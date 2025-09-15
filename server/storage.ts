import {
  users,
  patients,
  salesReps,
  providers,
  providerSalesReps,
  referralSources,
  referralSourceSalesReps,
  referralSourceContacts,  
  patientTimelineEvents,
  referralSourceTimelineEvents,
  patientTreatments,
  treatmentCommissions,
  invitations,
  surgicalCommissions,
  type User,
  type InsertUser,
  type Patient,
  type InsertPatient,
  type SalesRep,
  type InsertSalesRep,
  type Provider,
  type InsertProvider,
  type ProviderSalesRep,
  type InsertProviderSalesRep,
  type ReferralSource,
  type InsertReferralSource,
  type ReferralSourceSalesRep,
  type InsertReferralSourceSalesRep,
  type ReferralSourceContact,
  type InsertReferralSourceContact,
  type PatientTimelineEvent,
  type InsertPatientTimelineEvent,
  type ReferralSourceTimelineEvent,
  type InsertReferralSourceTimelineEvent,
  type PatientTreatment,
  type InsertPatientTreatment,
  type TreatmentCommission,
  type InsertTreatmentCommission,
  type Invitation,
  type InsertInvitation,
  type SurgicalCommission,
  type InsertSurgicalCommission,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, desc, gt } from "drizzle-orm";
import { randomBytes } from "crypto";

// Interface for storage operations
export interface IStorage {
  // User operations for local authentication
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAdminUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  changeUserPassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean>;
  
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
  
  // Provider operations
  createProvider(provider: InsertProvider): Promise<Provider>;
  getProviders(userId?: number, userEmail?: string): Promise<Provider[]>;
  getProviderById(id: number): Promise<Provider | undefined>;
  updateProvider(id: number, provider: Partial<InsertProvider>): Promise<Provider | undefined>;
  deleteProvider(id: number): Promise<boolean>;
  getProviderStats(userId?: number, userEmail?: string): Promise<Array<Provider & { patientCount: number; activeTreatments: number; completedTreatments: number }>>;
  
  // Provider Sales Rep assignment operations
  assignSalesRepToProvider(providerId: number, salesRepId: number): Promise<ProviderSalesRep>;
  removeSalesRepFromProvider(providerId: number, salesRepId: number): Promise<boolean>;
  getProviderSalesReps(providerId: number): Promise<SalesRep[]>;
  getSalesRepsForProvider(providerId: number): Promise<SalesRep[]>;
  
  // Referral Source operations
  createReferralSource(referralSource: InsertReferralSource): Promise<ReferralSource>;
  getReferralSources(userId?: number, userEmail?: string): Promise<ReferralSource[]>;
  getReferralSourceById(id: number): Promise<ReferralSource | undefined>;
  updateReferralSource(id: number, referralSource: Partial<InsertReferralSource>): Promise<ReferralSource | undefined>;
  deleteReferralSource(id: number): Promise<boolean>;
  getReferralSourceStats(userId?: number, userEmail?: string): Promise<Array<ReferralSource & { patientCount: number; activeTreatments: number; completedTreatments: number }>>;

  // Referral Source Sales Rep assignment operations
  assignSalesRepToReferralSource(referralSourceId: number, salesRepId: number): Promise<ReferralSourceSalesRep>;
  removeSalesRepFromReferralSource(referralSourceId: number, salesRepId: number): Promise<boolean>;
  getReferralSourceSalesReps(referralSourceId: number): Promise<SalesRep[]>;
  getSalesRepsForReferralSource(referralSourceId: number): Promise<SalesRep[]>;
  
  // Referral Source Timeline operations
  createReferralSourceTimelineEvent(event: InsertReferralSourceTimelineEvent): Promise<ReferralSourceTimelineEvent>;
  getReferralSourceTimelineEvents(referralSourceId: number, userId: number): Promise<ReferralSourceTimelineEvent[]>;
  updateReferralSourceTimelineEvent(id: number, event: Partial<InsertReferralSourceTimelineEvent>, userId: number): Promise<ReferralSourceTimelineEvent | undefined>;
  deleteReferralSourceTimelineEvent(id: number, userId: number): Promise<boolean>;
  
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
  updateTreatmentInvoiceStatus(treatmentId: number, invoiceStatus: string, paymentDate?: string): Promise<PatientTreatment | undefined>;
  
  // Treatment Commission operations
  createTreatmentCommission(commission: InsertTreatmentCommission): Promise<TreatmentCommission>;
  getTreatmentCommissions(treatmentId: number): Promise<TreatmentCommission[]>;
  getAllTreatmentCommissions(): Promise<TreatmentCommission[]>;
  updateTreatmentCommission(id: number, commission: Partial<InsertTreatmentCommission>): Promise<TreatmentCommission | undefined>;
  deleteTreatmentCommission(id: number): Promise<boolean>;
  deleteTreatmentCommissionsByTreatmentId(treatmentId: number): Promise<boolean>;
  

