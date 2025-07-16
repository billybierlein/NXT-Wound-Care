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

// User storage table for local authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  password: varchar("password").notNull(),
  role: varchar("role").default("sales_rep").notNull(), // admin or sales_rep
  salesRepName: varchar("sales_rep_name"), // for sales reps, their name in the system
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales representatives table
export const salesReps = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").unique(),
  isActive: boolean("is_active").default(true).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("10.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Providers table
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").unique(),
  phoneNumber: varchar("phone_number"),
  npiNumber: varchar("npi_number"),
  statesCovered: varchar("states_covered"),
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
  provider: varchar("provider"), // Link to provider name
  woundType: varchar("wound_type"),
  woundSize: varchar("wound_size"),
  patientStatus: varchar("patient_status").default("Evaluation Stage"),
  notes: text("notes"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Login and registration schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterUserData = z.infer<typeof registerUserSchema>;

export const insertSalesRepSchema = createInsertSchema(salesReps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSalesRep = z.infer<typeof insertSalesRepSchema>;
export type SalesRep = typeof salesReps.$inferSelect;

export const insertProviderSchema = createInsertSchema(providers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providers.$inferSelect;

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
  createdBy: varchar("created_by", { length: 100 }), // Username who created the event
  createdAt: timestamp("created_at").defaultNow(),
  userId: integer("user_id").references(() => users.id).notNull(),
});

export const insertPatientTimelineEventSchema = createInsertSchema(patientTimelineEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertPatientTimelineEvent = z.infer<typeof insertPatientTimelineEventSchema>;
export type PatientTimelineEvent = typeof patientTimelineEvents.$inferSelect;

// Patient Treatments table for IVR approved patients
export const patientTreatments = pgTable("patient_treatments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  treatmentNumber: integer("treatment_number").notNull(),
  woundSizeAtTreatment: decimal("wound_size_at_treatment", { precision: 8, scale: 2 }),
  skinGraftType: varchar("skin_graft_type").notNull(),
  qCode: varchar("q_code", { length: 20 }), // Q code for graft type
  pricePerSqCm: decimal("price_per_sq_cm", { precision: 10, scale: 2 }).notNull(),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).notNull(),
  invoiceTotal: decimal("invoice_total", { precision: 12, scale: 2 }).notNull(),
  nxtCommission: decimal("nxt_commission", { precision: 12, scale: 2 }).notNull(),
  salesRepCommissionRate: decimal("sales_rep_commission_rate", { precision: 5, scale: 2 }).notNull(),
  salesRepCommission: decimal("sales_rep_commission", { precision: 12, scale: 2 }).notNull(),
  treatmentDate: timestamp("treatment_date").notNull(),
  status: varchar("status").notNull().default("active"), // active, completed, cancelled
  actingProvider: varchar("acting_provider"), // Link to provider name
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPatientTreatmentSchema = createInsertSchema(patientTreatments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPatientTreatment = z.infer<typeof insertPatientTreatmentSchema>;
export type PatientTreatment = typeof patientTreatments.$inferSelect;

// Update sales reps table to include commission rate
export const salesRepsWithCommission = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").unique(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull().default("10.00"), // percentage
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  status: varchar("status").notNull().default("open"), // open, payable, closed
  invoiceDate: date("invoice_date").notNull(),
  invoiceNo: varchar("invoice_no").notNull().unique(),
  payableDate: date("payable_date").notNull(),
  treatmentStartDate: date("treatment_start_date").notNull(),
  patientName: varchar("patient_name").notNull(),
  salesRep: varchar("sales_rep").notNull(),
  provider: varchar("provider").notNull(),
  graft: varchar("graft").notNull(),
  productCode: varchar("product_code").notNull(), // Q code
  size: decimal("size", { precision: 10, scale: 2 }).notNull(), // sq cm
  totalBillable: decimal("total_billable", { precision: 10, scale: 2 }).notNull(), // Treatment revenue
  totalInvoice: decimal("total_invoice", { precision: 10, scale: 2 }).notNull(), // 60% of revenue
  totalCommission: decimal("total_commission", { precision: 10, scale: 2 }).notNull(), // Total commission (rep + NXT)
  repCommission: decimal("rep_commission", { precision: 10, scale: 2 }).notNull(), // Sales rep commission
  nxtCommission: decimal("nxt_commission", { precision: 10, scale: 2 }).notNull(), // NXT commission
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  invoiceDate: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    return val;
  }),
  payableDate: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    return val;
  }),
  treatmentStartDate: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    return val;
  }),
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
