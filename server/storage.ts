import {
  users,
  leads,
  salesReps,
  type User,
  type UpsertUser,
  type Lead,
  type InsertLead,
  type SalesRep,
  type InsertSalesRep,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Lead operations
  createLead(lead: InsertLead, userId: string): Promise<Lead>;
  getLeads(userId: string): Promise<Lead[]>;
  getLeadById(id: number, userId: string): Promise<Lead | undefined>;
  updateLead(id: number, lead: Partial<InsertLead>, userId: string): Promise<Lead | undefined>;
  deleteLead(id: number, userId: string): Promise<boolean>;
  searchLeads(userId: string, searchTerm?: string, salesRep?: string, referralSource?: string): Promise<Lead[]>;
  
  // Sales Rep operations
  createSalesRep(salesRep: InsertSalesRep): Promise<SalesRep>;
  getSalesReps(): Promise<SalesRep[]>;
  getSalesRepById(id: number): Promise<SalesRep | undefined>;
  updateSalesRep(id: number, salesRep: Partial<InsertSalesRep>): Promise<SalesRep | undefined>;
  deleteSalesRep(id: number): Promise<boolean>;
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

  // Lead operations
  async createLead(lead: InsertLead, userId: string): Promise<Lead> {
    const [newLead] = await db
      .insert(leads)
      .values({ ...lead, userId })
      .returning();
    return newLead;
  }

  async getLeads(userId: string): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId))
      .orderBy(desc(leads.createdAt));
  }

  async getLeadById(id: number, userId: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
    return lead;
  }

  async updateLead(id: number, lead: Partial<InsertLead>, userId: string): Promise<Lead | undefined> {
    const [updatedLead] = await db
      .update(leads)
      .set({ ...lead, updatedAt: new Date() })
      .where(and(eq(leads.id, id), eq(leads.userId, userId)))
      .returning();
    return updatedLead;
  }

  async deleteLead(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async searchLeads(userId: string, searchTerm?: string, salesRep?: string, referralSource?: string): Promise<Lead[]> {
    const baseConditions = [eq(leads.userId, userId)];

    if (searchTerm) {
      baseConditions.push(
        or(
          ilike(leads.firstName, `%${searchTerm}%`),
          ilike(leads.lastName, `%${searchTerm}%`),
          ilike(leads.phoneNumber, `%${searchTerm}%`)
        )!
      );
    }

    if (salesRep) {
      baseConditions.push(eq(leads.salesRep, salesRep));
    }

    if (referralSource) {
      baseConditions.push(ilike(leads.referralSource, `%${referralSource}%`));
    }

    return await db
      .select()
      .from(leads)
      .where(and(...baseConditions))
      .orderBy(desc(leads.createdAt));
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
}

export const storage = new DatabaseStorage();
