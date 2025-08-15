CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"token" varchar NOT NULL,
	"role" varchar DEFAULT 'sales_rep' NOT NULL,
	"invited_by" integer NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"invoice_date" date NOT NULL,
	"invoice_no" varchar NOT NULL,
	"payable_date" date NOT NULL,
	"treatment_start_date" date NOT NULL,
	"patient_name" varchar NOT NULL,
	"sales_rep" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"graft" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"size" numeric(10, 2) NOT NULL,
	"total_billable" numeric(10, 2) NOT NULL,
	"total_invoice" numeric(10, 2) NOT NULL,
	"total_commission" numeric(10, 2) NOT NULL,
	"rep_commission" numeric(10, 2) NOT NULL,
	"nxt_commission" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient_timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"event_date" timestamp NOT NULL,
	"wound_size" numeric(10, 2),
	"created_by" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_treatments" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"referral_source_id" integer,
	"treatment_number" integer NOT NULL,
	"wound_size_at_treatment" numeric(8, 2),
	"skin_graft_type" varchar NOT NULL,
	"q_code" varchar(20),
	"price_per_sq_cm" numeric(10, 2) NOT NULL,
	"total_revenue" numeric(12, 2) NOT NULL,
	"invoice_total" numeric(12, 2) NOT NULL,
	"nxt_commission" numeric(12, 2) NOT NULL,
	"sales_rep" varchar NOT NULL,
	"sales_rep_commission_rate" numeric(5, 2) NOT NULL,
	"sales_rep_commission" numeric(12, 2) NOT NULL,
	"treatment_date" timestamp NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"acting_provider" varchar,
	"notes" text,
	"invoice_status" varchar DEFAULT 'open' NOT NULL,
	"invoice_date" date,
	"invoice_no" varchar,
	"payable_date" date,
	"total_commission" numeric(12, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"date_of_birth" date NOT NULL,
	"phone_number" varchar NOT NULL,
	"insurance" varchar NOT NULL,
	"custom_insurance" varchar,
	"referral_source" varchar NOT NULL,
	"referral_source_id" integer,
	"sales_rep" varchar NOT NULL,
	"provider" varchar,
	"wound_type" varchar,
	"wound_size" varchar,
	"patient_status" varchar DEFAULT 'Evaluation Stage',
	"notes" text,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "provider_sales_reps" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"sales_rep_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"tax_id_number" varchar,
	"practice_name" varchar,
	"ship_to_address" text,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"contact_name" varchar,
	"phone_number" varchar,
	"email" varchar,
	"practice_phone" varchar,
	"practice_fax" varchar,
	"practice_email" varchar,
	"individual_npi" varchar,
	"group_npi" varchar,
	"ptan" varchar,
	"bill_to_name" varchar,
	"bill_to_city" varchar,
	"bill_to_state" varchar,
	"bill_to_zip" varchar,
	"ap_contact_name" varchar,
	"ap_phone" varchar,
	"ap_email" varchar,
	"npi_number" varchar,
	"states_covered" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_source_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_source_id" integer NOT NULL,
	"contact_name" varchar NOT NULL,
	"title_position" varchar,
	"phone_number" varchar,
	"email" varchar,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_source_sales_reps" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_source_id" integer NOT NULL,
	"sales_rep_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_source_timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_source_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"event_date" timestamp NOT NULL,
	"created_by" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_name" varchar NOT NULL,
	"contact_person" varchar,
	"email" varchar,
	"phone_number" varchar,
	"address" text,
	"facility_type" varchar,
	"referral_volume" varchar,
	"relationship_status" varchar DEFAULT 'Active',
	"notes" text,
	"sales_rep" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "referral_sources_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sales_reps" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar,
	"commission_rate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_reps_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"password" varchar NOT NULL,
	"role" varchar DEFAULT 'sales_rep' NOT NULL,
	"sales_rep_name" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_timeline_events" ADD CONSTRAINT "patient_timeline_events_patient_id_leads_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_timeline_events" ADD CONSTRAINT "patient_timeline_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_patient_id_leads_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_treatments" ADD CONSTRAINT "patient_treatments_referral_source_id_referral_sources_id_fk" FOREIGN KEY ("referral_source_id") REFERENCES "public"."referral_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_referral_source_id_referral_sources_id_fk" FOREIGN KEY ("referral_source_id") REFERENCES "public"."referral_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_sales_reps" ADD CONSTRAINT "provider_sales_reps_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_sales_reps" ADD CONSTRAINT "provider_sales_reps_sales_rep_id_sales_reps_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_source_contacts" ADD CONSTRAINT "referral_source_contacts_referral_source_id_referral_sources_id_fk" FOREIGN KEY ("referral_source_id") REFERENCES "public"."referral_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_source_sales_reps" ADD CONSTRAINT "referral_source_sales_reps_referral_source_id_referral_sources_id_fk" FOREIGN KEY ("referral_source_id") REFERENCES "public"."referral_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_source_sales_reps" ADD CONSTRAINT "referral_source_sales_reps_sales_rep_id_sales_reps_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_source_timeline_events" ADD CONSTRAINT "referral_source_timeline_events_referral_source_id_referral_sources_id_fk" FOREIGN KEY ("referral_source_id") REFERENCES "public"."referral_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_source_timeline_events" ADD CONSTRAINT "referral_source_timeline_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");