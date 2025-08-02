# MediMind AI - Diabetes Training Platform

## Overview

MediMind AI is a comprehensive diabetes care training platform designed for healthcare workers in care homes and nursing facilities. The application combines video-based learning modules with an AI-powered tutor to provide interactive, evidence-based training on diabetes management. The platform emphasizes compliance with NICE guidelines, NHS best practices, and CQC requirements.

## User Preferences

Preferred communication style: Simple, everyday language.
Branding: Use consistent MediMind AI logo (healthcare hands/heart design) across all pages.

## System Architecture

### Full-Stack Application Structure
The application follows a modern full-stack architecture with clear separation of concerns:

- **Frontend**: React-based single-page application built with Vite
- **Backend**: Express.js REST API server
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **UI Framework**: Tailwind CSS with shadcn/ui components for consistent design
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing

### Development Environment
The project is optimized for Replit development with:
- Hot module replacement via Vite
- TypeScript for type safety across the entire stack
- ESM modules throughout
- Integrated error handling and development tooling

## Key Components

### Frontend Architecture
- **Component Library**: Comprehensive shadcn/ui components providing accessible, themed UI elements
- **Styling**: Tailwind CSS with custom healthcare-themed color palette and CSS variables
- **Type Safety**: Full TypeScript integration with strict type checking
- **Build System**: Vite for fast development and optimized production builds

### Backend Services
- **API Layer**: RESTful Express.js server with structured route handling
- **AI Integration**: OpenAI GPT-4o integration for intelligent tutoring responses
- **Data Storage**: PostgreSQL database with Drizzle ORM for persistent data storage
- **Session Management**: PostgreSQL-backed session storage for Replit Auth

### Authentication System
The application now uses Replit Authentication for secure user management:
- **Replit Auth Integration**: OpenID Connect-based authentication system
- **Session Management**: Secure PostgreSQL-based session storage
- **User Profiles**: Automatic user creation and management via Replit Auth claims
- **Protected Routes**: Authentication required for training features and progress tracking
- **Landing Page**: Public landing page for unauthenticated visitors

### Database Schema
The application uses a well-structured PostgreSQL schema with the following entities:
- **Sessions**: Secure session storage for Replit Auth (required)
- **Users**: Healthcare worker profiles with Replit Auth integration
- **Courses**: Training course definitions and metadata
- **Modules**: Individual learning modules within courses
- **User Progress**: Tracking completion and progress through modules
- **Chat Messages**: AI tutor conversation history
- **Resources**: Educational resources and reference materials

### AI Tutor System
- **Specialized Context**: AI responses tailored for diabetes care in healthcare settings
- **Compliance Focus**: Responses emphasize NICE guidelines, NHS practices, and CQC requirements
- **Interactive Learning**: Suggested follow-up questions to encourage deeper engagement
- **Safety-First Approach**: Consistent emphasis on safety protocols and professional consultation

## Data Flow

### User Journey
1. User authentication and role-based access control
2. Course selection and module navigation
3. Video-based learning with progress tracking
4. Interactive AI tutor for questions and clarification
5. Progress persistence and completion tracking

### API Communication
- RESTful endpoints for all data operations
- Consistent error handling with appropriate HTTP status codes
- JSON-based request/response format
- Real-time progress updates through optimistic UI patterns

### State Management
- TanStack Query for server state caching and synchronization
- React state for local UI interactions
- Persistent progress tracking across sessions

## External Dependencies

### Core Technologies
- **React 18**: Frontend framework with modern hooks and concurrent features
- **Express.js**: Backend web framework
- **PostgreSQL**: Primary database (configured via @neondatabase/serverless)
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **OpenAI API**: GPT-4o for AI tutoring capabilities

### UI and Design
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless component primitives for accessibility
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library for consistent iconography

### Development Tools
- **TypeScript**: Type safety across the entire stack
- **Vite**: Build tool and development server
- **ESBuild**: Production bundling for the backend

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds optimized static assets to `dist/public`
- **Backend**: ESBuild bundles the Express server to `dist/index.js`
- **Database**: Drizzle migrations manage schema changes

### Environment Configuration
- **Development**: Hot reloading with Vite dev server
- **Production**: Static file serving through Express with API routing
- **Database**: Environment-based connection string configuration

### Replit Integration
- Custom Vite plugins for Replit-specific development features
- Environment detection for development vs. production behavior
- Integrated error overlay for development debugging

### Scalability Considerations
- Modular architecture allows for easy component extraction
- Database abstraction layer (IStorage interface) enables easy migration from in-memory to persistent storage
- Stateless server design supports horizontal scaling
- CDN-ready static asset structure