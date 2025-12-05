# KinesteX Squat Tracking Demo

## Overview
A simple demo application for tracking squats using the KinesteX SDK with custom UI. The app uses the device camera to detect and count squat repetitions in real-time.

## Project Structure
```
client/src/
├── components/
│   ├── KinesteXCamera.tsx    # Main camera component with exercise tracking UI
│   └── ui/                   # Shadcn UI components
├── services/
│   └── kinestexService.ts    # KinesteX SDK integration service
├── pages/
│   ├── home.tsx              # Main workout page
│   └── not-found.tsx         # 404 page
├── App.tsx                   # Main app with routing
└── main.tsx                  # Entry point

server/
├── index.ts                  # Express server entry
├── routes.ts                 # API routes
└── storage.ts                # In-memory storage
```

## Key Features
- Camera permission handling with user-friendly prompts
- Real-time squat tracking with KinesteX SDK
- Rep counter with pulse animation on each rep
- Form feedback banner for exercise corrections
- Workout complete summary with stats
- Start/Stop/Reset controls

## Environment Variables
- `VITE_KINESTEX_API_KEY` - KinesteX API key
- `VITE_KINESTEX_COMPANY` - KinesteX company ID (BBELabs)

## KinesteX Service (`kinestexService.ts`)
The service provides:
- `initialize(config, container)` - Initialize SDK with iframe in container
- `startExercise()` - Start tracking
- `stopExercise()` - Stop tracking
- `resetExercise()` - Reset the session
- `addEventListener(handler)` - Listen for events (rep_count, mistakes, workout_complete)
- `destroy()` - Clean up resources

## KinesteXCamera Component Props
```typescript
interface KinesteXCameraProps {
  isVisible: boolean;              // Show/hide camera
  onRepCount?: (count: number) => void;
  onMistake?: (mistake: string) => void;
  onWorkoutComplete?: (totalReps: number, duration: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}
```

## UI States
1. `permission_required` - Camera access prompt
2. `initializing` - Loading SDK
3. `ready` - Ready to start workout
4. `active` - Workout in progress
5. `error` - Error state with retry option
6. `complete` - Workout summary

## Design Notes
- Camera-centric layout with full viewport camera feed
- Semi-transparent overlays with backdrop blur
- Stats panel in top-right corner
- Feedback banner slides from top
- Control panel at bottom center
- All text white for contrast on camera feed
