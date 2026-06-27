
class VoiceService {
  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lastSpeechTime: number = 0;
  private minInterval: number = 4000; // 4 seconds throttle

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speak(text: string, force: boolean = false) {
    const now = Date.now();
    if (!force && now - this.lastSpeechTime < this.minInterval) {
      return;
    }

    this.cancel();

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance.rate = 1.0;
    this.currentUtterance.pitch = 1.0;
    this.currentUtterance.volume = 1.0;
    
    // Attempt to find a natural-sounding voice
    const voices = this.synth.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural')) || voices[0];
    if (preferredVoice) {
      this.currentUtterance.voice = preferredVoice;
    }

    this.currentUtterance.onend = () => {
      this.currentUtterance = null;
    };

    this.synth.speak(this.currentUtterance);
    this.lastSpeechTime = now;
  }

  cancel() {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
  }

  isSpeaking() {
    return this.synth.speaking;
  }
}

export const voiceService = new VoiceService();
