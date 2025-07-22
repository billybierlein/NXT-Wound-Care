# WoundCare Patient Manager

## Overview

A complete full-stack web application for managing patients in the wound care industry. Successfully deployed with secure authentication, comprehensive patient management capabilities, CSV export functionality, and responsive design. The application is actively being used by wound care sales representatives to track patient referrals and manage field activity from mobile devices.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (July 22, 2025)

✓ Created comprehensive Referral Sources management system with database schema and sample data
✓ Built referral sources management page with statistics dashboard, filtering, and CRUD operations
✓ Developed detailed referral source profile pages with timeline tracking and editing capabilities
✓ Added navigation integration and proper routing for admin-only access to referral sources
✓ Implemented full database operations with error handling and user feedback for facility partnerships
✓ Fixed SelectItem component errors and database column issues for seamless functionality
✓ Redesigned Medical Insights AI with ChatGPT-style interface integrated into main dashboard
✓ Moved AI functionality from popup widget to dedicated section on home page below welcome message  
✓ Created clean, professional interface with mode selection tabs (Chat, Assessment, Protocol)
✓ Enhanced user experience with conversation history display and message bubbles
✓ Removed old popup widget and replaced with full-featured dashboard integration
✓ Added auto-scrolling chat messages and proper text wrapping for long AI responses
✓ Implemented ChatGPT-inspired design with input area, tools button, and conversation flow
✓ Enhanced ChatGPT integration with specialized medical insights for wound care professionals
✓ Added specialized wound assessment API endpoint with structured clinical analysis framework
✓ Created treatment protocol generator with evidence-based recommendations for specific wound types and severity levels
✓ Enhanced AI responses with clinical terminology, treatment modalities, and standard care protocols
✓ Added wound type selector supporting pressure ulcers, diabetic ulcers, venous ulcers, arterial ulcers, surgical wounds, traumatic wounds, burns, and chronic wounds
✓ Integrated severity level classification (Mild Stage I-II, Moderate Stage II-III, Severe Stage III-IV, Critical/Complex)
✓ Added Educational Content Generator as fourth tab in Medical Insights AI interface
✓ Created AI-powered patient education tool for personalized wound care instructions
✓ Implemented content type selection: Home Care Instructions, Educational Information, What to Expect, Warning Signs, Diet & Nutrition, Activity Guidelines
✓ Added comprehensive form with wound type, treatment stage, patient age, and risk factors
✓ Enhanced AI responses with patient-friendly language and practical guidance
✓ Integrated educational content generation with conversation history display
✓ Added proper HTML formatting for AI responses - markdown syntax now displays as formatted text
✓ Implemented comprehensive markdown-to-HTML converter for headers, bold, italic, lists, and paragraphs
✓ Enhanced message display with typography styling for professional document appearance
✓ Added patient name and provider reference fields to Educational Content Generator for personalized content
✓ Implemented comprehensive markdown-to-HTML converter for headers, bold, italic, and lists in AI responses
✓ Integrated patient and provider data from existing system to personalize educational materials with contact information
✓ Enhanced educational content to always prominently include provider phone numbers when provider is selected
✓ Standardized provider contact information display in AI-generated patient education materials
✓ Added sales representative selection field to Educational Content Generator form
✓ Integrated sales rep contact information in AI-generated content signatures
✓ Enhanced AI prompts to automatically include sales rep name and phone number at end of educational materials
✓ Fixed provider phone number field mapping from database (phoneNumber vs phone) for accurate contact retrieval
✓ Added phone number field to sales representatives database table with actual phone numbers
✓ Enhanced signature formatting with professional layout and proper line spacing
✓ Added standardized contact information header at top of all educational content showing provider and representative details
✓ Implemented PDF download functionality for AI-generated educational content using jsPDF library
✓ Added download button to all assistant messages in Medical Insights AI interface
✓ PDF generation includes patient name in filename and properly formatted content with contact information
✓ Enhanced sales rep assignment with role-based access control
✓ Admin users can now select any sales rep when adding/editing patients via dropdown
✓ Sales rep users see read-only field with their own name (cannot change assignment)  
✓ Add Patient form shows dropdown for admin, disabled field for sales reps
✓ Patient Profile edit form has same role-based sales rep selection logic
✓ Form submission logic respects user role - admin selections preserved, sales rep auto-assigned
✓ Enhanced security while providing admin flexibility for patient assignment management
✓ Added NXT Commission total summary card to Patient Treatments dashboard for admin users
✓ Dashboard now displays total NXT commission across all treatments with orange styling
✓ Expanded dashboard grid layout to accommodate fourth summary card
✓ NXT Commission card shows total amount and treatment count for comprehensive overview
✓ Implemented mobile responsiveness fixes for navigation bar and dashboard layouts to prevent horizontal scrolling
✓ Enhanced mobile navigation with horizontal scrollable design to show all navigation items
✓ Added CSS overflow controls to prevent horizontal scrolling on mobile devices
✓ Improved mobile padding and spacing throughout the Patient Treatments dashboard
✓ Fixed non-functional "More" button by implementing proper scrollable navigation for all menu items
✓ Isolated Patient Treatments table filters from dashboard calculations for independent operation
✓ Added dashboard-specific date range filter for admin users affecting only summary cards and chart
✓ Dashboard metrics now filter separately from table data allowing different view perspectives
✓ Dashboard date filter includes clear button and treatment count display for filtered data
✓ Enhanced dashboard date filter with dropdown options: Last Month, Month to Date, Year to Date, and Custom Range
✓ Custom Range option dynamically shows/hides calendar date inputs based on selection
✓ Added totals row at bottom of Patient Treatments table showing sums for Revenue, Invoice, Sales Rep Commission, and NXT Commission columns
✓ Totals row displays with bold formatting and color-coded values matching column themes
✓ Updated all currency figures to use standard format with comma separators ($xx,xxx.xx) for better readability
✓ Applied consistent currency formatting to table values, totals row, and all financial calculations
✓ Added sales rep column to Sales Reports page tables for admin users only (Patient Pipeline, Active Treatments, Completed Treatments)
✓ Admin users can now quickly see which rep is responsible for each line item in all Sales Reports tables
✓ Sales rep column shows assigned sales representative name with proper formatting and fallback for unassigned items
✓ Updated Active Treatments and Completed Treatments tables for admin users - replaced "Your Commission" column with "NXT Commission"
✓ Admin users now see NXT Commission amounts in orange styling instead of sales rep commission in blue
✓ Updated commission total calculations to sum NXT Commission for admin users in both Active and Completed treatment sections
✓ Commission summary cards now show "Estimated NXT Commission" and "Total NXT Commission" labels for admin users with orange theming

