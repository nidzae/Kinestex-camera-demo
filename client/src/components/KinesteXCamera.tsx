import { useEffect, useRef, useState, useCallback } from 'react';
import { kinestexService, getKinesteXConfig, type KinesteXEventData } from '@/services/kinestexService';
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
}

type CameraState = 'permission_required' | 'initializing' | 'ready' | 'active' | 'error' | 'complete';

export function KinesteXCamera({
  isVisible,
  onRepCount,
  onMistake,
  onWorkoutComplete,
  onReady,
  onError,
}: KinesteXCameraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>('permission_required');
  const [repCount, setRepCount] = useState(0);
  const [currentMistake, setCurrentMistake] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workoutStats, setWorkoutStats] = useState<{ totalReps: number; duration: number } | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const mistakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraStateRef = useRef<CameraState>(cameraState);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  const handleEvent = useCallback((data: KinesteXEventData) => {
    switch (data.type) {
      case 'ready':
      case 'pose_detected':
        if (cameraStateRef.current !== 'active' && cameraStateRef.current !== 'complete') {
          setCameraState('ready');
          onReady?.();
        }
        break;
      case 'rep_count':
        if (data.repCount !== undefined) {
          setRepCount(data.repCount);
          onRepCount?.(data.repCount);
          setIsPulsing(true);
          setTimeout(() => setIsPulsing(false), 200);
        }
        break;
      case 'mistakes':
        if (data.mistake) {
          setCurrentMistake(data.mistake);
          onMistake?.(data.mistake);
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
          totalReps: data.totalReps || repCount,
          duration: data.duration || 0,
        };
        setWorkoutStats(stats);
        onWorkoutComplete?.(stats.totalReps, stats.duration);
        break;
      case 'error':
        setCameraState('error');
        setErrorMessage(data.message || 'An error occurred');
        onError?.(data.message || 'An error occurred');
        break;
    }
  }, [onRepCount, onMistake, onWorkoutComplete, onReady, onError, repCount]);

  const requestCameraPermission = async () => {
    try {
      setCameraState('initializing');
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      if (containerRef.current) {
        const config = getKinesteXConfig();
        await kinestexService.initialize(config, containerRef.current);
        kinestexService.addEventListener(handleEvent);
        setCameraState('ready');
      }
    } catch (error) {
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
    setCameraState('ready');
    kinestexService.resetExercise();
  };

  useEffect(() => {
    return () => {
      if (mistakeTimeoutRef.current) {
        clearTimeout(mistakeTimeoutRef.current);
      }
      kinestexService.removeEventListener(handleEvent);
      kinestexService.destroy();
    };
  }, [handleEvent]);

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
              <p className="text-white/60 text-lg mb-1" data-testid="text-exercise-label">Squats</p>
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
