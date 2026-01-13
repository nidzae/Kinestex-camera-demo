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

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseData {
  coordinates?: PoseLandmark[];
  worldCoordinates?: PoseLandmark[];
  angles2D?: Record<string, number>;
  angles3D?: Record<string, number>;
}

export interface KinesteXEventData {
  type: 'rep_count' | 'mistakes' | 'workout_complete' | 'error' | 'ready' | 'pose_detected' | 'exit_kinestex' | 'person_in_frame' | 'pose_landmarks';
  repCount?: number;
  mistake?: string;
  totalReps?: number;
  duration?: number;
  message?: string;
  accuracy?: number;
  inFrame?: boolean;
  poseData?: PoseData;
}

export type KinesteXEventHandler = (data: KinesteXEventData) => void;

// KinesteX SDK URL with configuration flags
// NOTE: Pose data (includePoseData) is NOT currently working - see POSE_DATA_NOTES.md
// Voice muting flags also not fully effective - user muted laptop as workaround
const KINESTEX_URL = 'https://ai.kinestex.com/camera?showSilhouette=false&isOnboarding=false&hideMistakesFeedback=true&mute=true&includePoseData=poseLandmarks,worldLandmarks,angles';

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
    // Only accept messages from official KinesteX domains
    if (!event.origin.includes('ai.kinestex.com') && !event.origin.includes('kinestex.vercel.app')) {
      return;
    }

    try {
      const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

      if (!message || !message.type) return;

      // Log message types (filter out high-frequency pose data to avoid console flood)
      if (message.type !== 'pose_landmarks' && message.type !== 'world_landmarks') {
        console.log('KinesteX message type:', message.type);
      }

      switch (message.type) {
        case 'kinestex_loaded':
          console.log('SDK kinestex_loaded received - NOW sending silent configuration...');
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

        case 'custom_type':
          // Handle person_in_frame status
          if (message.data?.type === 'person_in_frame') {
            this.eventHandlers.forEach(handler => handler({
              type: 'person_in_frame',
              inFrame: message.data.value,
            }));
          }
          // Handle pose_landmarks data
          if (message.data?.type === 'pose_landmarks') {
            this.eventHandlers.forEach(handler => handler({
              type: 'pose_landmarks',
              poseData: {
                coordinates: message.data.coordinates,
                worldCoordinates: message.data.worldCoordinates,
                angles2D: message.data.angles2D,
                angles3D: message.data.angles3D,
              },
            }));
          }
          break;

        case 'pose_landmarks':
          // Direct pose_landmarks message type (2D coordinates)
          this.eventHandlers.forEach(handler => handler({
            type: 'pose_landmarks',
            poseData: {
              coordinates: message.coordinates || message.data?.coordinates,
              worldCoordinates: message.worldCoordinates || message.data?.worldCoordinates,
              angles2D: message.angles2D || message.data?.angles2D,
              angles3D: message.angles3D || message.data?.angles3D,
            },
          }));
          break;

        case 'world_landmarks':
          // 3D world coordinates in meters
          this.eventHandlers.forEach(handler => handler({
            type: 'pose_landmarks',
            poseData: {
              coordinates: message.coordinates || message.data?.coordinates,
              worldCoordinates: message.worldCoordinates || message.data?.worldCoordinates,
              angles2D: message.angles2D || message.data?.angles2D,
              angles3D: message.angles3D || message.data?.angles3D,
            },
          }));
          break;

        default:
          // Log unhandled messages (throttled to avoid console spam)
          if (!message.type?.includes('landmark')) {
            console.log('Unhandled KinesteX message:', message);
          }
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
        exercises: ['jX5zy5BKz3S2OtLRqSbT'],
        currentExercise: 'jX5zy5BKz3S2OtLRqSbT',
        // IF YOU WANT TO USE A VIDEO FEED INSTEAD OF CAMERA STREAM, UNCOMMENT THIS LINE 
        // videoURL: "https://cdn.kinestex.com/uploads%2F2047b732-0206-4bb9-9e15-e92fddaabefb_jz73VFlUyZ9nyd64OjRb.mp4?alt=media&token=3135ff52-3014-43b2-938e-024c280f92e5",
        age: config.age || 25,
        height: config.height || 170,
        weight: config.weight || 70,
        gender: config.gender || 'Male',
        lifestyle: 'Sedentary',
        style: config.style || 'dark',
        // Behavioral flags MUST be at top level (flat object) for HTML/JS /camera route
        hideMistakesFeedback: true, // Mutes form correction voice ("Squat lower", etc.)
        isOnboarding: false,        // Mutes intro tutorial voice
        showSilhouette: false,      // Mutes "Step back so I can see your legs" prompts
        hideMusicIcon: true,        // Removes music UI
        restSpeeches: [],           // Prevents transition/rest audio
        // Fallback mute keys for different SDK versions
        enableVoice: false,
        isMute: true,
        mute: true,
        // Pose data config nested in customParameters for React/Web
        // TODO: NOT WORKING - pose_landmarks messages never received
        // See POSE_DATA_NOTES.md for full troubleshooting history
        // May need to contact KinesteX support to verify API key permissions
        customParameters: {
          includePoseData: ['poseLandmarks', 'worldLandmarks', 'angles'],
          includeRealtimeAccuracy: true,
          isDrawingPose: true,
        },
      };

      window.addEventListener('message', this.handleMessage);

      this.iframe = document.createElement('iframe');
      this.iframe.id = 'kinestex-iframe';
      this.iframe.style.width = '100%';
      this.iframe.style.height = '100%';
      this.iframe.style.border = 'none';
      this.iframe.setAttribute('frameborder', '0');
      // Note: Removed 'autoplay' to try to prevent voice feedback auto-playing
      this.iframe.setAttribute('allow', 'camera; microphone; accelerometer; gyroscope; magnetometer');
      this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox');
      this.iframe.setAttribute('allowfullscreen', 'true');

      this.iframe.onload = () => {
        // Don't send postData here - wait for 'kinestex_loaded' message (handshake)
        // The kinestex_loaded handler in handleMessage will call sendMessage()
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

  private muteIframeAudio(): void {
    if (!this.iframe) return;

    // Try sending mute command via postMessage
    this.iframe.contentWindow?.postMessage({ action: 'mute' }, KINESTEX_URL);
    this.iframe.contentWindow?.postMessage({ type: 'mute' }, KINESTEX_URL);
    this.iframe.contentWindow?.postMessage({ command: 'muteAudio', value: true }, KINESTEX_URL);

    console.log('Attempted to mute KinesteX audio via postMessage');
  }

  public mute(): void {
    this.muteIframeAudio();
  }

  public unmute(): void {
    if (!this.iframe) return;
    this.iframe.contentWindow?.postMessage({ action: 'unmute' }, KINESTEX_URL);
    this.iframe.contentWindow?.postMessage({ type: 'unmute' }, KINESTEX_URL);
  }
}

export const kinestexService = new KinesteXService();

export function getKinesteXConfig(): KinesteXConfig {
  const config = {
    apiKey: import.meta.env.VITE_KINESTEX_API_KEY || '',
    company: import.meta.env.VITE_KINESTEX_COMPANY || '',
    exercise: 'Bent Over Dumbbell Row',
    exercises: ['Bent Over Dumbbell Row'],
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
