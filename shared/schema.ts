import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  date,
  boolean,
  integer,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales representatives table
export const salesReps = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Patients table
export const patients = pgTable("leads", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  insurance: varchar("insurance").notNull(),
  customInsurance: varchar("custom_insurance"),
  referralSource: varchar("referral_source").notNull(),
  salesRep: varchar("sales_rep").notNull(),
  woundType: varchar("wound_type"),
  woundSize: varchar("wound_size"),
  patientStatus: varchar("patient_status").default("Evaluation Stage"),
  notes: text("notes"),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertSalesRepSchema = createInsertSchema(salesReps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSalesRep = z.infer<typeof insertSalesRepSchema>;
export type SalesRep = typeof salesReps.$inferSelect;

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  woundType: z.string().min(1, "Wound type is required"),
  woundSize: z.string().min(1, "Wound size is required"),
});

export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patients.$inferSelect;

// Patient Timeline Events
export const patientTimelineEvents = pgTable("patient_timeline_events", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'created', 'note', 'wound_measurement', 'appointment', 'treatment', 'call', 'visit'
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  woundSize: decimal("wound_size", { precision: 10, scale: 2 }), // For wound measurements
  createdAt: timestamp("created_at").defaultNow(),
  userId: varchar("user_id").references(() => users.id).notNull(),
});

export const insertPatientTimelineEventSchema = createInsertSchema(patientTimelineEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertPatientTimelineEvent = z.infer<typeof insertPatientTimelineEventSchema>;
export type PatientTimelineEvent = typeof patientTimelineEvents.$inferSelect;
