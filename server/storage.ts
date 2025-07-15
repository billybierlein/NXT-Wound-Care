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
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Patient operations
  createPatient(patient: InsertPatient, userId: string): Promise<Patient>;
  getPatients(userId: string): Promise<Patient[]>;
  getPatientById(id: number, userId: string): Promise<Patient | undefined>;
  updatePatient(id: number, patient: Partial<InsertPatient>, userId: string): Promise<Patient | undefined>;
  deletePatient(id: number, userId: string): Promise<boolean>;
  searchPatients(userId: string, searchTerm?: string, salesRep?: string, referralSource?: string): Promise<Patient[]>;
  
  // Sales Rep operations
  createSalesRep(salesRep: InsertSalesRep): Promise<SalesRep>;
  getSalesReps(): Promise<SalesRep[]>;
  getSalesRepById(id: number): Promise<SalesRep | undefined>;
  updateSalesRep(id: number, salesRep: Partial<InsertSalesRep>): Promise<SalesRep | undefined>;
  deleteSalesRep(id: number): Promise<boolean>;
  
  // Patient Timeline operations
  createPatientTimelineEvent(event: InsertPatientTimelineEvent): Promise<PatientTimelineEvent>;
  getPatientTimelineEvents(patientId: number, userId: string): Promise<PatientTimelineEvent[]>;
  updatePatientTimelineEvent(id: number, event: Partial<InsertPatientTimelineEvent>, userId: string): Promise<PatientTimelineEvent | undefined>;
  deletePatientTimelineEvent(id: number, userId: string): Promise<boolean>;
  
  // Patient Treatment operations
  createPatientTreatment(treatment: InsertPatientTreatment): Promise<PatientTreatment>;
  getPatientTreatments(patientId: number, userId: string): Promise<PatientTreatment[]>;
  updatePatientTreatment(id: number, treatment: Partial<InsertPatientTreatment>, userId: string): Promise<PatientTreatment | undefined>;
  deletePatientTreatment(id: number, userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Patient operations
  async createPatient(patient: InsertPatient, userId: string): Promise<Patient> {
    const [newPatient] = await db
      .insert(patients)
      .values({ ...patient, userId })
      .returning();
    return newPatient;
  }

  async getPatients(userId: string): Promise<Patient[]> {
    return await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .orderBy(desc(patients.createdAt));
  }

  async getPatientById(id: number, userId: string): Promise<Patient | undefined> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.userId, userId)));
    return patient;
  }

  async updatePatient(id: number, patient: Partial<InsertPatient>, userId: string): Promise<Patient | undefined> {
    const [updatedPatient] = await db
      .update(patients)
      .set({ ...patient, updatedAt: new Date() })
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning();
    return updatedPatient;
  }

  async deletePatient(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(patients)
      .where(and(eq(patients.id, id), eq(patients.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async searchPatients(userId: string, searchTerm?: string, salesRep?: string, referralSource?: string): Promise<Patient[]> {
    const baseConditions = [eq(patients.userId, userId)];

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

  async deletePatientTimelineEvent(id: number, userId: string): Promise<boolean> {
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

  async getPatientTreatments(patientId: number, userId: string): Promise<PatientTreatment[]> {
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

  async updatePatientTreatment(id: number, treatment: Partial<InsertPatientTreatment>, userId: string): Promise<PatientTreatment | undefined> {
    // Remove userId from treatment data to avoid foreign key constraint issues
    const { userId: _, ...treatmentData } = treatment;
    
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

  async deletePatientTreatment(id: number, userId: string): Promise<boolean> {
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
