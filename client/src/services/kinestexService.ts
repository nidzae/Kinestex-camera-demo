export interface KinesteXConfig {
  apiKey: string;
  company: string;
  exercise: string;
  userId?: string;
  age?: number;
  height?: number;
  weight?: number;
  gender?: 'Male' | 'Female';
}

export interface KinesteXEventData {
  type: 'rep_count' | 'mistakes' | 'workout_complete' | 'error' | 'ready' | 'pose_detected' | 'exercise_completed' | 'exit_kinestex' | 'workout_opened' | 'left_camera_frame';
  repCount?: number;
  mistake?: string;
  totalReps?: number;
  duration?: number;
  message?: string;
  poseData?: unknown;
  calories?: number;
  mistakes?: Record<string, number>;
}

export type KinesteXEventHandler = (data: KinesteXEventData) => void;

class KinesteXService {
  private iframe: HTMLIFrameElement | null = null;
  private eventHandlers: Set<KinesteXEventHandler> = new Set();
  private isInitialized = false;
  private config: KinesteXConfig | null = null;

  private handleMessage = (event: MessageEvent) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      if (!data || !data.type) return;

      let eventData: KinesteXEventData;

      switch (data.type) {
        case 'finished_workout':
          eventData = {
            type: 'workout_complete',
            duration: data.data?.time_spent || data.time_spent,
            calories: data.data?.calories || data.calories,
            totalReps: data.data?.repeats || data.repeats,
          };
          break;
        case 'exercise_completed':
          eventData = {
            type: 'rep_count',
            repCount: data.data?.repeats || data.repeats,
            duration: data.data?.time_spent || data.time_spent,
            calories: data.data?.calories || data.calories,
            mistakes: data.data?.mistakes || data.mistakes,
          };
          break;
        case 'error_occurred':
          eventData = {
            type: 'error',
            message: data.data?.error || data.error || 'An error occurred',
          };
          break;
        case 'exit_kinestex':
          eventData = {
            type: 'workout_complete',
            duration: data.data?.time_spent || data.time_spent,
          };
          break;
        case 'workout_opened':
          eventData = {
            type: 'ready',
          };
          break;
        case 'left_camera_frame':
          eventData = {
            type: 'mistakes',
            mistake: 'Please stay in the camera frame',
          };
          break;
        default:
          eventData = {
            type: data.type,
            repCount: data.repCount || data.reps || data.rep_count || data.data?.repeats,
            mistake: data.mistake || data.error || data.feedback,
            totalReps: data.totalReps || data.total_reps || data.data?.repeats,
            duration: data.duration || data.data?.time_spent,
            message: data.message,
            poseData: data.poseData || data.pose,
          };
      }

      this.eventHandlers.forEach(handler => handler(eventData));
    } catch (error) {
      console.error('Error parsing KinesteX message:', error, event.data);
    }
  };

  initialize(config: KinesteXConfig, container: HTMLElement): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isInitialized && this.iframe) {
        resolve();
        return;
      }

      this.config = config;

      this.iframe = document.createElement('iframe');
      this.iframe.src = 'https://kinestex.vercel.app/';
      this.iframe.style.width = '100%';
      this.iframe.style.height = '100%';
      this.iframe.style.border = 'none';
      this.iframe.allow = 'camera; microphone; autoplay';
      this.iframe.setAttribute('allowfullscreen', 'true');
      this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');

      window.addEventListener('message', this.handleMessage);

      this.iframe.onload = () => {
        const postData = {
          userId: config.userId || 'demo-user-' + Date.now(),
          company: config.company,
          key: config.apiKey,
          planC: config.exercise === 'squats' ? 'Fitness' : config.exercise,
          age: config.age || 25,
          height: config.height || 170,
          weight: config.weight || 70,
          gender: config.gender || 'Male',
        };

        setTimeout(() => {
          if (this.iframe?.contentWindow) {
            this.iframe.contentWindow.postMessage(postData, '*');
            this.isInitialized = true;
            resolve();
          }
        }, 500);
      };

      this.iframe.onerror = () => {
        reject(new Error('Failed to load KinesteX camera'));
      };

      container.innerHTML = '';
      container.appendChild(this.iframe);

      setTimeout(() => {
        if (!this.isInitialized) {
          this.isInitialized = true;
          resolve();
        }
      }, 5000);
    });
  }

  startExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      { action: 'start', exercise: this.config?.exercise },
      '*'
    );
  }

  stopExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      { action: 'stop' },
      '*'
    );
  }

  resetExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      { action: 'reset' },
      '*'
    );
  }

  addEventListener(handler: KinesteXEventHandler): void {
    this.eventHandlers.add(handler);
  }

  removeEventListener(handler: KinesteXEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    this.eventHandlers.clear();
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.isInitialized = false;
    this.config = null;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const kinestexService = new KinesteXService();

export function getKinesteXConfig(): KinesteXConfig {
  return {
    apiKey: import.meta.env.VITE_KINESTEX_API_KEY || '',
    company: import.meta.env.VITE_KINESTEX_COMPANY || '',
    exercise: 'squats',
  };
}
