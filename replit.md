# MediMind AI - Diabetes Training Platform

## Overview

MediMind AI is a comprehensive diabetes care training platform designed for healthcare workers in care homes and nursing facilities. The application combines video-based learning modules with an advanced agentic RAG (Retrieval-Augmented Generation) system to provide interactive, evidence-based training on diabetes management. The platform features multi-agent AI reasoning, sophisticated document processing capabilities, and emphasizes compliance with NICE guidelines, NHS best practices, and CQC requirements.

## Recent Changes (August 14, 2025)

### Emergency Detection Enhancement ✅ COMPLETED (Latest)
- **Educational Emergency Response**: Modified emergency detection system to provide educational content instead of blocking responses
- **Safety Compliance Maintained**: Added comprehensive emergency disclaimers to responses containing emergency keywords
- **Enhanced Learning Experience**: Users now receive helpful educational guidance with appropriate safety warnings
- **Improved User Experience**: Emergency keywords (unconscious, seizure, hypoglycemia, etc.) no longer stop the learning process but add safety context

### Advanced Features Implementation Analysis ✅ COMPLETED
- **Comprehensive Feature Assessment**: Analyzed six critical advanced features requested for the healthcare AI platform
- **Database Issue Resolution**: Fixed integer overflow error in intent classification and type compatibility issues
- **Implementation Plan Creation**: Developed detailed 12-16 week roadmap for advanced features including:
  - Advanced Re-ranking Systems with cross-encoder and LLM-based approaches
  - Knowledge Graph integration with Neo4j or PostgreSQL-based graph traversal
  - Real-time Document Updates with auto-reindexing capabilities
  - Advanced Analytics Dashboard with real-time monitoring and insights
  - Hybrid LLM System for cost optimization with local/cached models
  - Enhanced UX with interactive citations, voice improvements, and follow-up suggestions
- **Risk Assessment**: Identified high-risk items and fallback strategies for Replit environment constraints
- **Priority Matrix**: Established 3-phase implementation timeline with clear milestones and success metrics

### Enhanced RAG Efficiency Implementation ✅ COMPLETED
- **Enhanced RAG Orchestrator**: Successfully implemented sophisticated multi-agent processing with parallel execution, dynamic context windowing, and intelligent agent pruning
- **Advanced Intent Classification**: Added OpenAI-powered query analysis for optimal routing and agent selection with JSON-object response formatting
- **Performance Caching System**: Implemented query cache with SHA-256 hashing, hit counting, and 7-day expiration management for frequently asked questions
- **Feedback Collection**: Added comprehensive feedback system for response quality monitoring and improvement
- **Analytics & Monitoring**: Integrated detailed analytics tracking for response times, confidence scores, and token usage optimization
- **Database Schema Extensions**: Added new tables for chat summaries, query cache, response feedback, RAG analytics, and intent classification
- **Dynamic Context Windowing**: Implemented token-budget-aware context building with complexity-based sizing (1500-4000 tokens)
- **Emergency Detection**: Added real-time emergency keyword detection with instant protocol routing for critical medical situations
- **Chat History Summarization**: Automatic conversation summarization for efficient context management
- **Vector Search Integration**: Added missing `searchSimilar` method to vectorStore with comprehensive error handling
- **Production Debugging**: Resolved all TypeScript diagnostics and JSON parsing errors for production-ready deployment

### Previous RAG Features
- **Advanced Agentic RAG System**: Implemented multi-agent architecture with specialized medical roles (medical specialist, compliance officer, learning facilitator)
- **Document Processing Pipeline**: Added comprehensive document processing for PDFs, DOCX, HTML, and TXT files with vector storage
- **Vector Database Integration**: Integrated Pinecone for semantic search and retrieval of medical knowledge
- **Enhanced AI Tutor**: RAG-powered responses with source citations and confidence scoring
- **Document Management Interface**: Built admin interface for uploading and managing medical knowledge base
- **Entity Relationship Mapping**: Added knowledge graph capabilities for medical entities and relationships
- **Interactive Course Progress**: Enhanced VideoSection with clickable progress tracking, expandable details, and star-based rating system
- **Smart Bookmark System**: Added intelligent bookmarking with visual feedback and toast notifications
- **Conditional Quiz Access**: Implemented progress-gated quiz functionality requiring 80% video completion
- **Enhanced Progress Visualization**: Added expandable progress section with module statistics and completion status

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

### Enhanced Agentic RAG System
- **Enhanced RAG Orchestrator**: Advanced multi-agent processing system with:
  - **Parallel Agent Processing**: Simultaneous execution of multiple specialized agents for faster responses
  - **Dynamic Agent Pruning**: Intelligent selection of relevant agents based on query analysis
  - **Intent Classification**: OpenAI-powered routing optimization for query type detection
  - **Context Windowing**: Dynamic token budget management based on query complexity
  - **Emergency Detection**: Real-time safety keyword monitoring with immediate protocol routing
  
- **Multi-Agent Architecture**: Three specialized AI agents with enhanced capabilities:
  - **Medical Specialist**: Evidence-based clinical guidance with NICE/NHS compliance
  - **Compliance Officer**: Regulatory adherence verification (NICE, NHS, CQC requirements)
  - **Learning Facilitator**: Educational engagement with personalized follow-up questions
  
- **Performance Optimization Features**:
  - **Query Caching**: Intelligent caching system for frequently asked questions
  - **Response Synthesis**: Multi-agent response combination for comprehensive answers
  - **Analytics Tracking**: Detailed performance monitoring and optimization
  - **Feedback Loop**: User feedback collection for continuous improvement
  
- **Storage & Processing**:
  - **Document Processing Pipeline**: Sophisticated text extraction and chunking for multiple file formats
  - **Vector Storage**: Pinecone integration for semantic search across medical knowledge base
  - **Entity Recognition**: NLP-powered extraction of medical entities and relationships
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