## Previous Changes (July 21, 2025)

✓ Fixed patient deletion permissions - admin users can now delete any patient in the system
✓ Resolved foreign key constraint errors by properly deleting associated timeline events and treatments before patient deletion
✓ Updated deletePatient method to handle cascading deletions for data integrity
✓ Sales reps maintain restricted deletion access (only their own patients) while admins have full deletion rights
✓ Fixed sales rep patient deletion logic - sales reps can now delete patients assigned to them regardless of who created the patient
✓ Resolved user_id restriction issue - sales rep deletion now properly checks by sales rep name instead of user_id match
✓ Updated Add Treatment form for sales rep users - invoice date field now starts blank for manual entry
✓ Added automatic sales rep population in Add Treatment forms - logged-in sales rep name auto-populates
✓ Fixed runtime initialization error with salesReps variable in patient profile page
✓ Enhanced cache invalidation for patient status updates - changes now appear immediately without page refresh
✓ Added comprehensive query invalidation and refetch for all patient-related data
✓ Reduced cache stale time to 30 seconds and added automatic refetch intervals for real-time updates
✓ Fixed patient update validation errors by adding default values for required fields (woundType, woundSize)
✓ Enhanced Add Treatment forms with automatic sales rep name population and blank invoice date fields for sales reps
✓ Resolved commission percentage visibility - hidden sales rep commission rates in dropdown selections for privacy
✓ Fixed Add Treatment form on Patient Treatments page to properly auto-populate sales rep for logged-in users
✓ Restricted sales rep selection - sales reps can only see their own name (read-only), admins see full dropdown
✓ Enhanced security by preventing sales reps from viewing other representatives' commission rates
✓ Fixed duplicate invoice number constraint error by removing unique constraint from invoice_no field
✓ Users can now reuse invoice numbers across different treatments as needed for real-world scenarios
✓ Added user-friendly error handling - displays "Duplicate invoice number" message when needed
✓ Completely removed unique index constraint from database to prevent future conflicts
✓ Fixed Dermabind graft selection dropdown conflict by differentiating Q2 and Q3 options
✓ Updated all graft options to use unique names: "Dermabind Q2" and "Dermabind Q3"
✓ Replaced blue heart icons with NXT company logo across landing page, auth page, and navigation bar
✓ Updated application branding from "WoundCare Lead Manager" to "WoundCare Patient Manager"
✓ Implemented clean navigation header showing only NXT logo without text for professional appearance
✓ Fixed React hooks error in Sales Reports page by restructuring conditional logic and hook usage order
✓ Added admin sales rep filter dropdown allowing admins to view any rep's data or all reps combined
✓ Updated logo sizing - landing page logo increased 150% for better visibility
✓ Fixed TypeScript errors and asset import issues for proper logo integration
✓ Removed registration functionality for internal use only - no public registration allowed
✓ Simplified authentication page to login-only interface for security
✓ Updated auth page description to "Internal access for wound care sales representatives"
✓ Removed reCAPTCHA implementation as registration is no longer available
✓ Cleaned up server endpoints by removing /api/auth/register route completely
✓ Enhanced security by requiring manual user account creation by administrators
✓ Removed "filter by rep" feature from Manage Patients page for sales rep users
✓ Sales reps now only see their own patients without filter options
✓ Admin users retain full filtering capabilities including sales rep filter
✓ Added comprehensive date range filtering to Active Treatments section with independent controls
✓ Implemented Completed Treatments section with identical functionality to Active Treatments
✓ Isolated date filtering between sections - each has independent start/end date inputs and calculations
✓ Fixed dateRange reference error to prevent application crashes during filtering
✓ Created separate state management for activeDateRange and completedDateRange
✓ Both sections now support custom date range filtering by treatment date with clear filter buttons
✓ Fixed critical data filtering issue in Sales Reports page - resolved incorrect invoice status counts
✓ Corrected frontend filtering logic to match backend API behavior for sales rep users
✓ Sales Reports now properly displays all treatments filtered by patients.salesRep instead of userId
✓ Fixed data consistency between Patient Treatments and Sales Reports pages
✓ Updated wound size field labels to "Initial Wound Size (sq cm)" throughout patient management system:
  - Add Patient form, Edit Patient form, Patient Profile display and edit form
  - Removed redundant "sq cm" unit display since it's now included in field labels
  - Timeline wound measurements correctly maintain "Wound Size (sq cm)" for current measurements
