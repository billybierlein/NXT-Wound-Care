CREATE TABLE "surgical_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_date" date NOT NULL,
	"date_due" date,
	"date_paid" date,
	"invoice_number" varchar,
	"order_number" varchar,
	"facility" varchar NOT NULL,
	"contact" varchar NOT NULL,
	"item_sku" varchar,
	"quantity" integer DEFAULT 0 NOT NULL,
	"sale" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"commission_paid" varchar,
	"commission_paid_date" date,
	"status" varchar DEFAULT 'owed' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treatment_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"treatment_id" integer NOT NULL,
	"sales_rep_id" integer NOT NULL,
	"sales_rep_name" varchar NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "token" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "treatment_commissions" ADD CONSTRAINT "treatment_commissions_treatment_id_patient_treatments_id_fk" FOREIGN KEY ("treatment_id") REFERENCES "public"."patient_treatments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_commissions" ADD CONSTRAINT "treatment_commissions_sales_rep_id_sales_reps_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;