import { useState } from 'react';
import { KinesteXCamera } from '@/components/KinesteXCamera';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [isWorkoutStarted] = useState(true);
  const { toast } = useToast();

  const handleRepCount = (count: number) => {
    if (count > 0 && count % 5 === 0) {
      toast({
        title: `${count} reps!`,
        description: 'Keep going, you\'re doing great!',
      });
    }
  };

  const handleMistake = (mistake: string) => {
    console.log('Form feedback:', mistake);
  };

  const handleWorkoutComplete = (totalReps: number, duration: number) => {
    toast({
      title: 'Workout Complete!',
      description: `You completed ${totalReps} squats in ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`,
    });
  };

  const handleError = (message: string) => {
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
  };

  return (
    <div className="min-h-screen bg-black" data-testid="page-home">
      <KinesteXCamera
        isVisible={isWorkoutStarted}
        onRepCount={handleRepCount}
        onMistake={handleMistake}
        onWorkoutComplete={handleWorkoutComplete}
        onError={handleError}
      />
    </div>
  );
}