✓ Fixed blank dropdown issue in patient profile edit forms by adding wound type normalization
✓ Added conversion between database format ("pressure-ulcer") and display format ("Pressure Ulcer")
✓ Implemented inline Patient Status editing without requiring full edit mode
✓ Added patient status update mutation with dropdown selector and color-coded badges
✓ Removed Invoices page from navigation for both admin and sales rep users
✓ Cleaned up app routing and imports to remove manage-invoices functionality
✓ Consolidated invoice functionality remains integrated within Patient Treatments dashboard
✓ Created new Sales Reports page for sales rep users with dashboard elements
✓ Added Sales Reports navigation tab visible only to sales rep users
✓ Moved invoice status cards and treatment size chart from Patient Treatments to Sales Reports for sales reps
✓ Patient Treatments page now shows only table data for sales reps, full dashboard for admins

## Previous Changes (July 16, 2025)

✓ Implemented complete custom username/password authentication system
✓ Replaced Replit Auth with local authentication for better business control
✓ Created secure password hashing using Node.js crypto module with salt
✓ Updated database schema with proper user management fields:
  - Integer primary keys for users table
  - Email, password, role, and sales rep name fields
  - Active status for user account management
✓ Built comprehensive authentication API endpoints:
  - POST /api/auth/login - User login with email/password
  - POST /api/auth/register - User registration
  - POST /api/auth/logout - Secure logout
  - GET /api/auth/user - Get current user info
✓ Created beautiful login/registration page with two-column layout
✓ Added hero section highlighting wound care management features
✓ Updated all API endpoints to use integer user IDs instead of string IDs
✓ Enhanced role-based access control with proper user role management
✓ Updated navigation with secure logout functionality
✓ Modified landing page to direct users to new authentication system
✓ Created default user accounts for immediate testing:
  - Admin: billy@nxtmedical.us / password123
  - Sales Rep: ernest@nxtmedical.us / password123 (Ernie Svara)
  - Sales Rep: nash@nxtmedical.us / password123 (Nash Conroy)
