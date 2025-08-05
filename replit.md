# MediMind AI - Diabetes Training Platform

## Overview

MediMind AI is a comprehensive diabetes care training platform designed for healthcare workers in care homes and nursing facilities. The application combines video-based learning modules with an advanced agentic RAG (Retrieval-Augmented Generation) system to provide interactive, evidence-based training on diabetes management. The platform features multi-agent AI reasoning, sophisticated document processing capabilities, and emphasizes compliance with NICE guidelines, NHS best practices, and CQC requirements.

## Recent Changes (August 2025)

- **Advanced Agentic RAG System**: Implemented multi-agent architecture with specialized medical roles (medical specialist, compliance officer, learning facilitator)
- **Document Processing Pipeline**: Added comprehensive document processing for PDFs, DOCX, HTML, and TXT files with vector storage
- **Vector Database Integration**: Integrated Pinecone for semantic search and retrieval of medical knowledge
- **Enhanced AI Tutor**: RAG-powered responses with source citations and confidence scoring
- **Document Management Interface**: Built admin interface for uploading and managing medical knowledge base
- **Entity Relationship Mapping**: Added knowledge graph capabilities for medical entities and relationships

## User Preferences

Preferred communication style: Simple, everyday language.
Branding: Use consistent MediMind AI logo (healthcare hands/heart design) across all pages.

**CRITICAL SAFETY REQUIREMENTS (August 2025):**
- AI tutor must be extremely strict for nursing/care home regulations
- NEVER provide medical advice without explicit source documentation
- Every statement MUST include citation: [Source: Document Title, Section X, Page Y]
- If information unavailable, respond exactly: "I don't have sufficient information in my knowledge base to answer this safely. Please consult NICE guidelines or healthcare professionals."
- PROHIBITED: General statements, assumptions, or "common practice" advice
- REQUIRED: Specific guideline references, confidence scores, professional consultation flags

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

### Advanced Agentic RAG System
- **Multi-Agent Architecture**: Three specialized AI agents work together for comprehensive responses:
  - Medical Specialist: Evidence-based clinical guidance
  - Compliance Officer: Regulatory adherence (NICE, NHS, CQC)
  - Learning Facilitator: Educational engagement and follow-up questions
- **Document Processing Pipeline**: Sophisticated text extraction and chunking for multiple file formats
- **Vector Storage**: Pinecone integration for semantic search across medical knowledge base
- **Entity Recognition**: NLP-powered extraction of medical entities and relationships
- **Source Attribution**: All responses include citations and confidence scores
- **Knowledge Graph**: Relationship mapping between medical concepts for deeper understanding

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