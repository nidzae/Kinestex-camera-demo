export interface KinesteXConfig {
  apiKey: string;
  company: string;
  exercise: string;
  exercises?: string[];
  userId?: string;
  style?: 'dark' | 'light';
  age?: number;
  height?: number;
  weight?: number;
  gender?: 'Male' | 'Female';
}

export interface KinesteXEventData {
  type: 'rep_count' | 'mistakes' | 'workout_complete' | 'error' | 'ready' | 'pose_detected' | 'exit_kinestex';
  repCount?: number;
  mistake?: string;
  totalReps?: number;
  duration?: number;
  message?: string;
  accuracy?: number;
}

export type KinesteXEventHandler = (data: KinesteXEventData) => void;

const KINESTEX_URL = 'https://kinestex.vercel.app/camera';

class KinesteXService {
  private iframe: HTMLIFrameElement | null = null;
  private eventHandlers: Set<KinesteXEventHandler> = new Set();
  private isInitialized = false;
  private config: KinesteXConfig | null = null;
  private postData: Record<string, unknown> | null = null;

  private sendMessage = () => {
    if (this.iframe?.contentWindow && this.postData) {
      console.log('Sending KinesteX postData:', JSON.stringify(this.postData, null, 2));
      this.iframe.contentWindow.postMessage(this.postData, KINESTEX_URL);
      console.log('KinesteX postData sent successfully');
    } else {
      console.error('Cannot send message - iframe or postData not available');
    }
  };

  private handleMessage = (event: MessageEvent) => {
    if (!event.origin.includes('kinestex.vercel.app')) {
      return;
    }

    try {
      const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

      if (!message || !message.type) return;

      console.log('KinesteX message received:', {
        type: message.type,
        data: message.data,
        fullMessage: message
      });

      switch (message.type) {
        case 'kinestex_loaded':
          this.sendMessage();
          this.eventHandlers.forEach(handler => handler({ type: 'ready' }));
          break;

        case 'successful_repeat':
          this.eventHandlers.forEach(handler => handler({
            type: 'rep_count',
            repCount: message.value || message.data?.value || message.data?.reps || 1,
            accuracy: message.accuracy || message.data?.accuracy,
          }));
          break;

        case 'mistake':
          this.eventHandlers.forEach(handler => handler({
            type: 'mistakes',
            mistake: message.value || message.data?.value || message.data?.mistake || 'Form correction needed',
          }));
          break;

        case 'exit_kinestex':
          this.eventHandlers.forEach(handler => handler({
            type: 'workout_complete',
            duration: message.time_spent || message.data?.time_spent || 0,
            totalReps: message.reps || message.data?.reps || 0,
          }));
          break;

        case 'error_occurred':
          this.eventHandlers.forEach(handler => handler({
            type: 'error',
            message: message.error || message.data?.error || message.data?.message || 'An error occurred',
          }));
          break;

        default:
          console.log('Unhandled KinesteX message:', message);
      }
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

      this.postData = {
        userId: config.userId || 'demo-user-' + Date.now(),
        key: config.apiKey,
        company: config.company,
        exercises: ['Squats'],
        currentExercise: 'Squats',
        age: config.age || 25,
        height: config.height || 170,
        weight: config.weight || 70,
        gender: config.gender || 'Male',
        lifestyle: 'Sedentary',
        customParameters: {
          style: config.style || 'dark',
        },
      };

      window.addEventListener('message', this.handleMessage);

      this.iframe = document.createElement('iframe');
      this.iframe.id = 'kinestex-iframe';
      this.iframe.style.width = '100%';
      this.iframe.style.height = '100%';
      this.iframe.style.border = 'none';
      this.iframe.setAttribute('frameborder', '0');
      this.iframe.setAttribute('allow', 'camera; microphone; autoplay; accelerometer; gyroscope; magnetometer');
      this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox');
      this.iframe.setAttribute('allowfullscreen', 'true');

      this.iframe.onload = () => {
        this.sendMessage();
        this.isInitialized = true;
        resolve();
      };

      this.iframe.onerror = () => {
        reject(new Error('Failed to load KinesteX camera'));
      };

      container.innerHTML = '';
      this.iframe.src = KINESTEX_URL;
      container.appendChild(this.iframe);
    });
  }

  startExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      { action: 'start', exercise: this.config?.exercise },
      KINESTEX_URL
    );
  }

  stopExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      { action: 'stop' },
      KINESTEX_URL
    );
  }

  resetExercise(): void {
    if (!this.iframe?.contentWindow) {
      console.error('KinesteX not initialized');
      return;
    }

    this.iframe.contentWindow.postMessage(
      { action: 'reset' },
      KINESTEX_URL
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
    this.postData = null;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const kinestexService = new KinesteXService();

export function getKinesteXConfig(): KinesteXConfig {
  const config = {
    apiKey: import.meta.env.VITE_KINESTEX_API_KEY || '',
    company: import.meta.env.VITE_KINESTEX_COMPANY || '',
    exercise: 'Squats',
    exercises: ['Squats'],
    style: 'dark',
  };
  console.log('Environment variables check:', {
    hasApiKey: !!config.apiKey,
    hasCompany: !!config.company,
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 5)}...` : 'MISSING',
    company: config.company || 'MISSING',
  });
  return config;
}
