export interface KinesteXConfig {
  apiKey: string;
  company: string;
  exercise: string;
  userId?: string;
}

export interface KinesteXEventData {
  type: 'rep_count' | 'mistakes' | 'workout_complete' | 'error' | 'ready' | 'pose_detected';
  repCount?: number;
  mistake?: string;
  totalReps?: number;
  duration?: number;
  message?: string;
  poseData?: unknown;
}

export type KinesteXEventHandler = (data: KinesteXEventData) => void;

class KinesteXService {
  private iframe: HTMLIFrameElement | null = null;
  private eventHandlers: Set<KinesteXEventHandler> = new Set();
  private isInitialized = false;
  private config: KinesteXConfig | null = null;

  private handleMessage = (event: MessageEvent) => {
    if (event.origin !== 'https://kinestex.vercel.app') {
      return;
    }

    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      const eventData: KinesteXEventData = {
        type: data.type || data.event || 'error',
        repCount: data.repCount || data.reps || data.rep_count,
        mistake: data.mistake || data.error || data.feedback,
        totalReps: data.totalReps || data.total_reps,
        duration: data.duration,
        message: data.message,
        poseData: data.poseData || data.pose,
      };

      this.eventHandlers.forEach(handler => handler(eventData));
    } catch (error) {
      console.error('Error parsing KinesteX message:', error);
    }
  };

  initialize(config: KinesteXConfig, container: HTMLElement): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isInitialized) {
        resolve();
        return;
      }

      this.config = config;

      const params = new URLSearchParams({
        apiKey: config.apiKey,
        company: config.company,
        exercise: config.exercise,
        userId: config.userId || 'demo-user',
      });

      this.iframe = document.createElement('iframe');
      this.iframe.src = `https://kinestex.vercel.app/camera?${params.toString()}`;
      this.iframe.style.width = '100%';
      this.iframe.style.height = '100%';
      this.iframe.style.border = 'none';
      this.iframe.allow = 'camera; microphone; accelerometer; gyroscope';
      this.iframe.setAttribute('allowfullscreen', 'true');

      this.iframe.onload = () => {
        this.isInitialized = true;
        window.addEventListener('message', this.handleMessage);
        resolve();
      };

      this.iframe.onerror = () => {
        reject(new Error('Failed to load KinesteX camera'));
      };

      container.innerHTML = '';
      container.appendChild(this.iframe);
    });
  }

  startExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      JSON.stringify({ action: 'start', exercise: this.config?.exercise }),
      'https://kinestex.vercel.app'
    );
  }

  stopExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      JSON.stringify({ action: 'stop' }),
      'https://kinestex.vercel.app'
    );
  }

  resetExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      JSON.stringify({ action: 'reset' }),
      'https://kinestex.vercel.app'
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
