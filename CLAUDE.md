# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CardAll** is a knowledge card management system focused on structured display of text and image content. Currently in planning phase with complete requirement and design documentation.

## Project Structure

This is a greenfield project with the following planning documents:
- `CardAll.md` - Original project requirements
- `requirement.md` - Detailed technical requirements
- `design.md` - System architecture and technical design
- `task.md` - 15-week development timeline
- `prd.md` - Product requirements document

## Planned Architecture

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **UI Components**: Ant Design or Material-UI
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js + Express/Fastify
- **Database**: PostgreSQL + Redis
- **File Storage**: AWS S3 or local filesystem
- **API**: RESTful with OpenAPI documentation

### Deployment Targets
- Web application (PWA)
- Desktop client (Electron)
- Mobile app (React Native or PWA)

## Development Commands (To be implemented)

Once project is initialized:

```bash
# Frontend
cd frontend
npm install
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript check

# Backend
cd backend
npm install
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run db:migrate   # Run database migrations

# Docker
docker-compose up    # Start all services
docker-compose down  # Stop all services
```

## Key Development Phases

1. **Week 1-2**: Project initialization and basic setup
2. **Week 3-6**: Core card functionality development
3. **Week 7-9**: Interactive features (drag, search, edit)
4. **Week 10-11**: Sharing and export features
5. **Week 12-13**: Multi-platform deployment
6. **Week 14-15**: Testing and optimization

## Next Steps

1. Initialize frontend project structure
2. Set up backend API foundation
3. Create initial card component
4. Implement basic CRUD operations
5. Set up development environment

## File Organization (Planned)

```
src/
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── utils/
│   └── package.json
├── backend/           # Node.js backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   └── package.json
├── shared/            # Shared types and utilities
└── docker-compose.yml
```