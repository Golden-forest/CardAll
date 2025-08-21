# CardAll Project Development Rules

## Project Overview
CardAll is a visual card management platform for creating, organizing, and sharing rich media digital cards with front/back structure, drag-and-drop interactions, and Apple-inspired design.

## Core Features
- **Card System**: Front (title+content) / Back (tags+notes), flip animation, real-time editing
- **Magnetic Snap**: Cards can magnetically attach to each other's edges (top/bottom/left/right)
- **Folder Management**: Hierarchical organization with drag-and-drop
- **Style System**: Solid/gradient backgrounds, independent style components
- **Tag System**: Add, filter, rename, hide tags (exclude from copy)
- **Media Handling**: Ctrl+V paste, drag upload, image positioning, PNG export
- **Sharing**: Copy text, screenshot cards/groups, social sharing

## Tech Stack
- **Frontend**: React 18 + TypeScript + Shadcn UI + Tailwind CSS + Uiverse.io
- **Backend**: Node.js + Express + MongoDB
- **Key Libraries**: @dnd-kit/core, TanStack Query, Framer Motion, html2canvas, Tiptap

## Development Principles
1. **Use Existing Solutions**: Leverage mature libraries, avoid reinventing wheels
2. **Apple HIG Design**: Clean, minimalist, consistent with large rounded corners
3. **Component Architecture**: Independent, reusable, maintainable modules
4. **TypeScript First**: 100% type coverage, strict mode
5. **Performance**: Virtual scrolling, lazy loading, optimized animations

## Code Standards
- **Files**: kebab-case naming (e.g., `card-editor.tsx`)
- **Components**: PascalCase, forwardRef support
- **Interfaces**: I-prefix (e.g., `ICardProps`)
- **Git**: Conventional Commits, Feature Branch + PR Review

## Module Structure
```
src/
├── components/ui/          # Shadcn base components
├── features/cards/         # Card functionality
├── features/folders/       # Folder management
├── features/tags/          # Tag system
├── features/sharing/       # Share functionality
├── hooks/                  # Custom hooks
└── types/                  # TypeScript definitions
```

## Key Interfaces
```typescript
interface ICardProps {
  id: string;
  frontContent: ICardContent;
  backContent: ICardContent;
  style: ICardStyle;
  isFlipped: boolean;
  onFlip: (cardId: string) => void;
}

interface ICardStyle {
  type: 'solid' | 'gradient';
  backgroundColor: string;
  gradientColors?: string[];
  borderRadius: number;
}
```

## Team Roles
- **Infrastructure**: Project setup, CI/CD, architecture
- **UI/UX**: Design system, Uiverse integration, prototypes
- **Frontend**: Component development, state management
- **Backend**: API, database, authentication
- **QA**: Testing, performance, compatibility

## Quality Gates
- TypeScript coverage > 95%
- Unit test coverage > 85%
- Performance: <1.5s load time, 60fps animations
- Mobile-first responsive design
- WCAG 2.1 AA accessibility

## Priority Features (MVP)
1. Card CRUD with flip animation
2. Magnetic snap combination
3. Basic folder management
4. Style selection (solid/gradient)
5. Copy/screenshot functionality
6. Tag system basics

## Technical Decisions
- **Drag & Drop**: @dnd-kit/core for modern DnD
- **Rich Text**: Tiptap for extensible editing
- **Animation**: Uiverse + Framer Motion
- **State**: Zustand for lightweight management
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind + CSS-in-JS for dynamic styles

## Development Flow
1. Feature Branch → PR Review → Merge
2. Daily standups, weekly milestone checks
3. Mock data for parallel frontend/backend development
4. Continuous integration with automated testing
5. Progressive enhancement for browser compatibility

## Performance Targets
- Bundle size < 500KB gzipped
- First Contentful Paint < 1.5s
- Smooth 60fps animations
- Support 1000+ cards with virtual scrolling
- Mobile Lighthouse score > 90

## Browser Support
- Chrome 90+, Firefox 88+, Safari 14+
- iOS 14+, Android 10+
- Progressive Web App capabilities