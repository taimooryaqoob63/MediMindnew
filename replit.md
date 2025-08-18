# MediMind AI - Diabetes Training Platform

## Overview
MediMind AI is a comprehensive diabetes care training platform for healthcare workers in care homes and nursing facilities. It combines video-based learning with an advanced agentic RAG (Retrieval-Augmented Generation) system for interactive, evidence-based training on diabetes management. The platform features multi-agent AI reasoning, sophisticated document processing, and emphasizes compliance with NICE guidelines, NHS best practices, and CQC requirements. Its vision is to enhance healthcare worker proficiency in diabetes care, improve patient outcomes, and ensure regulatory compliance, positioning itself as a leader in AI-driven medical education.

## User Preferences
Preferred communication style: Simple, everyday language.
Branding: Use consistent MediMind AI logo (healthcare hands/heart design) across all pages.
Every response must include a practical example from real scenarios.
Responses should use a structured format: Brief explanation (4-5 sentences), practical example, key steps in bullet points, and one clear action.

## System Architecture

### Full-Stack Application Structure
The application employs a modern full-stack architecture:
- **Frontend**: React-based single-page application built with Vite.
- **Backend**: Express.js REST API server.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI Framework**: Tailwind CSS with shadcn/ui components.
- **State Management**: TanStack Query.
- **Routing**: Wouter.

### Core Architectural Decisions
- **Layered Configuration**: Sophisticated parameter management for AI responses, including RAG Retrieval, Generation Settings, Agent Selection, Safety & Compliance, Performance, and Audit.
- **Medical Accuracy Parameters**: Tightened ranges for clinical and educational queries (lower temperature, higher confidence threshold).
- **Advanced Emergency Detection**: NLP-based intent analysis using GPT-4o for real-time safety keyword monitoring and protocol routing, providing educational content with disclaimers instead of blocking.
- **Hybrid Search Optimization**: BM25 + vector embeddings (30%/70% weighting) for faster, accurate retrieval.
- **Citation Enforcement**: Mandatory authoritative citation requirements (NICE/NHS/CQC validation) with audit trails.
- **Human-in-the-Loop Escalation**: Confidence-based routing (50-70% triggers supervisor review) for critical queries.
- **Super Enhanced RAG Orchestrator**: Comprehensive enhanced RAG system with Docling-based document processing, hybrid search (BM25 + Vector + Reranking), multi-agent debate system, knowledge graph integration, and enhanced confidence scoring. Successfully integrated with updated Pinecone API key and medimind-rag index (August 18, 2025).
- **Performance Caching**: Query cache with SHA-256 hashing and 7-day expiration for frequently asked questions.
- **Dynamic Context Windowing**: Token-budget-aware context building (1500-4000 tokens) based on complexity.
- **Multi-Agent Architecture**: Specialized AI agents (Medical Specialist, Compliance Officer, Learning Facilitator) for enhanced capabilities.
- **Enhanced Document Processing Pipeline**: Docling-based structure-aware chunking with metadata enhancement, deduplication, and comprehensive processing for PDFs, DOCX, HTML, and TXT files with vector storage.
- **Knowledge Graph**: Entity Relationship Mapping and integration for medical entities and relationships.
- **Authentication**: Replit Authentication for secure user management, using PostgreSQL-backed session storage.

### UI/UX Decisions
- **Component Library**: Comprehensive shadcn/ui components for accessible, themed UI.
- **Styling**: Tailwind CSS with a custom healthcare-themed color palette.
- **Interactive Course Progress**: Clickable progress tracking, expandable details, and star-based rating.
- **Smart Bookmark System**: Intelligent bookmarking with visual feedback.
- **Conditional Quiz Access**: Progress-gated quiz functionality (80% video completion required).

## External Dependencies

### Core Technologies
- **React 18**: Frontend framework.
- **Express.js**: Backend web framework.
- **PostgreSQL**: Primary database (via @neondatabase/serverless).
- **Drizzle ORM**: Type-safe database operations.
- **OpenAI API**: GPT-4o for AI tutoring and intent classification.
- **Pinecone**: Vector database for semantic search and retrieval.

### UI and Design
- **Tailwind CSS**: Utility-first CSS framework.
- **Radix UI**: Headless component primitives.
- **shadcn/ui**: Pre-built component library.
- **Lucide React**: Icon library.

### Development Tools
- **TypeScript**: Type safety.
- **Vite**: Build tool and development server.
- **ESBuild**: Production bundling for the backend.