# WoundCare Patient Manager

## Overview

A complete full-stack web application for managing patients in the wound care industry. Successfully deployed with secure authentication, comprehensive patient management capabilities, CSV export functionality, and responsive design. The application is actively being used by wound care sales representatives to track patient referrals and manage field activity from mobile devices.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (July 15, 2025)

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