  // Invitation operations
  createInvitation(invitation: InsertInvitation, invitedBy: number): Promise<Invitation>;
  getInvitations(userId: number): Promise<Invitation[]>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  markInvitationAsUsed(token: string): Promise<boolean>;
  deleteInvitation(id: number): Promise<boolean>;

  // Surgical Commission operations
  createSurgicalCommission(commission: InsertSurgicalCommission): Promise<SurgicalCommission>;
  getSurgicalCommissions(): Promise<SurgicalCommission[]>;
  getSurgicalCommissionById(id: number): Promise<SurgicalCommission | undefined>;
  updateSurgicalCommission(id: number, commission: Partial<InsertSurgicalCommission>): Promise<SurgicalCommission | undefined>;
  deleteSurgicalCommission(id: number): Promise<boolean>;
  
  // Raw query execution
  executeRawQuery(sql: string, params?: any[]): Promise<any[]>;
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

  async getAdminUsers(): Promise<User[]> {
    // Get admin users, prioritizing billy@nxtmedical.us as the main admin
    const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
    
    // Sort to put billy@nxtmedical.us first if it exists
    return adminUsers.sort((a, b) => {
      if (a.email === 'billy@nxtmedical.us') return -1;
      if (b.email === 'billy@nxtmedical.us') return 1;
      return 0;
    });
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async changeUserPassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    // Get the user's current password hash
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return false;

    // Verify current password
    const { scrypt, timingSafeEqual } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);

