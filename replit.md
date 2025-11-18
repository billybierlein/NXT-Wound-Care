# WoundCare Patient Manager

## Overview

A full-stack web application designed for managing patients in the wound care industry. It provides secure authentication, comprehensive patient management, CSV export, and responsive design. The application helps wound care sales representatives track patient referrals and manage field activities from mobile devices, aiming to optimize patient care coordination and sales efficiency. The project vision is to enhance the capabilities of wound care professionals and sales teams through robust digital tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and dark mode support
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state management
- **Form Handling**: React Hook Form with Zod validation
- **UI/UX Decisions**: Mobile-first responsive design, consistent component library, color-coded badges for status, professional layouts for forms and dashboards. Branding features an NXT company logo.
- **Technical Implementations**: Comprehensive timeline visualization system, dynamic form fields (e.g., custom insurance, graft selection with auto-population of ASP pricing and Q codes), inline editing for statuses, role-based UI adjustments (e.g., sales rep specific views), PDF export for AI-generated content and calculators.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: Custom username/password authentication system replacing Replit Auth, with secure password hashing. Role-based access control for features and data visibility.
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful endpoints with JSON responses
- **Error Handling**: Centralized error middleware

### Database Architecture
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations
- **Data Models**: Patients, Users, Referral Sources, Providers, Timeline Events, Treatments, Sales Representatives, Referral Source Contacts. Includes junction tables for many-to-many relationships (e.g., referral_source_sales_reps).
- **Invoice Data Integration**: All invoice-related data is stored directly within the patient_treatments table, eliminating redundancy and ensuring a single source of truth.

### System Design Choices
- **Patient Management**: Centralized CRUD operations for patients, treatments, providers, and referral sources. Includes features like patient status tracking, wound type/size tracking, and integration of patient timeline events.
- **Financial Calculations**: Automated calculations for revenue, invoice totals, sales rep commissions, and NXT commissions. Includes a Provider Revenue Calculator with advanced billing fee calculations and PDF export.
- **Reporting**: Sales Reports page with pipeline, active, and completed treatment overviews, featuring detailed filtering and total summaries.
- **AI Assistant**: Dedicated AI Assistant page with ChatGPT-style interface for medical insights, wound assessment, treatment protocol generation, and educational content generation, with markdown-to-HTML rendering and PDF download.
- **Consolidation**: Invoice and patient treatment functionalities are merged into a unified dashboard with complete elimination of redundant invoice table.
- **Data Consistency**: Aggressive cache invalidation and auto-refresh mechanisms ensure real-time data synchronization across user sessions.
- **Naming Convention**: Consistent terminology change from "leads" to "patients" applied throughout the entire application and database.
- **Architecture Cleanup (September 2025)**: Removed redundant invoices table and consolidated all invoice data into patient_treatments for single source of truth. Eliminated unused invoice management interface and redundant API endpoints.
- **Recent Fixes**: Fixed Month to Date filter on Patient Treatments page to include entire current month instead of only up to today's date (August 2025). Fixed 404 errors when clicking patient names in Sales Reports - corrected route paths from `/patients/` to `/patient-profile/`. Added Total Squares summary dashboard and monthly bar chart for admin users on Sales Reports page.
- **Email Notifications**: Implemented automated email notification system for new sales rep registrations. Admin notifications are sent to billy@nxtmedical.us when sales reps register through invitation links, with reminders to assign commission rates.
- **Invoice Management Access Control**: Invoice Management page and commission reporting restricted to admin users only. Sales reps cannot access invoice data or commission calculations for security and privacy.
- **Custom Domain Configuration**: All email notification links and system URLs updated to use custom domain app.nxtmedical.us instead of Replit domains. This ensures consistent branding and proper routing for production deployment. Email invitation links now work correctly after deployment, directing users to the custom domain for registration.
- **Enhanced Surgical Commissions Features**: Added comprehensive inline editing capabilities for commission paid date and status fields, with click-to-edit functionality. Implemented sortable order date column with ascending/descending toggle. Commission calculations now use status-based tracking (paid vs owed) for accurate financial reporting. Commission rates displayed as percentages with automatic calculation of dollar amounts.
- **Centralized Graft Pricing Data (September 2025)**: Consolidated all graft ASP (Average Sales Price) data into a single source of truth at `shared/constants/grafts.ts`. Implemented quarterly versioning pattern with year, quarter, and active/inactive flags. This centralization eliminates duplicate data across calculator, patient-profile, and public-calculator pages. Quarterly pricing updates now require editing only one file instead of three. Added validation helpers and `/api/health/grafts` endpoint for deployment verification. Nash (surgical sales rep) can now see surgical commission data alongside treatment commissions.
- **Kanban Patient Referrals System (November 2025)**: Completely redesigned patient referrals from form-based to Kanban workflow management. Features drag-and-drop PDF upload (no form fields required), 4-column status board (New/Needs Review, Medicare, Advantage Plans, Patient Created), inline editing for patient details (name, insurance, wound size), role-based permissions (sales reps can inline edit their assignments, only admins can drag between columns), and comprehensive patient creation from approved referrals with full form prefilling and automatic PDF file attachment. Email notifications sent to info@nxtmedical.us and ernest@nxtmedical.us when new referrals uploaded. Built with @hello-pangea/dnd library.
  - **Advanced Filtering & Customization (November 2025)**: Added comprehensive filter UI above Kanban board with 4 controls (Date, Referral Source, Sales Rep, Insurance Type) using AND logic. Implemented Reset Filters button for quick clearing. Added dropdown fields on "New / Needs Review" cards for assigning sales reps and referral sources, with "Add New Source" option that opens reusable dialog for creating referral sources inline. Auto-sorting of New column by referral send date (newest first). All dropdowns use proper type conversion (string to integer) for backend schema validation.
