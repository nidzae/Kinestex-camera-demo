# KinesteX Pose Data Integration Notes

## Goal
Get raw pose landmark data (coordinates, angles) from the KinesteX SDK to build custom form feedback on top of their exercise tracking.

## Current Status: NOT WORKING (via manual iframe)
The SDK is fully functional for exercise tracking (reps, mistakes) but pose data is not being received through the manual iframe/postMessage approach. **Next step: migrate to `kinestex-sdk-react-ts` React package.**

---

## What IS Working
- Camera initialization and permissions
- KinesteX iframe loading (`kinestex_loaded` message received)
- Exercise tracking with model_id `jX5zy5BKz3S2OtLRqSbT` (Bent Over Dumbbell Row)
- Rep counting (`successful_repeat` messages)
- Form feedback/mistakes (`mistake` messages like "Push your hips back...")
- The AI is clearly tracking the body (it gives form corrections), but pose data isn't piped through
- **Voice muting** — SOLVED via `currentExercise: "Pause Audio"` (see below)

## What is NOT Working
- `pose_landmarks` messages are never received
- `world_landmarks` messages are never received
- No coordinates, angles, or visibility data coming through

---

## Voice Muting: SOLVED

Per KinesteX support, `currentExercise` doubles as an action controller:

1. At session start, set `currentExercise: "Pause Audio"` to mute all voice feedback
2. Then change `currentExercise` to the actual exercise ID to begin tracking (audio stays muted)
3. To resume audio later, set `currentExercise: "Resume Audio"`

**Implementation:** On `kinestex_loaded`, we send postData with `currentExercise: "Pause Audio"` first, then after 500ms send again with the real exercise ID. This replaced all previous workaround flags (`hideMistakesFeedback`, `enableVoice`, `isMute`, `mute`, `restSpeeches`, etc.) which were ineffective.

---

## Raw Event Logging Results (Feb 2026)

Added comprehensive raw event logging (`[RAW-NEW-TYPE]`) that logs EVERY message from the iframe before any filtering/parsing. This confirmed that the manual iframe approach only receives these message types:

```
kinestex_loaded     — SDK ready, date timestamp
kinestex_launched   — App started, date string
model_warmedup      — "Pose tracking model loaded, starting other processes"
camera_selected     — Camera ID, label, isMirrorCamera
models_loaded       — "All models loaded"
successful_repeat   — Rep count (only during exercise)
mistake             — Form corrections (only during exercise)
```

**No pose_landmarks, world_landmarks, or any coordinate data is ever sent.** The `customParameters.includePoseData` config has no effect via the manual iframe approach. This is not a filtering issue on our side — the data simply never arrives.

---

## Configuration Attempts (all failed for pose data)

### 1. URL Parameters
```
includePoseData=poseLandmarks,worldLandmarks,angles
```

### 2. Top-level postData flags
```typescript
includePoseData: ['poseLandmarks', 'worldLandmarks', 'angles'],
```

### 3. Nested in customParameters (current)
```typescript
customParameters: {
  includePoseData: ['poseLandmarks', 'worldLandmarks', 'angles'],
  includeRealtimeAccuracy: true,
  isDrawingPose: true,
},
```

### 4. String format instead of array
```typescript
includePoseData: 'poseLandmarks,worldLandmarks,angles',
```

**None of these produced pose data output.**

---

## Current Code Structure

### kinestexService.ts
- Manual iframe/postMessage integration
- Raw event logging (`[RAW-NEW-TYPE]` and `[RAW]`) for debugging
- "Pause Audio" muting on session start via `sendMuteAndStart()`
- Handlers for `pose_landmarks`, `world_landmarks`, `custom_type` (ready but never triggered)

### KinesteXCamera.tsx
- Canvas overlay ready to draw skeleton
- Pose data status panel in top-left
- Uses refs for high-frequency data (30-60 FPS) to avoid re-render performance issues
- `drawSkeleton()` function ready with MediaPipe 33-landmark topology
- Throttled state updates (4x/second) for UI display

---

## Expected Data Structure (from documentation)

### pose_landmarks (2D Image Space)
```json
{
  "coordinates": [
    { "x": 0.52, "y": 0.23, "z": -0.1, "visibility": 0.99 },
    // ... 33 landmarks total (MediaPipe topology)
  ],
  "angles2D": {
    "left_elbow": 175.4,
    "right_knee": 92.1
  },
  "angles3D": { ... }
}
```

### world_landmarks (3D Metric Space)
- Coordinates in real-world meters
- Origin at center of user's hips

### Landmark Mapping (33 points)
| Index | Landmark | Index | Landmark |
|-------|----------|-------|----------|
| 0 | Nose | 11, 12 | Shoulders (L, R) |
| 13, 14 | Elbows (L, R) | 23, 24 | Hips (L, R) |
| 15, 16 | Wrists (L, R) | 25, 26 | Knees (L, R) |
| 19, 20 | Index Fingers (L, R) | 27, 28 | Ankles (L, R) |

---

## Files Modified
- `client/src/services/kinestexService.ts` - SDK integration (manual iframe)
- `client/src/components/KinesteXCamera.tsx` - UI with canvas overlay
- `client/.env` - API credentials (VITE_KINESTEX_API_KEY, VITE_KINESTEX_COMPANY)
- `client/src/utils/exerciseMatcher.ts` - Fuzzy matching for exercise names
- `client/src/data/kinestex-exercises.json` - Full exercise list (374 exercises)
- `scripts/fetch-exercises.js` - Script to fetch exercise catalog

---

## Next Steps

### 1. Migrate to `kinestex-sdk-react-ts` React package
KinesteX support recommended using their official React package instead of the manual iframe approach. This is the most likely path to getting pose data working.

**Package:** `kinestex-sdk-react-ts` (v0.0.2)
```bash
npm i kinestex-sdk-react-ts
```

**Key details:**
- Exports `<KinesteXSDK>` component with `handleMessage(type, data)` callback
- Use `IntegrationOption.CAMERA` for custom UI with exercise tracking
- Ref-based API (`KinesteXSDKCamera`) for `changeExercise()` and `sendAction()`
- Handles iframe internally — no manual postMessage wiring needed
- Docs: https://www.kinestex.com/docs/installation?lang=react-ts

**Migration plan:**
1. Install `kinestex-sdk-react-ts`
2. Replace `kinestexService.ts` manual iframe with `<KinesteXSDK>` component
3. Use `IntegrationOption.CAMERA` with `exercises` and `currentExercise` in `IPostData`
4. Wire `handleMessage` callback to existing event handlers
5. Use ref to implement "Pause Audio" muting via `changeExercise("Pause Audio")`
6. Keep existing UI overlay (rep counter, feedback banner, skeleton canvas)
7. Test if pose data events arrive through the React package

### 2. If pose data still missing after migration
- Contact KinesteX support to confirm API key has pose data permissions
- Ask which exercises support pose data output
- Check their admin dashboard chatbot for additional configuration

---

## Environment
- Dev server: `PORT=4000 npm run dev` (port 5000 taken by macOS AirPlay)
- Vite + React + TypeScript
- API credentials in `client/.env`