✓ Updated all storage operations to work with new authentication system
✓ Enhanced session management with PostgreSQL session storage
✓ Added proper error handling and validation for authentication flows
✓ Updated frontend authentication hooks to work with new system
✓ Maintained all existing role-based access control features
✓ Created secure password generation system for user account creation
✓ Fixed admin user treatment access by updating role-based storage queries
✓ Enhanced commission visibility - NXT commission hidden from sales reps, visible to admin users
✓ Added comprehensive "Total Invoice" calculations throughout the application:
  - Patient profile treatment summary now shows Total Invoice (60% of revenue)
  - Patient Treatments dashboard includes Projected Invoice and Total Invoice cards
  - Invoice amounts highlighted in purple for visual distinction
  - Updated grid layouts to accommodate new invoice information
✓ Enhanced commission tracking for both admin and sales rep users:
  - Added Projected Commission and Total Commission cards for all users (green styling)
  - Sales reps see their commission totals from active and completed treatments
  - Admin users see additional NXT commission data (orange styling)
  - Expanded dashboard to 6-column grid layout for comprehensive metrics
✓ Fixed missing API endpoint for treatment data fetching on Patient Treatments dashboard
✓ Implemented comprehensive timeline events with enhanced timestamp tracking:
  - Added createdBy field to timeline events database schema for username tracking
  - Updated timeline creation endpoints to capture current user's email/username
  - Created formatTimestamp function for Eastern time display
  - Added timestamp display showing Eastern time (HH:MM AM/PM), date (MMDDYYYY), and creator username
  - Timeline timestamps appear on both patient profile and dedicated timeline pages
✓ Reverted patient status filtering feature - all patients now visible on manage patients page:
  - Removed filter that moved "IVR Approved" patients to treatments tab only
  - Manage patients page now shows all patients regardless of status for comprehensive searching
  - Maintained treatment addition capability for IVR Approved patient profiles
  - Users can search and view all patients in one central location
✓ Restricted Sales Reps management page access to admin users only:
  - Sales reps can no longer see the "Sales Reps" navigation tab
  - Direct URL access to /manage-sales-reps redirects sales reps to 404 page
  - Admin users retain full access to sales rep management functionality
  - Prevents sales reps from viewing other reps' commission rates and statistics
✓ Implemented comprehensive graft selection system with automatic ASP pricing and Q code population:
  - Added 10 graft types with real ASP prices: Membrane Wrap ($1,190.44), Dermabind Q2/Q3 ($3,337.23/$3,520.69), AmchoPlast ($4,415.97), etc.
  - Graft dropdown shows name and ASP price for easy selection
  - Q code field auto-populates when graft is selected (Q4205-Q3, Q4313-Q2, etc.)
  - ASP automatically updates price per sq cm field for accurate revenue calculations
  - Enhanced treatment forms with read-only Q code display
  - Updated database schema to include Q code storage
  - Maintained backward compatibility with existing treatments
✓ Fixed cross-user data synchronization issue for treatment updates:
  - Enhanced cache invalidation to update data across all user sessions
  - Admin treatment changes now immediately reflect on sales rep dashboards
  - Improved real-time data consistency for multi-user collaboration
  - Reduced cache stale time from infinite to 5 minutes for better responsiveness
  - Added automatic 10-second refresh intervals for treatment data
  - Implemented aggressive cache invalidation with predicate-based matching
✓ Fixed critical role-based access control issue for treatment visibility:
  - Sales reps can now see all treatments for their assigned patients regardless of who created them
  - Updated storage layer to remove restrictive userId filtering for sales rep treatment access
  - Admin-created treatments now properly display on sales rep patient profiles
  - Maintained security by ensuring sales reps only see treatments for their assigned patients
✓ Implemented comprehensive Provider Management system:
  - Created providers database table with name, email, phone, NPI number fields
  - Added provider field to patients table for provider assignment tracking
  - Built complete provider CRUD API endpoints with statistics calculations
  - Created Providers management page with statistics dashboard
  - Added provider statistics: patient count, active treatments, completed treatments
  - Integrated provider navigation for admin users only
  - Added default providers: Dr. John Smith, Dr. Sarah Johnson, Dr. Michael Davis
  - Maintained role-based access control for provider management features
