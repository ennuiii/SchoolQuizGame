class AudioService {
  private static instance: AudioService;
  private backgroundMusic: HTMLAudioElement | null = null;
  private isMuted: boolean = false;

  private constructor() {
    // Initialize background music
    this.backgroundMusic = new Audio('/assets/background-music.mp3');
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0.5;

    // Load mute state from localStorage
    const savedMuteState = localStorage.getItem('isMuted');
    if (savedMuteState) {
      this.isMuted = JSON.parse(savedMuteState);
      if (this.isMuted) {
        this.backgroundMusic.volume = 0;
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
      this.backgroundMusic.volume = this.isMuted ? 0 : 0.5;
      localStorage.setItem('isMuted', JSON.stringify(this.isMuted));
    }
    return this.isMuted;
  }

  public isMusicMuted(): boolean {
    return this.isMuted;
  }
}

export default AudioService.getInstance(); 