    const [hashed, salt] = user.password.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(currentPassword, salt, 64)) as Buffer;
    
    if (!timingSafeEqual(hashedBuf, suppliedBuf)) {
      return false; // Current password is incorrect
    }

    // Hash the new password
    const { randomBytes } = await import("crypto");
    const newSalt = randomBytes(16).toString("hex");
    const newBuf = (await scryptAsync(newPassword, newSalt, 64)) as Buffer;
    const newHashedPassword = `${newBuf.toString("hex")}.${newSalt}`;

    // Update the password
    await db
      .update(users)
      .set({ password: newHashedPassword })
      .where(eq(users.id, userId));

    return true;
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
        return await db.select().from(patients).where(eq(patients.salesRep, salesRepName)).orderBy(desc(patients.createdAt));
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
        )!;
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
        )!;
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
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    try {
      // Admin users can delete any patient
      if (user.role === 'admin') {
        // First delete associated timeline events
        await db.delete(patientTimelineEvents).where(eq(patientTimelineEvents.patientId, id));
        
        // Then delete associated treatments
        await db.delete(patientTreatments).where(eq(patientTreatments.patientId, id));
        
        // Finally delete the patient
        const result = await db
          .delete(patients)
          .where(eq(patients.id, id));
        return (result.rowCount || 0) > 0;
      }
      
      // Sales reps can only delete their own patients (by sales rep name, not user_id)
      if (user.role === 'sales_rep') {
        // Find the sales rep record by email to get their name
        const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail || user.email));
        if (salesRepRecords.length > 0) {
          const salesRepName = salesRepRecords[0].name;
          // Check if patient belongs to this sales rep
          const [patient] = await db.select().from(patients).where(
            and(eq(patients.id, id), eq(patients.salesRep, salesRepName))
          );
          if (!patient) {
            return false; // Patient not found or doesn't belong to this sales rep
          }
        } else {
          // If no sales rep record found, return false
          return false;
        }
      }
      
      // For sales reps, delete associated records first, then delete the patient
      await db.delete(patientTimelineEvents).where(eq(patientTimelineEvents.patientId, id));
      await db.delete(patientTreatments).where(eq(patientTreatments.patientId, id));
      
      // Delete the patient (sales rep access already verified above)
      const result = await db
        .delete(patients)
        .where(eq(patients.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting patient:', error);
      return false;
    }
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

  async getPatientTimelineEvents(patientId: number, userId: number): Promise<PatientTimelineEvent[]> {
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

  async updatePatientTimelineEvent(id: number, event: Partial<InsertPatientTimelineEvent>, userId: number): Promise<PatientTimelineEvent | undefined> {
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
    return (result.rowCount || 0) > 0;
  }

  // Patient Treatment operations
  async createPatientTreatment(treatment: InsertPatientTreatment): Promise<PatientTreatment> {
    console.log("Storage layer - Creating treatment with data:", treatment);
    
    // Convert date fields from strings to Date objects if needed
    const treatmentData = {
      ...treatment,
      treatmentDate: typeof treatment.treatmentDate === 'string' ? new Date(treatment.treatmentDate) : treatment.treatmentDate,
      invoiceDate: treatment.invoiceDate && typeof treatment.invoiceDate === 'object' ? treatment.invoiceDate.toISOString().split('T')[0] : treatment.invoiceDate,
      payableDate: treatment.payableDate && typeof treatment.payableDate === 'object' ? treatment.payableDate.toISOString().split('T')[0] : treatment.payableDate,
      paymentDate: treatment.paymentDate && typeof treatment.paymentDate === 'object' ? treatment.paymentDate.toISOString().split('T')[0] : treatment.paymentDate
    };
    
    const [newTreatment] = await db
      .insert(patientTreatments)
      .values([treatmentData])
      .returning();
    return newTreatment;
  }

  async getPatientTreatments(patientId: number, userId: number, userEmail?: string): Promise<PatientTreatment[]> {
    // First check if user has access to this patient
    const patient = await this.getPatientById(patientId, userId, userEmail);
    if (!patient) {
      return [];
    }
    
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    // Admin users can see all treatments for any patient they have access to
    if (user.role === 'admin') {
      const treatments = await db
        .select()
        .from(patientTreatments)
        .where(eq(patientTreatments.patientId, patientId))
        .orderBy(patientTreatments.treatmentNumber);
      return treatments;
    }
    
    // Sales reps see all treatments for their assigned patients (regardless of who created them)
    const treatments = await db
      .select()
      .from(patientTreatments)
      .where(eq(patientTreatments.patientId, patientId))
      .orderBy(patientTreatments.treatmentNumber);
    return treatments;
  }

  async getAllTreatments(userId: number, userEmail?: string): Promise<PatientTreatment[]> {
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    // Admin users can see all treatments regardless of who created them
    if (user.role === 'admin') {
      const treatments = await db
        .select()
        .from(patientTreatments)
        .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
        .orderBy(patientTreatments.treatmentDate);
      
      // Map to include patient names
      return treatments.map(row => ({
        ...row.patient_treatments,
        firstName: row.leads.firstName,
        lastName: row.leads.lastName
      })) as any;
    }
    
    // Sales reps only see treatments for their assigned patients
    if (user.role === 'sales_rep') {
      // Get all treatments for patients assigned to this sales rep
      const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail || user.email));
      if (salesRepRecords.length > 0) {
        const salesRepName = salesRepRecords[0].name;
        // Get treatments only for patients assigned to this sales rep
        const treatments = await db
          .select()
          .from(patientTreatments)
          .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
          .where(eq(patients.salesRep, salesRepName))
          .orderBy(patientTreatments.treatmentDate);
        
        // Map to include patient names
        return treatments.map(row => ({
          ...row.patient_treatments,
          firstName: row.leads.firstName,
          lastName: row.leads.lastName
        })) as any;
      } else {
        return [];
      }
    }
    
    // Fallback: return empty array
    return [];
  }

  async updatePatientTreatment(id: number, treatment: Partial<InsertPatientTreatment>, userId: number, userEmail?: string): Promise<PatientTreatment | undefined> {
    // Remove userId from treatment data to avoid foreign key constraint issues
    const { userId: _, treatmentDate, ...treatmentData } = treatment;
    
    // Convert date fields from strings to Date objects if needed
    const finalTreatmentData: any = { ...treatmentData };
    
    if (treatmentDate) {
      finalTreatmentData.treatmentDate = typeof treatmentDate === 'string' ? new Date(treatmentDate) : treatmentDate;
    }
    
    // Convert other date fields - convert Date objects to strings as expected by the database
    if (finalTreatmentData.invoiceDate && typeof finalTreatmentData.invoiceDate === 'object') {
      finalTreatmentData.invoiceDate = finalTreatmentData.invoiceDate.toISOString().split('T')[0];
    }
    if (finalTreatmentData.payableDate && typeof finalTreatmentData.payableDate === 'object') {
      finalTreatmentData.payableDate = finalTreatmentData.payableDate.toISOString().split('T')[0];
    }
    if (finalTreatmentData.paymentDate && typeof finalTreatmentData.paymentDate === 'object') {
      finalTreatmentData.paymentDate = finalTreatmentData.paymentDate.toISOString().split('T')[0];
    }
    
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return undefined;
    
    // Admin users can update any treatment
    if (user.role === 'admin') {
      const [updatedTreatment] = await db
        .update(patientTreatments)
        .set(finalTreatmentData)
        .where(eq(patientTreatments.id, id))
        .returning();
      return updatedTreatment;
    }
    
    // Sales reps can update treatments for their assigned patients (regardless of who created them)
    if (user.role === 'sales_rep') {
      // Get the treatment first to check patient access
      const [existingTreatment] = await db
        .select()
        .from(patientTreatments)
        .where(eq(patientTreatments.id, id));
      
      if (existingTreatment) {
        // Check if user has access to this patient
        const patient = await this.getPatientById(existingTreatment.patientId, userId, userEmail);
        if (!patient) {
          return undefined;
        }
        
        // Update the treatment (no userId restriction for sales reps on their assigned patients)
        const [updatedTreatment] = await db
          .update(patientTreatments)
          .set(finalTreatmentData)
          .where(eq(patientTreatments.id, id))
          .returning();
        return updatedTreatment;
      } else {
        return undefined;
      }
    }
    
    // Fallback: return undefined
    return undefined;
  }

  async deletePatientTreatment(id: number, userId: number, userEmail?: string): Promise<boolean> {
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    // Admin users can delete any treatment
    if (user.role === 'admin') {
      const result = await db
        .delete(patientTreatments)
        .where(eq(patientTreatments.id, id));
      return (result.rowCount || 0) > 0;
    }
    
    // Sales reps can delete treatments for their assigned patients (regardless of who created them)
    if (user.role === 'sales_rep') {
      // Get the treatment first to check patient access
      const [existingTreatment] = await db
        .select()
        .from(patientTreatments)
        .where(eq(patientTreatments.id, id));
      
      if (existingTreatment) {
        // Check if user has access to this patient
        const patient = await this.getPatientById(existingTreatment.patientId, userId, userEmail);
        if (!patient) {
          return false;
        }
        
        // Delete the treatment (no userId restriction for sales reps on their assigned patients)
        const result = await db
          .delete(patientTreatments)
          .where(eq(patientTreatments.id, id));
        return (result.rowCount || 0) > 0;
      } else {
        return false;
      }
    }
    
    // Fallback: return false
    return false;
  }

  async updateTreatmentInvoiceStatusById(invoiceId: number, status: string): Promise<PatientTreatment | undefined> {
    const [updatedTreatment] = await db
      .update(patientTreatments)
      .set({ invoiceStatus: status, updatedAt: new Date() })
      .where(eq(patientTreatments.id, invoiceId))
      .returning();
    return updatedTreatment || undefined;
  }

  async updateTreatmentInvoiceStatus(treatmentId: number, invoiceStatus: string, paymentDate?: string): Promise<PatientTreatment | undefined> {
    const updateData: any = { invoiceStatus, updatedAt: new Date() };
    
    // Add payment date and paid_at if provided and status is closed
    if (paymentDate && invoiceStatus === 'closed') {
      updateData.paymentDate = paymentDate;
      updateData.paidAt = new Date(); // Set paid_at to current timestamp when marking as paid
    }
    
    const [updatedTreatment] = await db
      .update(patientTreatments)
      .set(updateData)
      .where(eq(patientTreatments.id, treatmentId))
      .returning();
    return updatedTreatment || undefined;
  }

  // Treatment Commission operations
  async createTreatmentCommission(commission: InsertTreatmentCommission): Promise<TreatmentCommission> {
    const [newCommission] = await db
      .insert(treatmentCommissions)
      .values(commission)
      .returning();
    return newCommission;
  }

  async getTreatmentCommissions(treatmentId: number): Promise<TreatmentCommission[]> {
    const commissions = await db
      .select()
      .from(treatmentCommissions)
      .where(eq(treatmentCommissions.treatmentId, treatmentId))
      .orderBy(treatmentCommissions.createdAt);
    return commissions;
  }

  async getAllTreatmentCommissions(): Promise<TreatmentCommission[]> {
    const commissions = await db
      .select()
      .from(treatmentCommissions)
      .orderBy(treatmentCommissions.createdAt);
    return commissions;
  }

  async updateTreatmentCommission(id: number, commission: Partial<InsertTreatmentCommission>): Promise<TreatmentCommission | undefined> {
    const [updatedCommission] = await db
      .update(treatmentCommissions)
      .set({ ...commission, updatedAt: new Date() })
      .where(eq(treatmentCommissions.id, id))
      .returning();
    return updatedCommission;
  }

  async deleteTreatmentCommission(id: number): Promise<boolean> {
    const result = await db
      .delete(treatmentCommissions)
      .where(eq(treatmentCommissions.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteTreatmentCommissionsByTreatmentId(treatmentId: number): Promise<boolean> {
    const result = await db
      .delete(treatmentCommissions)
      .where(eq(treatmentCommissions.treatmentId, treatmentId));
    return (result.rowCount || 0) > 0;
  }

  // Provider operations
  async createProvider(providerData: InsertProvider): Promise<Provider> {
    const [provider] = await db
      .insert(providers)
      .values(providerData)
      .returning();
    return provider;
  }

  async getProviders(userId?: number, userEmail?: string): Promise<Provider[]> {
    // If no user context provided, return all providers (for admin or system operations)
    if (!userId && !userEmail) {
      return await db.select().from(providers).orderBy(providers.name);
    }

    // Get the user's role from the database
    const user = userId ? await this.getUserById(userId) : null;
    if (!user) {
      return await db.select().from(providers).orderBy(providers.name);
    }

    // Admin users can see all providers
    if (user.role === 'admin') {
      return await db.select().from(providers).orderBy(providers.name);
    }

    // Sales reps can only see providers they are assigned to
    if (user.role === 'sales_rep') {
      // Find the sales rep record by email/name
      const salesRepRecord = await db
        .select()
        .from(salesReps)
        .where(eq(salesReps.email, user.email));

      if (salesRepRecord.length === 0) {
        return []; // No sales rep record found
      }

      const salesRepId = salesRepRecord[0].id;

      // Get providers assigned to this sales rep
      const assignedProviders = await db
        .select({
          id: providers.id,
          name: providers.name,
          taxIdNumber: providers.taxIdNumber,
          practiceName: providers.practiceName,
          shipToAddress: providers.shipToAddress,
          city: providers.city,
          state: providers.state,
          zipCode: providers.zipCode,
          contactName: providers.contactName,
          phoneNumber: providers.phoneNumber,
          email: providers.email,
          practicePhone: providers.practicePhone,
          practiceFax: providers.practiceFax,
          practiceEmail: providers.practiceEmail,
          individualNpi: providers.individualNpi,
          groupNpi: providers.groupNpi,
          ptan: providers.ptan,
          billToName: providers.billToName,
          billToCity: providers.billToCity,
          billToState: providers.billToState,
          billToZip: providers.billToZip,
          apContactName: providers.apContactName,
          apPhone: providers.apPhone,
          apEmail: providers.apEmail,
          npiNumber: providers.npiNumber,
          statesCovered: providers.statesCovered,
          isActive: providers.isActive,
          createdAt: providers.createdAt,
          updatedAt: providers.updatedAt,
        })
        .from(providerSalesReps)
        .innerJoin(providers, eq(providerSalesReps.providerId, providers.id))
        .where(eq(providerSalesReps.salesRepId, salesRepId))
        .orderBy(providers.name);

      return assignedProviders;
    }

    // Fallback: return all providers
    return await db.select().from(providers).orderBy(providers.name);
  }

  async getProviderById(id: number): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    return provider || undefined;
  }

  async updateProvider(id: number, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    const [updatedProvider] = await db
      .update(providers)
      .set(providerData)
      .where(eq(providers.id, id))
      .returning();
    return updatedProvider || undefined;
  }

  async deleteProvider(id: number): Promise<boolean> {
    const result = await db
      .delete(providers)
      .where(eq(providers.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getProviderStats(userId?: number, userEmail?: string): Promise<Array<Provider & { patientCount: number; activeTreatments: number; completedTreatments: number }>> {
    // Get providers with role-based filtering
    const allProviders = await this.getProviders(userId, userEmail);
    
    const providersWithStats = await Promise.all(
      allProviders.map(async (provider) => {
        // Count patients assigned to this provider
        const patientCount = await db
          .select({ count: patients.id })
          .from(patients)
          .where(eq(patients.provider, provider.name));
        
        // Get treatments for patients assigned to this provider
        const activeTreatments = await db
          .select({ count: patientTreatments.id })
          .from(patientTreatments)
          .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
          .where(
            and(
              eq(patients.provider, provider.name),
              eq(patientTreatments.status, 'active')
            )
          );

        const completedTreatments = await db
          .select({ count: patientTreatments.id })
          .from(patientTreatments)
          .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
          .where(
            and(
              eq(patients.provider, provider.name),
              eq(patientTreatments.status, 'completed')
            )
          );

        return {
          ...provider,
          patientCount: patientCount.length,
          activeTreatments: activeTreatments.length,
          completedTreatments: completedTreatments.length,
        };
      })
    );

    return providersWithStats;
  }

  // Provider Sales Rep assignment operations
  async assignSalesRepToProvider(providerId: number, salesRepId: number): Promise<ProviderSalesRep> {
    const [assignment] = await db
      .insert(providerSalesReps)
      .values({ providerId, salesRepId })
      .returning();
    return assignment;
  }

  async removeSalesRepFromProvider(providerId: number, salesRepId: number): Promise<boolean> {
    const result = await db
      .delete(providerSalesReps)
      .where(
        and(
          eq(providerSalesReps.providerId, providerId),
          eq(providerSalesReps.salesRepId, salesRepId)
        )
      );
    return (result.rowCount || 0) > 0;
  }

  async getProviderSalesReps(providerId: number): Promise<SalesRep[]> {
    const assignments = await db
      .select({
        id: salesReps.id,
        name: salesReps.name,
        email: salesReps.email,
        phoneNumber: salesReps.phoneNumber,
        isActive: salesReps.isActive,
        commissionRate: salesReps.commissionRate,
        createdAt: salesReps.createdAt,
        updatedAt: salesReps.updatedAt,
      })
      .from(providerSalesReps)
      .innerJoin(salesReps, eq(providerSalesReps.salesRepId, salesReps.id))
      .where(eq(providerSalesReps.providerId, providerId))
      .orderBy(salesReps.name);
    return assignments;
  }

  async getSalesRepsForProvider(providerId: number): Promise<SalesRep[]> {
    return this.getProviderSalesReps(providerId);
  }

  // Referral Source Sales Rep assignment operations
  async assignSalesRepToReferralSource(referralSourceId: number, salesRepId: number): Promise<ReferralSourceSalesRep> {
    const [assignment] = await db
      .insert(referralSourceSalesReps)
      .values({ referralSourceId, salesRepId })
      .returning();
    return assignment;
  }

  async removeSalesRepFromReferralSource(referralSourceId: number, salesRepId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(referralSourceSalesReps)
        .where(
          and(
            eq(referralSourceSalesReps.referralSourceId, referralSourceId),
            eq(referralSourceSalesReps.salesRepId, salesRepId)
          )
        );
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error removing sales rep from referral source:', error);
      return false;
    }
  }

  async getReferralSourceSalesReps(referralSourceId: number): Promise<SalesRep[]> {
    const assignments = await db
      .select({
        id: salesReps.id,
        name: salesReps.name,
        email: salesReps.email,
        phoneNumber: salesReps.phoneNumber,
        isActive: salesReps.isActive,
        commissionRate: salesReps.commissionRate,
        createdAt: salesReps.createdAt,
        updatedAt: salesReps.updatedAt,
      })
      .from(referralSourceSalesReps)
      .innerJoin(salesReps, eq(referralSourceSalesReps.salesRepId, salesReps.id))
      .where(eq(referralSourceSalesReps.referralSourceId, referralSourceId))
      .orderBy(salesReps.name);
    return assignments;
  }

  async getSalesRepsForReferralSource(referralSourceId: number): Promise<SalesRep[]> {
    return this.getReferralSourceSalesReps(referralSourceId);
  }

  // Referral Source operations
  async createReferralSource(referralSourceData: InsertReferralSource): Promise<ReferralSource> {
    const [referralSource] = await db
      .insert(referralSources)
      .values(referralSourceData)
      .returning();
    return referralSource;
  }

  async getReferralSources(userId?: number, userEmail?: string): Promise<ReferralSource[]> {
    // Check if user has a role (admin vs sales rep)
    if (userId && userEmail) {
      const user = await this.getUserById(userId);
      
      // If admin, show all referral sources
      if (user && (user as any)?.role === 'admin') {
        return await db.select().from(referralSources).orderBy(referralSources.facilityName);
      }
      
      // If sales rep, only show assigned referral sources using the salesRep field
      if (user && (user as any)?.role === 'sales_rep') {
        // Get user's full name to match against the salesRep field
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        const assignedReferralSources = await db
          .select()
          .from(referralSources)
          .where(eq(referralSources.salesRep, fullName))
          .orderBy(referralSources.facilityName);

        return assignedReferralSources;
      }
    }

    // Fallback: return all referral sources
    return await db.select().from(referralSources).orderBy(referralSources.facilityName);
  }

  async getReferralSourceById(id: number): Promise<ReferralSource | undefined> {
    const [referralSource] = await db.select().from(referralSources).where(eq(referralSources.id, id));
    return referralSource || undefined;
  }

  async updateReferralSource(id: number, referralSourceData: Partial<InsertReferralSource>): Promise<ReferralSource | undefined> {
    const [updatedReferralSource] = await db
      .update(referralSources)
      .set({ ...referralSourceData, updatedAt: new Date() })
      .where(eq(referralSources.id, id))
      .returning();
    return updatedReferralSource || undefined;
  }

  async deleteReferralSource(id: number): Promise<boolean> {
    try {
      // First, set referralSourceId to null for any patient treatments associated with this referral source
      await db
        .update(patientTreatments)
        .set({ referralSourceId: null })
        .where(eq(patientTreatments.referralSourceId, id));

      // Get the referral source to update any patients that reference it by name
      const referralSource = await this.getReferralSourceById(id);
      if (referralSource) {
        // Set referral source to placeholder for any patients that reference this facility by name or ID
        await db
          .update(patients)
          .set({ 
            referralSource: "Unassigned",
            referralSourceId: null 
          })
          .where(
            or(
              eq(patients.referralSource, referralSource.facilityName),
              eq(patients.referralSourceId, id)
            )
          );
      }

      // Delete associated timeline events
      await db.delete(referralSourceTimelineEvents).where(eq(referralSourceTimelineEvents.referralSourceId, id));
      
      // Delete associated sales rep assignments  
      await db.delete(referralSourceSalesReps).where(eq(referralSourceSalesReps.referralSourceId, id));
      
      // Delete associated contacts (should cascade automatically due to schema)
      await db.delete(referralSourceContacts).where(eq(referralSourceContacts.referralSourceId, id));
      
      // Finally delete the referral source
      const result = await db
        .delete(referralSources)
        .where(eq(referralSources.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting referral source:', error);
      throw error; // Re-throw the error so the route handler can provide a proper error message
    }
  }

  async getReferralSourceStats(userId?: number, userEmail?: string): Promise<Array<ReferralSource & { patientCount: number; activeTreatments: number; completedTreatments: number }>> {
    // Get referral sources with role-based filtering
    const allReferralSources = await this.getReferralSources(userId, userEmail);
    
    const referralSourcesWithStats = await Promise.all(
      allReferralSources.map(async (source) => {
        // Count patients from this referral source
        const patientCount = await db
          .select({ count: patients.id })
          .from(patients)
          .where(eq(patients.referralSource, source.facilityName));
        
        // Get treatments for patients from this referral source
        const activeTreatments = await db
          .select({ count: patientTreatments.id })
          .from(patientTreatments)
          .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
          .where(
            and(
              eq(patients.referralSource, source.facilityName),
              eq(patientTreatments.status, 'active')
            )
          );

        const completedTreatments = await db
          .select({ count: patientTreatments.id })
          .from(patientTreatments)
          .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
          .where(
            and(
              eq(patients.referralSource, source.facilityName),
              eq(patientTreatments.status, 'completed')
            )
          );

        return {
          ...source,
          patientCount: patientCount.length,
          activeTreatments: activeTreatments.length,
          completedTreatments: completedTreatments.length,
        };
      })
    );

    return referralSourcesWithStats;
  }

  // Referral Source Contact operations
  async createReferralSourceContact(contactData: InsertReferralSourceContact): Promise<ReferralSourceContact> {
    const [contact] = await db
      .insert(referralSourceContacts)
      .values(contactData)
      .returning();
    return contact;
  }

  async getReferralSourceContacts(referralSourceId: number): Promise<ReferralSourceContact[]> {
    return await db
      .select()
      .from(referralSourceContacts)
      .where(eq(referralSourceContacts.referralSourceId, referralSourceId))
      .orderBy(desc(referralSourceContacts.isPrimary), referralSourceContacts.contactName);
  }

  async updateReferralSourceContact(id: number, contactData: Partial<InsertReferralSourceContact>): Promise<ReferralSourceContact | undefined> {
    const [updatedContact] = await db
      .update(referralSourceContacts)
      .set({ ...contactData, updatedAt: new Date() })
      .where(eq(referralSourceContacts.id, id))
      .returning();
    return updatedContact || undefined;
  }

  async deleteReferralSourceContact(id: number): Promise<boolean> {
    const result = await db
      .delete(referralSourceContacts)
      .where(eq(referralSourceContacts.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Referral Source Timeline operations
  async createReferralSourceTimelineEvent(eventData: InsertReferralSourceTimelineEvent): Promise<ReferralSourceTimelineEvent> {
    const [event] = await db
      .insert(referralSourceTimelineEvents)
      .values(eventData)
      .returning();
    return event;
  }

  async getReferralSourceTimelineEvents(referralSourceId: number, userId: number): Promise<ReferralSourceTimelineEvent[]> {
    return await db
      .select()
      .from(referralSourceTimelineEvents)
      .where(eq(referralSourceTimelineEvents.referralSourceId, referralSourceId))
      .orderBy(desc(referralSourceTimelineEvents.eventDate));
  }

  async updateReferralSourceTimelineEvent(id: number, eventData: Partial<InsertReferralSourceTimelineEvent>, userId: number): Promise<ReferralSourceTimelineEvent | undefined> {
    const [updatedEvent] = await db
      .update(referralSourceTimelineEvents)
      .set(eventData)
      .where(
        and(
          eq(referralSourceTimelineEvents.id, id),
          eq(referralSourceTimelineEvents.userId, userId)
        )
      )
      .returning();
    return updatedEvent || undefined;
  }

  async deleteReferralSourceTimelineEvent(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(referralSourceTimelineEvents)
      .where(
        and(
          eq(referralSourceTimelineEvents.id, id),
          eq(referralSourceTimelineEvents.userId, userId)
        )
      );
    return (result.rowCount || 0) > 0;
  }

  async getReferralSourceTreatments(referralSourceId: number, userId: number): Promise<any[]> {
    // Get the user's role from the database
    const user = await this.getUserById(userId);
    if (!user) return [];

    // Get the referral source name
    const referralSource = await this.getReferralSourceById(referralSourceId);
    if (!referralSource) return [];

    let query = db
      .select({
        id: patientTreatments.id,
        patientId: patientTreatments.patientId,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        treatmentDate: patientTreatments.treatmentDate,
        woundSizeAtTreatment: patientTreatments.woundSizeAtTreatment,
        skinGraftType: patientTreatments.skinGraftType,
        qCode: patientTreatments.qCode,
        totalRevenue: patientTreatments.totalRevenue,
        invoiceTotal: patientTreatments.invoiceTotal,
        salesRepCommission: patientTreatments.salesRepCommission,
        nxtCommission: patientTreatments.nxtCommission,
        status: patientTreatments.status,
        actingProvider: patientTreatments.actingProvider,
        salesRep: patients.salesRep,
        invoiceStatus: patientTreatments.invoiceStatus,
        invoiceNo: patientTreatments.invoiceNo,
      })
      .from(patientTreatments)
      .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
      .where(
        or(
          eq(patients.referralSourceId, referralSourceId),
          eq(patients.referralSource, referralSource.facilityName)
        )
      )
      .orderBy(desc(patientTreatments.treatmentDate));

    // Admin users can see all treatments for the referral source
    if (user.role === 'admin') {
      return await query;
    }

    // Sales reps only see treatments for their assigned patients
    if (user.role === 'sales_rep') {
      const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, user.email));
      if (salesRepRecords.length > 0) {
        const salesRepName = salesRepRecords[0].name;
        return await db
          .select({
            id: patientTreatments.id,
            patientId: patientTreatments.patientId,
            treatmentNumber: patientTreatments.treatmentNumber,
            treatmentDate: patientTreatments.treatmentDate,
            woundSizeAtTreatment: patientTreatments.woundSizeAtTreatment,
            skinGraftType: patientTreatments.skinGraftType,
            qCode: patientTreatments.qCode,
            totalRevenue: patientTreatments.totalRevenue,
            invoiceTotal: patientTreatments.invoiceTotal,
            salesRepCommission: patientTreatments.salesRepCommission,
            nxtCommission: patientTreatments.nxtCommission,
            status: patientTreatments.status,
            actingProvider: patientTreatments.actingProvider,
            salesRep: patients.salesRep,
            invoiceStatus: patientTreatments.invoiceStatus,
            invoiceNo: patientTreatments.invoiceNo,
          })
          .from(patientTreatments)
          .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
          .where(
            and(
              or(
                eq(patients.referralSourceId, referralSourceId),
                eq(patients.referralSource, referralSource.facilityName)
              ),
              eq(patients.salesRep, salesRepName)
            )
          )
          .orderBy(desc(patientTreatments.treatmentDate));
      } else {
        return [];
      }
    }

    return await query;
  }


  // Invitation operations
  async createInvitation(invitation: InsertInvitation, invitedBy: number): Promise<Invitation> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days from now

    const [newInvitation] = await db
      .insert(invitations)
      .values({
        ...invitation,
        token,
        invitedBy,
        expiresAt,
      })
      .returning();
    return newInvitation;
  }

  async getInvitations(userId: number): Promise<Invitation[]> {
    return await db
      .select()
      .from(invitations)
      .where(eq(invitations.invitedBy, userId))
      .orderBy(desc(invitations.createdAt));
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.token, token),
        eq(invitations.isUsed, false),
        gt(invitations.expiresAt, new Date())
      ));
    return invitation || undefined;
  }

  async markInvitationAsUsed(token: string): Promise<boolean> {
    const result = await db
      .update(invitations)
      .set({ isUsed: true, updatedAt: new Date() })
      .where(eq(invitations.token, token));
    return (result.rowCount || 0) > 0;
  }

  async deleteInvitation(id: number): Promise<boolean> {
    const result = await db
      .delete(invitations)
      .where(eq(invitations.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Surgical Commission operations
  async createSurgicalCommission(commission: InsertSurgicalCommission): Promise<SurgicalCommission> {
    // Convert string fields to appropriate types for database compatibility
    const commissionData = {
      ...commission,
      // commissionRate and sale should be strings (decimal fields)
      commissionRate: typeof commission.commissionRate === 'number' ? commission.commissionRate.toString() : commission.commissionRate,
      sale: typeof commission.sale === 'number' ? commission.sale.toString() : commission.sale,
      // quantity should be a number (integer field)
      quantity: typeof commission.quantity === 'string' ? parseInt(commission.quantity, 10) || 0 : commission.quantity
    };
    
    const [newCommission] = await db
      .insert(surgicalCommissions)
      .values([commissionData])
      .returning();
    return newCommission;
  }

  async getSurgicalCommissions(): Promise<SurgicalCommission[]> {
    return await db
      .select()
      .from(surgicalCommissions)
      .orderBy(desc(surgicalCommissions.orderDate));
  }

  async getSurgicalCommissionById(id: number): Promise<SurgicalCommission | undefined> {
    const [commission] = await db
      .select()
      .from(surgicalCommissions)
      .where(eq(surgicalCommissions.id, id));
    return commission;
  }

  async updateSurgicalCommission(id: number, commission: Partial<InsertSurgicalCommission>): Promise<SurgicalCommission | undefined> {
    // Convert fields to appropriate types for database compatibility
    const updateData: any = { ...commission, updatedAt: new Date() };
    
    // commissionRate and sale should be strings (decimal fields)
    if (typeof updateData.commissionRate === 'number') {
      updateData.commissionRate = updateData.commissionRate.toString();
    }
    if (typeof updateData.sale === 'number') {
      updateData.sale = updateData.sale.toString();
    }
    
    // quantity should be a number (integer field)
    if (typeof updateData.quantity === 'string') {
      updateData.quantity = parseInt(updateData.quantity, 10) || 0;
    }
    
    const [updatedCommission] = await db
      .update(surgicalCommissions)
      .set(updateData)
      .where(eq(surgicalCommissions.id, id))
      .returning();
    return updatedCommission;
  }

  async deleteSurgicalCommission(id: number): Promise<boolean> {
    const result = await db
      .delete(surgicalCommissions)
      .where(eq(surgicalCommissions.id, id));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
