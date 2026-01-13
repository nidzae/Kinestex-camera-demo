# KinesteX Pose Data Integration Notes

## Goal
Get raw pose landmark data (coordinates, angles) from the KinesteX SDK to build custom form feedback on top of their exercise tracking.

## Current Status: NOT WORKING
The SDK is fully functional for exercise tracking (reps, mistakes) but pose data is not being received.

---

## What IS Working
- Camera initialization and permissions
- KinesteX iframe loading (`kinestex_loaded` message received)
- Exercise tracking with model_id `jX5zy5BKz3S2OtLRqSbT` (Bent Over Dumbbell Row)
- Rep counting (`successful_repeat` messages)
- Form feedback/mistakes (`mistake` messages like "Push your hips back...")
- The AI is clearly tracking the body (it gives form corrections), but pose data isn't piped through

## What is NOT Working
- `pose_landmarks` messages are never received
- `world_landmarks` messages are never received
- No coordinates, angles, or visibility data coming through

---

## Configuration Attempts

### 1. URL Parameters (kinestexService.ts:44)
```
const KINESTEX_URL = 'https://ai.kinestex.com/camera?showSilhouette=false&isOnboarding=false&hideMistakesFeedback=true&mute=true&includePoseData=poseLandmarks,worldLandmarks,angles';
```

### 2. Top-level postData flags
Tried adding directly to postData object:
```typescript
includePoseData: ['poseLandmarks', 'worldLandmarks', 'angles'],
```
Result: No pose data received

### 3. Nested in customParameters (CURRENT - per documentation)
```typescript
customParameters: {
  includePoseData: ['poseLandmarks', 'worldLandmarks', 'angles'],
  includeRealtimeAccuracy: true,
  isDrawingPose: true,
},
```
Result: No pose data received

### 4. String format instead of array
```typescript
includePoseData: 'poseLandmarks,worldLandmarks,angles',
```
Result: Documentation says this is WRONG - must be array

---

## Message Types We DO Receive
From console logs:
- `kinestex_launched`
- `kinestex_loaded`
- `model_warmedup`
- `camera_selected`
- `models_loaded`
- `successful_repeat` (rep counts)
- `mistake` (form corrections)

## Message Types We DON'T Receive (but should)
- `pose_landmarks`
- `world_landmarks`
- `correct_position_accuracy`

---

## Current Code Structure

### kinestexService.ts
- Handles iframe communication via postMessage
- Has handlers for `pose_landmarks`, `world_landmarks`, and `custom_type` with nested pose data
- Console logging filtered to avoid flood when pose data starts working
- Full postData config at lines 182-220

### KinesteXCamera.tsx
- Canvas overlay ready to draw skeleton (lines 412-418)
- Pose data status panel in top-left (lines 420-448)
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

## Possible Issues to Investigate

1. **API Key permissions** - Does the BBELabs API key have pose data access enabled?

2. **Exercise-specific** - Does Bent Over Dumbbell Row support pose data output? Try a different exercise?

3. **SDK version** - Is ai.kinestex.com the correct endpoint? Previously tried kinestex.vercel.app

4. **Timing** - Maybe pose data only streams after clicking "Start"? (We tested this, still nothing)

5. **Message format** - The SDK might send pose data in a different wrapper we're not catching

6. **CORS/iframe sandbox** - Could be blocking the high-frequency messages?

---

## Voice Muting (Also Attempted, Partially Working)

Tried to mute all voice feedback. Many approaches attempted:
- URL params: `mute=true`, `hideMistakesFeedback=true`, `showSilhouette=false`, `isOnboarding=false`
- postData flags: `enableVoice: false`, `isMute: true`, `mute: true`, `hideMistakesFeedback: true`
- `restSpeeches: []`
- Removed `autoplay` from iframe allow attribute

**Result**: Voice still plays. User muted laptop as workaround.

---

## Files Modified
- `client/src/services/kinestexService.ts` - SDK integration
- `client/src/components/KinesteXCamera.tsx` - UI with canvas overlay
- `client/.env` - API credentials (VITE_KINESTEX_API_KEY, VITE_KINESTEX_COMPANY)
- `client/src/utils/exerciseMatcher.ts` - Fuzzy matching for exercise names
- `client/src/data/kinestex-exercises.json` - Full exercise list (374 exercises)
- `scripts/fetch-exercises.js` - Script to fetch exercise catalog

---

## Next Steps to Try

1. Contact KinesteX support to verify:
   - API key has pose data permissions
   - Correct parameter format for their current SDK version
   - Whether specific exercises support pose data output

2. Try their React Native or Swift SDK instead of web iframe

3. Check if there's a different domain/endpoint for pose data

4. Look for SDK documentation updates

---

## Environment
- Dev server running on port 5001 (`npm run dev`)
- Vite + React + TypeScript
- API credentials in `client/.env`
