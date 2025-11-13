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
  salesRepName: varchar("sales_rep_name"), // for sales reps, their name in the system (legacy)
  salesRepId: integer("sales_rep_id").references(() => salesReps.id, { onDelete: "set null" }), // FK to salesReps
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales representatives table
export const salesReps = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").unique(),
  phoneNumber: varchar("phone_number"),
  isActive: boolean("is_active").default(true).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("10.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Providers table
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  // Basic Provider Info
  name: varchar("name").notNull(), // Provider Name
  taxIdNumber: varchar("tax_id_number"), // Tax ID Number
  
  // Practice Information
  practiceName: varchar("practice_name"), // Practice Name
  shipToAddress: text("ship_to_address"), // Ship To Address
  city: varchar("city"), // City
  state: varchar("state"), // State
  zipCode: varchar("zip_code"), // ZIP
  
  // Contact Information
  contactName: varchar("contact_name"), // Contact Name
  phoneNumber: varchar("phone_number"), // Contact Phone
  email: varchar("email"), // Contact Email
  practicePhone: varchar("practice_phone"), // Practice Phone
  practiceFax: varchar("practice_fax"), // Practice Fax
  practiceEmail: varchar("practice_email"), // Practice Email
  
  // Billing NPI Information
  individualNpi: varchar("individual_npi"), // Individual NPI
  groupNpi: varchar("group_npi"), // Group NPI
  ptan: varchar("ptan"), // PTAN
  
  // Bill To Information
  billToName: varchar("bill_to_name"), // Bill To
  billToCity: varchar("bill_to_city"), // Bill To City
  billToState: varchar("bill_to_state"), // Bill To State
  billToZip: varchar("bill_to_zip"), // Bill To ZIP
  
  // Accounts Payable Contact
  apContactName: varchar("ap_contact_name"), // Accounts Payable Contact Name
  apPhone: varchar("ap_phone"), // Accounts Payable Phone
  apEmail: varchar("ap_email"), // Accounts Payable Email
  
  // Legacy fields (keeping for backward compatibility)
  npiNumber: varchar("npi_number"), // Legacy NPI field
  statesCovered: varchar("states_covered"), // Legacy states field
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referral Sources table
export const referralSources = pgTable("referral_sources", {
  id: serial("id").primaryKey(),
  facilityName: varchar("facility_name").notNull(),
  contactPerson: varchar("contact_person"),
  email: varchar("email").unique(),
  phoneNumber: varchar("phone_number"),
  address: text("address"),
  facilityType: varchar("facility_type"), // Hospital, Clinic, SNF, etc.
  referralVolume: varchar("referral_volume"), // Low, Medium, High
  relationshipStatus: varchar("relationship_status").default("Active"), // Active, Inactive, Prospect
  notes: text("notes"),
  salesRep: varchar("sales_rep"), // Assigned sales rep
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
  referralSourceId: integer("referral_source_id").references(() => referralSources.id),
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

// Provider Sales Rep assignments table (many-to-many relationship)
export const providerSalesReps = pgTable("provider_sales_reps", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id, { onDelete: "cascade" }).notNull(),
  salesRepId: integer("sales_rep_id").references(() => salesReps.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral Source Sales Rep assignments table (many-to-many relationship)
export const referralSourceSalesReps = pgTable("referral_source_sales_reps", {
  id: serial("id").primaryKey(),
  referralSourceId: integer("referral_source_id").references(() => referralSources.id, { onDelete: "cascade" }).notNull(),
  salesRepId: integer("sales_rep_id").references(() => salesReps.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProviderSalesRepSchema = createInsertSchema(providerSalesReps).omit({
  id: true,
  createdAt: true,
});

export type InsertProviderSalesRep = z.infer<typeof insertProviderSalesRepSchema>;
export type ProviderSalesRep = typeof providerSalesReps.$inferSelect;

export const insertProviderSchema = createInsertSchema(providers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providers.$inferSelect;

export const insertReferralSourceSchema = createInsertSchema(referralSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReferralSource = z.infer<typeof insertReferralSourceSchema>;
export type ReferralSource = typeof referralSources.$inferSelect;

export const insertReferralSourceSalesRepSchema = createInsertSchema(referralSourceSalesReps).omit({
  id: true,
  createdAt: true,
});

export type InsertReferralSourceSalesRep = z.infer<typeof insertReferralSourceSalesRepSchema>;
export type ReferralSourceSalesRep = typeof referralSourceSalesReps.$inferSelect;

// Referral Source Contacts table
export const referralSourceContacts = pgTable("referral_source_contacts", {
  id: serial("id").primaryKey(),
  referralSourceId: integer("referral_source_id").references(() => referralSources.id, { onDelete: "cascade" }).notNull(),
  contactName: varchar("contact_name").notNull(),
  titlePosition: varchar("title_position"),
  phoneNumber: varchar("phone_number"),
  email: varchar("email"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReferralSourceContactSchema = createInsertSchema(referralSourceContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReferralSourceContact = z.infer<typeof insertReferralSourceContactSchema>;
export type ReferralSourceContact = typeof referralSourceContacts.$inferSelect;

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

// Referral Source Timeline Events
export const referralSourceTimelineEvents = pgTable("referral_source_timeline_events", {
  id: serial("id").primaryKey(),
  referralSourceId: integer("referral_source_id").references(() => referralSources.id).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'created', 'note', 'meeting', 'call', 'visit', 'contract_update'
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  createdBy: varchar("created_by", { length: 100 }), // Username who created the event
  createdAt: timestamp("created_at").defaultNow(),
  userId: integer("user_id").references(() => users.id).notNull(),
});

export const insertReferralSourceTimelineEventSchema = createInsertSchema(referralSourceTimelineEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertReferralSourceTimelineEvent = z.infer<typeof insertReferralSourceTimelineEventSchema>;
export type ReferralSourceTimelineEvent = typeof referralSourceTimelineEvents.$inferSelect;

// Patient Treatments table for IVR approved patients (now includes invoice data)
export const patientTreatments = pgTable("patient_treatments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referralSourceId: integer("referral_source_id").references(() => referralSources.id),
  treatmentNumber: integer("treatment_number").notNull(),
  woundSizeAtTreatment: decimal("wound_size_at_treatment", { precision: 8, scale: 2 }),
  skinGraftType: varchar("skin_graft_type").notNull(),
  qCode: varchar("q_code", { length: 20 }), // Q code for graft type
  pricePerSqCm: decimal("price_per_sq_cm", { precision: 10, scale: 2 }).notNull(),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).notNull(),
  invoiceTotal: decimal("invoice_total", { precision: 12, scale: 2 }).notNull(),
  nxtCommission: decimal("nxt_commission", { precision: 12, scale: 2 }).notNull(),
  salesRep: varchar("sales_rep").notNull(), // Sales rep name
  salesRepCommissionRate: decimal("sales_rep_commission_rate", { precision: 5, scale: 2 }).notNull(),
  salesRepCommission: decimal("sales_rep_commission", { precision: 12, scale: 2 }).notNull(),
  treatmentDate: timestamp("treatment_date").notNull(),
  status: varchar("status").notNull().default("active"), // active, completed, cancelled
  actingProvider: varchar("acting_provider"), // Link to provider name
  notes: text("notes"),
  // Invoice-specific fields added from invoices table
  invoiceStatus: varchar("invoice_status").notNull().default("open"), // open, payable, closed
  invoiceDate: date("invoice_date"),
  invoiceNo: varchar("invoice_no"),
  payableDate: date("payable_date"),
  paymentDate: date("payment_date"), // Actual date payment was received (Invoice Payment Date)
  paidAt: timestamp("paid_at"), // Timestamp when marked as paid (for commission reports)
  commissionPaymentDate: date("commission_payment_date"), // Date when NXT receives commission from tissue bank
  aczPayDate: date("acz_pay_date"), // Date when NXT sends commission payments to sales reps
  totalCommission: decimal("total_commission", { precision: 12, scale: 2 }), // Total commission (rep + NXT)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPatientTreatmentSchema = createInsertSchema(patientTreatments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  treatmentDate: z.union([z.date(), z.string().min(1, "Treatment date is required")]),
  invoiceDate: z.union([z.date(), z.string(), z.null()]).optional(),
  payableDate: z.union([z.date(), z.string(), z.null()]).optional(),
  paymentDate: z.union([z.date(), z.string(), z.null()]).optional(),
  paidAt: z.union([z.date(), z.string(), z.null()]).optional(),
  commissionPaymentDate: z.union([z.date(), z.string(), z.null()]).optional(),
  aczPayDate: z.union([z.date(), z.string(), z.null()]).optional(),
});

export type InsertPatientTreatment = z.infer<typeof insertPatientTreatmentSchema>;
export type PatientTreatment = typeof patientTreatments.$inferSelect;

// Treatment Commissions table (many-to-many relationship between treatments and sales reps)
export const treatmentCommissions = pgTable("treatment_commissions", {
  id: serial("id").primaryKey(),
  treatmentId: integer("treatment_id").notNull().references(() => patientTreatments.id, { onDelete: "cascade" }),
  salesRepId: integer("sales_rep_id").notNull().references(() => salesReps.id, { onDelete: "cascade" }),
  salesRepName: varchar("sales_rep_name").notNull(), // Denormalized for easier querying
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // percentage (e.g., 20.00 for 20%)
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(), // calculated dollar amount
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTreatmentCommissionSchema = createInsertSchema(treatmentCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTreatmentCommission = z.infer<typeof insertTreatmentCommissionSchema>;
export type TreatmentCommission = typeof treatmentCommissions.$inferSelect;

// Invitations table for secure registration
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  token: varchar("token", { length: 128 }).unique().notNull(),
  role: varchar("role").default("sales_rep").notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("10.00"),
  invitedBy: integer("invited_by").notNull().references(() => users.id),
  isUsed: boolean("is_used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  token: true,
  isUsed: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  expiresAt: z.union([z.date(), z.string()]).optional(),
});

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

// Update sales reps table to include commission rate
export const salesRepsWithCommission = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").unique(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull().default("10.00"), // percentage
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});


// Surgical Commissions table
export const surgicalCommissions = pgTable("surgical_commissions", {
  id: serial("id").primaryKey(),
  orderDate: date("order_date").notNull(),
  dateDue: date("date_due"),
  datePaid: date("date_paid"),
  invoiceNumber: varchar("invoice_number"),
  orderNumber: varchar("order_number"),
  facility: varchar("facility").notNull(),
  contact: varchar("contact").notNull(),
  itemSku: varchar("item_sku"),
  quantity: integer("quantity").notNull().default(0),
  sale: decimal("sale", { precision: 10, scale: 2 }).notNull().default("0.00"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  commissionPaid: varchar("commission_paid"),
  commissionPaidDate: date("commission_paid_date"),
  status: varchar("status").notNull().default("owed"), // 'paid' or 'owed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSurgicalCommissionSchema = createInsertSchema(surgicalCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  orderDate: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    // Handle empty strings
    if (typeof val === 'string' && val.trim() === '') {
      return new Date().toISOString().split('T')[0];
    }
    // Convert M/D/YYYY or M/D format to YYYY-MM-DD
    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 2) {
        // M/D format - assume current year
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = new Date().getFullYear();
        return `${year}-${month}-${day}`;
      } else if (parts.length === 3) {
        // M/D/YYYY format
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return val;
  }),
  dateDue: z.union([z.string(), z.date(), z.null(), z.undefined()]).transform((val) => {
    if (!val || val === '') return null;
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    // Convert M/D/YYYY or M/D format to YYYY-MM-DD
    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 2) {
        // M/D format - assume current year
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = new Date().getFullYear();
        return `${year}-${month}-${day}`;
      } else if (parts.length === 3) {
        // M/D/YYYY format
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return val;
  }).optional().nullable(),
  datePaid: z.union([z.string(), z.date(), z.null(), z.undefined()]).transform((val) => {
    if (!val || val === '') return null;
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    // Convert M/D/YYYY or M/D format to YYYY-MM-DD
    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 2) {
        // M/D format - assume current year
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = new Date().getFullYear();
        return `${year}-${month}-${day}`;
      } else if (parts.length === 3) {
        // M/D/YYYY format
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return val;
  }).optional().nullable(),
  commissionPaidDate: z.union([z.string(), z.date(), z.null(), z.undefined()]).transform((val) => {
    if (!val || val === '') return null;
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    // Convert M/D/YYYY or M/D format to YYYY-MM-DD
    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 2) {
        // M/D format - assume current year
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = new Date().getFullYear();
        return `${year}-${month}-${day}`;
      } else if (parts.length === 3) {
        // M/D/YYYY format
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return val;
  }).optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  orderNumber: z.string().optional().nullable(),
  itemSku: z.string().optional().nullable(),
  commissionPaid: z.string().optional().nullable(),
  quantity: z.number().default(0),
  sale: z.number().default(0),
  commissionRate: z.number().default(0),
});

export type InsertSurgicalCommission = z.infer<typeof insertSurgicalCommissionSchema>;
export type SurgicalCommission = typeof surgicalCommissions.$inferSelect;

// Pipeline notes table for quick notes and pipeline management
export const pipelineNotes = pgTable("pipeline_notes", {
  id: serial("id").primaryKey(),
  patient: text("patient").notNull(),
  assignedSalesRepId: integer("assigned_sales_rep_id").references(() => salesReps.id, { onDelete: "set null" }),
  providerId: integer("provider_id").references(() => providers.id, { onDelete: "set null" }),
  woundSize: text("wound_size"),
  nextUpdate: date("next_update"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  sortOrder: integer("sort_order").default(0), // Keep for backward compatibility
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  repIdx: index("idx_pipeline_notes_rep").on(table.assignedSalesRepId),
  providerIdx: index("idx_pipeline_notes_provider").on(table.providerId),
}));

export type InsertPipelineNote = typeof pipelineNotes.$inferInsert;
export type PipelineNote = typeof pipelineNotes.$inferSelect;

// Zod schemas for pipeline notes
export const insertPipelineNoteSchema = createInsertSchema(pipelineNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sortOrder: true,
});

// Patient referrals table for tracking incoming referrals from referral sources
export const patientReferrals = pgTable("patient_referrals", {
  id: serial("id").primaryKey(),
  patientName: varchar("patient_name"), // Now nullable for Kanban workflow - filled via inline edit
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "set null" }),
  assignedSalesRepId: integer("assigned_sales_rep_id").references(() => salesReps.id, { onDelete: "set null" }),
  assignedProviderId: integer("assigned_provider_id").references(() => providers.id, { onDelete: "set null" }),
  referralDate: date("referral_date"), // Now nullable - auto-filled on upload
  referralSourceId: integer("referral_source_id").references(() => referralSources.id, { onDelete: "set null" }),
  priority: varchar("priority").default("Medium").notNull(), // Low, Medium, High
  status: varchar("status").default("Active").notNull(), // Legacy field - kept for rollback
  kanbanStatus: varchar("kanban_status").default("new").notNull(), // new, in_review, approved, denied, completed - validated by Zod
  patientInsurance: varchar("patient_insurance"), // Inline editable field
  estimatedWoundSize: varchar("estimated_wound_size"), // Inline editable field
  notes: text("notes"),
  archivedAt: timestamp("archived_at"), // Soft delete - null = active, non-null = archived
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  patientIdx: index("idx_patient_referrals_patient").on(table.patientId),
  repIdx: index("idx_patient_referrals_rep").on(table.assignedSalesRepId),
  sourceIdx: index("idx_patient_referrals_source").on(table.referralSourceId),
  kanbanStatusIdx: index("idx_patient_referrals_kanban_status").on(table.kanbanStatus),
}));

export type InsertPatientReferral = typeof patientReferrals.$inferInsert;
export type PatientReferral = typeof patientReferrals.$inferSelect;

// Zod schema for inserting patient referrals (Kanban workflow)
export const insertPatientReferralSchema = createInsertSchema(patientReferrals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  kanbanStatus: true, // Auto-filled as 'new'
  status: true, // Legacy field, auto-filled
}).extend({
  patientName: z.string().nullable().optional(),
  referralDate: z.string().nullable().optional(),
  patientInsurance: z.string().nullable().optional(),
  estimatedWoundSize: z.string().nullable().optional(),
});

// Zod schema for updating inline fields (sales reps can do this)
export const updatePatientReferralInlineSchema = z.object({
  patientName: z.string().nullable().optional(),
  patientInsurance: z.string().nullable().optional(),
  estimatedWoundSize: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Zod schema for updating kanban status (admin only)
export const updatePatientReferralStatusSchema = z.object({
  kanbanStatus: z.enum(["new", "in_review", "approved", "denied", "completed"]),
});

// Referral files table for storing uploaded PDF documents
export const referralFiles = pgTable("referral_files", {
  id: serial("id").primaryKey(),
  patientReferralId: integer("patient_referral_id").references(() => patientReferrals.id, { onDelete: "cascade" }),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "cascade" }),
  fileName: varchar("file_name").notNull(),
  filePath: varchar("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type").default("application/pdf"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  referralIdx: index("idx_referral_files_referral").on(table.patientReferralId),
  patientIdx: index("idx_referral_files_patient").on(table.patientId),
}));

export type InsertReferralFile = typeof referralFiles.$inferInsert;
export type ReferralFile = typeof referralFiles.$inferSelect;

export const insertReferralFileSchema = createInsertSchema(referralFiles).omit({
  id: true,
  createdAt: true,
});
