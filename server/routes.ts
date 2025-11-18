import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, type DashboardMetrics } from "./storage";
import { setupAuth, requireAuth, requireAdmin, sanitizeUser } from "./auth";
import { MailService } from '@sendgrid/mail';
import { 
  insertPatientSchema, 
  insertPatientTreatmentSchema, 
  insertProviderSchema, 
  insertReferralSourceSchema, 
  insertReferralSourceTimelineEventSchema,
  insertSurgicalCommissionSchema,
  insertTreatmentCommissionSchema,
  type SalesRep
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { askChatGPT, getWoundAssessment, getTreatmentProtocol, generateEducationalContent } from "./openai";
import { db } from "./db";
import { patientTreatments, treatmentCommissions, salesReps, users, providers, pipelineNotes, surgicalCommissions, referralFiles } from "@shared/schema";
import { eq, and, or, desc, inArray, isNotNull, isNull, gte, lt } from "drizzle-orm";
import { resolveSalesRepIdForUser } from "./lib/resolveSalesRep";
import { getActiveGrafts, validateGraftData } from "@shared/constants/grafts";

// Initialize SendGrid
const mailService = new MailService();

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupAuth(app);
  
  // Explicit API root handler to prevent SPA fallback
  app.get('/api', (req, res) => res.json({ ok: true, message: 'API is running' }));

  // Health check for graft data (verifies centralized graft constants are loaded)
  app.get('/api/health/grafts', (req, res) => {
    try {
      const activeGrafts = getActiveGrafts();
      const validation = validateGraftData();
      
      res.json({ 
        ok: true, 
        count: activeGrafts.length,
        totalGrafts: activeGrafts.length,
        validation: validation.valid ? 'passed' : 'failed',
        errors: validation.errors,
        quarter: activeGrafts[0]?.quarter || 'unknown',
        year: activeGrafts[0]?.year || 'unknown'
      });
    } catch (error) {
      console.error("Error checking graft data:", error);
      res.status(500).json({ ok: false, message: "Failed to check graft data" });
    }
  });

  // Test route for authenticated user
  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      res.json(sanitizeUser(req.user));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Me endpoint for role-based access control
  app.get('/api/me', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const salesRepId = await resolveSalesRepIdForUser(user.id);
      
      res.json({ 
        ok: true, 
        data: { 
          id: user.id, 
          role: user.role, 
          salesRepId: salesRepId || null 
        } 
      });
    } catch (error) {
      console.error("Error fetching me data:", error);
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });

  // Change password endpoint
  app.post('/api/auth/change-password', requireAuth, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters long" });
      }

      const success = await storage.changeUserPassword(req.user.id, currentPassword, newPassword);
      
      if (!success) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Commissions metrics API with role-based scoping
  app.get('/api/metrics/commissions', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const isAdmin = user.role === "admin";
      const myRepId = await resolveSalesRepIdForUser(user.id);

      // Treatment commissions calculations
      const treatmentCommissionsQuery = db.select().from(treatmentCommissions);
      const treatmentCommissionsData = await (myRepId && !isAdmin 
        ? treatmentCommissionsQuery.where(eq(treatmentCommissions.salesRepId, myRepId))
        : treatmentCommissionsQuery);

      const treatmentCommissionTotal = treatmentCommissionsData.reduce((sum, tc) => 
        sum + parseFloat(tc.commissionAmount || "0"), 0);

      // Surgical commissions calculations (admin + Nash only)
      let surgicalPaid = 0;
      let surgicalPending = 0;
      
      // Nash (nash@nxtmedical.us) is the surgical sales rep who should see surgical commission data
      const isNash = user.email === 'nash@nxtmedical.us';
      
      if (isAdmin || isNash) {
        const surgicalCommissionsQuery = db.select().from(surgicalCommissions);
        const surgicalCommissionsData = await surgicalCommissionsQuery;

        surgicalPaid = surgicalCommissionsData
          .filter(sc => sc.status === 'paid')
          .reduce((sum, sc) => sum + (parseFloat(sc.sale || "0") * parseFloat(sc.commissionRate || "0") / 100), 0);

        surgicalPending = surgicalCommissionsData
          .filter(sc => sc.status === 'owed')
          .reduce((sum, sc) => sum + (parseFloat(sc.sale || "0") * parseFloat(sc.commissionRate || "0") / 100), 0);
      }

      // Patient treatments commission data (for additional context)
      const patientTreatmentsQuery = db.select().from(patientTreatments);
      const patientTreatmentsData = await (myRepId && !isAdmin
        ? patientTreatmentsQuery.where(eq(patientTreatments.userId, user.id))
        : patientTreatmentsQuery);

      const treatmentCommissionsPaid = patientTreatmentsData
        .filter(pt => pt.commissionPaymentDate)
        .reduce((sum, pt) => sum + parseFloat(pt.salesRepCommission || "0"), 0);

      const treatmentCommissionsPending = patientTreatmentsData
        .filter(pt => !pt.commissionPaymentDate)
        .reduce((sum, pt) => sum + parseFloat(pt.salesRepCommission || "0"), 0);

      // Combine totals
      const totalPaid = surgicalPaid + treatmentCommissionsPaid;
      const totalPending = surgicalPending + treatmentCommissionsPending;

      // Only compute NXT share for admin
      let nxtShare: number | null = null;
      if (isAdmin) {
        nxtShare = patientTreatmentsData.reduce((sum, pt) => 
          sum + parseFloat(pt.nxtCommission || "0"), 0);
      }

      res.json({
        ok: true,
        data: { 
          scope: isAdmin ? "all" : "self", 
          repId: myRepId || null, 
          totalPaid, 
          totalPending, 
          nxtShare 
        }
      });
    } catch (error) {
      console.error("Error fetching commissions metrics:", error);
      res.status(500).json({ message: "Failed to fetch commissions metrics" });
    }
  });

  // ChatGPT integration endpoint
  app.post('/api/chat', requireAuth, async (req: any, res) => {
    try {
      const { question } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ message: "Question is required" });
      }

      const response = await askChatGPT(question);
      res.json({ response });
    } catch (error) {
      console.error("ChatGPT API error:", error);
      res.status(500).json({ message: "Failed to get response from ChatGPT" });
    }
  });

  // Wound assessment endpoint
  app.post('/api/wound-assessment', requireAuth, async (req: any, res) => {
    try {
      const { woundDescription, patientInfo } = req.body;
      
      if (!woundDescription || typeof woundDescription !== 'string') {
        return res.status(400).json({ message: "Wound description is required" });
      }

      const assessment = await getWoundAssessment(woundDescription, patientInfo);
      res.json({ assessment });
    } catch (error) {
      console.error("Wound assessment API error:", error);
      res.status(500).json({ message: "Failed to generate wound assessment" });
    }
  });

  // Treatment protocol endpoint
  app.post('/api/treatment-protocol', requireAuth, async (req: any, res) => {
    try {
      const { woundType, severity } = req.body;
      
      if (!woundType || !severity) {
        return res.status(400).json({ message: "Wound type and severity are required" });
      }

      const protocol = await getTreatmentProtocol(woundType, severity);
      res.json({ protocol });
    } catch (error) {
      console.error("Treatment protocol API error:", error);
      res.status(500).json({ message: "Failed to generate treatment protocol" });
    }
  });

  // Educational content generation endpoint
  app.post('/api/generate-education', requireAuth, async (req: any, res) => {
    try {
      const { 
        woundType, 
        patientAge, 
        treatmentStage, 
        complications, 
        additionalNotes, 
        contentType,
        patientName,
        providerId,
        salesRepId
      } = req.body;
      
      if (!woundType || !treatmentStage || !contentType) {
        return res.status(400).json({ message: "Wound type, treatment stage, and content type are required" });
      }

      // Fetch provider information if providerId is provided
      let providerInfo = undefined;
      if (providerId) {
        try {
          const provider = await storage.getProviderById(parseInt(providerId));
          if (provider) {
            providerInfo = {
              name: provider.name,
              email: provider.email || undefined,
              phone: provider.phoneNumber || undefined,
              npiNumber: provider.npiNumber || undefined
            };
          }
        } catch (error) {
          console.warn("Could not fetch provider information:", error);
        }
      }

      // Fetch sales rep information if salesRepId is provided
      let salesRepInfo = undefined;
      if (salesRepId) {
        try {
          const salesRep = await storage.getSalesRepById(parseInt(salesRepId));
          if (salesRep) {
            salesRepInfo = {
              name: salesRep.name,
              email: salesRep.email || undefined,
              phoneNumber: salesRep.phoneNumber || undefined,
              commissionRate: typeof salesRep.commissionRate === 'string' ? parseFloat(salesRep.commissionRate) : salesRep.commissionRate || undefined
            };
          }
        } catch (error) {
          console.warn("Could not fetch sales rep information:", error);
        }
      }

      const content = await generateEducationalContent({
        woundType,
        patientAge,
        treatmentStage,
        complications,
        additionalNotes,
        contentType,
        patientName,
        providerId,
        providerInfo,
        salesRepId,
        salesRepInfo
      });
      
      res.json({ content });
    } catch (error) {
      console.error("Educational content generation API error:", error);
      res.status(500).json({ message: "Failed to generate educational content" });
    }
  });

  // Dashboard Metrics endpoint
  app.get('/api/dashboard/metrics', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      
      const metrics = await storage.getDashboardMetrics(userId, userEmail);
      res.json(metrics);
    } catch (error) {
      console.error("Dashboard metrics API error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Patient routes
  app.post('/api/patients', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validation = insertPatientSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const patient = await storage.createPatient(validation.data, userId);
      
      // Create initial timeline event for patient creation
      await storage.createPatientTimelineEvent({
        patientId: patient.id,
        eventType: 'created',
        title: 'Patient Created',
        description: `Patient ${patient.firstName} ${patient.lastName} was added to the system`,
        eventDate: new Date(),
        userId: userId
      });
      
      res.json(patient);
    } catch (error) {
      console.error("Error creating patient:", error);
      res.status(500).json({ message: "Failed to create patient" });
    }
  });

  app.get('/api/patients', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const { search, salesRep, referralSource } = req.query;
      
      const patients = await storage.searchPatients(
        userId,
        search as string,
        salesRep as string,
        referralSource as string,
        userEmail
      );
      res.json(patients);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  // Get all treatments for a user (for dashboard statistics)
  app.get('/api/treatments', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const treatments = await storage.getAllTreatments(userId, userEmail);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching treatments:", error);
      res.status(500).json({ message: "Failed to fetch treatments" });
    }
  });

  // Get all treatments for all users (admin dashboard)
  app.get('/api/treatments/all', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const treatments = await storage.getAllTreatments(userId, userEmail);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching all treatments:", error);
      res.status(500).json({ message: "Failed to fetch treatments" });
    }
  });

  app.get('/api/patients/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patient = await storage.getPatientById(parseInt(req.params.id), userId, userEmail);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  app.put('/api/patients/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const validation = insertPatientSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const patient = await storage.updatePatient(parseInt(req.params.id), validation.data, userId, userEmail);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error updating patient:", error);
      res.status(500).json({ message: "Failed to update patient" });
    }
  });

  app.delete('/api/patients/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const success = await storage.deletePatient(parseInt(req.params.id), userId, userEmail);
      
      if (!success) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      res.json({ message: "Patient deleted successfully" });
    } catch (error) {
      console.error("Error deleting patient:", error);
      res.status(500).json({ message: "Failed to delete patient" });
    }
  });

  // CSV export endpoint
  app.get('/api/patients/export/csv', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const { search, salesRep, referralSource } = req.query;
      
      const patients = await storage.searchPatients(
        userId,
        search as string,
        salesRep as string,
        referralSource as string,
        userEmail
      );
      
      // Create CSV headers
      const csvHeaders = [
        'First Name',
        'Last Name', 
        'Date of Birth',
        'Phone Number',
        'Insurance',
        'Custom Insurance',
        'Referral Source',
        'Sales Rep',
        'Wound Type',
        'Wound Size (sq cm)',
        'Patient Status',
        'Notes',
        'Created At'
      ];
      
      // Create CSV rows
      const csvRows = patients.map(patient => [
        patient.firstName,
        patient.lastName,
        patient.dateOfBirth,
        patient.phoneNumber,
        patient.insurance,
        patient.customInsurance || '',
        patient.referralSource,
        patient.salesRep,
        patient.woundType || '',
        patient.woundSize || '',
        patient.patientStatus || '',
        patient.notes || '',
        patient.createdAt?.toISOString().split('T')[0] || ''
      ]);
      
      // Combine headers and rows
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="patients.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting patients to CSV:", error);
      res.status(500).json({ message: "Failed to export patients to CSV" });
    }
  });

  // Sales Rep routes
  app.get('/api/sales-reps', requireAuth, async (req: any, res) => {
    try {
      const salesReps = await storage.getSalesReps();
      res.json(salesReps);
    } catch (error) {
      console.error("Error fetching sales reps:", error);
      res.status(500).json({ message: "Failed to fetch sales reps" });
    }
  });

  app.post('/api/sales-reps', requireAuth, async (req: any, res) => {
    try {
      const salesRepData = req.body;
      const salesRep = await storage.createSalesRep(salesRepData);
      res.status(201).json(salesRep);
    } catch (error) {
      console.error("Error creating sales rep:", error);
      res.status(500).json({ message: "Failed to create sales rep" });
    }
  });

  app.get('/api/sales-reps/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid sales rep ID" });
      }
      const salesRep = await storage.getSalesRepById(id);
      if (!salesRep) {
        return res.status(404).json({ message: "Sales rep not found" });
      }
      res.json(salesRep);
    } catch (error) {
      console.error("Error fetching sales rep:", error);
      res.status(500).json({ message: "Failed to fetch sales rep" });
    }
  });

  app.put('/api/sales-reps/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid sales rep ID" });
      }
      const salesRepData = req.body;
      const salesRep = await storage.updateSalesRep(id, salesRepData);
      if (!salesRep) {
        return res.status(404).json({ message: "Sales rep not found" });
      }
      res.json(salesRep);
    } catch (error) {
      console.error("Error updating sales rep:", error);
      res.status(500).json({ message: "Failed to update sales rep" });
    }
  });

  app.delete('/api/sales-reps/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid sales rep ID" });
      }
      const success = await storage.deleteSalesRep(id);
      if (!success) {
        return res.status(404).json({ message: "Sales rep not found" });
      }
      res.json({ message: "Sales rep deleted successfully" });
    } catch (error) {
      console.error("Error deleting sales rep:", error);
      res.status(500).json({ message: "Failed to delete sales rep" });
    }
  });

  app.get('/api/sales-reps/commissions', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const salesReps = await storage.getSalesReps();
      const treatments = await storage.getAllTreatments(userId, userEmail);
      
      const commissionData = await Promise.all(salesReps.map(async (salesRep) => {
        // Get treatments for this sales rep's patients
        const salesRepTreatments = treatments.filter(treatment => {
          return treatment.salesRep === salesRep.name;
        });

        const totalCommission = salesRepTreatments.reduce((sum, treatment) => {
          const revenue = parseFloat(treatment.totalRevenue || '0');
          const commissionRate = parseFloat(salesRep.commissionRate?.toString() || '0') / 100;
          return sum + (revenue * commissionRate);
        }, 0);

        const pendingCommission = salesRepTreatments
          .filter(treatment => treatment.status === 'Active')
          .reduce((sum, treatment) => {
            const revenue = parseFloat(treatment.totalRevenue || '0');
            const commissionRate = parseFloat(salesRep.commissionRate?.toString() || '0') / 100;
            return sum + (revenue * commissionRate);
          }, 0);

        return {
          salesRepId: salesRep.id,
          salesRepName: salesRep.name,
          salesRepEmail: salesRep.email,
          commissionRate: salesRep.commissionRate,
          patientCount: salesRepTreatments.length,
          treatmentCount: salesRepTreatments.length,
          totalCommission: totalCommission,
          pendingCommission: pendingCommission,
          status: salesRep.isActive ? 'Active' : 'Inactive'
        };
      }));

      res.json(commissionData);
    } catch (error) {
      console.error("Error fetching sales rep commissions:", error);
      res.status(500).json({ message: "Failed to fetch sales rep commissions" });
    }
  });

  // Debug endpoint to check commission data counts
  app.get('/api/commission-reports/_debug-count', async (req, res) => {
    try {
      const userId = 2; // Admin user for testing
      const userEmail = "billy@nxtmedical.us";
      
      // Count multi-rep records (treatment_commissions)
      const treatments = await storage.getAllTreatments(userId, userEmail);
      const multiRepCount = treatments.filter(t => 
        ['paid', 'closed'].includes(t.invoiceStatus) && 
        t.paidAt
      ).length;
      
      // Count treatments with commissions
      let treatmentsWithCommissions = 0;
      for (const treatment of treatments) {
        const commissions = await storage.getTreatmentCommissions(treatment.id);
        if (commissions.length > 0) {
          treatmentsWithCommissions++;
        }
      }
      
      // Count legacy single-rep records (treatments without commissions)
      const legacyCount = multiRepCount - treatmentsWithCommissions;
      
      res.json({
        multi_rep: treatmentsWithCommissions,
        legacy: legacyCount >= 0 ? legacyCount : 0,
        total_paid_treatments: multiRepCount
      });
    } catch (error) {
      console.error("Debug count error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Commission reports endpoint - unified view of multi-rep and legacy single-rep commissions using paid_at
  app.get('/api/commission-reports', requireAuth, async (req: any, res) => {
    // Disable caching during debugging to prevent 304 responses
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      const { from, to, repId, repName } = req.query as any;
      
      // Build shared predicates - drive reports by commissionPaymentDate, keep paidAt as guard
      const guards = and(
        inArray(patientTreatments.invoiceStatus, ['paid', 'closed']),
        isNotNull(patientTreatments.paidAt),
        isNotNull(patientTreatments.commissionPaymentDate)
      );
      
      const windowPred = from && to 
        ? and(gte(patientTreatments.commissionPaymentDate, from), lt(patientTreatments.commissionPaymentDate, to))
        : undefined;
      
      // Multi-rep rows: LEFT JOIN to prevent ghost exclusions
      const multiRep = await db
        .select({
          treatmentId: patientTreatments.id,
          invoiceNo: patientTreatments.invoiceNo,
          invoiceDate: patientTreatments.invoiceDate,
          invoiceStatus: patientTreatments.invoiceStatus,
          invoiceTotal: patientTreatments.invoiceTotal,
          paymentDate: patientTreatments.paymentDate,
          commissionPaymentDate: patientTreatments.commissionPaymentDate,
          paidAt: patientTreatments.paidAt,
          aczPayDate: patientTreatments.aczPayDate,
          repId: treatmentCommissions.salesRepId,
          repName: treatmentCommissions.salesRepName,
          commissionRate: treatmentCommissions.commissionRate,
          commissionAmount: treatmentCommissions.commissionAmount,
        })
        .from(patientTreatments)
        .leftJoin(
          treatmentCommissions,
          eq(patientTreatments.id, treatmentCommissions.treatmentId)
        )
        .where(and(
          guards,
          windowPred,
          // ensure multi-rep branch only returns rows when commission actually exists
          isNotNull(treatmentCommissions.id),
          // branch-specific rep filters
          !repId ? undefined : eq(treatmentCommissions.salesRepId, Number(repId)),
          !repName ? undefined : eq(treatmentCommissions.salesRepName, repName),
        ))
        .orderBy(desc(patientTreatments.commissionPaymentDate), desc(patientTreatments.id));

      // Legacy rows: explicitly mutually exclusive (no commission assignments)
      const legacy = await db
        .select({
          treatmentId: patientTreatments.id,
          invoiceNo: patientTreatments.invoiceNo,
          invoiceDate: patientTreatments.invoiceDate,
          invoiceStatus: patientTreatments.invoiceStatus,
          invoiceTotal: patientTreatments.invoiceTotal,
          paymentDate: patientTreatments.paymentDate,
          commissionPaymentDate: patientTreatments.commissionPaymentDate,
          paidAt: patientTreatments.paidAt,
          aczPayDate: patientTreatments.aczPayDate,
          repId: salesReps.id,
          repName: salesReps.name,
          commissionRate: patientTreatments.salesRepCommissionRate,
        })
        .from(patientTreatments)
        .leftJoin(
          treatmentCommissions,
          eq(treatmentCommissions.treatmentId, patientTreatments.id)
        )
        .leftJoin(salesReps, eq(salesReps.name, patientTreatments.salesRep))
        .where(and(
          guards,
          windowPred,
          // explicitly legacy-only: no commission rows exist
          isNull(treatmentCommissions.id),
          // legacy rep filters reference salesReps.*
          !repId ? undefined : eq(salesReps.id, Number(repId)),
          !repName ? undefined : eq(salesReps.name, repName),
        ))
        .orderBy(desc(patientTreatments.commissionPaymentDate), desc(patientTreatments.id));

      // Normalize and combine results
      const normalized = [
        ...multiRep.map(r => ({
          treatmentId: r.treatmentId,
          invoiceNo: r.invoiceNo,
          invoiceDate: r.invoiceDate,
          invoiceStatus: r.invoiceStatus,
          invoiceTotal: Number(r.invoiceTotal),
          paymentDate: r.paymentDate,
          commissionPaymentDate: r.commissionPaymentDate,
          paidAt: r.paidAt,
          aczPayDate: r.aczPayDate,
          repId: r.repId,
          repName: r.repName,
          commissionRate: Number(r.commissionRate),
          commissionAmount: Number(r.commissionAmount),
          isLegacy: false
        })),
        ...legacy.map(r => ({
          treatmentId: r.treatmentId,
          invoiceNo: r.invoiceNo,
          invoiceDate: r.invoiceDate,
          invoiceStatus: r.invoiceStatus,
          invoiceTotal: Number(r.invoiceTotal),
          paymentDate: r.paymentDate,
          commissionPaymentDate: r.commissionPaymentDate,
          paidAt: r.paidAt,
          aczPayDate: r.aczPayDate,
          repId: r.repId,
          repName: r.repName,
          commissionRate: Number(r.commissionRate),
          commissionAmount: Number((Number(r.invoiceTotal) * Number(r.commissionRate) / 100).toFixed(2)),
          isLegacy: true
        })),
      ].sort((a,b) => {
        const dateA = a.commissionPaymentDate ? new Date(a.commissionPaymentDate).getTime() : 0;
        const dateB = b.commissionPaymentDate ? new Date(b.commissionPaymentDate).getTime() : 0;
        return dateB - dateA || (b.treatmentId - a.treatmentId);
      });

      res.json(normalized);
    } catch (error) {
      console.error("Error fetching commission reports:", error);
      res.status(500).json({ message: "Failed to fetch commission reports" });
    }
  });
  
  // Debug endpoint for troubleshooting specific treatments
  app.get('/api/commission-reports/_debug-one/:id', requireAuth, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      
      // Get treatment with commission assignments
      const [treatment] = await db
        .select()
        .from(patientTreatments)
        .where(eq(patientTreatments.id, id));
        
      const commissions = treatment ? await db
        .select()
        .from(treatmentCommissions)
        .where(eq(treatmentCommissions.treatmentId, id)) : [];
      
      if (!treatment) {
        return res.json({ ok: false, message: 'No treatment found' });
      }
      
      const reasons: string[] = [];
      if (!['paid','closed'].includes((treatment.invoiceStatus || '').toLowerCase())) {
        reasons.push('invoiceStatus not paid/closed');
      }
      if (!treatment.paidAt) reasons.push('paidAt is NULL');
      if (!treatment.commissionPaymentDate) reasons.push('commissionPaymentDate is NULL');
      
      // Check if has active commission assignments  
      const hasAssignments = commissions.length > 0 && commissions.some((c: any) => 
        (Number(c.commissionRate) ?? 0) > 0
      );
      
      // Simulate eligibility for both paths
      const eligibleByDates = !!(treatment.paidAt && treatment.commissionPaymentDate);
      const eligibleByStatus = ['paid','closed'].includes((treatment.invoiceStatus || '').toLowerCase());
      
      const legacyEligible = !hasAssignments && eligibleByDates && eligibleByStatus;
      const multiEligible = hasAssignments && eligibleByDates && eligibleByStatus;
      
      res.json({
        ok: true,
        treatment: {
          id: treatment.id,
          invoiceNo: treatment.invoiceNo,
          invoiceStatus: treatment.invoiceStatus,
          paidAt: treatment.paidAt,
          commissionPaymentDate: treatment.commissionPaymentDate,
          salesRepLegacy: treatment.salesRep,
        },
        hasAssignments,
        commissions: commissions,
        eligible: { legacyEligible, multiEligible },
        guardsPass: reasons.length === 0,
        reasonsIfExcluded: reasons,
      });
    } catch (error) {
      console.error("Error in debug endpoint:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Timeline routes
  app.get('/api/patients/:patientId/timeline', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = parseInt(req.params.patientId);
      const events = await storage.getPatientTimelineEvents(patientId, userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching timeline events:", error);
      res.status(500).json({ message: "Failed to fetch timeline events" });
    }
  });

  app.post('/api/patients/:patientId/timeline', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const firstName = req.user.firstName;
      const lastName = req.user.lastName;
      const patientId = parseInt(req.params.patientId);
      const timelineData = req.body;
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Ensure eventDate is a proper Date object
      if (timelineData.eventDate && typeof timelineData.eventDate === 'string') {
        timelineData.eventDate = new Date(timelineData.eventDate);
      }
      
      // Add username to the event data
      const username = firstName && lastName ? `${firstName} ${lastName}` : userEmail;
      
      const event = await storage.createPatientTimelineEvent({
        ...timelineData,
        patientId,
        userId,
        createdBy: username
      });
      
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating timeline event:", error);
      res.status(500).json({ message: "Failed to create timeline event" });
    }
  });

  app.put('/api/patients/:patientId/timeline/:eventId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const eventId = parseInt(req.params.eventId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Ensure eventDate is a proper Date object
      const updateData = req.body;
      if (updateData.eventDate && typeof updateData.eventDate === 'string') {
        updateData.eventDate = new Date(updateData.eventDate);
      }
      
      const event = await storage.updatePatientTimelineEvent(eventId, updateData, userId);
      if (!event) {
        return res.status(404).json({ message: "Timeline event not found" });
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error updating timeline event:", error);
      res.status(500).json({ message: "Failed to update timeline event" });
    }
  });

  app.delete('/api/patients/:patientId/timeline/:eventId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const eventId = parseInt(req.params.eventId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      const success = await storage.deletePatientTimelineEvent(eventId, userId);
      if (!success) {
        return res.status(404).json({ message: "Timeline event not found" });
      }
      
      res.json({ message: "Timeline event deleted successfully" });
    } catch (error) {
      console.error("Error deleting timeline event:", error);
      res.status(500).json({ message: "Failed to delete timeline event" });
    }
  });

  // Treatment routes
  app.get('/api/patients/:patientId/treatments', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const treatments = await storage.getPatientTreatments(patientId, userId, userEmail);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching treatments:", error);
      res.status(500).json({ message: "Failed to fetch treatments" });
    }
  });

  app.post('/api/patients/:patientId/treatments', requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      
      // Verify patient belongs to user and has IVR approved status
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      if (patient.patientStatus?.toLowerCase() !== 'ivr approved') {
        return res.status(400).json({ message: "Patient must have IVR approved status for treatments" });
      }
      
      // Prepare treatment data with proper date handling for different field types
      const treatmentData = {
        ...req.body,
        patientId,
        userId,
        referralSourceId: patient.referralSourceId || null
      };
      
      console.log('Original treatmentDate from frontend:', treatmentData.treatmentDate, typeof treatmentData.treatmentDate);
      
      // Convert treatmentDate string to Date object (timestamp field requires Date object)
      // Parse as local time to prevent timezone conversion issues
      if (treatmentData.treatmentDate && typeof treatmentData.treatmentDate === 'string') {
        // Remove the T00:00:00 part and parse as YYYY-MM-DD to avoid timezone issues
        const dateOnly = treatmentData.treatmentDate.split('T')[0];
        treatmentData.treatmentDate = new Date(dateOnly + 'T12:00:00'); // Use noon to avoid timezone edge cases
        console.log('Converted treatmentDate to Date object:', treatmentData.treatmentDate);
      }
      
      // Handle invoiceDate and payableDate with same noon logic as treatmentDate to prevent timezone issues
      if (treatmentData.invoiceDate && typeof treatmentData.invoiceDate === 'string') {
        const dateOnly = treatmentData.invoiceDate.split('T')[0];
        treatmentData.invoiceDate = new Date(dateOnly + 'T12:00:00'); // Use noon to avoid timezone edge cases
        console.log('Converted invoiceDate to Date object:', treatmentData.invoiceDate);
      }
      
      if (treatmentData.payableDate && typeof treatmentData.payableDate === 'string') {
        const dateOnly = treatmentData.payableDate.split('T')[0];
        treatmentData.payableDate = new Date(dateOnly + 'T12:00:00'); // Use noon to avoid timezone edge cases
        console.log('Converted payableDate to Date object:', treatmentData.payableDate);
      }
      
      const validation = insertPatientTreatmentSchema.safeParse(treatmentData);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const treatment = await storage.createPatientTreatment(validation.data);
      
      // Handle commission assignments if provided (multi-rep support)
      if (req.body.commissionAssignments && Array.isArray(req.body.commissionAssignments)) {
        console.log("Creating commission assignments:", req.body.commissionAssignments);
        
        // Create commission records for each assigned sales rep
        for (const assignment of req.body.commissionAssignments) {
          if (assignment.salesRepId && assignment.commissionRate) {
            try {
              await storage.createTreatmentCommission({
                treatmentId: treatment.id,
                salesRepId: parseInt(assignment.salesRepId),
                salesRepName: assignment.salesRepName,
                commissionRate: assignment.commissionRate.toString(),
                commissionAmount: assignment.commissionAmount || '0'
              });
              console.log(`Created commission for sales rep ${assignment.salesRepId}: ${assignment.commissionRate}%`);
            } catch (commissionError) {
              console.error("Error creating commission assignment:", commissionError);
              // Don't fail the entire treatment creation if commission creation fails
            }
          }
        }
      }
      
      res.status(201).json(treatment);
    } catch (error: any) {
      console.error("Error creating treatment:", error);
      
      // Handle duplicate invoice number error
      if (error.code === '23505' && error.detail && error.detail.includes('invoice_no')) {
        return res.status(400).json({ message: "Duplicate invoice number. Please use a different invoice number." });
      }
      
      res.status(500).json({ message: "Failed to create treatment" });
    }
  });

  app.put('/api/patients/:patientId/treatments/:treatmentId', requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const treatmentId = parseInt(req.params.treatmentId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Prepare treatment data with proper date handling for different field types
      const treatmentData = req.body;
      
      console.log('UPDATE - Original treatmentDate from frontend:', treatmentData.treatmentDate, typeof treatmentData.treatmentDate);
      
      // Convert treatmentDate string to Date object (timestamp field requires Date object)
      // Parse as local time to prevent timezone conversion issues
      if (treatmentData.treatmentDate && typeof treatmentData.treatmentDate === 'string') {
        // Remove the T00:00:00 part and parse as YYYY-MM-DD to avoid timezone issues
        const dateOnly = treatmentData.treatmentDate.split('T')[0];
        treatmentData.treatmentDate = new Date(dateOnly + 'T12:00:00'); // Use noon to avoid timezone edge cases
        console.log('UPDATE - Converted treatmentDate to Date object:', treatmentData.treatmentDate);
      }
      
      // Handle invoiceDate and payableDate with same noon logic as treatmentDate to prevent timezone issues
      if (treatmentData.invoiceDate && typeof treatmentData.invoiceDate === 'string') {
        const dateOnly = treatmentData.invoiceDate.split('T')[0];
        treatmentData.invoiceDate = new Date(dateOnly + 'T12:00:00'); // Use noon to avoid timezone edge cases
        console.log('UPDATE - Converted invoiceDate to Date object:', treatmentData.invoiceDate);
      }
      
      if (treatmentData.payableDate && typeof treatmentData.payableDate === 'string') {
        const dateOnly = treatmentData.payableDate.split('T')[0];
        treatmentData.payableDate = new Date(dateOnly + 'T12:00:00'); // Use noon to avoid timezone edge cases
        console.log('UPDATE - Converted payableDate to Date object:', treatmentData.payableDate);
      }
      
      const validation = insertPatientTreatmentSchema.partial().safeParse(treatmentData);
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }
      
      const treatment = await storage.updatePatientTreatment(treatmentId, validation.data, userId, userEmail);
      if (!treatment) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      // Handle commission assignments if provided (multi-rep support)
      if (req.body.commissionAssignments && Array.isArray(req.body.commissionAssignments)) {
        console.log("Updating commission assignments:", req.body.commissionAssignments);
        
        // First, delete existing commission assignments for this treatment
        try {
          await storage.deleteTreatmentCommissionsByTreatmentId(treatmentId);
          console.log(`Deleted existing commissions for treatment ${treatmentId}`);
        } catch (deleteError) {
          console.error("Error deleting existing commission assignments:", deleteError);
          // Continue - we'll still try to create new ones
        }
        
        // Create new commission records for each assigned sales rep
        for (const assignment of req.body.commissionAssignments) {
          if (assignment.salesRepId && assignment.commissionRate) {
            try {
              await storage.createTreatmentCommission({
                treatmentId: treatment.id,
                salesRepId: parseInt(assignment.salesRepId),
                salesRepName: assignment.salesRepName,
                commissionRate: assignment.commissionRate.toString(),
                commissionAmount: assignment.commissionAmount || '0'
              });
              console.log(`Updated commission for sales rep ${assignment.salesRepId}: ${assignment.commissionRate}%`);
            } catch (commissionError) {
              console.error("Error creating commission assignment:", commissionError);
              // Don't fail the entire treatment update if commission creation fails
            }
          }
        }
      }
      
      res.json(treatment);
    } catch (error) {
      console.error("Error updating treatment:", error);
      res.status(500).json({ message: "Failed to update treatment" });
    }
  });

  app.delete('/api/patients/:patientId/treatments/:treatmentId', requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const treatmentId = parseInt(req.params.treatmentId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      const deleted = await storage.deletePatientTreatment(treatmentId, userId, userEmail);
      if (!deleted) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json({ message: "Treatment deleted successfully" });
    } catch (error) {
      console.error("Error deleting treatment:", error);
      res.status(500).json({ message: "Failed to delete treatment" });
    }
  });

  // Direct treatment deletion endpoint for treatments page
  app.delete('/api/treatments/:treatmentId', requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const treatmentId = parseInt(req.params.treatmentId);
      
      const deleted = await storage.deletePatientTreatment(treatmentId, userId, userEmail);
      if (!deleted) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json({ message: "Treatment deleted successfully" });
    } catch (error) {
      console.error("Error deleting treatment:", error);
      res.status(500).json({ message: "Failed to delete treatment" });
    }
  });

  // Update treatment status endpoint (inline editing)
  app.put('/api/treatments/:treatmentId/status', requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const treatmentId = parseInt(req.params.treatmentId);
      const updateData = req.body;
      
      // Only allow status, invoiceStatus, and paymentDate updates
      const allowedFields = ['status', 'invoiceStatus', 'paymentDate'];
      const filteredData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {} as any);
      
      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const treatment = await storage.updatePatientTreatment(treatmentId, filteredData, userId, userEmail);
      if (!treatment) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json(treatment);
    } catch (error) {
      console.error("Error updating treatment status:", error);
      res.status(500).json({ message: "Failed to update treatment status" });
    }
  });

  // Update treatment commission payment date endpoint
  app.patch('/api/treatments/:treatmentId/commission-payment-date', requireAdmin, async (req: any, res) => {
    try {
      const treatmentId = parseInt(req.params.treatmentId);
      const { commissionPaymentDate } = req.body;
      
      // Validate input - should be a date string or null
      if (commissionPaymentDate !== null && commissionPaymentDate !== undefined && typeof commissionPaymentDate !== 'string') {
        return res.status(400).json({ message: "Commission payment date must be a date string or null" });
      }
      
      // Validate date format if provided (YYYY-MM-DD)
      if (commissionPaymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(commissionPaymentDate)) {
        return res.status(400).json({ message: "Commission payment date must be in YYYY-MM-DD format" });
      }
      
      const treatment = await storage.updateTreatmentCommissionPaymentDate(treatmentId, commissionPaymentDate);
      if (!treatment) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json(treatment);
    } catch (error) {
      console.error("Error updating commission payment date:", error);
      res.status(500).json({ message: "Failed to update commission payment date" });
    }
  });

  // Update treatment ACZ pay date endpoint
  app.patch('/api/treatments/:treatmentId/reppaymentdate', requireAdmin, async (req: any, res) => {
    try {
      const treatmentId = parseInt(req.params.treatmentId);
      const { aczPayDate } = req.body;
      
      // Validate input - should be a date string or null
      if (aczPayDate !== null && aczPayDate !== undefined && typeof aczPayDate !== 'string') {
        return res.status(400).json({ message: "Rep payment date must be a date string or null" });
      }
      
      // Validate date format if provided (YYYY-MM-DD)
      if (aczPayDate && !/^\d{4}-\d{2}-\d{2}$/.test(aczPayDate)) {
        return res.status(400).json({ message: "Rep payment date must be in YYYY-MM-DD format" });
      }
      
      const treatment = await storage.updateTreatmentRepPaymentDate(treatmentId, aczPayDate);
      if (!treatment) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json(treatment);
    } catch (error) {
      console.error("Error updating rep payment date:", error);
      res.status(500).json({ message: "Failed to update rep payment date" });
    }
  });

  // Provider routes
  app.get('/api/providers', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const providers = await storage.getProviders(userId, userEmail);
      res.json(providers);
    } catch (error) {
      console.error("Error fetching providers:", error);
      res.status(500).json({ message: "Failed to fetch providers" });
    }
  });

  app.get('/api/providers/stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const providersWithStats = await storage.getProviderStats(userId, userEmail);
      res.json(providersWithStats);
    } catch (error) {
      console.error("Error fetching provider stats:", error);
      res.status(500).json({ message: "Failed to fetch provider stats" });
    }
  });

  app.get('/api/providers/:id', requireAuth, async (req: any, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const provider = await storage.getProviderById(providerId);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.json(provider);
    } catch (error) {
      console.error("Error fetching provider:", error);
      res.status(500).json({ message: "Failed to fetch provider" });
    }
  });

  app.post('/api/providers', requireAuth, async (req: any, res) => {
    try {
      const validation = insertProviderSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const provider = await storage.createProvider(validation.data);
      
      // Auto-assign the creating sales rep to the provider if user is a sales rep
      const user = req.user;
      if (user.role === 'sales_rep') {
        // Find the sales rep by email
        const salesReps = await storage.getSalesReps();
        const salesRep = salesReps.find(sr => sr.email === user.email);
        if (salesRep) {
          await storage.assignSalesRepToProvider(provider.id, salesRep.id);
        }
      }
      
      res.json(provider);
    } catch (error) {
      console.error("Error creating provider:", error);
      res.status(500).json({ message: "Failed to create provider" });
    }
  });

  app.put('/api/providers/:id', requireAuth, async (req: any, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const validation = insertProviderSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const provider = await storage.updateProvider(providerId, validation.data);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      res.json(provider);
    } catch (error) {
      console.error("Error updating provider:", error);
      res.status(500).json({ message: "Failed to update provider" });
    }
  });

  app.delete('/api/providers/:id', requireAuth, async (req: any, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const deleted = await storage.deleteProvider(providerId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      res.json({ message: "Provider deleted successfully" });
    } catch (error) {
      console.error("Error deleting provider:", error);
      res.status(500).json({ message: "Failed to delete provider" });
    }
  });

  // Provider Sales Rep assignment routes
  app.get('/api/providers/:id/sales-reps', requireAuth, async (req: any, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const salesReps = await storage.getProviderSalesReps(providerId);
      res.json(salesReps);
    } catch (error) {
      console.error("Error fetching provider sales reps:", error);
      res.status(500).json({ message: "Failed to fetch provider sales reps" });
    }
  });

  app.post('/api/providers/:id/sales-reps/:salesRepId', requireAuth, async (req: any, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const salesRepId = parseInt(req.params.salesRepId);
      const assignment = await storage.assignSalesRepToProvider(providerId, salesRepId);
      res.status(201).json(assignment);
    } catch (error: any) {
      console.error("Error assigning sales rep to provider:", error);
      
      // Handle duplicate assignment
      if (error.code === '23505') {
        return res.status(409).json({ message: "Sales rep is already assigned to this provider" });
      }
      
      res.status(500).json({ message: "Failed to assign sales rep to provider" });
    }
  });

  app.delete('/api/providers/:id/sales-reps/:salesRepId', requireAuth, async (req: any, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const salesRepId = parseInt(req.params.salesRepId);
      const removed = await storage.removeSalesRepFromProvider(providerId, salesRepId);
      
      if (!removed) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      res.json({ message: "Sales rep removed from provider successfully" });
    } catch (error) {
      console.error("Error removing sales rep from provider:", error);
      res.status(500).json({ message: "Failed to remove sales rep from provider" });
    }
  });


  // Alternative route for treatment invoice status updates
  // General PATCH endpoint for treatment updates
  app.patch('/api/treatments/:id', requireAdmin, async (req: any, res) => {
    try {
      const treatmentId = parseInt(req.params.id);
      const userId = req.user.id;
      const userEmail = req.user.email;
      const updateData = req.body;
      
      // Allow specific fields for updates
      const allowedFields = ['paymentDate', 'paidAt', 'invoiceStatus', 'status', 'notes'];
      const filteredData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {} as any);
      
      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const treatment = await storage.updatePatientTreatment(treatmentId, filteredData, userId, userEmail);
      if (!treatment) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json(treatment);
    } catch (error) {
      console.error("Error updating treatment:", error);
      res.status(500).json({ message: "Failed to update treatment" });
    }
  });

  app.patch('/api/treatments/:id/invoice-status', requireAdmin, async (req: any, res) => {
    try {
      const treatmentId = parseInt(req.params.id);
      const { invoiceStatus, paymentDate } = req.body;
      
      if (!['open', 'payable', 'closed'].includes(invoiceStatus)) {
        return res.status(400).json({ message: "Invalid status. Must be 'open', 'payable', or 'closed'" });
      }
      
      const treatment = await storage.updateTreatmentInvoiceStatus(treatmentId, invoiceStatus, paymentDate);
      
      if (!treatment) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json(treatment);
    } catch (error) {
      console.error("Error updating treatment invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  // Referral Source routes
  app.get('/api/referral-sources', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const referralSources = await storage.getReferralSources(userId, userEmail);
      res.json(referralSources);
    } catch (error) {
      console.error("Error fetching referral sources:", error);
      res.status(500).json({ message: "Failed to fetch referral sources" });
    }
  });

  app.get('/api/referral-sources/stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const referralSourcesWithStats = await storage.getReferralSourceStats(userId, userEmail);
      res.json(referralSourcesWithStats);
    } catch (error) {
      console.error("Error fetching referral source stats:", error);
      res.status(500).json({ message: "Failed to fetch referral source stats" });
    }
  });

  app.get('/api/referral-sources/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const referralSource = await storage.getReferralSourceById(id);
      if (!referralSource) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      res.json(referralSource);
    } catch (error) {
      console.error("Error fetching referral source:", error);
      res.status(500).json({ message: "Failed to fetch referral source" });
    }
  });

  app.post('/api/referral-sources', requireAuth, async (req: any, res) => {
    try {
      const validation = insertReferralSourceSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const referralSource = await storage.createReferralSource(validation.data);
      
      // Auto-assign creating sales rep to the referral source
      const userId = req.user.id;
      const userRole = (req.user as any)?.role;
      
      if (userRole === 'sales_rep') {
        try {
          await storage.assignSalesRepToReferralSource(referralSource.id, userId);
          console.log(`Auto-assigned sales rep ${userId} to referral source ${referralSource.id}`);
        } catch (assignError) {
          console.error("Failed to auto-assign sales rep to referral source:", assignError);
          // Don't fail the referral source creation if assignment fails
        }
      }
      
      res.json(referralSource);
    } catch (error) {
      console.error("Error creating referral source:", error);
      res.status(500).json({ message: "Failed to create referral source" });
    }
  });

  app.put('/api/referral-sources/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const validation = insertReferralSourceSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const referralSource = await storage.updateReferralSource(id, validation.data);
      if (!referralSource) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      
      res.json(referralSource);
    } catch (error) {
      console.error("Error updating referral source:", error);
      res.status(500).json({ message: "Failed to update referral source" });
    }
  });

  app.delete('/api/referral-sources/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteReferralSource(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      
      res.json({ message: "Referral source deleted successfully. Any associated patients have been marked as 'Unassigned' and treatments have been unlinked for reassignment." });
    } catch (error) {
      console.error("Error deleting referral source:", error);
      res.status(500).json({ message: "Failed to delete referral source" });
    }
  });

  // Referral Source Contact routes
  app.get('/api/referral-sources/:referralSourceId/contacts', requireAuth, async (req: any, res) => {
    try {
      const referralSourceId = parseInt(req.params.referralSourceId);
      const contacts = await storage.getReferralSourceContacts(referralSourceId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching referral source contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post('/api/referral-sources/:referralSourceId/contacts', requireAuth, async (req: any, res) => {
    try {
      const referralSourceId = parseInt(req.params.referralSourceId);
      const contactData = req.body;
      
      // Verify referral source exists
      const referralSource = await storage.getReferralSourceById(referralSourceId);
      if (!referralSource) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      
      const contact = await storage.createReferralSourceContact({
        ...contactData,
        referralSourceId,
      });
      
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating referral source contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.put('/api/referral-sources/:referralSourceId/contacts/:contactId', requireAuth, async (req: any, res) => {
    try {
      const referralSourceId = parseInt(req.params.referralSourceId);
      const contactId = parseInt(req.params.contactId);
      const contactData = req.body;
      
      // Verify referral source exists
      const referralSource = await storage.getReferralSourceById(referralSourceId);
      if (!referralSource) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      
      const contact = await storage.updateReferralSourceContact(contactId, contactData);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Error updating referral source contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete('/api/referral-sources/:referralSourceId/contacts/:contactId', requireAuth, async (req: any, res) => {
    try {
      const referralSourceId = parseInt(req.params.referralSourceId);
      const contactId = parseInt(req.params.contactId);
      
      // Verify referral source exists
      const referralSource = await storage.getReferralSourceById(referralSourceId);
      if (!referralSource) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      
      const success = await storage.deleteReferralSourceContact(contactId);
      if (!success) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      console.error("Error deleting referral source contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Referral Source Timeline routes
  app.get('/api/referral-sources/:referralSourceId/timeline', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const referralSourceId = parseInt(req.params.referralSourceId);
      const events = await storage.getReferralSourceTimelineEvents(referralSourceId, userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching referral source timeline events:", error);
      res.status(500).json({ message: "Failed to fetch timeline events" });
    }
  });

  app.post('/api/referral-sources/:referralSourceId/timeline', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const firstName = req.user.firstName;
      const lastName = req.user.lastName;
      const referralSourceId = parseInt(req.params.referralSourceId);
      const timelineData = req.body;
      
      // Verify referral source exists
      const referralSource = await storage.getReferralSourceById(referralSourceId);
      if (!referralSource) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      
      // Ensure eventDate is a proper Date object
      if (timelineData.eventDate && typeof timelineData.eventDate === 'string') {
        timelineData.eventDate = new Date(timelineData.eventDate);
      }
      
      // Add username to the event data
      const username = firstName && lastName ? `${firstName} ${lastName}` : userEmail;
      
      const event = await storage.createReferralSourceTimelineEvent({
        ...timelineData,
        referralSourceId,
        userId,
        createdBy: username
      });
      
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating referral source timeline event:", error);
      res.status(500).json({ message: "Failed to create timeline event" });
    }
  });

  app.put('/api/referral-sources/:referralSourceId/timeline/:eventId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const referralSourceId = parseInt(req.params.referralSourceId);
      const eventId = parseInt(req.params.eventId);
      
      // Verify referral source exists
      const referralSource = await storage.getReferralSourceById(referralSourceId);
      if (!referralSource) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      
      // Ensure eventDate is a proper Date object
      const updateData = req.body;
      if (updateData.eventDate && typeof updateData.eventDate === 'string') {
        updateData.eventDate = new Date(updateData.eventDate);
      }
      
      const event = await storage.updateReferralSourceTimelineEvent(eventId, updateData, userId);
      if (!event) {
        return res.status(404).json({ message: "Timeline event not found" });
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error updating referral source timeline event:", error);
      res.status(500).json({ message: "Failed to update timeline event" });
    }
  });

  app.delete('/api/referral-sources/:referralSourceId/timeline/:eventId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const referralSourceId = parseInt(req.params.referralSourceId);
      const eventId = parseInt(req.params.eventId);
      
      // Verify referral source exists
      const referralSource = await storage.getReferralSourceById(referralSourceId);
      if (!referralSource) {
        return res.status(404).json({ message: "Referral source not found" });
      }
      
      const success = await storage.deleteReferralSourceTimelineEvent(eventId, userId);
      if (!success) {
        return res.status(404).json({ message: "Timeline event not found" });
      }
      
      res.json({ message: "Timeline event deleted successfully" });
    } catch (error) {
      console.error("Error deleting referral source timeline event:", error);
      res.status(500).json({ message: "Failed to delete timeline event" });
    }
  });

  app.get('/api/referral-sources/:referralSourceId/treatments', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const referralSourceId = parseInt(req.params.referralSourceId);
      const treatments = await storage.getReferralSourceTreatments(referralSourceId, userId);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching referral source treatments:", error);
      res.status(500).json({ message: "Failed to fetch treatments" });
    }
  });

  // Referral Source Sales Rep assignment routes
  app.get('/api/referral-sources/:id/sales-reps', requireAuth, async (req: any, res) => {
    try {
      const referralSourceId = parseInt(req.params.id);
      const salesReps = await storage.getReferralSourceSalesReps(referralSourceId);
      res.json(salesReps);
    } catch (error) {
      console.error("Error fetching referral source sales reps:", error);
      res.status(500).json({ message: "Failed to fetch referral source sales reps" });
    }
  });

  app.post('/api/referral-sources/:id/sales-reps/:salesRepId', requireAuth, async (req: any, res) => {
    try {
      const referralSourceId = parseInt(req.params.id);
      const salesRepId = parseInt(req.params.salesRepId);
      
      const assignment = await storage.assignSalesRepToReferralSource(referralSourceId, salesRepId);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning sales rep to referral source:", error);
      if ((error as Error).message?.includes('duplicate')) {
        res.status(409).json({ message: "Sales rep is already assigned to this referral source" });
      } else {
        res.status(500).json({ message: "Failed to assign sales rep to referral source" });
      }
    }
  });

  app.delete('/api/referral-sources/:id/sales-reps/:salesRepId', requireAuth, async (req: any, res) => {
    try {
      const referralSourceId = parseInt(req.params.id);
      const salesRepId = parseInt(req.params.salesRepId);
      
      const success = await storage.removeSalesRepFromReferralSource(referralSourceId, salesRepId);
      if (success) {
        res.json({ message: "Sales rep removed from referral source successfully" });
      } else {
        res.status(404).json({ message: "Assignment not found" });
      }
    } catch (error) {
      console.error("Error removing sales rep from referral source:", error);
      res.status(500).json({ message: "Failed to remove sales rep from referral source" });
    }
  });

  // Order submission email endpoint
  app.post('/api/submit-order', requireAuth, async (req: any, res) => {
    try {
      const { orderData, pdfBase64 } = req.body;
      
      console.log("SendGrid API key exists:", !!process.env.SENDGRID_API_KEY);
      console.log("SendGrid API key length:", process.env.SENDGRID_API_KEY?.length);
      
      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ message: "Email service not configured" });
      }

      if (!orderData || !pdfBase64) {
        return res.status(400).json({ message: "Order data and PDF are required" });
      }

      // Create email content
      const emailHtml = `
        <h2>New Order Submission</h2>
        <h3>Shipping Information</h3>
        <p><strong>Facility Name:</strong> ${orderData.facilityName}</p>
        <p><strong>Contact Name:</strong> ${orderData.shippingContactName}</p>
        <p><strong>Address:</strong> ${orderData.shippingAddress}</p>
        <p><strong>Phone:</strong> ${orderData.phoneNumber}</p>
        <p><strong>Email:</strong> ${orderData.emailAddress}</p>
        <p><strong>Date of Case:</strong> ${orderData.dateOfCase}</p>
        <p><strong>Product Arrival:</strong> ${orderData.productArrivalDateTime}</p>
        
        <h3>Order Details</h3>
        <p><strong>Purchase Order Number:</strong> ${orderData.purchaseOrderNumber}</p>
        <p><strong>Grand Total:</strong> ${orderData.grandTotal}</p>
        
        <h3>Items Ordered</h3>
        <ul>
          ${orderData.orderItems.map((item: any) => `
            <li>
              <strong>Product Code:</strong> ${item.productCode}<br>
              <strong>Graft:</strong> ${item.graftName}${item.graftSize ? ` (${item.graftSize})` : ''}<br>
              <strong>Quantity:</strong> ${item.quantity}<br>
              <strong>Total Cost:</strong> ${item.totalCost}
            </li>
          `).join('')}
        </ul>
        
        <p>Order form PDF is attached.</p>
      `;

      // Prepare recipient list
      const recipients = ['billy@nxtmedical.us', 'ernest@nxtmedical.us'];
      if (orderData.emailAddress && orderData.emailAddress.trim()) {
        recipients.push(orderData.emailAddress.trim());
      }

      const msg = {
        to: recipients,
        from: 'info@nxtmedical.us', // Verified sender
        subject: `New Order Submission - ${orderData.facilityName} - PO# ${orderData.purchaseOrderNumber}`,
        html: emailHtml,
        attachments: [
          {
            content: pdfBase64,
            filename: `Order_Form_${orderData.facilityName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ]
      };

      // Set API key fresh each time
      mailService.setApiKey(process.env.SENDGRID_API_KEY);
      
      console.log("Attempting to send email with SendGrid...");
      await mailService.send(msg);
      console.log("Email sent successfully!");
      res.json({ message: "Order submitted successfully" });
      
    } catch (error: any) {
      console.error("Error submitting order:", error);
      if (error.response && error.response.body && error.response.body.errors) {
        console.error("SendGrid error details:", JSON.stringify(error.response.body.errors, null, 2));
      }
      res.status(500).json({ 
        message: "Failed to submit order",
        details: error.response?.body?.errors || error.message
      });
    }
  });

  // Public order submission endpoint (no authentication required)
  app.post('/api/submit-order-public', async (req: any, res) => {
    try {
      const { orderData, pdfBase64 } = req.body;
      
      console.log("SendGrid API key exists:", !!process.env.SENDGRID_API_KEY);
      console.log("SendGrid API key length:", process.env.SENDGRID_API_KEY?.length);
      
      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ message: "Email service not configured" });
      }

      if (!orderData || !pdfBase64) {
        return res.status(400).json({ message: "Order data and PDF are required" });
      }

      // Create email content
      const emailHtml = `
        <h2>New Public Order Submission</h2>
        <h3>Shipping Information</h3>
        <p><strong>Facility Name:</strong> ${orderData.facilityName}</p>
        <p><strong>Contact Name:</strong> ${orderData.shippingContactName}</p>
        <p><strong>Address:</strong> ${orderData.shippingAddress}</p>
        <p><strong>Phone:</strong> ${orderData.phoneNumber}</p>
        <p><strong>Email:</strong> ${orderData.emailAddress}</p>
        <p><strong>Date of Case:</strong> ${orderData.dateOfCase}</p>
        <p><strong>Product Arrival:</strong> ${orderData.productArrivalDateTime}</p>
        
        <h3>Order Details</h3>
        <p><strong>Purchase Order Number:</strong> ${orderData.purchaseOrderNumber || 'Not provided'}</p>
        <p><strong>Grand Total:</strong> ${orderData.grandTotal}</p>
        
        <h3>Items Ordered</h3>
        <ul>
          ${orderData.orderItems.map((item: any) => `
            <li>
              <strong>Product Code:</strong> ${item.productCode}<br>
              <strong>Graft:</strong> ${item.graftName}${item.graftSize ? ` (${item.graftSize})` : ''}<br>
              <strong>Quantity:</strong> ${item.quantity}<br>
              <strong>Total Cost:</strong> ${item.totalCost}
            </li>
          `).join('')}
        </ul>
        
        <p><em>This order was submitted through the public order form.</em></p>
        <p>Order form PDF is attached.</p>
      `;

      // Prepare recipient list
      const recipients = ['billy@nxtmedical.us', 'ernest@nxtmedical.us'];
      if (orderData.emailAddress && orderData.emailAddress.trim()) {
        recipients.push(orderData.emailAddress.trim());
      }

      const msg = {
        to: recipients,
        from: 'info@nxtmedical.us', // Verified sender
        subject: `New Public Order Submission - ${orderData.facilityName} - PO# ${orderData.purchaseOrderNumber || 'N/A'}`,
        html: emailHtml,
        attachments: [
          {
            content: pdfBase64,
            filename: `Public_Order_Form_${orderData.facilityName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ]
      };

      // Set API key fresh each time
      mailService.setApiKey(process.env.SENDGRID_API_KEY);
      
      console.log("Attempting to send public order email with SendGrid...");
      await mailService.send(msg);
      console.log("Public order email sent successfully!");
      res.json({ message: "Order submitted successfully" });
      
    } catch (error: any) {
      console.error("Error submitting public order:", error);
      if (error.response && error.response.body && error.response.body.errors) {
        console.error("SendGrid error details:", JSON.stringify(error.response.body.errors, null, 2));
      }
      res.status(500).json({ 
        message: "Failed to submit order",
        details: error.response?.body?.errors || error.message
      });
    }
  });

  // Surgical Commissions endpoints
  app.get('/api/surgical-commissions', requireAuth, async (req: any, res) => {
    try {
      const commissions = await storage.getSurgicalCommissions();
      res.json(commissions);
    } catch (error) {
      console.error("Error fetching surgical commissions:", error);
      res.status(500).json({ message: "Failed to fetch surgical commissions" });
    }
  });

  app.post('/api/surgical-commissions', requireAuth, async (req: any, res) => {
    try {
      console.log("Received surgical commission data:", JSON.stringify(req.body, null, 2));
      const validatedData = insertSurgicalCommissionSchema.parse(req.body);
      console.log("Validated data:", JSON.stringify(validatedData, null, 2));
      const commission = await storage.createSurgicalCommission(validatedData);
      res.status(201).json(commission);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("Validation error:", error.errors);
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation failed", 
          details: validationError.message,
          errors: error.errors
        });
      }
      console.error("Error creating surgical commission:", error);
      res.status(500).json({ message: "Failed to create surgical commission" });
    }
  });

  app.put('/api/surgical-commissions/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid commission ID" });
      }
      
      const validatedData = insertSurgicalCommissionSchema.partial().parse(req.body);
      const commission = await storage.updateSurgicalCommission(id, validatedData);
      
      if (!commission) {
        return res.status(404).json({ message: "Surgical commission not found" });
      }
      
      res.json(commission);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation failed", 
          details: validationError.message 
        });
      }
      console.error("Error updating surgical commission:", error);
      res.status(500).json({ message: "Failed to update surgical commission" });
    }
  });

  app.delete('/api/surgical-commissions/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid commission ID" });
      }
      
      const success = await storage.deleteSurgicalCommission(id);
      if (!success) {
        return res.status(404).json({ message: "Surgical commission not found" });
      }
      
      res.json({ message: "Surgical commission deleted successfully" });
    } catch (error) {
      console.error("Error deleting surgical commission:", error);
      res.status(500).json({ message: "Failed to delete surgical commission" });
    }
  });

  // Treatment Commission routes
  app.get('/api/treatment-commissions/:treatmentId', requireAuth, async (req: any, res) => {
    try {
      const treatmentId = parseInt(req.params.treatmentId);
      if (isNaN(treatmentId)) {
        return res.status(400).json({ message: "Invalid treatment ID" });
      }
      
      // First, try to get multi-rep commission data
      let commissions = await storage.getTreatmentCommissions(treatmentId);
      
      // If no multi-rep commissions found, check for legacy commission data
      if (commissions.length === 0) {
        console.log(`No multi-rep commissions found for treatment ${treatmentId}, checking legacy data...`);
        
        // Get the treatment to check for legacy commission data
        const treatments = await storage.getAllTreatments(req.user.id, req.user.email);
        const treatment = treatments.find(t => t.id === treatmentId);
        
        if (treatment && treatment.salesRep && treatment.salesRepCommissionRate) {
          console.log(`Found legacy commission data: ${treatment.salesRep} at ${treatment.salesRepCommissionRate}%`);
          
          // Find the sales rep ID by name
          const salesReps = await storage.getSalesReps();
          const salesRep = salesReps.find(rep => rep.name === treatment.salesRep);
          
          // Convert legacy data to multi-rep format
          const legacyCommission = {
            id: treatmentId, // Use treatmentId as a temporary ID
            treatmentId: treatmentId,
            salesRepId: salesRep?.id || 0,
            salesRepName: treatment.salesRep,
            commissionRate: parseFloat(treatment.salesRepCommissionRate?.toString() || "0"),
            commissionAmount: treatment.salesRepCommission ? parseFloat(treatment.salesRepCommission.toString()) : 0,
            createdAt: treatment.treatmentDate || new Date(),
            updatedAt: treatment.treatmentDate || new Date()
          };
          
          commissions = [legacyCommission];
          console.log(`Converted legacy commission:`, legacyCommission);
        } else {
          console.log(`No legacy commission data found for treatment ${treatmentId}`);
        }
      } else {
        console.log(`Found ${commissions.length} multi-rep commissions for treatment ${treatmentId}`);
      }
      
      res.json(commissions);
    } catch (error) {
      console.error("Error fetching treatment commissions:", error);
      res.status(500).json({ message: "Failed to fetch treatment commissions" });
    }
  });

  app.post('/api/treatment-commissions', requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertTreatmentCommissionSchema.parse(req.body);
      const commission = await storage.createTreatmentCommission(validatedData);
      res.status(201).json(commission);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation failed", 
          details: validationError.message 
        });
      }
      console.error("Error creating treatment commission:", error);
      res.status(500).json({ message: "Failed to create treatment commission" });
    }
  });

  app.put('/api/treatment-commissions/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid commission ID" });
      }
      
      const validatedData = insertTreatmentCommissionSchema.partial().parse(req.body);
      const commission = await storage.updateTreatmentCommission(id, validatedData);
      
      if (!commission) {
        return res.status(404).json({ message: "Treatment commission not found" });
      }
      
      res.json(commission);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation failed", 
          details: validationError.message 
        });
      }
      console.error("Error updating treatment commission:", error);
      res.status(500).json({ message: "Failed to update treatment commission" });
    }
  });

  app.delete('/api/treatment-commissions/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid commission ID" });
      }
      
      const success = await storage.deleteTreatmentCommission(id);
      if (!success) {
        return res.status(404).json({ message: "Treatment commission not found" });
      }
      
      res.json({ message: "Treatment commission deleted successfully" });
    } catch (error) {
      console.error("Error deleting treatment commission:", error);
      res.status(500).json({ message: "Failed to delete treatment commission" });
    }
  });

  app.delete('/api/treatment-commissions/treatment/:treatmentId', requireAuth, async (req: any, res) => {
    try {
      const treatmentId = parseInt(req.params.treatmentId);
      if (isNaN(treatmentId)) {
        return res.status(400).json({ message: "Invalid treatment ID" });
      }
      
      const success = await storage.deleteTreatmentCommissionsByTreatmentId(treatmentId);
      res.json({ message: success ? "Treatment commissions deleted successfully" : "No commissions found for treatment" });
    } catch (error) {
      console.error("Error deleting treatment commissions:", error);
      res.status(500).json({ message: "Failed to delete treatment commissions" });
    }
  });

  // Pipeline Notes routes - updated with proper visibility and filtering
  app.get('/api/pipeline-notes', requireAuth, async (req: any, res) => {
    try {
      const { repId, providerId } = req.query as { repId?: string; providerId?: string };
      const isAdmin = req.user.role === 'admin';
      const userId = req.user.id;
      
      // Get current user's sales rep ID using resolver
      const mySalesRepId = await resolveSalesRepIdForUser(userId);

      // Build filters array
      const filters = [];
      if (repId) filters.push(eq(pipelineNotes.assignedSalesRepId, Number(repId)));
      if (providerId) filters.push(eq(pipelineNotes.providerId, Number(providerId)));

      // Build visibility condition
      let visibilityCondition;
      if (isAdmin) {
        visibilityCondition = undefined; // Admin sees all
      } else {
        // Sales rep sees: entries they created OR entries assigned to them
        const conditions = [eq(pipelineNotes.createdByUserId, userId)];
        if (mySalesRepId) {
          conditions.push(eq(pipelineNotes.assignedSalesRepId, mySalesRepId));
        }
        visibilityCondition = or(...conditions);
      }

      // Combine all conditions
      const whereConditions = [visibilityCondition, ...filters].filter(Boolean);
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Query with joins to get rep and provider names
      const notes = await db
        .select({
          id: pipelineNotes.id,
          patient: pipelineNotes.patient,
          assignedSalesRepId: pipelineNotes.assignedSalesRepId,
          assignedSalesRepName: salesReps.name,
          providerId: pipelineNotes.providerId,
          providerName: providers.name,
          woundSize: pipelineNotes.woundSize,
          nextUpdate: pipelineNotes.nextUpdate,
          notes: pipelineNotes.notes,
          createdByUserId: pipelineNotes.createdByUserId,
          sortOrder: pipelineNotes.sortOrder,
          createdAt: pipelineNotes.createdAt,
          updatedAt: pipelineNotes.updatedAt,
        })
        .from(pipelineNotes)
        .leftJoin(salesReps, eq(pipelineNotes.assignedSalesRepId, salesReps.id))
        .leftJoin(providers, eq(pipelineNotes.providerId, providers.id))
        .where(whereClause)
        .orderBy(desc(pipelineNotes.updatedAt));

      res.json({ ok: true, data: notes });
    } catch (error: any) {
      console.error("Error fetching pipeline notes:", error);
      res.status(500).json({ ok: false, message: "Failed to fetch pipeline notes", details: error.message });
    }
  });

  app.post('/api/pipeline-notes', requireAuth, async (req: any, res) => {
    try {
      const isAdmin = req.user.role === 'admin';
      const userId = req.user.id;
      
      // Get current user's sales rep ID using resolver
      const mySalesRepId = await resolveSalesRepIdForUser(userId);

      const { patient, assignedSalesRepId, providerId, woundSize, nextUpdate, notes } = req.body;

      if (!patient) {
        return res.status(400).json({ ok: false, message: "Patient is required" });
      }

      // Admin can assign to any rep, sales rep gets assigned to themselves
      const repForSave = isAdmin ? (assignedSalesRepId ?? null) : (mySalesRepId ?? null);

      // Error if sales rep user isn't linked to a sales rep record
      if (!isAdmin && repForSave == null) {
        return res.status(400).json({
          ok: false,
          message: "Your user is not linked to a Sales Rep. Ask an admin to set users.sales_rep_id."
        });
      }

      const [inserted] = await db.insert(pipelineNotes).values({
        patient,
        assignedSalesRepId: repForSave,
        providerId: providerId ?? null,
        woundSize: woundSize ?? null,
        nextUpdate: nextUpdate ?? null,
        notes: notes ?? null,
        createdByUserId: userId,
      }).returning();

      res.status(201).json({ ok: true, data: inserted });
    } catch (error: any) {
      console.error("Error creating pipeline note:", error);
      res.status(500).json({ ok: false, message: "Failed to create note", details: error.message });
    }
  });

  app.patch('/api/pipeline-notes/:id', requireAuth, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ ok: false, message: "Invalid id" });
      }

      const isAdmin = req.user.role === 'admin';
      const userId = req.user.id;
      
      // Get current user's sales rep ID using resolver
      const mySalesRepId = await resolveSalesRepIdForUser(userId);

      // Check if note exists and user can edit it
      const [existingNote] = await db.select().from(pipelineNotes).where(eq(pipelineNotes.id, id));
      if (!existingNote) {
        return res.status(404).json({ ok: false, message: "Not found" });
      }

      const canEdit = isAdmin ||
        existingNote.createdByUserId === userId ||
        (mySalesRepId && existingNote.assignedSalesRepId === mySalesRepId);

      if (!canEdit) {
        return res.status(403).json({ ok: false, message: "Forbidden" });
      }

      // Admin can change assignment, sales reps cannot
      const { assignedSalesRepId, ...rest } = req.body ?? {};
      const updateData = isAdmin ? req.body : rest;

      const [updated] = await db.update(pipelineNotes)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(pipelineNotes.id, id))
        .returning();

      res.json({ ok: true, data: updated });
    } catch (error: any) {
      console.error("Error updating pipeline note:", error);
      res.status(500).json({ ok: false, message: "Failed to update note", details: error.message });
    }
  });

  app.delete('/api/pipeline-notes/:id', requireAuth, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ ok: false, message: "Invalid id" });
      }

      const isAdmin = req.user.role === 'admin';
      const userId = req.user.id;
      
      // Get current user's sales rep ID
      const [currentUser] = await db.select({ salesRepId: users.salesRepId })
        .from(users)
        .where(eq(users.id, userId));
      const mySalesRepId = currentUser?.salesRepId;

      // Check if note exists and user can delete it
      const [existingNote] = await db.select().from(pipelineNotes).where(eq(pipelineNotes.id, id));
      if (!existingNote) {
        return res.status(404).json({ ok: false, message: "Not found" });
      }

      const canDelete = isAdmin ||
        existingNote.createdByUserId === userId ||
        (mySalesRepId && existingNote.assignedSalesRepId === mySalesRepId);

      if (!canDelete) {
        return res.status(403).json({ ok: false, message: "Forbidden" });
      }

      await db.delete(pipelineNotes).where(eq(pipelineNotes.id, id));
      res.json({ ok: true, message: "Pipeline note deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting pipeline note:", error);
      res.status(500).json({ ok: false, message: "Failed to delete note", details: error.message });
    }
  });

  app.post('/api/pipeline-notes/reorder', requireAuth, async (req: any, res) => {
    try {
      const { noteUpdates } = req.body;
      await storage.updatePipelineNotesOrder(noteUpdates);
      res.json({ message: "Notes order updated successfully" });
    } catch (error) {
      console.error("Error reordering pipeline notes:", error);
      res.status(500).json({ message: "Failed to reorder pipeline notes" });
    }
  });

  // Patient Referrals routes
  app.get('/api/patient-referrals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const referrals = await storage.getPatientReferrals(userId, userEmail);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching patient referrals:", error);
      res.status(500).json({ message: "Failed to fetch patient referrals" });
    }
  });

  app.get('/api/patient-referrals/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const referral = await storage.getPatientReferralById(id);
      if (!referral) {
        return res.status(404).json({ message: "Referral not found" });
      }
      res.json(referral);
    } catch (error) {
      console.error("Error fetching patient referral:", error);
      res.status(500).json({ message: "Failed to fetch patient referral" });
    }
  });

  app.post('/api/patient-referrals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const referralData = { ...req.body, createdByUserId: userId };
      const newReferral = await storage.createPatientReferral(referralData);
      res.status(201).json(newReferral);
    } catch (error) {
      console.error("Error creating patient referral:", error);
      res.status(500).json({ message: "Failed to create patient referral" });
    }
  });

  app.patch('/api/patient-referrals/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedReferral = await storage.updatePatientReferral(id, req.body);
      if (!updatedReferral) {
        return res.status(404).json({ message: "Referral not found" });
      }
      res.json(updatedReferral);
    } catch (error) {
      console.error("Error updating patient referral:", error);
      res.status(500).json({ message: "Failed to update patient referral" });
    }
  });

  app.delete('/api/patient-referrals/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePatientReferral(id);
      if (!deleted) {
        return res.status(404).json({ message: "Referral not found" });
      }
      res.json({ message: "Referral deleted successfully" });
    } catch (error) {
      console.error("Error deleting patient referral:", error);
      res.status(500).json({ message: "Failed to delete patient referral" });
    }
  });

  app.patch('/api/patient-referrals/:id/archive', requireAuth, async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const userRole = req.user.role;

      // Get the referral to check ownership
      const referral = await storage.getPatientReferralById(id);
      if (!referral) {
        return res.status(404).json({ message: "Referral not found" });
      }

      // Check authorization: Only admins or assigned sales rep can archive
      if (userRole !== 'admin') {
        const user = await storage.getUserById(userId);
        if (!user || user.salesRepId !== referral.assignedSalesRepId) {
          return res.status(403).json({ message: "Not authorized to archive this referral" });
        }
      }

      const archived = await storage.archivePatientReferral(id);
      if (!archived) {
        return res.status(404).json({ message: "Failed to archive referral" });
      }
      res.json(archived);
    } catch (error) {
      console.error("Error archiving patient referral:", error);
      res.status(500).json({ message: "Failed to archive patient referral" });
    }
  });

  app.patch('/api/patient-referrals/:id/unarchive', requireAuth, async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const userRole = req.user.role;

      // Get the referral to check ownership
      const referral = await storage.getPatientReferralById(id);
      if (!referral) {
        return res.status(404).json({ message: "Referral not found" });
      }

      // Check authorization: Only admins or assigned sales rep can unarchive
      if (userRole !== 'admin') {
        const user = await storage.getUserById(userId);
        if (!user || user.salesRepId !== referral.assignedSalesRepId) {
          return res.status(403).json({ message: "Not authorized to unarchive this referral" });
        }
      }

      const unarchived = await storage.unarchivePatientReferral(id);
      if (!unarchived) {
        return res.status(404).json({ message: "Failed to unarchive referral" });
      }
      res.json(unarchived);
    } catch (error) {
      console.error("Error unarchiving patient referral:", error);
      res.status(500).json({ message: "Failed to unarchive patient referral" });
    }
  });

  // Kanban Workflow API endpoints
  // Simple PDF upload that creates referral + file in one step
  app.post('/api/referrals/upload', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { base64Data, fileName, fileSize, mimeType } = req.body;

      if (!base64Data || !fileName) {
        return res.status(400).json({ message: "File data and name are required" });
      }

      // Create referral record with minimal data
      const newReferral = await storage.createPatientReferral({
        createdByUserId: userId,
        assignedSalesRepId: req.user.salesRepId, // Auto-assign to uploader
        kanbanStatus: 'new',
        status: 'Active', // Keep legacy field in sync
      });

      // Save file to disk
      const buffer = Buffer.from(base64Data, 'base64');
      const uploadsDir = './uploads';
      const fs = await import('fs/promises');
      
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      const timestamp = Date.now();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${uploadsDir}/${timestamp}_${safeFileName}`;
      
      await fs.writeFile(filePath, buffer);

      // Create file record
      const fileRecord = await storage.createReferralFile({
        patientReferralId: newReferral.id,
        patientId: null,
        fileName,
        filePath,
        fileSize: fileSize || buffer.length,
        mimeType: mimeType || 'application/pdf',
        uploadedByUserId: userId,
      });

      // Send email notification
      const { sendNewReferralNotification } = await import('./notifications');
      await sendNewReferralNotification({
        uploadedByName: `${req.user.firstName} ${req.user.lastName}`,
        uploadedByEmail: req.user.email,
        fileName: fileName,
        uploadDate: new Date(),
        referralId: newReferral.id
      });

      res.status(201).json({ referral: newReferral, file: fileRecord });
    } catch (error) {
      console.error("Error uploading referral:", error);
      res.status(500).json({ message: "Failed to upload referral" });
    }
  });

  // Upload additional file to existing referral
  app.post('/api/referrals/:id/upload-file', requireAuth, async (req: any, res) => {
    try {
      const referralId = parseInt(req.params.id);
      const userId = req.user.id;
      const { base64Data, fileName, fileSize, mimeType } = req.body;

      if (!base64Data || !fileName) {
        return res.status(400).json({ message: "Missing file data or filename" });
      }

      // Check if referral exists
      const referral = await storage.getPatientReferralById(referralId);
      if (!referral) {
        return res.status(404).json({ message: "Referral not found" });
      }

      // Check authorization: user must be admin or assigned sales rep
      const isAdmin = req.user.role === 'admin';
      const currentSalesRepId = await resolveSalesRepIdForUser(userId);
      const isAssignedRep = 
        referral.assignedSalesRepId !== null && 
        currentSalesRepId !== null &&
        referral.assignedSalesRepId === currentSalesRepId;
      
      if (!isAdmin && !isAssignedRep) {
        return res.status(403).json({ message: "You can only upload files to referrals assigned to you" });
      }

      // Save file to disk
      const uploadsDir = path.join(process.cwd(), 'uploads', 'referrals');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const timestamp = Date.now();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = path.join(uploadsDir, `${timestamp}_${safeFileName}`);
      
      const buffer = Buffer.from(base64Data.replace(/^data:.*;base64,/, ''), 'base64');
      await fs.writeFile(filePath, buffer);

      // Create file record
      const fileRecord = await storage.createReferralFile({
        patientReferralId: referralId,
        patientId: null,
        fileName,
        filePath,
        fileSize: fileSize || buffer.length,
        mimeType: mimeType || 'application/pdf',
        uploadedByUserId: userId,
      });

      res.status(201).json(fileRecord);
    } catch (error) {
      console.error("Error uploading additional file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Update inline editable fields (sales reps can edit their own, admins can edit any)
  app.patch('/api/referrals/:id/inline', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check authorization: user must be admin or assigned sales rep
      const referral = await storage.getPatientReferralById(id);
      if (!referral) {
        return res.status(404).json({ message: "Referral not found" });
      }

      const isAdmin = req.user.role === 'admin';
      
      // Re-resolve current user's sales rep ID to prevent stale session data
      const currentSalesRepId = await resolveSalesRepIdForUser(req.user.id);
      
      // Sales rep can only edit if both IDs are valid numbers AND they match
      const isAssignedRep = 
        referral.assignedSalesRepId !== null && 
        currentSalesRepId !== null &&
        referral.assignedSalesRepId === currentSalesRepId;
      
      if (!isAdmin && !isAssignedRep) {
        return res.status(403).json({ message: "You can only edit referrals assigned to you" });
      }

      const { updatePatientReferralInlineSchema } = await import('@shared/schema');
      const validatedData = updatePatientReferralInlineSchema.parse(req.body);
      
      const updatedReferral = await storage.updatePatientReferral(id, validatedData);
      res.json(updatedReferral);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating referral inline fields:", error);
      res.status(500).json({ message: "Failed to update referral" });
    }
  });

  // Update kanban status (admin only)
  app.patch('/api/referrals/:id/status', requireAuth, async (req: any, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can change referral status" });
      }

      const id = parseInt(req.params.id);
      const { updatePatientReferralStatusSchema } = await import('@shared/schema');
      const { kanbanStatus } = updatePatientReferralStatusSchema.parse(req.body);
      
      // Keep legacy status in sync
      const legacyStatus = kanbanStatus === 'completed' ? 'Completed' : 
                          kanbanStatus === 'denied' ? 'Cancelled' : 'Active';
      
      const updatedReferral = await storage.updatePatientReferral(id, { 
        kanbanStatus,
        status: legacyStatus
      });
      
      if (!updatedReferral) {
        return res.status(404).json({ message: "Referral not found" });
      }
      res.json(updatedReferral);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating referral status:", error);
      res.status(500).json({ message: "Failed to update referral status" });
    }
  });

  // Create patient from approved referral
  app.post('/api/referrals/:id/create-patient', requireAuth, async (req: any, res) => {
    try {
      const referralId = parseInt(req.params.id);
      const referral = await storage.getPatientReferralById(referralId);
      
      if (!referral) {
        return res.status(404).json({ message: "Referral not found" });
      }

      if (referral.kanbanStatus !== 'approved') {
        return res.status(400).json({ message: "Only approved referrals can create patients" });
      }

      if (referral.patientId) {
        return res.status(400).json({ message: "Patient already created for this referral" });
      }

      // Patient data from request body (from add-patient form)
      const patientData = req.body;
      const newPatient = await storage.createPatient(patientData, req.user.id);

      // Attach referral PDF files to the new patient
      await storage.updateReferralFilesPatientId(referralId, newPatient.id);

      // Update referral to link patient and move to completed
      await storage.updatePatientReferral(referralId, {
        patientId: newPatient.id,
        kanbanStatus: 'completed',
        status: 'Completed'
      });

      res.status(201).json(newPatient);
    } catch (error) {
      console.error("Error creating patient from referral:", error);
      res.status(500).json({ message: "Failed to create patient" });
    }
  });

  // Referral Files routes
  app.get('/api/referral-files', requireAuth, async (req: any, res) => {
    try {
      const files = await db.select().from(referralFiles).orderBy(desc(referralFiles.createdAt));
      res.json(files);
    } catch (error) {
      console.error("Error fetching referral files:", error);
      res.status(500).json({ message: "Failed to fetch referral files" });
    }
  });

  app.get('/api/patients/:patientId/files', requireAuth, async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const files = await storage.getReferralFilesByPatientId(patientId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching patient files:", error);
      res.status(500).json({ message: "Failed to fetch patient files" });
    }
  });

  app.post('/api/referral-files', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { base64Data, fileName, fileSize, mimeType, patientReferralId, patientId } = req.body;

      if (!base64Data || !fileName) {
        return res.status(400).json({ message: "File data and name are required" });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const uploadsDir = './uploads';
      const fs = await import('fs/promises');
      
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      const timestamp = Date.now();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${uploadsDir}/${timestamp}_${safeFileName}`;
      
      await fs.writeFile(filePath, buffer);

      const fileRecord = await storage.createReferralFile({
        patientReferralId,
        patientId,
        fileName,
        filePath,
        fileSize: fileSize || buffer.length,
        mimeType: mimeType || 'application/pdf',
        uploadedByUserId: userId,
      });

      res.status(201).json(fileRecord);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get('/api/referral-files/:id/download', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getReferralFileById(id);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const fs = await import('fs/promises');
      const fileData = await fs.readFile(file.filePath);
      
      res.setHeader('Content-Type', file.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.send(fileData);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  app.delete('/api/referral-files/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getReferralFileById(id);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const fs = await import('fs/promises');
      try {
        await fs.unlink(file.filePath);
      } catch (error) {
        console.warn("Could not delete file from disk:", error);
      }

      await storage.deleteReferralFile(id);
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}