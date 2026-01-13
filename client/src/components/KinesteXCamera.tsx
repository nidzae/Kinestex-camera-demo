import { useEffect, useRef, useState, useCallback } from 'react';
import { kinestexService, getKinesteXConfig, type KinesteXEventData, type PoseData } from '@/services/kinestexService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Play, Square, RotateCcw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface KinesteXCameraProps {
  isVisible: boolean;
  onRepCount?: (count: number) => void;
  onMistake?: (mistake: string) => void;
  onWorkoutComplete?: (totalReps: number, duration: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  onPoseData?: (poseData: PoseData) => void;
}

type CameraState = 'permission_required' | 'initializing' | 'ready' | 'active' | 'error' | 'complete';

export function KinesteXCamera({
  isVisible,
  onRepCount,
  onMistake,
  onWorkoutComplete,
  onReady,
  onError,
  onPoseData,
}: KinesteXCameraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>('permission_required');
  const [repCount, setRepCount] = useState(0);
  const [currentMistake, setCurrentMistake] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workoutStats, setWorkoutStats] = useState<{ totalReps: number; duration: number } | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<Array<{ id: number; message: string; timestamp: Date; source: 'kinestex' | 'custom' }>>([]);
  const [personInFrame, setPersonInFrame] = useState(true);
  const [poseDataStatus, setPoseDataStatus] = useState<{ receiving: boolean; frameCount: number; lastAngles: Record<string, number> | null }>({
    receiving: false,
    frameCount: 0,
    lastAngles: null,
  });
  const mistakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for high-frequency pose data (30-60 FPS)
  const poseDataRef = useRef<PoseData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCountRef = useRef(0);
  const lastStatusUpdateRef = useRef(0);
  const cameraStateRef = useRef<CameraState>(cameraState);
  const feedbackIdCounter = useRef(0);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  // Draw skeleton on canvas (called on each pose data frame)
  const drawSkeleton = useCallback(() => {
    const canvas = canvasRef.current;
    const poseData = poseDataRef.current;
    if (!canvas || !poseData?.coordinates) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const coords = poseData.coordinates;

    // MediaPipe skeleton connections
    const connections = [
      // Face
      [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
      // Torso
      [11, 12], [11, 23], [12, 24], [23, 24],
      // Left arm
      [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
      // Right arm
      [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
      // Left leg
      [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
      // Right leg
      [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
    ];

    // Draw connections
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    for (const [i, j] of connections) {
      if (coords[i] && coords[j] && coords[i].visibility! > 0.5 && coords[j].visibility! > 0.5) {
        ctx.beginPath();
        ctx.moveTo(coords[i].x * canvas.width, coords[i].y * canvas.height);
        ctx.lineTo(coords[j].x * canvas.width, coords[j].y * canvas.height);
        ctx.stroke();
      }
    }

    // Draw landmarks
    ctx.fillStyle = '#ff0000';
    for (let i = 0; i < coords.length; i++) {
      const point = coords[i];
      if (point && point.visibility! > 0.5) {
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }, []);

  // Use refs for callbacks to avoid recreating handleEvent on every render
  const onRepCountRef = useRef(onRepCount);
  const onMistakeRef = useRef(onMistake);
  const onWorkoutCompleteRef = useRef(onWorkoutComplete);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onPoseDataRef = useRef(onPoseData);
  const repCountRef = useRef(repCount);
  const drawSkeletonRef = useRef(drawSkeleton);

  useEffect(() => {
    onRepCountRef.current = onRepCount;
    onMistakeRef.current = onMistake;
    onWorkoutCompleteRef.current = onWorkoutComplete;
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
    onPoseDataRef.current = onPoseData;
    repCountRef.current = repCount;
    drawSkeletonRef.current = drawSkeleton;
  }, [onRepCount, onMistake, onWorkoutComplete, onReady, onError, onPoseData, repCount, drawSkeleton]);

  const handleEvent = useCallback((data: KinesteXEventData) => {
    console.log('KinesteXCamera handleEvent:', data);
    switch (data.type) {
      case 'ready':
      case 'pose_detected':
        if (cameraStateRef.current !== 'active' && cameraStateRef.current !== 'complete') {
          console.log('Setting camera state to ready');
          setCameraState('ready');
          onReadyRef.current?.();
        }
        break;
      case 'rep_count':
        setRepCount(prev => {
          const newCount = data.repCount !== undefined ? data.repCount : prev + 1;
          onRepCountRef.current?.(newCount);
          return newCount;
        });
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 200);
        break;
      case 'mistakes':
        if (data.mistake) {
          const prefixedMistake = `[KINESTEX] ${data.mistake}`;
          setCurrentMistake(prefixedMistake);
          const newFeedback = {
            id: ++feedbackIdCounter.current,
            message: prefixedMistake,
            timestamp: new Date(),
            source: 'kinestex' as const
          };
          setFeedbackHistory(prev => [newFeedback, ...prev]);
          onMistakeRef.current?.(data.mistake);
          if (mistakeTimeoutRef.current) {
            clearTimeout(mistakeTimeoutRef.current);
          }
          mistakeTimeoutRef.current = setTimeout(() => {
            setCurrentMistake(null);
          }, 3500);
        }
        break;
      case 'workout_complete':
        setCameraState('complete');
        const stats = {
          totalReps: data.totalReps || repCountRef.current,
          duration: data.duration || 0,
        };
        setWorkoutStats(stats);
        onWorkoutCompleteRef.current?.(stats.totalReps, stats.duration);
        break;
      case 'error':
        console.error('KinesteX error event:', data);
        setCameraState('error');
        setErrorMessage(data.message || 'An error occurred');
        onErrorRef.current?.(data.message || 'An error occurred');
        break;
      case 'person_in_frame':
        setPersonInFrame(data.inFrame ?? true);
        break;
      case 'pose_landmarks':
        if (data.poseData) {
          // Store in ref (no re-render) for high-frequency updates
          poseDataRef.current = data.poseData;
          frameCountRef.current++;

          // Draw skeleton on canvas
          drawSkeletonRef.current();

          // Throttle state updates to ~4 times per second for UI display
          const now = Date.now();
          if (now - lastStatusUpdateRef.current > 250) {
            lastStatusUpdateRef.current = now;
            setPoseDataStatus({
              receiving: true,
              frameCount: frameCountRef.current,
              lastAngles: data.poseData.angles2D || null,
            });
          }

          onPoseDataRef.current?.(data.poseData);
        }
        break;
    }
  }, []); // No dependencies - uses refs for all external values

  const requestCameraPermission = async () => {
    try {
      console.log('Requesting camera permission...');
      setCameraState('initializing');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('Camera permission granted, stream:', stream);

      if (containerRef.current) {
        const config = getKinesteXConfig();
        console.log('KinesteX config:', config);
        console.log('Initializing KinesteX service...');
        await kinestexService.initialize(config, containerRef.current);
        kinestexService.addEventListener(handleEvent);
        console.log('KinesteX service initialized, setting state to ready');
        setCameraState('ready');
      }
    } catch (error) {
      console.error('Camera permission error:', error);
      setCameraState('error');
      setErrorMessage('Camera access was denied. Please enable camera permissions.');
      onError?.('Camera access denied');
    }
  };

  const startWorkout = () => {
    setCameraState('active');
    setRepCount(0);
    setCurrentMistake(null);
    setWorkoutStats(null);
    setFeedbackHistory([]);
    feedbackIdCounter.current = 0;
    kinestexService.startExercise();
  };

  const stopWorkout = () => {
    setCameraState('ready');
    kinestexService.stopExercise();
  };

  const resetWorkout = () => {
    setRepCount(0);
    setCurrentMistake(null);
    setWorkoutStats(null);
    setFeedbackHistory([]);
    feedbackIdCounter.current = 0;
    setCameraState('ready');
    kinestexService.resetExercise();
  };

  // Store handleEvent in a ref for cleanup
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  // Resize canvas to match container
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [cameraState]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      if (mistakeTimeoutRef.current) {
        clearTimeout(mistakeTimeoutRef.current);
      }
      kinestexService.removeEventListener(handleEventRef.current);
      kinestexService.destroy();
    };
  }, []); // Empty deps - only runs on unmount

  if (!isVisible) {
    return null;
  }

  return (
    <div className="relative h-screen w-full bg-black" data-testid="kinestex-wrapper">
      <div
        id="kinestex-container"
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        data-testid="kinestex-container"
      />

      {cameraState === 'permission_required' && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-black/60">
          <Card className="max-w-md mx-4 p-8 text-center bg-white/10 backdrop-blur-lg border-white/20">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-primary/20">
                <Camera className="w-12 h-12 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3" data-testid="text-permission-title">
              Camera Access Required
            </h2>
            <p className="text-white/80 mb-6 text-lg">
              To track your squats, we need access to your camera. Your video stays on your device and is never stored.
            </p>
            <Button 
              size="lg" 
              className="w-full text-lg py-6"
              onClick={requestCameraPermission}
              data-testid="button-allow-camera"
            >
              <Camera className="w-5 h-5 mr-2" />
              Allow Camera Access
            </Button>
          </Card>
        </div>
      )}

      {cameraState === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-black/60">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-white animate-spin mx-auto mb-4" />
            <p className="text-xl text-white font-medium" data-testid="text-initializing">
              Initializing camera...
            </p>
          </div>
        </div>
      )}

      {cameraState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-black/60">
          <Card className="max-w-md mx-4 p-8 text-center bg-white/10 backdrop-blur-lg border-white/20">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-destructive/20">
                <AlertTriangle className="w-12 h-12 text-red-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3" data-testid="text-error-title">
              Something Went Wrong
            </h2>
            <p className="text-white/80 mb-6 text-lg" data-testid="text-error-message">
              {errorMessage}
            </p>
            <Button 
              size="lg" 
              className="w-full text-lg py-6"
              onClick={requestCameraPermission}
              data-testid="button-retry"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Try Again
            </Button>
          </Card>
        </div>
      )}

      {cameraState === 'complete' && workoutStats && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-black/60 z-20">
          <Card className="max-w-md mx-4 p-8 text-center bg-white/10 backdrop-blur-lg border-white/20 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-green-500/20">
                <CheckCircle2 className="w-16 h-16 text-green-400" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-6" data-testid="text-complete-title">
              Workout Complete!
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-5xl font-bold text-white" data-testid="text-final-reps">
                  {workoutStats.totalReps}
                </p>
                <p className="text-white/60 text-sm mt-1">Total Reps</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-5xl font-bold text-white" data-testid="text-duration">
                  {Math.floor(workoutStats.duration / 60)}:{String(workoutStats.duration % 60).padStart(2, '0')}
                </p>
                <p className="text-white/60 text-sm mt-1">Duration</p>
              </div>
            </div>
            <Button 
              size="lg" 
              className="w-full text-lg py-6"
              onClick={resetWorkout}
              data-testid="button-try-again"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Try Again
            </Button>
          </Card>
        </div>
      )}

      {(cameraState === 'ready' || cameraState === 'active') && (
        <>
          <div className="absolute top-6 right-6 z-10">
            <div className="p-6 rounded-2xl backdrop-blur-lg bg-black/30 border border-white/10">
              <p className="text-white/60 text-lg mb-1" data-testid="text-exercise-label">Bent Over Dumbbell Row</p>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-7xl font-bold text-white tabular-nums transition-transform duration-150 ${isPulsing ? 'scale-110' : 'scale-100'}`}
                  data-testid="text-rep-count"
                >
                  {repCount}
                </span>
                <span className="text-2xl text-white/60">reps</span>
              </div>
            </div>
          </div>

          {/* Canvas overlay for drawing skeleton */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-[5]"
            width={1280}
            height={720}
          />

          {/* Pose Data Status Panel */}
          <div className="absolute top-6 left-6 z-10 max-w-sm">
            <div className="p-4 rounded-2xl backdrop-blur-lg bg-black/30 border border-white/10">
              <h3 className="text-white/80 text-sm font-semibold mb-2 uppercase tracking-wide">
                Pose Data {poseDataStatus.receiving && (
                  <span className="text-green-400 animate-pulse">LIVE</span>
                )}
              </h3>
              {!poseDataStatus.receiving ? (
                <p className="text-white/50 text-sm italic">Waiting for pose data...</p>
              ) : (
                <div className="space-y-2 text-xs font-mono">
                  <p className="text-green-400">
                    Frames received: {poseDataStatus.frameCount}
                  </p>
                  {poseDataStatus.lastAngles && (
                    <div className="text-white/80">
                      <p className="text-amber-400 font-semibold mb-1">Joint Angles:</p>
                      {Object.entries(poseDataStatus.lastAngles).slice(0, 6).map(([joint, angle]) => (
                        <p key={joint} className="text-white/70">
                          {joint}: <span className="text-white">{angle?.toFixed(1)}°</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {!personInFrame && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="px-8 py-6 rounded-2xl backdrop-blur-lg bg-blue-500/20 border border-blue-400/30 text-center">
                <p className="text-2xl font-semibold text-white">
                  [KINESTEX] Please step back so I can see your full body
                </p>
              </div>
            </div>
          )}

          {(cameraState === 'ready' || cameraState === 'active') && (
            <div className="absolute bottom-24 left-6 z-10 max-w-sm">
              <div className="p-4 rounded-2xl backdrop-blur-lg bg-black/30 border border-white/10">
                <h3 className="text-white/80 text-sm font-semibold mb-3 uppercase tracking-wide">
                  Form Feedback
                </h3>
                {feedbackHistory.length === 0 ? (
                  <p className="text-white/50 text-sm italic">No feedback yet - keep going!</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {feedbackHistory.map((feedback, index) => (
                    <div
                      key={feedback.id}
                      className={`p-3 rounded-lg bg-white/5 border border-white/10 ${index === 0 ? 'animate-in slide-in-from-top duration-200' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-white/90 leading-relaxed">
                          {feedback.message}
                        </p>
                      </div>
                      <p className="text-xs text-white/40 mt-1.5">
                        {feedback.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentMistake && (
            <div 
              className="absolute top-0 left-0 right-0 z-10 animate-in slide-in-from-top duration-300"
              data-testid="feedback-banner"
            >
              <div className="mx-auto max-w-2xl mt-6">
                <div className="px-6 py-4 rounded-2xl backdrop-blur-lg bg-amber-500/20 border border-amber-400/30 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-300" />
                    <p className="text-xl font-semibold text-white" data-testid="text-mistake">
                      {currentMistake}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-4 p-3 rounded-full backdrop-blur-lg bg-black/30 border border-white/10">
              {cameraState === 'ready' ? (
                <Button
                  size="lg"
                  className="rounded-full min-h-14 min-w-14 px-8 text-lg"
                  onClick={startWorkout}
                  data-testid="button-start"
                >
                  <Play className="w-6 h-6 mr-2" />
                  Start
                </Button>
              ) : (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full min-h-14 min-w-14 bg-white/10 text-white"
                    onClick={resetWorkout}
                    data-testid="button-reset"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="rounded-full min-h-14 px-8 text-lg"
                    onClick={stopWorkout}
                    data-testid="button-stop"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
