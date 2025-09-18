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
  pipelineNotes,
  type PipelineNote,
  type InsertPipelineNote,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, desc, gt, gte, lt, isNotNull, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// Dashboard metrics type definitions
export interface TreatmentPipelineMetrics {
  totalTreatments: number;
  activeTreatments: number;
  completedTreatments: number;
  totalRevenue: number;
  averageRevenuePerTreatment: number;
  monthlyTrends: MonthlyTrend[];
}

export interface CommissionSummary {
  totalCommissionsPaid: number;
  totalCommissionsPending: number;
  salesRepBreakdown: SalesRepCommission[];
}

export interface SalesRepCommission {
  salesRepName: string;
  totalCommissions: number;
  paidCommissions: number;
  pendingCommissions: number;
  treatmentCount: number;
}

export interface ReferralSourcePerformance {
  facilityName: string;
  patientCount: number;
  treatmentCount: number;
  totalRevenue: number;
  averageRevenuePerPatient: number;
}

export interface GraftAnalysis {
  graftType: string;
  patientCount: number;
  treatmentCount: number;
  totalRevenue: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  totalBillable: number;
  totalInvoices: number;
  commissionsPaid: number;
}

export interface PendingActions {
  pendingInvoices: number;
  overdueInvoices: number;
  pendingCommissionPayments: number;
  newPatients: number;
  activeTreatments: number;
}