✓ Fixed critical dashboard metrics calculation issues:
  - Corrected field name mappings (totalRevenue instead of revenue)
  - Updated all metric calculations to use proper database field names
  - Fixed revenue, invoice, and commission calculations using stored values
  - Added NXT Commission column display for admin users only (orange styling)
  - Added Sales Rep column showing patient's assigned sales representative
  - Enhanced CSV export with proper field mappings and conditional columns
  - Improved search functionality to work with correct database schema
✓ Completed major system consolidation - merged invoice and patient treatment functionality:
  - Added invoice-specific columns to patient treatments table: invoice_status, invoice_date, invoice_no, payable_date, total_commission
  - Updated Patient Treatments dashboard to use invoice dashboard components with status cards (Open, Payable, Closed)
  - Replaced treatment summary metrics with invoice status totals and visual analytics
  - Enhanced table display with invoice columns: Invoice No, Invoice Status, Invoice Date, Payable Date
  - Updated CSV export to include all invoice-related fields
  - Successfully consolidated two separate systems into unified invoice/treatment management interface
✓ Applied invoice template format to Add Treatment feature:
  - Redesigned treatment form with clean 2-column layout matching invoice creation template
  - Organized fields into logical sections: Basic Info, Patient & Provider, Graft & Product, Financial Calculations
  - Added auto-calculated financial fields with proper color coding (green for commissions, purple for invoice amounts)
  - Enhanced form with read-only fields for Product Code and ASP Price that auto-populate
  - Improved visual hierarchy with proper spacing, labels, and section grouping
  - Updated dialog to be wider and scrollable to accommodate comprehensive form layout
  - Added proper styling for auto-calculated fields with background colors and borders
✓ Completed comprehensive invoice field integration in Add Treatment form:
  - Added Invoice Status dropdown with Open/Payable/Closed options
  - Added Invoice Date field with automatic Payable Date calculation (Invoice Date + 30 days)
  - Added Invoice Number text field for tracking reference numbers
  - Added Payable Date field (auto-calculated but manually editable)
  - Added Treatment Number field in organized 6-row professional layout
  - Updated form submission logic to include all new invoice fields
  - Enhanced edit functionality to properly populate invoice fields when editing treatments
  - Added Sales Rep display field (read-only) for complete invoice context
  - Implemented automatic date calculations and field dependencies
✓ Added inline editing functionality for status columns in Patient Treatments table:
  - Converted Invoice Status and Treatment Status columns to dropdown selectors
  - Renamed "Status" column to "Treatment Status" for clarity
  - Added color-coded styling: Invoice Status (yellow/blue/green), Treatment Status (blue/green/red)
  - Created backend API endpoint for status updates with field validation
  - Implemented real-time status changes without full form editing
  - Added proper error handling and success notifications for inline edits
✓ Implemented comprehensive "Add Treatment" functionality on Patient Treatments dashboard:
  - Added blue "Add Treatment" button positioned next to CSV download button
  - Created complete treatment form dialog with professional 6-row layout matching invoice template
  - Added patient search dropdown limited to IVR approved patients with searchable interface
  - Integrated graft selection system with automatic ASP pricing and Q code population
  - Implemented auto-calculation logic for revenue, invoice totals, and commission calculations
  - Added invoice fields with automatic payable date calculation (invoice date + 30 days)
  - Enhanced form with color-coded fields and comprehensive validation
  - Created treatment directly from dashboard without requiring patient profile navigation
✓ Fixed role-based commission visibility across all Add Treatment forms:
  - Hidden Total Commission and NXT Commission fields from sales reps on patient profile forms
  - Sales reps now only see: Total Billable, Total Invoice (60%), and Sales Rep Commission
  - Admin users continue to see all commission fields including Total Commission and NXT Commission
  - Grid layouts dynamically adjust: 1 column for sales reps, multiple columns for admin users
  - Consistent role-appropriate financial information display across global and patient-specific treatment forms
✓ Created comprehensive Provider Revenue Calculator for sales rep presentations:
  - Built dedicated Calculator page with professional interface design
  - Added graft selection dropdown with 10 real ASP pricing options and Q codes
  - Implemented wound size input field for precise calculations
  - Added treatment count functionality for multi-treatment revenue projections
  - Created real-time calculations showing Total Billable and Provider Invoice (60% of billable)
  - Added Provider Presentation Summary section for easy client demonstrations
  - Integrated Calculator navigation item accessible to all authenticated users
  - Responsive design optimized for mobile field presentations
  - Revenue model explanation helps sales reps explain calculations to providers
