/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class GingAudioEngine {
  private audioCtx: AudioContext | null = null;
  private oscillator1: OscillatorNode | null = null;
  private oscillator2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private beepInterval: number | null = null;
  private speechInterval: number | null = null;
  private isPlaying: boolean = false;

  private initContext() {
    if (!this.audioCtx) {
      // @ts-ignore - support older legacy browsers just in case
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public start(soundType: string, volume: number = 0.8) {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.initContext();

    if (!this.audioCtx) return;

    // Standard volume controller
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    this.gainNode.connect(this.audioCtx.destination);

    if (soundType === 'industrial') {
      this.startIndustrial(volume);
    } else if (soundType === 'classic-beep') {
      this.startClassicBeep(volume);
    } else if (soundType === 'air-horn') {
      this.startAirHorn(volume);
    } else {
      this.startIndustrial(volume);
    }
  }

  private startIndustrial(volume: number) {
    if (!this.audioCtx || !this.gainNode) return;

    // Create a super piercing dual-tone oscillator
    this.oscillator1 = this.audioCtx.createOscillator();
    this.oscillator2 = this.audioCtx.createOscillator();

    this.oscillator1.type = 'sawtooth';
    this.oscillator2.type = 'square';

    // Frequencies that clash terribly (minor second interval) to induce stress
    this.oscillator1.frequency.setValueAtTime(880, this.audioCtx.currentTime); 
    this.oscillator2.frequency.setValueAtTime(885, this.audioCtx.currentTime);

    // Add frequency modulation for a screaming siren effect
    const lfo = this.audioCtx.createOscillator();
    const lfoGain = this.audioCtx.createGain();
    lfo.frequency.setValueAtTime(4, this.audioCtx.currentTime); // 4Hz vibration
    lfoGain.gain.setValueAtTime(40, this.audioCtx.currentTime); // oscillate by 40Hz

    lfo.connect(lfoGain);
    lfoGain.connect(this.oscillator1.frequency);
    lfoGain.connect(this.oscillator2.frequency);

    this.oscillator1.connect(this.gainNode);
    this.oscillator2.connect(this.gainNode);

    lfo.start();
    this.oscillator1.start();
    this.oscillator2.start();
  }

  private startClassicBeep(volume: number) {
    if (!this.audioCtx || !this.gainNode) return;

    let toggle = false;
    this.beepInterval = window.setInterval(() => {
      if (!this.audioCtx || !this.gainNode || !this.isPlaying) return;

      const osc = this.audioCtx.createOscillator();
      const clickGain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2500, this.audioCtx.currentTime); // High pitch alarm beep

      clickGain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.18);

      osc.connect(clickGain);
      clickGain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.2);
    }, 250);
  }

  private startAirHorn(volume: number) {
    if (!this.audioCtx || !this.gainNode) return;

    // Dual sawtooth oscillators at massive low pitches
    this.oscillator1 = this.audioCtx.createOscillator();
    this.oscillator2 = this.audioCtx.createOscillator();

    this.oscillator1.type = 'sawtooth';
    this.oscillator2.type = 'sawtooth';

    this.oscillator1.frequency.setValueAtTime(150, this.audioCtx.currentTime); 
    this.oscillator2.frequency.setValueAtTime(225, this.audioCtx.currentTime); // perfect fifth but distorted

    // Modulate to simulate dynamic motor resonance
    const hornLfo = this.audioCtx.createOscillator();
    const hornLfoGain = this.audioCtx.createGain();
    hornLfo.type = 'triangle';
    hornLfo.frequency.setValueAtTime(8, this.audioCtx.currentTime);
    hornLfoGain.gain.setValueAtTime(8, this.audioCtx.currentTime);

    hornLfo.connect(hornLfoGain);
    hornLfoGain.connect(this.oscillator1.frequency);

    this.oscillator1.connect(this.gainNode);
    this.oscillator2.connect(this.gainNode);

    hornLfo.start();
    this.oscillator1.start();
    this.oscillator2.start();
  }

  public stop() {
    this.isPlaying = false;

    if (this.beepInterval) {
      clearInterval(this.beepInterval);
      this.beepInterval = null;
    }

    if (this.speechInterval) {
      clearInterval(this.speechInterval);
      this.speechInterval = null;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    try {
      this.oscillator1?.stop();
      this.oscillator2?.stop();
    } catch (e) {
      // already stopped or not started
    }

    this.oscillator1 = null;
    this.oscillator2 = null;

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }
}

export const gingAudio = new GingAudioEngine();
