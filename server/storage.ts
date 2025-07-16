import {
  users,
  patients,
  salesReps,
  patientTimelineEvents,
  patientTreatments,
  type User,
  type UpsertUser,
  type Patient,
  type InsertPatient,
  type SalesRep,
  type InsertSalesRep,
  type PatientTimelineEvent,
  type InsertPatientTimelineEvent,
  type PatientTreatment,
  type InsertPatientTreatment,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations for local authentication
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Patient operations
  createPatient(patient: InsertPatient, userId: number): Promise<Patient>;
  getPatients(userId: number, userEmail?: string): Promise<Patient[]>;
  getPatientById(id: number, userId: number, userEmail?: string): Promise<Patient | undefined>;
  updatePatient(id: number, patient: Partial<InsertPatient>, userId: number, userEmail?: string): Promise<Patient | undefined>;
  deletePatient(id: number, userId: number, userEmail?: string): Promise<boolean>;
  searchPatients(userId: number, searchTerm?: string, salesRep?: string, referralSource?: string, userEmail?: string): Promise<Patient[]>;
  
  // Sales Rep operations
  createSalesRep(salesRep: InsertSalesRep): Promise<SalesRep>;
  getSalesReps(): Promise<SalesRep[]>;
  getSalesRepById(id: number): Promise<SalesRep | undefined>;
  updateSalesRep(id: number, salesRep: Partial<InsertSalesRep>): Promise<SalesRep | undefined>;
  deleteSalesRep(id: number): Promise<boolean>;
  
  // Patient Timeline operations
  createPatientTimelineEvent(event: InsertPatientTimelineEvent): Promise<PatientTimelineEvent>;
  getPatientTimelineEvents(patientId: number, userId: number): Promise<PatientTimelineEvent[]>;
  updatePatientTimelineEvent(id: number, event: Partial<InsertPatientTimelineEvent>, userId: number): Promise<PatientTimelineEvent | undefined>;
  deletePatientTimelineEvent(id: number, userId: number): Promise<boolean>;
  
  // Patient Treatment operations
  createPatientTreatment(treatment: InsertPatientTreatment): Promise<PatientTreatment>;
  getPatientTreatments(patientId: number, userId: number, userEmail?: string): Promise<PatientTreatment[]>;
  getAllTreatments(userId: number, userEmail?: string): Promise<PatientTreatment[]>;
  updatePatientTreatment(id: number, treatment: Partial<InsertPatientTreatment>, userId: number, userEmail?: string): Promise<PatientTreatment | undefined>;
  deletePatientTreatment(id: number, userId: number, userEmail?: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Helper function to determine user role and sales rep name
  private getUserRole(userEmail: string): { role: string; salesRepName?: string } {
    // For now, we'll use a simple email-based role determination
    // Later this can be moved to the database
    
    // Check if user is a sales rep by matching their email to sales rep records
    // Admin users typically have admin emails or are the main users
    const adminEmails = ['billy@nxtmedical.us', 'admin@nxtmedical.us']; // Add more admin emails as needed
    
    if (adminEmails.includes(userEmail.toLowerCase())) {
      return { role: 'admin' };
    }
    
    // For sales reps, we'll match them by email to sales rep records
    // This is a simplified approach - in production you'd have proper user role management
    return { role: 'sales_rep', salesRepName: userEmail };
  }

  // User operations for local authentication
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  // Patient operations
  async createPatient(patient: InsertPatient, userId: number): Promise<Patient> {
    const [newPatient] = await db
      .insert(patients)
      .values({ ...patient, userId })
      .returning();
    return newPatient;
  }

  async getPatients(userId: number, userEmail?: string): Promise<Patient[]> {
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    let query = db.select().from(patients);
    
    // Admin users can see all patients
    if (user.role === 'admin') {
      // Admin sees all patients regardless of user assignment
      return await query.orderBy(desc(patients.createdAt));
    }
    
    // Sales reps only see their assigned patients
    if (user.role === 'sales_rep') {
      // Find the sales rep record by email to get their name
      const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail || user.email));
      if (salesRepRecords.length > 0) {
        const salesRepName = salesRepRecords[0].name;
        // Filter patients to only show those assigned to this sales rep
        query = query.where(eq(patients.salesRep, salesRepName));
      } else {
        // If no sales rep record found, return empty array
        return [];
      }
    }
    
    return await query.orderBy(desc(patients.createdAt));
  }

  async getPatientById(id: number, userId: number, userEmail?: string): Promise<Patient | undefined> {
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return undefined;
    
    let whereCondition = eq(patients.id, id);
    
    // Admin users can see any patient
    if (user.role === 'admin') {
      // Admin sees any patient regardless of user assignment
      const [patient] = await db.select().from(patients).where(whereCondition);
      return patient;
    }
    
    // Sales reps only see their assigned patients
    if (user.role === 'sales_rep') {
      // Find the sales rep record by email to get their name
      const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail || user.email));
      if (salesRepRecords.length > 0) {
        const salesRepName = salesRepRecords[0].name;
        // Add sales rep filter to the condition
        whereCondition = and(
          eq(patients.id, id),
          eq(patients.salesRep, salesRepName)
        );
      } else {
        // If no sales rep record found, return undefined
        return undefined;
      }
    }
    
    const [patient] = await db
      .select()
      .from(patients)
      .where(whereCondition);
    return patient;
  }

  async updatePatient(id: number, patient: Partial<InsertPatient>, userId: number, userEmail?: string): Promise<Patient | undefined> {
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return undefined;
    
    let whereCondition = eq(patients.id, id);
    
    // Admin users can update any patient
    if (user.role === 'admin') {
      // Admin can update any patient regardless of user assignment
      const [updatedPatient] = await db
        .update(patients)
        .set({ ...patient, updatedAt: new Date() })
        .where(whereCondition)
        .returning();
      return updatedPatient;
    }
    
    // Sales reps only update their assigned patients
    if (user.role === 'sales_rep') {
      // Find the sales rep record by email to get their name
      const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail || user.email));
      if (salesRepRecords.length > 0) {
        const salesRepName = salesRepRecords[0].name;
        // Add sales rep filter to the condition
        whereCondition = and(
          eq(patients.id, id),
          eq(patients.salesRep, salesRepName)
        );
      } else {
        // If no sales rep record found, return undefined
        return undefined;
      }
    }
    
    const [updatedPatient] = await db
      .update(patients)
      .set({ ...patient, updatedAt: new Date() })
      .where(whereCondition)
      .returning();
    return updatedPatient;
  }

  async deletePatient(id: number, userId: number, userEmail?: string): Promise<boolean> {
    let whereCondition = and(eq(patients.id, id), eq(patients.userId, userId));
    
    // If userEmail is provided, check if user is a sales rep
    if (userEmail) {
      const userRole = this.getUserRole(userEmail);
      if (userRole.role === 'sales_rep') {
        // Find the sales rep record by email to get their name
        const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail));
        if (salesRepRecords.length > 0) {
          const salesRepName = salesRepRecords[0].name;
          // Add sales rep filter to the condition
          whereCondition = and(
            eq(patients.id, id),
            eq(patients.userId, userId),
            eq(patients.salesRep, salesRepName)
          );
        } else {
          // If no sales rep record found, return false
          return false;
        }
      }
    }
    
    const result = await db
      .delete(patients)
      .where(whereCondition);
    return (result.rowCount || 0) > 0;
  }

  async searchPatients(userId: number, searchTerm?: string, salesRep?: string, referralSource?: string, userEmail?: string): Promise<Patient[]> {
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    const baseConditions = [];

    // Role-based access control for search
    if (user.role === 'sales_rep') {
      // Sales reps only search their assigned patients
      const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail || user.email));
      if (salesRepRecords.length > 0) {
        const salesRepName = salesRepRecords[0].name;
        // Add sales rep filter to the base conditions
        baseConditions.push(eq(patients.salesRep, salesRepName));
      } else {
        // If no sales rep record found, return empty array
        return [];
      }
    }
    // Admin users can search all patients (no additional conditions)

    if (searchTerm) {
      baseConditions.push(
        or(
          ilike(patients.firstName, `%${searchTerm}%`),
          ilike(patients.lastName, `%${searchTerm}%`),
          ilike(patients.phoneNumber, `%${searchTerm}%`)
        )!
      );
    }

    if (salesRep) {
      baseConditions.push(eq(patients.salesRep, salesRep));
    }

    if (referralSource) {
      baseConditions.push(ilike(patients.referralSource, `%${referralSource}%`));
    }

    return await db
      .select()
      .from(patients)
      .where(and(...baseConditions))
      .orderBy(desc(patients.createdAt));
  }

  // Sales Rep operations
  async createSalesRep(salesRepData: InsertSalesRep): Promise<SalesRep> {
    const [salesRep] = await db
      .insert(salesReps)
      .values(salesRepData)
      .returning();
    return salesRep;
  }

  async getSalesReps(): Promise<SalesRep[]> {
    return await db
      .select()
      .from(salesReps)
      .where(eq(salesReps.isActive, true))
      .orderBy(salesReps.name);
  }

  async getSalesRepById(id: number): Promise<SalesRep | undefined> {
    const [salesRep] = await db
      .select()
      .from(salesReps)
      .where(eq(salesReps.id, id));
    return salesRep;
  }

  async updateSalesRep(id: number, salesRepData: Partial<InsertSalesRep>): Promise<SalesRep | undefined> {
    const [updatedSalesRep] = await db
      .update(salesReps)
      .set({ ...salesRepData, updatedAt: new Date() })
      .where(eq(salesReps.id, id))
      .returning();
    return updatedSalesRep;
  }

  async deleteSalesRep(id: number): Promise<boolean> {
    // Soft delete by setting isActive to false
    const [updatedSalesRep] = await db
      .update(salesReps)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(salesReps.id, id))
      .returning();
    return !!updatedSalesRep;
  }

  // Patient Timeline operations
  async createPatientTimelineEvent(event: InsertPatientTimelineEvent): Promise<PatientTimelineEvent> {
    const [timelineEvent] = await db
      .insert(patientTimelineEvents)
      .values(event)
      .returning();
    return timelineEvent;
  }

  async getPatientTimelineEvents(patientId: number, userId: string): Promise<PatientTimelineEvent[]> {
    const events = await db
      .select()
      .from(patientTimelineEvents)
      .where(
        and(
          eq(patientTimelineEvents.patientId, patientId),
          eq(patientTimelineEvents.userId, userId)
        )
      )
      .orderBy(desc(patientTimelineEvents.eventDate));
    return events;
  }

  async updatePatientTimelineEvent(id: number, event: Partial<InsertPatientTimelineEvent>, userId: string): Promise<PatientTimelineEvent | undefined> {
    const [updatedEvent] = await db
      .update(patientTimelineEvents)
      .set(event)
      .where(
        and(
          eq(patientTimelineEvents.id, id),
          eq(patientTimelineEvents.userId, userId)
        )
      )
      .returning();
    return updatedEvent;
  }

  async deletePatientTimelineEvent(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(patientTimelineEvents)
      .where(
        and(
          eq(patientTimelineEvents.id, id),
          eq(patientTimelineEvents.userId, userId)
        )
      );
    return result.rowCount > 0;
  }

  // Patient Treatment operations
  async createPatientTreatment(treatment: InsertPatientTreatment): Promise<PatientTreatment> {
    const [newTreatment] = await db
      .insert(patientTreatments)
      .values(treatment)
      .returning();
    return newTreatment;
  }

  async getPatientTreatments(patientId: number, userId: number, userEmail?: string): Promise<PatientTreatment[]> {
    // First check if user has access to this patient
    const patient = await this.getPatientById(patientId, userId, userEmail);
    if (!patient) {
      return [];
    }
    
    const treatments = await db
      .select()
      .from(patientTreatments)
      .where(
        and(
          eq(patientTreatments.patientId, patientId),
          eq(patientTreatments.userId, userId)
        )
      )
      .orderBy(patientTreatments.treatmentNumber);
    return treatments;
  }

  async getAllTreatments(userId: number, userEmail?: string): Promise<PatientTreatment[]> {
    // If userEmail is provided, check if user is a sales rep
    if (userEmail) {
      const userRole = this.getUserRole(userEmail);
      if (userRole.role === 'sales_rep') {
        // Get all treatments for patients assigned to this sales rep
        const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail));
        if (salesRepRecords.length > 0) {
          const salesRepName = salesRepRecords[0].name;
          // Get treatments only for patients assigned to this sales rep
          const treatments = await db
            .select({
              id: patientTreatments.id,
              patientId: patientTreatments.patientId,
              treatmentNumber: patientTreatments.treatmentNumber,
              treatmentDate: patientTreatments.treatmentDate,
              woundSize: patientTreatments.woundSize,
              skinGraftPrice: patientTreatments.skinGraftPrice,
              treatmentRevenue: patientTreatments.treatmentRevenue,
              invoiceAmount: patientTreatments.invoiceAmount,
              nxtCommission: patientTreatments.nxtCommission,
              salesRepCommission: patientTreatments.salesRepCommission,
              status: patientTreatments.status,
              notes: patientTreatments.notes,
              userId: patientTreatments.userId,
              createdAt: patientTreatments.createdAt,
              updatedAt: patientTreatments.updatedAt,
            })
            .from(patientTreatments)
            .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
            .where(
              and(
                eq(patientTreatments.userId, userId),
                eq(patients.salesRep, salesRepName)
              )
            )
            .orderBy(patientTreatments.treatmentDate);
          return treatments;
        } else {
          return [];
        }
      }
    }
    
    // Admin users see all treatments
    const treatments = await db
      .select()
      .from(patientTreatments)
      .where(eq(patientTreatments.userId, userId))
      .orderBy(patientTreatments.treatmentDate);
    return treatments;
  }

  async updatePatientTreatment(id: number, treatment: Partial<InsertPatientTreatment>, userId: number, userEmail?: string): Promise<PatientTreatment | undefined> {
    // Remove userId from treatment data to avoid foreign key constraint issues
    const { userId: _, ...treatmentData } = treatment;
    
    // If userEmail is provided, check if user is a sales rep and verify access
    if (userEmail) {
      const userRole = this.getUserRole(userEmail);
      if (userRole.role === 'sales_rep') {
        // Get the treatment first to check patient access
        const [existingTreatment] = await db
          .select()
          .from(patientTreatments)
          .where(and(eq(patientTreatments.id, id), eq(patientTreatments.userId, userId)));
        
        if (existingTreatment) {
          // Check if user has access to this patient
          const patient = await this.getPatientById(existingTreatment.patientId, userId, userEmail);
          if (!patient) {
            return undefined;
          }
        } else {
          return undefined;
        }
      }
    }
    
    const [updatedTreatment] = await db
      .update(patientTreatments)
      .set(treatmentData)
      .where(
        and(
          eq(patientTreatments.id, id),
          eq(patientTreatments.userId, userId)
        )
      )
      .returning();
    return updatedTreatment;
  }

  async deletePatientTreatment(id: number, userId: number, userEmail?: string): Promise<boolean> {
    // If userEmail is provided, check if user is a sales rep and verify access
    if (userEmail) {
      const userRole = this.getUserRole(userEmail);
      if (userRole.role === 'sales_rep') {
        // Get the treatment first to check patient access
        const [existingTreatment] = await db
          .select()
          .from(patientTreatments)
          .where(and(eq(patientTreatments.id, id), eq(patientTreatments.userId, userId)));
        
        if (existingTreatment) {
          // Check if user has access to this patient
          const patient = await this.getPatientById(existingTreatment.patientId, userId, userEmail);
          if (!patient) {
            return false;
          }
        } else {
          return false;
        }
      }
    }
    
    const result = await db
      .delete(patientTreatments)
      .where(
        and(
          eq(patientTreatments.id, id),
          eq(patientTreatments.userId, userId)
        )
      );
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
