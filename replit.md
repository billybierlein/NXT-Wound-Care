# WoundCare Lead Manager

## Overview

A complete full-stack web application for managing patient leads in the wound care industry. Successfully deployed with secure authentication, comprehensive lead management capabilities, CSV export functionality, and responsive design. The application is actively being used by wound care sales representatives to track patient referrals and manage field activity from mobile devices.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (July 13, 2025)

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

### Lead Management System
- **CRUD Operations**: Full create, read, update, delete functionality for patient leads
- **Search & Filter**: Real-time search with filters for sales rep and referral source
- **Data Validation**: Zod schemas for both client and server-side validation
- **User Isolation**: All leads are scoped to authenticated users

### UI Components
- **Design System**: Consistent component library with shadcn/ui
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Navigation**: Persistent navigation bar with active state indicators
- **Form Controls**: Accessible form components with validation feedback
- **Data Display**: Tables, cards, and lists for lead information

## Data Flow

### Authentication Flow
1. User accesses protected route
2. Middleware checks for valid session
3. If unauthorized, redirects to OIDC provider
4. On successful auth, creates/updates user record
5. Establishes session and redirects to intended route

### Lead Management Flow
1. User creates/updates lead through form
2. Client validates data with Zod schema
3. API validates data again on server
4. Database operation performed with user context
5. Response returned and client state updated via React Query

### Data Persistence
- **Sessions**: Stored in PostgreSQL sessions table
- **Users**: Stored in users table with OIDC claims
- **Leads**: Stored in leads table with foreign key to users

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