✓ Enhanced Provider Revenue Calculator with advanced billing fee calculations:
  - Added customizable Practice Billing Fee input field (default 6%) under closure rate dropdown
  - Implemented dynamic billing fee calculation as percentage of total billable amount
  - Updated revenue display to show billing fee as negative red amount in Total Revenue box
  - Added Net Clinic Profit calculation (gross profit minus billing fees) in green styling
  - Enhanced PDF export with 5 color-coded summary boxes including billing fee breakdown
  - All calculations update real-time when changing billing fee percentage for accurate practice-specific presentations

## Previous Changes (July 15, 2025)

✓ Completed comprehensive terminology change from "leads" to "patients" throughout entire application
✓ Updated database schema: renamed 'leads' table to 'patients' and all schema types
✓ Modified all API endpoints from /api/leads to /api/patients (including CSV export)
✓ Updated all frontend components, forms, and navigation to use patient terminology
✓ Changed application title from "WoundCare Lead Manager" to "WoundCare Patient Manager"
✓ Updated all user-facing text, form labels, and button text to reflect patient management
✓ Modified routing from /add-lead to /add-patient and /manage-leads to /manage-patients
✓ Updated storage interface and database operations to use patient terminology
✓ Enhanced form validation and error messages to use consistent patient language
✓ Added conditional custom insurance input field when "Other" is selected
✓ Enhanced forms to dynamically show/hide custom insurance text input
✓ Updated validation to require custom insurance specification when "Other" selected
✓ Modified patient display and CSV export to show custom insurance names
✓ Added database field for custom insurance storage with proper schema migration
✓ Added Medicare Advantage insurance options to dropdown menus:
  - UnitedHealthcare Medicare Advantage
  - Aetna Medicare Advantage  
  - Cigna Medicare Advantage
  - Humana Medicare Advantage
  - WellCare Medicare Advantage
✓ Updated insurance badge colors to support new Medicare Advantage options
✓ Enhanced patient forms with expanded insurance provider selection
✓ Updated date format from YYYY-MM-DD to MM/DD/YYYY throughout entire application
✓ Added automatic date formatting with input masks for user-friendly data entry
✓ Updated date validation to ensure MM/DD/YYYY format compliance
✓ Modified CSV export to display dates in MM/DD/YYYY format
✓ Enhanced patient display tables to show dates in MM/DD/YYYY format
✓ Maintained backend compatibility by converting formats between frontend and database
✓ Added wound type and wound size fields for patient tracking
✓ Implemented wound size as numeric input with "sq cm" unit display
✓ Added 8 common wound type categories with dropdown selection
✓ Updated patient management table and CSV export to include wound information
✓ Enhanced recent patients dashboard with labeled sections for all key information
✓ Added patient count and total wound size tracking for sales representatives
✓ Implemented real-time statistics calculation for sales rep performance metrics
✓ Built complete interactive patient timeline visualization system
✓ Added timeline events database table with proper schema and API endpoints
✓ Fixed date handling issue in timeline event creation (Date object conversion)
✓ Created timeline event types: notes, wound measurements, appointments, treatments, calls, visits
✓ Added automatic timeline event creation when new patients are added
✓ Integrated timeline access button in patient management interface
✓ Created comprehensive patient profile page combining patient info, editing, and timeline
✓ Made patient names clickable links throughout the application
✓ Unified patient management with single-page profile view
✓ Removed redundant title field from timeline forms - auto-generated from event type
✓ Added patient status dropdown field with IVR tracking options:
  - Evaluation Stage (default)
  - IVR Requested
  - IVR Denied  
  - IVR Approved
✓ Updated database schema with patientStatus field and default value
✓ Added patient status to all patient forms (add, edit, profile)
✓ Enhanced patient display tables to show status with color-coded badges
✓ Updated CSV export functionality to include patient status data
✓ Implemented status badges with intuitive color coding:
  - Yellow: Evaluation Stage
  - Blue: IVR Requested
  - Red: IVR Denied
  - Green: IVR Approved
