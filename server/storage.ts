import {
  users,
  leads,
  type User,
  type UpsertUser,
  type Lead,
  type InsertLead,
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
    console.log("Storage searchLeads called with:", { userId, searchTerm, salesRep, referralSource });
    
    const baseConditions = [eq(leads.userId, userId)];

    if (searchTerm) {
      console.log("Adding search term condition");
      baseConditions.push(
        or(
          ilike(leads.firstName, `%${searchTerm}%`),
          ilike(leads.lastName, `%${searchTerm}%`),
          ilike(leads.phoneNumber, `%${searchTerm}%`)
        )!
      );
    }

    if (salesRep) {
      console.log("Adding sales rep condition:", salesRep);
      baseConditions.push(eq(leads.salesRep, salesRep));
    }

    if (referralSource) {
      console.log("Adding referral source condition");
      baseConditions.push(ilike(leads.referralSource, `%${referralSource}%`));
    }

    const result = await db
      .select()
      .from(leads)
      .where(and(...baseConditions))
      .orderBy(desc(leads.createdAt));
      
    console.log("Query result count:", result.length);
    return result;
  }
}

export const storage = new DatabaseStorage();
