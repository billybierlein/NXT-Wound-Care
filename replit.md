# WoundCare Patient Manager

## Overview
A full-stack web application for managing patients in the wound care industry. It provides secure authentication, comprehensive patient management, CSV export, and a responsive design, primarily aimed at wound care sales representatives. The application helps track patient referrals and manage field activities from mobile devices, optimizing patient care coordination and sales efficiency. The project seeks to enhance the capabilities of wound care professionals and sales teams through robust digital tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Vite
- **UI**: shadcn/ui (Radix UI primitives), Tailwind CSS (custom design tokens, dark mode)
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Form Handling**: React Hook Form with Zod validation
- **UI/UX**: Mobile-first responsive design, consistent component library, color-coded status badges, professional layouts, NXT company branding.
- **Key Features**: Comprehensive timeline visualization, dynamic form fields (e.g., insurance, graft selection with ASP/Q code auto-population), inline editing for statuses, role-based UI adjustments, PDF export for AI content and calculators.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **Authentication**: Custom username/password (secure hashing), role-based access control.
- **Session Management**: Express sessions with PostgreSQL store
- **API**: RESTful endpoints with JSON responses
- **Error Handling**: Centralized middleware

### Database
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM
- **Schema Management**: Drizzle Kit
- **Data Models**: Patients, Users, Referral Sources, Providers, Timeline Events, Treatments, Sales Representatives, Referral Source Contacts. Invoice data is consolidated within `patient_treatments`.

### System Design
- **Patient Management**: Centralized CRUD for patients, treatments, providers, referral sources; patient status, wound tracking, and timeline integration.
- **Financial Calculations**: Automated revenue, invoice, sales rep, and NXT commission calculations; Provider Revenue Calculator with PDF export.
- **Reporting**: Sales Reports with pipeline, active/completed treatment overviews, filtering, and summaries.
- **AI Assistant**: ChatGPT-style interface for medical insights, wound assessment, treatment protocols, and educational content (markdown-to-HTML, PDF download).
- **Data Consistency**: Aggressive cache invalidation and auto-refresh for real-time synchronization.
- **Terminology**: Consistent use of "patients" instead of "leads."
- **Email Notifications**: Automated notifications for new sales rep registrations (admin alerts) and new referral uploads. Custom domain usage for all email links.
- **Access Control**: Invoice management and commission reporting restricted to admin users.
- **Graft Pricing**: Centralized ASP data in `shared/constants/grafts.ts` with quarterly versioning.
- **Kanban Referrals System**: Drag-and-drop PDF upload, 4-column status board (New/Needs Review, Medicare, Advantage Plans, Patient Created), inline editing for patient details with standardized insurance dropdown (Medicare/Advantage Plan only), role-based permissions, comprehensive patient creation from approved referrals with form prefilling and PDF attachment. Includes advanced filtering and customization, optimistic UI updates, multiple file upload support per referral, and automatic sorting by referral date (newest first). Referral Source profile metrics track Total Referrals, Medicare count, and Advantage Plans count based on insurance field.
- **Referral Archive System**: Soft-delete archival for completed referrals with secure API endpoints and role-based authorization.
- **Patient Profile Enhancements**: Corrected sales rep assignment logic, added file upload capability to patient profiles.
- **Enhanced Patient Management**: Comprehensive filtering on Manage Patients page (status, insurance, sales rep, referral source) with clear all option. Clickable patient names for navigation. "Patient Referrals" tab on Referral Source profiles to track all Kanban referrals, regardless of conversion status, with summary statistics and detailed table view.
- **PDF Preview System**: In-browser PDF preview using reusable PDFPreviewModal component. PDFs open in modal dialog with iframe display instead of downloading. Backend serves PDFs with Content-Disposition: inline for browser preview. Integrated on Kanban referral cards and patient profile file sections with download option.

## External Dependencies

### Core
- **@neondatabase/serverless**: PostgreSQL serverless driver
- **drizzle-orm**: Type-safe ORM
- **express**: Web application framework
- **react**: Frontend library
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight routing

### UI
- **@radix-ui/**: Accessible component primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **react-hook-form**: Form state management
- **zod**: Schema validation
- **jsPDF**: PDF generation
- **@hello-pangea/dnd**: Drag-and-drop library

### Authentication
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store
- **Node.js crypto module**: Password hashing