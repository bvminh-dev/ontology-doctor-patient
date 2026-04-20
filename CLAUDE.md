# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Doctor-Patient Ontology - A web application for managing doctors and patients with an ontology-based approach. Built with Next.js 14 (App Router), MongoDB Atlas, and Tailwind CSS with shadcn/ui components.

## Common Commands

**Development:**
```bash
npm run dev        # Start development server on localhost:3000
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
```

**MongoDB:**
- Set `MONGODB_URI` in `.env.local` for MongoDB Atlas connection
- Database name: `doctor-patient`

## Architecture

**Backend (API Routes):**
- `src/app/api/doctors/route.ts` - Doctor CRUD endpoints
- `src/app/api/patients/route.ts` - Patient CRUD endpoints

**Data Models (Mongoose Schemas):**
- `src/models/Doctor.ts` - Doctor schema (name, specialty, phone, email)
- `src/models/Patient.ts` - Patient schema (name, age, phone, email, assignedDoctor reference)

**Frontend Components:**
- `src/app/page.tsx` - Main page with tab-based layout
- `src/components/DoctorForm.tsx` - Doctor creation form
- `src/components/PatientForm.tsx` - Patient creation form with doctor selection
- `src/components/DoctorList.tsx` - Doctor table display
- `src/components/PatientList.tsx` - Patient table with populated doctor info

**Database Connection:**
- `src/lib/mongodb.ts` - MongoDB connection singleton using caching pattern

## Design System

**IMPORTANT:** All UI development MUST follow the design system specified in [design.md](design.md).

Before coding any UI component:
1. Review the design system rules in `design.md`
2. Apply the Meta Store-inspired design patterns:
   - Use pill-shaped buttons (100px radius) with Meta Blue (`#0064E0`)
   - Follow the 8px spacing grid system
   - Use proper border radius scale (8px for inputs, 20px for cards, 100px for pills)
   - Apply semantic colors consistently (success, error, warning)
   - Follow typography hierarchy (Optimistic-style weights)
3. Reference specific color names and hex codes from the design document
4. Maintain generous whitespace (64-80px section padding for premium feel)
