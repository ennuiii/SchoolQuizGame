class AudioService {
  private static instance: AudioService;
  private backgroundMusic: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  private constructor() {
    // Initialize background music
    this.backgroundMusic = new Audio('/assets/background-music.mp3');
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0.5;

    // Load mute state and volume from localStorage
    const savedMuteState = localStorage.getItem('isMuted');
    const savedVolume = localStorage.getItem('musicVolume');
    
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

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  public playBackgroundMusic(): void {
    if (this.backgroundMusic && !this.isMuted) {
      this.backgroundMusic.play().catch(error => {
        console.warn('Auto-play prevented:', error);
      });
    }
  }

  public pauseBackgroundMusic(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
    }
  }

  public toggleMute(): boolean {
    if (this.backgroundMusic) {
      this.isMuted = !this.isMuted;
      this.backgroundMusic.volume = this.isMuted ? 0 : this.volume;
      localStorage.setItem('isMuted', JSON.stringify(this.isMuted));
    }
    return this.isMuted;
  }

  public isMusicMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(volume: number): void {
    if (this.backgroundMusic) {
      this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
      if (!this.isMuted) {
        this.backgroundMusic.volume = this.volume;
      }
      localStorage.setItem('musicVolume', JSON.stringify(this.volume));
    }
  }

  public getVolume(): number {
    return this.volume;
  }
}

export default AudioService.getInstance(); 