✓ Created separate Patient Treatments page for IVR Approved patients
✓ Added revenue forecasting dashboard with treatment metrics and projections
✓ Separated patient workflow: non-approved patients stay in Manage Patients, approved patients move to Patient Treatments
✓ Enhanced navigation with new Patient Treatments tab for active treatment tracking
✓ Added status-based CSV export filtering for both management and treatment views
✓ Implemented comprehensive sales forecasting with active treatment counts and revenue projections
✓ Fixed treatment form validation by adding all required calculated fields (revenue, commission, etc.)
✓ Added proper date handling for treatment dates in both frontend and backend
✓ Implemented full treatment editing functionality with edit buttons on each treatment
✓ Changed treatment status from 'planned' to 'active' throughout the system
✓ Added comprehensive treatment management with add, edit, and delete capabilities
✓ Enhanced treatment forms with dynamic dialog titles and submit buttons for editing

## Previous Changes (July 13, 2025)

✓ Fixed SelectItem component errors by replacing empty string values with "all" option
✓ Updated filter logic to properly handle "all" selection state  
✓ Resolved database schema and query issues in storage layer
✓ Successfully deployed complete wound care lead management system
✓ Verified all core functionality: authentication, lead creation, search/filter, CSV export

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and dark mode support
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: OpenID Connect (OIDC) with Replit Auth integration
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful endpoints with JSON responses
- **Error Handling**: Centralized error middleware with proper HTTP status codes

### Database Architecture
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema updates
- **Connection**: Connection pooling with @neondatabase/serverless

## Key Components

### Authentication System
- **Provider**: Replit OIDC for secure user authentication
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **Authorization**: Route-level protection with middleware
- **User Management**: Automatic user creation/update on login

### Patient Management System
- **CRUD Operations**: Full create, read, update, delete functionality for patients
- **Search & Filter**: Real-time search with filters for sales rep and referral source
- **Data Validation**: Zod schemas for both client and server-side validation
- **User Isolation**: All patients are scoped to authenticated users

### UI Components
- **Design System**: Consistent component library with shadcn/ui
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Navigation**: Persistent navigation bar with active state indicators
- **Form Controls**: Accessible form components with validation feedback
- **Data Display**: Tables, cards, and lists for patient information

## Data Flow

### Authentication Flow
1. User accesses protected route
2. Middleware checks for valid session
3. If unauthorized, redirects to OIDC provider
4. On successful auth, creates/updates user record
5. Establishes session and redirects to intended route

### Patient Management Flow
1. User creates/updates patient through form
2. Client validates data with Zod schema
3. API validates data again on server
4. Database operation performed with user context
5. Response returned and client state updated via React Query

### Data Persistence
- **Sessions**: Stored in PostgreSQL sessions table
- **Users**: Stored in users table with OIDC claims
- **Patients**: Stored in patients table with foreign key to users

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver
- **drizzle-orm**: Type-safe ORM with PostgreSQL dialect
- **express**: Web application framework
- **react**: Frontend library with hooks
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight routing for React

### UI Dependencies
- **@radix-ui/***: Accessible component primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **react-hook-form**: Form state management
- **zod**: Schema validation library

### Authentication Dependencies
- **openid-client**: OIDC client implementation
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite dev server with HMR for frontend
- **Backend**: tsx for TypeScript execution with file watching
- **Database**: Environment variable for DATABASE_URL
- **Session Secret**: Required environment variable for security

### Production Build
- **Frontend**: Vite builds optimized static assets to dist/public
- **Backend**: esbuild bundles server code to dist/index.js
- **Assets**: Static files served by Express in production
- **Process**: Single Node.js process serving both frontend and API

### Environment Requirements
- **DATABASE_URL**: PostgreSQL connection string (required)
- **SESSION_SECRET**: Secure random string for session encryption (required)
- **REPLIT_DOMAINS**: Domain configuration for OIDC (required)
- **ISSUER_URL**: OIDC issuer URL (defaults to replit.com/oidc)
- **REPL_ID**: Replit environment identifier

### Security Considerations
- **HTTPS**: Required for secure cookies and OIDC
- **CORS**: Configured for same-origin requests
- **Session Security**: HTTP-only cookies with secure flag
- **Input Validation**: Dual validation on client and server
- **SQL Injection**: Prevented through Drizzle ORM parameterized queries