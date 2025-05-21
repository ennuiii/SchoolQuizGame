class AudioService {
  private static instance: AudioService;
  private backgroundMusic: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // Initialize in constructor but don't start playing
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise((resolve) => {
      try {
        // Create audio element
        this.backgroundMusic = new Audio('/assets/background-music.mp3');
        this.backgroundMusic.loop = true;
        this.backgroundMusic.volume = 0.5;

        // Load saved state
        const savedMuteState = localStorage.getItem('isMuted');
        const savedVolume = localStorage.getItem('musicVolume');
        
        if (!savedMuteState && !savedVolume) {
          // First visit: default to muted
          this.isMuted = true;
          this.volume = 0;
          localStorage.setItem('isMuted', JSON.stringify(true));
          localStorage.setItem('musicVolume', JSON.stringify(0));
          this.backgroundMusic.volume = 0;
        } else {
          if (savedMuteState) {
            this.isMuted = JSON.parse(savedMuteState);
            if (this.isMuted) {
              this.backgroundMusic.volume = 0;
            }
          }
          
          if (savedVolume) {
            this.volume = JSON.parse(savedVolume);
            if (!this.isMuted) {
              this.backgroundMusic.volume = this.volume;
            }
          }
        }

        // Set up error handling
        this.backgroundMusic.addEventListener('error', (e) => {
          console.error('Audio error:', e);
          // Attempt to recover by reinitializing
          this.reinitialize();
        });

        this.isInitialized = true;
        resolve();
      } catch (error) {
        console.error('Failed to initialize audio:', error);
        this.isInitialized = false;
        resolve(); // Resolve anyway to prevent hanging
      }
    });

    return this.initializationPromise;
  }

  private async reinitialize(): Promise<void> {
    console.log('Reinitializing audio...');
    this.isInitialized = false;
    this.initializationPromise = null;
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic = null;
    }
    await this.initialize();
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  public async playBackgroundMusic(): Promise<void> {
    try {
      await this.initialize();
      
      if (!this.backgroundMusic) {
        console.error('Audio element not initialized');
        return;
      }

      if (!this.isMuted) {
        // Ensure audio state is synchronized
        this.backgroundMusic.volume = this.volume;
        
        try {
          await this.backgroundMusic.play();
        } catch (error) {
          console.warn('Auto-play prevented:', error);
          // If autoplay was prevented, we'll try again on user interaction
          document.addEventListener('click', () => {
            this.backgroundMusic?.play().catch(console.warn);
          }, { once: true });
        }
      }
    } catch (error) {
      console.error('Error playing background music:', error);
      await this.reinitialize();
    }
  }

  public pauseBackgroundMusic(): void {
    try {
      if (this.backgroundMusic) {
        this.backgroundMusic.pause();
      }
    } catch (error) {
      console.error('Error pausing background music:', error);
    }
  }

  public toggleMute(): boolean {
    try {
      if (!this.backgroundMusic) {
        console.error('Audio element not initialized');
        return this.isMuted;
      }

      this.isMuted = !this.isMuted;
      this.backgroundMusic.volume = this.isMuted ? 0 : this.volume;
      localStorage.setItem('isMuted', JSON.stringify(this.isMuted));
      return this.isMuted;
    } catch (error) {
      console.error('Error toggling mute:', error);
      return this.isMuted;
    }
  }

  public isMusicMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(volume: number): void {
    try {
      if (!this.backgroundMusic) {
        console.error('Audio element not initialized');
        return;
      }

      this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
      if (!this.isMuted) {
        this.backgroundMusic.volume = this.volume;
      }
      localStorage.setItem('musicVolume', JSON.stringify(this.volume));
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  public getVolume(): number {
    return this.volume;
  }
}

export default AudioService.getInstance(); 