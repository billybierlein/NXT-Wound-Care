# WoundCare Patient Manager

## Overview

A complete full-stack web application for managing patients in the wound care industry. Successfully deployed with secure authentication, comprehensive patient management capabilities, CSV export functionality, and responsive design. The application is actively being used by wound care sales representatives to track patient referrals and manage field activity from mobile devices.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (July 16, 2025)

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