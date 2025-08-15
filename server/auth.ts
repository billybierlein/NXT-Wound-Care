import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { sendNewSalesRepNotification, sendWelcomeEmailToSalesRep } from "./notifications";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}



export function setupAuth(app: Express) {
  // Session configuration
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !user.isActive) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          const isValidPassword = await comparePasswords(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Auth routes
  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    res.json({ user: req.user, message: "Login successful" });
  });



  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Invitation-based registration route
  app.post("/api/auth/register/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { firstName, lastName, password } = req.body;

      if (!firstName || !lastName || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Validate invitation token
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create user
      const hashedPassword = await hashPassword(password);
      const newUser = await storage.createUser({
        email: invitation.email,
        firstName,
        lastName,
        password: hashedPassword,
        role: invitation.role,
        salesRepName: `${firstName} ${lastName}`,
      });

      // If the role is sales_rep, also create a sales rep entry
      if (invitation.role === 'sales_rep') {
        await storage.createSalesRep({
          name: `${firstName} ${lastName}`,
          email: invitation.email,
          commissionRate: 10.0, // Default commission rate
          isActive: true,
        });

        // Send notification to admin about new sales rep registration
        try {
          // Get admin email from database
          const adminUsers = await storage.getAdminUsers();
          const adminEmail = adminUsers.length > 0 ? adminUsers[0].email : "admin@nxtmedical.us";
          
          await sendNewSalesRepNotification({
            salesRepName: `${firstName} ${lastName}`,
            salesRepEmail: invitation.email,
            registrationDate: new Date()
          }, adminEmail);
          console.log(`Admin notification sent for new sales rep: ${firstName} ${lastName} to ${adminEmail}`);
        } catch (notificationError) {
          console.error("Failed to send admin notification:", notificationError);
          // Don't fail the registration if notification fails
        }

        // Send welcome email to the new sales rep
        try {
          await sendWelcomeEmailToSalesRep(`${firstName} ${lastName}`, invitation.email);
          console.log(`Welcome email sent to new sales rep: ${firstName} ${lastName}`);
        } catch (welcomeError) {
          console.error("Failed to send welcome email:", welcomeError);
          // Don't fail the registration if welcome email fails
        }
      }

      // Mark invitation as used
      await storage.markInvitationAsUsed(token);

      // Auto-login the new user
      req.login(newUser, (err) => {
        if (err) {
          console.error("Auto-login error:", err);
          return res.status(201).json({ 
            user: newUser, 
            message: "Registration successful, please login" 
          });
        }
        res.status(201).json({ 
          user: req.user, 
          message: "Registration and login successful" 
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Admin routes for invitation management
  app.post("/api/auth/invitations", requireAuth, async (req, res) => {
    try {
      if ((req.user as any)?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { email, role = 'sales_rep' } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const invitation = await storage.createInvitation(
        { email, role },
        (req.user as any).id
      );

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Create invitation error:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/auth/invitations", requireAuth, async (req, res) => {
    try {
      if ((req.user as any)?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const invitations = await storage.getInvitations((req.user as any).id);
      res.json(invitations);
    } catch (error) {
      console.error("Get invitations error:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.delete("/api/auth/invitations/:id", requireAuth, async (req, res) => {
    try {
      if ((req.user as any)?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const success = await storage.deleteInvitation(parseInt(id));
      
      if (success) {
        res.json({ message: "Invitation deleted successfully" });
      } else {
        res.status(404).json({ message: "Invitation not found" });
      }
    } catch (error) {
      console.error("Delete invitation error:", error);
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });

  // Get invitation details by token (for registration page)
  app.get("/api/auth/invitation/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invalid or expired invitation" });
      }

      // Return only safe information
      res.json({
        email: invitation.email,
        role: invitation.role,
        valid: true
      });
    } catch (error) {
      console.error("Get invitation error:", error);
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });
}

// Auth middleware
export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export { hashPassword, comparePasswords };