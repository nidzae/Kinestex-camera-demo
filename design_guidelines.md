# KinesteX Squat Tracking Demo - Design Guidelines

## Design Approach: Fitness App Interface (Reference-Based)

**Primary References:** Peloton Digital, Apple Fitness+, Nike Training Club
**Rationale:** Camera-first fitness tracking requires minimal UI that doesn't obstruct movement visibility while providing clear, at-a-glance feedback during exercise.

---

## Core Design Principles

1. **Camera-Centric Layout:** Full or near-full viewport camera feed as primary element
2. **Non-Obstructive Overlays:** Critical stats positioned at edges, never center
3. **Distance Readability:** Large, bold typography visible from exercise position (3-6 feet away)
4. **Minimal Distractions:** Clean interface that disappears into the workout experience

---

## Layout System

### Spacing
Use Tailwind units: **4, 6, 8, 12** for consistent rhythm
- Overlay padding: p-6 to p-8
- Stat card spacing: gap-4
- Button spacing: px-8 py-4

### Viewport Strategy
- Camera container: Full viewport height (h-screen)
- Stats overlay: Absolute positioned, edges only
- Control panel: Fixed bottom or floating corner

---

## Typography Hierarchy

**Primary Font:** Inter or Roboto (Google Fonts) - exceptional readability
**Secondary Font:** Same family, varied weights

**Scale:**
- Rep Counter: text-6xl to text-8xl font-bold (primary stat)
- Exercise Name: text-2xl to text-3xl font-semibold
- Status Messages: text-xl font-medium
- Secondary Info: text-base to text-lg
- Buttons: text-lg font-semibold

---

## Component Library

### Camera View
- Full viewport container with id="kinestex-container"
- Aspect ratio: 16:9 or native camera
- Position: relative for overlay placement

### Stats Overlay (Top-Right Corner)
- Semi-transparent backdrop (backdrop-blur-lg bg-black/20)
- Rounded-2xl container
- Contains: Rep count, exercise name, current set
- Layout: Vertical stack with gap-2

### Form Feedback Banner (Top-Center)
- Appears only when mistakes detected
- Full-width alert bar with rounded-b-xl
- Large text for immediate visibility
- Auto-dismiss after 3-4 seconds

### Control Panel (Bottom-Center or Bottom-Right)
- Floating rounded-full button group
- Includes: Start/Stop, Reset, Camera toggle
- Buttons: Large touch targets (min-h-14 min-w-14)
- Icon-only for space efficiency

### Permission Modal
- Centered overlay with backdrop-blur
- Clear instruction text
- Large "Allow Camera" CTA button
- Friendly illustration or icon placeholder

### Workout Complete Card (Center Overlay)
- Modal-style with max-w-md
- Summary stats: Total reps, duration, form score
- Prominent "Done" or "Try Again" CTAs
- Celebration micro-animation on appear

---

## Interaction Patterns

### Camera Initialization
1. Permission request modal appears immediately
2. Loading state during SDK connection
3. Smooth fade-in when camera activates

### Exercise Tracking
- Rep counter animates on increment (scale pulse)
- Form feedback slides in from top
- Success states use subtle green indicators
- Error states use amber/yellow (not red - less aggressive)

### Animations
**Minimal & Purposeful:**
- Rep count: Scale pulse (1.0 → 1.1 → 1.0) on increment
- Feedback banner: Slide down from top
- Button states: Simple opacity/scale changes
- NO continuous animations that distract during exercise

---

## Accessibility & Safety

- Minimum 4.5:1 contrast ratio for all text on camera background
- Touch targets: Minimum 44x44px
- Large, clear icons (Heroicons preferred)
- Keyboard navigation for start/stop controls
- Screen reader announcements for rep counts

---

## Images

**No hero image required** - Camera feed IS the hero element

**Icon/Illustration Needs:**
- Camera permission icon (from Heroicons: camera)
- Success checkmark (check-circle)
- Warning indicator (exclamation-triangle)
- Loading spinner during initialization

---

## Visual Treatment Notes

**Critical:** All overlay components must use:
- Backdrop blur: backdrop-blur-md to backdrop-blur-lg
- Semi-transparent backgrounds: bg-black/20 to bg-black/40
- White text for maximum contrast on camera feed
- Rounded corners: rounded-xl to rounded-2xl for modern feel

**Button Treatment on Camera:**
- Floating buttons with backdrop-blur-lg bg-white/10
- White icons/text with drop shadows for depth
- No hover states needed - implement default button styles that work universally