export interface DashboardMetrics {
  treatmentPipeline: TreatmentPipelineMetrics;
  commissionSummary: CommissionSummary;
  topReferralSources: ReferralSourcePerformance[];
  graftAnalysis: GraftAnalysis[];
  monthlyTrends: MonthlyTrend[];
  pendingActions: PendingActions;
  lastUpdated: Date;
}

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
  
  // Commission Payment Date operations
  updateTreatmentCommissionPaymentDate(treatmentId: number, commissionPaymentDate: string | null): Promise<PatientTreatment | undefined>;
  updateTreatmentRepPaymentDate(treatmentId: number, aczPayDate: string | null): Promise<PatientTreatment | undefined>;

  // Dashboard Metrics operations
  getDashboardMetrics(userId: number, userEmail?: string): Promise<DashboardMetrics>;
  
  // Pipeline Notes operations
  getPipelineNotes(userId: number): Promise<PipelineNote[]>;
  createPipelineNote(note: InsertPipelineNote): Promise<PipelineNote>;
  updatePipelineNote(id: number, note: Partial<InsertPipelineNote>): Promise<PipelineNote | undefined>;
  deletePipelineNote(id: number): Promise<boolean>;
  updatePipelineNotesOrder(noteUpdates: Array<{ id: number; sortOrder: number }>): Promise<void>;
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

  // Provider operations
  async createProvider(provider: InsertProvider): Promise<Provider> {
    const [newProvider] = await db
      .insert(providers)
      .values(provider)
      .returning();
    return newProvider;
  }

  async getProviders(userId?: number, userEmail?: string): Promise<Provider[]> {
    return await db.select().from(providers).orderBy(providers.name);
  }

  async getProviderById(id: number): Promise<Provider | undefined> {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, id));
    return provider;
  }

  async updateProvider(id: number, provider: Partial<InsertProvider>): Promise<Provider | undefined> {
    const [updatedProvider] = await db
      .update(providers)
      .set({ ...provider, updatedAt: new Date() })
      .where(eq(providers.id, id))
      .returning();
    return updatedProvider;
  }

  async deleteProvider(id: number): Promise<boolean> {
    try {
      // First remove all sales rep assignments for this provider
      await db.delete(providerSalesReps).where(eq(providerSalesReps.providerId, id));
      
      // Then delete the provider
      const result = await db
        .delete(providers)
        .where(eq(providers.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting provider:', error);
      return false;
    }
  }

  async getProviderStats(userId?: number, userEmail?: string): Promise<Array<Provider & { patientCount: number; activeTreatments: number; completedTreatments: number }>> {
    const result = await db
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
        patientCount: sql<number>`COALESCE(COUNT(DISTINCT ${patients.id}), 0)`,
        activeTreatments: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${patientTreatments.status} = 'active' THEN ${patientTreatments.id} END), 0)`,
        completedTreatments: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${patientTreatments.status} = 'completed' THEN ${patientTreatments.id} END), 0)`
      })
      .from(providers)
      .leftJoin(patients, eq(patients.provider, providers.name))
      .leftJoin(patientTreatments, eq(patientTreatments.patientId, patients.id))
      .groupBy(providers.id)
      .orderBy(providers.name);

    return result;
  }

  // Provider Sales Rep assignments
  async assignSalesRepToProvider(providerId: number, salesRepId: number): Promise<ProviderSalesRep> {
    const [assignment] = await db
      .insert(providerSalesReps)
      .values({ providerId, salesRepId })
      .onConflictDoNothing()
      .returning();
    
    return assignment || { providerId, salesRepId };
  }

  async removeSalesRepFromProvider(providerId: number, salesRepId: number): Promise<boolean> {
    const result = await db
      .delete(providerSalesReps)
      .where(and(
        eq(providerSalesReps.providerId, providerId),
        eq(providerSalesReps.salesRepId, salesRepId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async getProviderSalesReps(providerId: number): Promise<SalesRep[]> {
    const result = await db
      .select({
        id: salesReps.id,
        name: salesReps.name,
        email: salesReps.email,
        phoneNumber: salesReps.phoneNumber,
        isActive: salesReps.isActive,
        createdAt: salesReps.createdAt,
        updatedAt: salesReps.updatedAt
      })
      .from(salesReps)
      .innerJoin(providerSalesReps, eq(salesReps.id, providerSalesReps.salesRepId))
      .where(eq(providerSalesReps.providerId, providerId))
      .orderBy(salesReps.name);
    
    return result;
  }

  async getSalesRepsForProvider(providerId: number): Promise<SalesRep[]> {
    return this.getProviderSalesReps(providerId);
  }

  // Referral Source operations
  async createReferralSource(referralSource: InsertReferralSource): Promise<ReferralSource> {
    const [newReferralSource] = await db
      .insert(referralSources)
      .values(referralSource)
      .returning();
    return newReferralSource;
  }

  async getReferralSources(userId?: number, userEmail?: string): Promise<ReferralSource[]> {
    return await db.select().from(referralSources).orderBy(referralSources.facilityName);
  }

  async getReferralSourceById(id: number): Promise<ReferralSource | undefined> {
    const [referralSource] = await db
      .select()
      .from(referralSources)
      .where(eq(referralSources.id, id));
    return referralSource;
  }

  async updateReferralSource(id: number, referralSource: Partial<InsertReferralSource>): Promise<ReferralSource | undefined> {
    const [updatedReferralSource] = await db
      .update(referralSources)
      .set({ ...referralSource, updatedAt: new Date() })
      .where(eq(referralSources.id, id))
      .returning();
    return updatedReferralSource;
  }

  async deleteReferralSource(id: number): Promise<boolean> {
    try {
      // First remove all sales rep assignments and contacts
      await db.delete(referralSourceSalesReps).where(eq(referralSourceSalesReps.referralSourceId, id));
      await db.delete(referralSourceContacts).where(eq(referralSourceContacts.referralSourceId, id));
      await db.delete(referralSourceTimelineEvents).where(eq(referralSourceTimelineEvents.referralSourceId, id));
      
      // Then delete the referral source
      const result = await db
        .delete(referralSources)
        .where(eq(referralSources.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting referral source:', error);
      return false;
    }
  }

  async getReferralSourceStats(userId?: number, userEmail?: string): Promise<Array<ReferralSource & { patientCount: number; activeTreatments: number; completedTreatments: number }>> {
    const result = await db
      .select({
        id: referralSources.id,
        facilityName: referralSources.facilityName,
        address: referralSources.address,
        phoneNumber: referralSources.phoneNumber,
        faxNumber: referralSources.faxNumber,
        email: referralSources.email,
        contactPerson: referralSources.contactPerson,
        notes: referralSources.notes,
        createdAt: referralSources.createdAt,
        updatedAt: referralSources.updatedAt,
        patientCount: sql<number>`COALESCE(COUNT(DISTINCT ${patients.id}), 0)`,
        activeTreatments: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${patientTreatments.status} = 'active' THEN ${patientTreatments.id} END), 0)`,
        completedTreatments: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${patientTreatments.status} = 'completed' THEN ${patientTreatments.id} END), 0)`
      })
      .from(referralSources)
      .leftJoin(patients, eq(patients.referralSource, referralSources.facilityName))
      .leftJoin(patientTreatments, eq(patientTreatments.patientId, patients.id))
      .groupBy(referralSources.id)
      .orderBy(referralSources.facilityName);

    return result;
  }

  // Referral Source Sales Rep assignments
  async assignSalesRepToReferralSource(referralSourceId: number, salesRepId: number): Promise<ReferralSourceSalesRep> {
    const [assignment] = await db
      .insert(referralSourceSalesReps)
      .values({ referralSourceId, salesRepId })
      .onConflictDoNothing()
      .returning();
    
    return assignment || { referralSourceId, salesRepId };
  }

  async removeSalesRepFromReferralSource(referralSourceId: number, salesRepId: number): Promise<boolean> {
    const result = await db
      .delete(referralSourceSalesReps)
      .where(and(
        eq(referralSourceSalesReps.referralSourceId, referralSourceId),
        eq(referralSourceSalesReps.salesRepId, salesRepId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async getReferralSourceSalesReps(referralSourceId: number): Promise<SalesRep[]> {
    const result = await db
      .select({
        id: salesReps.id,
        name: salesReps.name,
        email: salesReps.email,
        phoneNumber: salesReps.phoneNumber,
        isActive: salesReps.isActive,
        createdAt: salesReps.createdAt,
        updatedAt: salesReps.updatedAt
      })
      .from(salesReps)
      .innerJoin(referralSourceSalesReps, eq(salesReps.id, referralSourceSalesReps.salesRepId))
      .where(eq(referralSourceSalesReps.referralSourceId, referralSourceId))
      .orderBy(salesReps.name);
    
    return result;
  }

  async getSalesRepsForReferralSource(referralSourceId: number): Promise<SalesRep[]> {
    return this.getReferralSourceSalesReps(referralSourceId);
  }

  // Referral Source Timeline operations
  async createReferralSourceTimelineEvent(event: InsertReferralSourceTimelineEvent): Promise<ReferralSourceTimelineEvent> {
    const [timelineEvent] = await db
      .insert(referralSourceTimelineEvents)
      .values(event)
      .returning();
    return timelineEvent;
  }

  async getReferralSourceTimelineEvents(referralSourceId: number, userId: number): Promise<ReferralSourceTimelineEvent[]> {
    const events = await db
      .select()
      .from(referralSourceTimelineEvents)
      .where(eq(referralSourceTimelineEvents.referralSourceId, referralSourceId))
      .orderBy(desc(referralSourceTimelineEvents.eventDate));
    return events;
  }

  async updateReferralSourceTimelineEvent(id: number, event: Partial<InsertReferralSourceTimelineEvent>, userId: number): Promise<ReferralSourceTimelineEvent | undefined> {
    const [updatedEvent] = await db
      .update(referralSourceTimelineEvents)
      .set(event)
      .where(eq(referralSourceTimelineEvents.id, id))
      .returning();
    return updatedEvent;
  }

  async deleteReferralSourceTimelineEvent(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(referralSourceTimelineEvents)
      .where(eq(referralSourceTimelineEvents.id, id));
    return (result.rowCount || 0) > 0;
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
      paymentDate: treatment.paymentDate && typeof treatment.paymentDate === 'object' ? treatment.paymentDate.toISOString().split('T')[0] : treatment.paymentDate,
      paidAt: treatment.paidAt && typeof treatment.paidAt === 'string' ? new Date(treatment.paidAt) : treatment.paidAt
    };
    
    const [newTreatment] = await db
      .insert(patientTreatments)
      .values(treatmentData)
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
      }
    }
    
    return undefined;
  }

  async deletePatientTreatment(id: number, userId: number, userEmail?: string): Promise<boolean> {
    try {
      // Get the user's role from the database
      const user = await this.getUserById(userId);
      if (!user) return false;
      
      // Admin users can delete any treatment
      if (user.role === 'admin') {
        // First delete associated commissions
        await db.delete(treatmentCommissions).where(eq(treatmentCommissions.treatmentId, id));
        
        // Then delete the treatment
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
          
          // Delete associated commissions first
          await db.delete(treatmentCommissions).where(eq(treatmentCommissions.treatmentId, id));
          
          // Delete the treatment (no userId restriction for sales reps on their assigned patients)
          const result = await db
            .delete(patientTreatments)
            .where(eq(patientTreatments.id, id));
          return (result.rowCount || 0) > 0;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting treatment:', error);
      return false;
    }
  }

  async updateTreatmentInvoiceStatus(treatmentId: number, invoiceStatus: string, paymentDate?: string): Promise<PatientTreatment | undefined> {
    const updateData: any = { invoiceStatus, updatedAt: new Date() };
    
    if (paymentDate) {
      updateData.paymentDate = paymentDate;
    }
    
    // If status is being set to 'closed', also set the payment date if not provided
    if (invoiceStatus === 'closed' && !paymentDate) {
      updateData.paymentDate = new Date().toISOString().split('T')[0];
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
    return await db
      .select()
      .from(treatmentCommissions)
      .where(eq(treatmentCommissions.treatmentId, treatmentId))
      .orderBy(treatmentCommissions.salesRepName);
  }

  async getAllTreatmentCommissions(): Promise<TreatmentCommission[]> {
    return await db
      .select()
      .from(treatmentCommissions)
      .orderBy(desc(treatmentCommissions.createdAt));
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

  // Invitation operations
  async createInvitation(invitationData: InsertInvitation, invitedBy: number): Promise<Invitation> {
    // Generate a secure token and set expiration
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const [invitation] = await db
      .insert(invitations)
      .values({
        ...invitationData,
        token,
        invitedBy,
        expiresAt
      })
      .returning();
    return invitation;
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
      .values(commissionData)
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

  // Raw query execution
  async executeRawQuery(sql: string, params?: any[]): Promise<any[]> {
    // This method allows executing raw SQL queries when needed
    // Use with caution and proper validation
    const result = await db.execute(sql);
    return result.rows || [];
  }

  // Commission Payment Date operations
  async updateTreatmentCommissionPaymentDate(treatmentId: number, commissionPaymentDate: string | null): Promise<PatientTreatment | undefined> {
    const updateData: any = { commissionPaymentDate, updatedAt: new Date() };
    
    const [updatedTreatment] = await db
      .update(patientTreatments)
      .set(updateData)
      .where(eq(patientTreatments.id, treatmentId))
      .returning();
    return updatedTreatment || undefined;
  }

  async updateTreatmentRepPaymentDate(treatmentId: number, aczPayDate: string | null): Promise<PatientTreatment | undefined> {
    const updateData: any = { aczPayDate, updatedAt: new Date() };
    
    const [updatedTreatment] = await db
      .update(patientTreatments)
      .set(updateData)
      .where(eq(patientTreatments.id, treatmentId))
      .returning();
    return updatedTreatment || undefined;
  }

  // Dashboard Metrics implementation
  async getDashboardMetrics(userId: number, userEmail?: string): Promise<DashboardMetrics> {
    // Get user to check role
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Determine user role and sales rep filtering
    let salesRepFilter: string | null = null;
    if (user.role === 'sales_rep') {
      const salesRepRecords = await db.select().from(salesReps).where(eq(salesReps.email, userEmail || user.email));
      if (salesRepRecords.length > 0) {
        salesRepFilter = salesRepRecords[0].name;
      } else {
        // If sales rep not found, return empty metrics
        return this.getEmptyDashboardMetrics();
      }
    }

    // Calculate 12 months ago for trends
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Parallel execution of all metrics calculations
    const [
      treatmentPipeline,
      commissionSummary,
      referralSourcePerformance,
      graftAnalysis,
      monthlyTrends,
      pendingActions
    ] = await Promise.all([
      this.calculateTreatmentPipelineMetrics(salesRepFilter),
      this.calculateCommissionSummary(salesRepFilter),
      this.calculateReferralSourcePerformance(salesRepFilter),
      this.calculateGraftAnalysis(salesRepFilter),
      this.calculateMonthlyTrends(salesRepFilter, twelveMonthsAgo),
      this.calculatePendingActions(salesRepFilter)
    ]);

    return {
      treatmentPipeline,
      commissionSummary,
      topReferralSources: referralSourcePerformance,
      graftAnalysis,
      monthlyTrends,
      pendingActions,
      lastUpdated: new Date()
    };
  }

  private getEmptyDashboardMetrics(): DashboardMetrics {
    return {
      treatmentPipeline: {
        totalTreatments: 0,
        activeTreatments: 0,
        completedTreatments: 0,
        totalRevenue: 0,
        averageRevenuePerTreatment: 0,
        monthlyTrends: []
      },
      commissionSummary: {
        totalCommissionsPaid: 0,
        totalCommissionsPending: 0,
        salesRepBreakdown: []
      },
      topReferralSources: [],
      graftAnalysis: [],
      monthlyTrends: [],
      pendingActions: {
        pendingInvoices: 0,
        overdueInvoices: 0,
        pendingCommissionPayments: 0,
        newPatients: 0,
        activeTreatments: 0
      },
      lastUpdated: new Date()
    };
  }

  private async calculateTreatmentPipelineMetrics(salesRepFilter: string | null): Promise<TreatmentPipelineMetrics> {
    let treatments;
    
    if (salesRepFilter) {
      treatments = await db.select({
        status: patientTreatments.status,
        totalRevenue: patientTreatments.totalRevenue,
        treatmentDate: patientTreatments.treatmentDate
      }).from(patientTreatments)
        .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
        .where(eq(patients.salesRep, salesRepFilter));
    } else {
      treatments = await db.select({
        status: patientTreatments.status,
        totalRevenue: patientTreatments.totalRevenue,
        treatmentDate: patientTreatments.treatmentDate
      }).from(patientTreatments);
    }

    const totalTreatments = treatments.length;
    const activeTreatments = treatments.filter(t => t.status === 'active').length;
    const completedTreatments = treatments.filter(t => t.status === 'completed').length;
    
    const totalRevenue = treatments.reduce((sum, t) => sum + (parseFloat(t.totalRevenue?.toString() || '0')), 0);
    const averageRevenuePerTreatment = totalTreatments > 0 ? totalRevenue / totalTreatments : 0;

    return {
      totalTreatments,
      activeTreatments,
      completedTreatments,
      totalRevenue,
      averageRevenuePerTreatment,
      monthlyTrends: [] // This will be populated by monthlyTrends calculation
    };
  }

  private async calculateCommissionSummary(salesRepFilter: string | null): Promise<CommissionSummary> {
    let treatments;
    
    if (salesRepFilter) {
      treatments = await db.select({
        salesRep: patientTreatments.salesRep,
        salesRepCommission: patientTreatments.salesRepCommission,
        paidAt: patientTreatments.paidAt,
        commissionPaymentDate: patientTreatments.commissionPaymentDate
      }).from(patientTreatments)
        .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
        .where(eq(patients.salesRep, salesRepFilter));
    } else {
      treatments = await db.select({
        salesRep: patientTreatments.salesRep,
        salesRepCommission: patientTreatments.salesRepCommission,
        paidAt: patientTreatments.paidAt,
        commissionPaymentDate: patientTreatments.commissionPaymentDate
      }).from(patientTreatments);
    }

    // Group by sales rep
    const salesRepMap = new Map<string, {
      totalCommissions: number;
      paidCommissions: number;
      pendingCommissions: number;
      treatmentCount: number;
    }>();

    let totalPaid = 0;
    let totalPending = 0;

    treatments.forEach(treatment => {
      const commission = parseFloat(treatment.salesRepCommission?.toString() || '0');
      const isPaid = !!treatment.commissionPaymentDate;
      
      if (!salesRepMap.has(treatment.salesRep)) {
        salesRepMap.set(treatment.salesRep, {
          totalCommissions: 0,
          paidCommissions: 0,
          pendingCommissions: 0,
          treatmentCount: 0
        });
      }

      const repData = salesRepMap.get(treatment.salesRep)!;
      repData.totalCommissions += commission;
      repData.treatmentCount += 1;

      if (isPaid) {
        repData.paidCommissions += commission;
        totalPaid += commission;
      } else {
        repData.pendingCommissions += commission;
        totalPending += commission;
      }
    });

    const salesRepBreakdown: SalesRepCommission[] = Array.from(salesRepMap.entries()).map(([name, data]) => ({
      salesRepName: name,
      totalCommissions: data.totalCommissions,
      paidCommissions: data.paidCommissions,
      pendingCommissions: data.pendingCommissions,
      treatmentCount: data.treatmentCount
    }));

    return {
      totalCommissionsPaid: totalPaid,
      totalCommissionsPending: totalPending,
      salesRepBreakdown
    };
  }

  private async calculateReferralSourcePerformance(salesRepFilter: string | null): Promise<ReferralSourcePerformance[]> {
    let data;
    
    if (salesRepFilter) {
      data = await db.select({
        referralSource: patients.referralSource,
        totalRevenue: patientTreatments.totalRevenue,
        patientId: patients.id
      }).from(patients)
        .leftJoin(patientTreatments, eq(patients.id, patientTreatments.patientId))
        .where(eq(patients.salesRep, salesRepFilter));
    } else {
      data = await db.select({
        referralSource: patients.referralSource,
        totalRevenue: patientTreatments.totalRevenue,
        patientId: patients.id
      }).from(patients)
        .leftJoin(patientTreatments, eq(patients.id, patientTreatments.patientId));
    }

    // Group by referral source
    const sourceMap = new Map<string, {
      patientCount: number;
      treatmentCount: number;
      totalRevenue: number;
      patientIds: Set<number>;
    }>();

    data.forEach(row => {
      if (!sourceMap.has(row.referralSource)) {
        sourceMap.set(row.referralSource, {
          patientCount: 0,
          treatmentCount: 0,
          totalRevenue: 0,
          patientIds: new Set()
        });
      }

      const sourceData = sourceMap.get(row.referralSource)!;
      sourceData.patientIds.add(row.patientId || 0);
      
      if (row.totalRevenue) {
        sourceData.treatmentCount += 1;
        sourceData.totalRevenue += parseFloat(row.totalRevenue.toString());
      }
    });

    // Convert to final format
    const performance: ReferralSourcePerformance[] = Array.from(sourceMap.entries()).map(([facilityName, data]) => ({
      facilityName,
      patientCount: data.patientIds.size,
      treatmentCount: data.treatmentCount,
      totalRevenue: data.totalRevenue,
      averageRevenuePerPatient: data.patientIds.size > 0 ? data.totalRevenue / data.patientIds.size : 0
    }));

    // Sort by total revenue descending and return top 10
    return performance.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
  }

  private async calculateGraftAnalysis(salesRepFilter: string | null): Promise<GraftAnalysis[]> {
    let data;
    
    if (salesRepFilter) {
      data = await db.select({
        skinGraftType: patientTreatments.skinGraftType,
        totalRevenue: patientTreatments.totalRevenue,
        patientId: patients.id
      }).from(patientTreatments)
        .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
        .where(eq(patients.salesRep, salesRepFilter));
    } else {
      data = await db.select({
        skinGraftType: patientTreatments.skinGraftType,
        totalRevenue: patientTreatments.totalRevenue,
        patientId: patients.id
      }).from(patientTreatments)
        .innerJoin(patients, eq(patientTreatments.patientId, patients.id));
    }

    // Group by graft type
    const graftMap = new Map<string, {
      patientCount: number;
      treatmentCount: number;
      totalRevenue: number;
      patientIds: Set<number>;
    }>();

    data.forEach(row => {
      const graftType = row.skinGraftType || 'Unknown';
      
      if (!graftMap.has(graftType)) {
        graftMap.set(graftType, {
          patientCount: 0,
          treatmentCount: 0,
          totalRevenue: 0,
          patientIds: new Set()
        });
      }

      const graftData = graftMap.get(graftType)!;
      graftData.patientIds.add(row.patientId || 0);
      
      if (row.totalRevenue) {
        graftData.treatmentCount += 1;
        graftData.totalRevenue += parseFloat(row.totalRevenue.toString());
      }
    });

    const totalPatients = Array.from(graftMap.values()).reduce((sum, data) => sum + data.patientIds.size, 0);

    // Convert to final format
    const analysis: GraftAnalysis[] = Array.from(graftMap.entries()).map(([graftType, data]) => ({
      graftType,
      patientCount: data.patientIds.size,
      treatmentCount: data.treatmentCount,
      totalRevenue: data.totalRevenue,
      percentage: totalPatients > 0 ? (data.patientIds.size / totalPatients) * 100 : 0
    }));

    return analysis.sort((a, b) => b.patientCount - a.patientCount);
  }

  private async calculateMonthlyTrends(salesRepFilter: string | null, startDate: Date): Promise<MonthlyTrend[]> {
    let treatments;
    
    if (salesRepFilter) {
      treatments = await db.select({
        treatmentDate: patientTreatments.treatmentDate,
        totalRevenue: patientTreatments.totalRevenue,
        invoiceTotal: patientTreatments.invoiceTotal,
        salesRepCommission: patientTreatments.salesRepCommission,
        commissionPaymentDate: patientTreatments.commissionPaymentDate
      }).from(patientTreatments)
        .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
        .where(and(
          eq(patients.salesRep, salesRepFilter),
          gte(patientTreatments.treatmentDate, startDate)
        ));
    } else {
      treatments = await db.select({
        treatmentDate: patientTreatments.treatmentDate,
        totalRevenue: patientTreatments.totalRevenue,
        invoiceTotal: patientTreatments.invoiceTotal,
        salesRepCommission: patientTreatments.salesRepCommission,
        commissionPaymentDate: patientTreatments.commissionPaymentDate
      }).from(patientTreatments)
        .where(gte(patientTreatments.treatmentDate, startDate));
    }

    // Group by month/year
    const monthlyMap = new Map<string, {
      totalBillable: number;
      totalInvoices: number;
      commissionsPaid: number;
      month: string;
      year: number;
    }>();

    treatments.forEach(treatment => {
      const date = new Date(treatment.treatmentDate);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'long' });
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          totalBillable: 0,
          totalInvoices: 0,
          commissionsPaid: 0,
          month: monthName,
          year: date.getFullYear()
        });
      }

      const monthData = monthlyMap.get(monthKey)!;
      monthData.totalBillable += parseFloat(treatment.totalRevenue?.toString() || '0');
      monthData.totalInvoices += parseFloat(treatment.invoiceTotal?.toString() || '0');
      
      if (treatment.commissionPaymentDate) {
        monthData.commissionsPaid += parseFloat(treatment.salesRepCommission?.toString() || '0');
      }
    });

    // Convert to array and sort by date
    const trends = Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return new Date(`${a.month} 1, ${a.year}`).getMonth() - new Date(`${b.month} 1, ${b.year}`).getMonth();
    });

    return trends;
  }

  private async calculatePendingActions(salesRepFilter: string | null): Promise<PendingActions> {
    // Calculate date thresholds
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let treatments;
    let allPatients;

    if (salesRepFilter) {
      treatments = await db.select({
        invoiceStatus: patientTreatments.invoiceStatus,
        payableDate: patientTreatments.payableDate,
        status: patientTreatments.status,
        commissionPaymentDate: patientTreatments.commissionPaymentDate
      }).from(patientTreatments)
        .innerJoin(patients, eq(patientTreatments.patientId, patients.id))
        .where(eq(patients.salesRep, salesRepFilter));

      allPatients = await db.select({
        createdAt: patients.createdAt
      }).from(patients)
        .where(eq(patients.salesRep, salesRepFilter));
    } else {
      treatments = await db.select({
        invoiceStatus: patientTreatments.invoiceStatus,
        payableDate: patientTreatments.payableDate,
        status: patientTreatments.status,
        commissionPaymentDate: patientTreatments.commissionPaymentDate
      }).from(patientTreatments);

      allPatients = await db.select({
        createdAt: patients.createdAt
      }).from(patients);
    }

    const pendingInvoices = treatments.filter(t => t.invoiceStatus === 'open' || t.invoiceStatus === 'payable').length;
    
    const overdueInvoices = treatments.filter(t => {
      return t.payableDate && new Date(t.payableDate) < thirtyDaysAgo && t.invoiceStatus !== 'closed';
    }).length;

    const pendingCommissionPayments = treatments.filter(t => !t.commissionPaymentDate && t.status === 'completed').length;
    
    const newPatients = allPatients.filter(p => new Date(p.createdAt!) > thirtyDaysAgo).length;
    
    const activeTreatments = treatments.filter(t => t.status === 'active').length;

    return {
      pendingInvoices,
      overdueInvoices,
      pendingCommissionPayments,
      newPatients,
      activeTreatments
    };
  }

  // Pipeline Notes implementation
  async getPipelineNotes(userId: number): Promise<PipelineNote[]> {
    const notes = await db
      .select()
      .from(pipelineNotes)
      .where(eq(pipelineNotes.userId, userId))
      .orderBy(pipelineNotes.sortOrder, pipelineNotes.createdAt);
    return notes;
  }

  async createPipelineNote(note: InsertPipelineNote): Promise<PipelineNote> {
    const [newNote] = await db
      .insert(pipelineNotes)
      .values(note)
      .returning();
    return newNote;
  }

  async updatePipelineNote(id: number, note: Partial<InsertPipelineNote>): Promise<PipelineNote | undefined> {
    const [updatedNote] = await db
      .update(pipelineNotes)
      .set({ ...note, updatedAt: new Date() })
      .where(eq(pipelineNotes.id, id))
      .returning();
    return updatedNote;
  }

  async deletePipelineNote(id: number): Promise<boolean> {
    const result = await db
      .delete(pipelineNotes)
      .where(eq(pipelineNotes.id, id));
    return (result.rowCount || 0) > 0;
  }

  async updatePipelineNotesOrder(noteUpdates: Array<{ id: number; sortOrder: number }>): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of noteUpdates) {
        await tx
          .update(pipelineNotes)
          .set({ sortOrder: update.sortOrder, updatedAt: new Date() })
          .where(eq(pipelineNotes.id, update.id));
      }
    });
  }
}

export const storage = new DatabaseStorage();