- **Enhanced Patient Creation from Referrals (November 2025)**: Implemented reusable PatientForm component with intelligent form prefilling from referral data (name splitting, insurance mapping, wound size, assigned sales rep). Features dirty-state guarding to prevent async data from wiping user edits, role-based sales rep enforcement (admins select from dropdown, sales reps auto-assigned), and automatic PDF file attachment to newly created patients. Backend safely links only unassigned referral files using NULL-safety checks to prevent reassigning existing attachments.
- **Referral Archive System (November 2025)**: Implemented soft-delete archival for completed patient referrals using timestamp-based pattern (archivedAt field). Archive button appears on completed referral cards with AlertDialog confirmation. Secure archive/unarchive API endpoints with requireAuth middleware and role-based authorization (admins or assigned sales rep only). Archived referrals are automatically filtered from Kanban board queries, cleaning up the board while preserving data for potential future restoration. Archive mutations include proper cache invalidation and toast feedback for seamless UX.
- **Optimistic Kanban Updates (November 2025)**: Enhanced Kanban drag-and-drop with TanStack Query v5 optimistic updates for instant, smooth card movements. Cards now update immediately when dragged (no visual revert), with automatic rollback on server errors. Implementation uses onMutate for cache snapshots and optimistic UI updates, onError for rollback with toast notifications, and onSettled for eventual server synchronization. Eliminates previous delay where cards would snap back to original position before jumping to destination.
- **Multiple File Upload Support (November 2025)**: Added ability to upload multiple files to each referral card to accommodate scenarios where patient files come from different locations. Features include: display of all files per referral with individual download links, "Upload Additional File" button on non-completed referral cards, drag-and-drop file upload dialog for additional files, role-based authorization (admins and assigned sales reps can upload), and automatic cache invalidation for real-time UI updates. Backend endpoint `/api/referrals/:id/upload-file` handles secure file uploads with proper authorization checks and file storage.
- **Patient Profile Enhancements (November 2025)**: Fixed critical bug in Edit Patient form where sales rep field was being incorrectly overridden for non-admin users in handleEditSubmit. Changed from role-based override (`user.role === 'admin' ? editFormData.salesRep : user.salesRepName`) to preserving existing assignment (`editFormData.salesRep`), ensuring all users see and save the patient's actual assigned sales rep. Added file upload capability directly to patient profile Files section with Upload File button (data-testid="button-upload-file") that opens drag-and-drop dialog for PDF and image uploads. Upload mutation posts to `/api/referral-files` endpoint with patientId, invalidates files cache on success. Also fixed authentication password format issue for admin user (migrated from bcrypt to scrypt format to match current auth implementation).
- **Enhanced Patient Management Features (November 2025)**: Added comprehensive filtering to Manage Patients page with patient status and insurance dropdowns, enabling users to quickly find patients by their current status and insurance provider. Made patient names clickable hyperlinks in Provider Profile (Patients, Treatments, and Invoices tabs), providing quick navigation to patient details. Added "Patient Referrals" tab to Referral Source profile pages showing all patients referred from that source with one-click navigation to patient profiles. Removed decorative star icon from sales rep name display in Referral Source profiles for cleaner UI. All backend filter logic added to routes and storage layer with proper Drizzle query conditions.

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver
- **drizzle-orm**: Type-safe ORM with PostgreSQL dialect
- **express**: Web application framework
- **react**: Frontend library
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight routing for React

### UI Dependencies
- **@radix-ui/**: Accessible component primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **react-hook-form**: Form state management
- **zod**: Schema validation library
- **jsPDF**: For generating PDF documents
- **@hello-pangea/dnd**: Drag-and-drop library for Kanban board functionality

### Authentication Dependencies
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store
- **Node.js crypto module**: For secure password hashing