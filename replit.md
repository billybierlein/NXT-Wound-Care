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

### System Design Choices
- **Patient Management**: Centralized CRUD operations for patients, treatments, providers, and referral sources. Includes features like patient status tracking, wound type/size tracking, and integration of patient timeline events.
- **Financial Calculations**: Automated calculations for revenue, invoice totals, sales rep commissions, and NXT commissions. Includes a Provider Revenue Calculator with advanced billing fee calculations and PDF export.
- **Reporting**: Sales Reports page with pipeline, active, and completed treatment overviews, featuring detailed filtering and total summaries.
- **AI Assistant**: Dedicated AI Assistant page with ChatGPT-style interface for medical insights, wound assessment, treatment protocol generation, and educational content generation, with markdown-to-HTML rendering and PDF download.
- **Consolidation**: Invoice and patient treatment functionalities are merged into a unified dashboard.
- **Data Consistency**: Aggressive cache invalidation and auto-refresh mechanisms ensure real-time data synchronization across user sessions.
- **Naming Convention**: Consistent terminology change from "leads" to "patients" applied throughout the entire application and database.

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

### Authentication Dependencies
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store
- **Node.js crypto module**: For secure password hashing