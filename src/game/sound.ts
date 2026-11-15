// Procedural Web Audio API retro 16-bit synthesizer + looping atmospheric background music

export const BACKGROUND_MUSIC_SRC = '/assets/aistudio/Void_Survival_c375955c.mp3';
export const BACKGROUND_MUSIC_MILD_VOLUME = 0.18;

class RetroAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;
  private bgmEl: HTMLAudioElement | null = null;
  private shellMode: 'title' | 'playing' | 'paused' | 'gameover' = 'title';

  public get muted(): boolean {
    return this._muted;
  }

  public set muted(val: boolean) {
    this._muted = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(val ? 0 : 1, this.ctx.currentTime);
    }
    if (this.bgmEl) {
      this.bgmEl.muted = val;
      this.bgmEl.volume = val ? 0 : BACKGROUND_MUSIC_MILD_VOLUME;
      if (val) {
        this.bgmEl.pause();
      } else if (this.shellMode !== 'paused') {
        this.bgmEl.play().catch(() => {});
      }
    }
  }

  private getMasterOut(ctx: AudioContext): AudioNode {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this._muted ? 0 : 1, ctx.currentTime);
      this.masterGain.connect(this.getMasterOut(ctx));
    }
    return this.masterGain;
  }

  public bindBackgroundAudio(el: HTMLAudioElement | null) {
    this.bgmEl = el;
    if (!el) return;
    el.loop = true;
    el.volume = this._muted ? 0 : BACKGROUND_MUSIC_MILD_VOLUME;
    el.muted = this._muted;
  }

  public syncGameShellMode(mode: 'title' | 'playing' | 'paused' | 'gameover') {
    this.shellMode = mode;
    if (!this.bgmEl) return;
    this.bgmEl.volume = this._muted ? 0 : BACKGROUND_MUSIC_MILD_VOLUME;
    this.bgmEl.muted = this._muted;
    if (mode === 'paused' || this._muted) {
      this.bgmEl.pause();
    } else {
      this.bgmEl.play().catch(() => {});
    }
  }

  public unlockAndPlayBgm() {
    if (!this.bgmEl) return;
    this.bgmEl.loop = true;
    this.bgmEl.volume = this._muted ? 0 : BACKGROUND_MUSIC_MILD_VOLUME;
    this.bgmEl.muted = this._muted;
    if (!this._muted && this.shellMode !== 'paused') {
      this.bgmEl.play().catch(() => {});
    }
  }

  private getContext(): AudioContext | null {
    if (this._muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playStep() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 115 + (Math.random() * 20 - 10);
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.045);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  public playInteract() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.07, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.09);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.1);
    });
  }

  public playAlert() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [320, 240, 320].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.08, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.08);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.085);
    });
  }

  public playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.08, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.22);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.23);
    });
  }

  public playNewSol() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Warm Stardew/Pokémon-style new day dawn fanfare chord
    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public playEventSound(eventId: string) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (eventId === 'lunar_micrometeoroid_shower') {
      // Realistic Falling Meteor Shower: 3 staggered whistling Doppler meteor falls + deep explosive crater booms & debris rumble!
      const meteorTimes = [0, 0.42, 0.88];
      meteorTimes.forEach((offset, idx) => {
        const t0 = now + offset;
        const fallDur = 0.26;

        // 1. Incoming whistling meteor fall (high-to-low pitch Doppler scream)
        const whistle = ctx.createOscillator();
        const whistleGain = ctx.createGain();
        whistle.type = 'sine';
        const startFreq = 1950 - idx * 220;
        whistle.frequency.setValueAtTime(startFreq, t0);
        whistle.frequency.exponentialRampToValueAtTime(140, t0 + fallDur);
        whistleGain.gain.setValueAtTime(0.01, t0);
        whistleGain.gain.linearRampToValueAtTime(0.11, t0 + fallDur * 0.8);
        whistleGain.gain.exponentialRampToValueAtTime(0.001, t0 + fallDur);
        whistle.connect(whistleGain);
        whistleGain.connect(this.getMasterOut(ctx));
        whistle.start(t0);
        whistle.stop(t0 + fallDur + 0.01);

        // 2. Explosive crater impact sub-bass boom when meteor hits!
        const impactTime = t0 + fallDur - 0.02;
        const subBoom = ctx.createOscillator();
        const subGain = ctx.createGain();
        subBoom.type = 'sine';
        subBoom.frequency.setValueAtTime(155, impactTime);
        subBoom.frequency.exponentialRampToValueAtTime(26, impactTime + 0.45);
        subGain.gain.setValueAtTime(0.24, impactTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, impactTime + 0.46);
        subBoom.connect(subGain);
        subGain.connect(this.getMasterOut(ctx));
        subBoom.start(impactTime);
        subBoom.stop(impactTime + 0.48);

        // 3. Broadband explosion roar + scattering rock debris noise burst
        const noise = ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(ctx, 0.48);
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(920, impactTime);
        lowpass.frequency.exponentialRampToValueAtTime(110, impactTime + 0.46);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.22, impactTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, impactTime + 0.46);
        noise.connect(lowpass);
        lowpass.connect(noiseGain);
        noiseGain.connect(this.getMasterOut(ctx));
        noise.start(impactTime);
        noise.stop(impactTime + 0.48);
      });
      return;
    }

    if (eventId === 'hab_oxygen_leakage') {
      // 1. Heavy Pipe Rupture Bang on start (explosive low-end thump + metallic transient snap)
      const bangSub = ctx.createOscillator();
      const bangGain = ctx.createGain();
      bangSub.type = 'sawtooth';
      bangSub.frequency.setValueAtTime(290, now);
      bangSub.frequency.exponentialRampToValueAtTime(34, now + 0.18);
      bangGain.gain.setValueAtTime(0.24, now);
      bangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      bangSub.connect(bangGain);
      bangGain.connect(this.getMasterOut(ctx));
      bangSub.start(now);
      bangSub.stop(now + 0.2);

      const ruptureBurst = ctx.createBufferSource();
      ruptureBurst.buffer = this.createNoiseBuffer(ctx, 0.16);
      const ruptureLp = ctx.createBiquadFilter();
      ruptureLp.type = 'lowpass';
      ruptureLp.frequency.setValueAtTime(1100, now);
      const rbGain = ctx.createGain();
      rbGain.gain.setValueAtTime(0.22, now);
      rbGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      ruptureBurst.connect(ruptureLp);
      ruptureLp.connect(rbGain);
      rbGain.connect(this.getMasterOut(ctx));
      ruptureBurst.start(now);
      ruptureBurst.stop(now + 0.16);

      // 2. Sustained pressurized O2 steam hiss (1.35s)
      const hiss = ctx.createBufferSource();
      hiss.buffer = this.createNoiseBuffer(ctx, 1.35);
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(3100, now);
      bandpass.Q.setValueAtTime(1.6, now);
      const hissGain = ctx.createGain();
      hissGain.gain.setValueAtTime(0.17, now + 0.06);
      hissGain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
      hiss.connect(bandpass);
      bandpass.connect(hissGain);
      hissGain.connect(this.getMasterOut(ctx));
      hiss.start(now);
      hiss.stop(now + 1.35);

      // 3. Alternating high-low pressure klaxon beeps
      [940, 620, 940, 620].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        const st = now + 0.12 + idx * 0.2;
        osc.frequency.setValueAtTime(freq, st);
        gain.gain.setValueAtTime(0.07, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.15);
        osc.connect(gain);
        gain.connect(this.getMasterOut(ctx));
        osc.start(st);
        osc.stop(st + 0.16);
      });
      return;
    }

    if (eventId === 'lunar_electrostatic_dust') {
      // Crackling high-voltage static electricity arcs + buzzing dust zaps
      const zapFreqs = [1450, 520, 2300, 680, 1890, 430, 2650, 820, 1600];
      zapFreqs.forEach((freq, idx) => {
        const st = now + idx * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(freq, st);
        osc.frequency.linearRampToValueAtTime(freq * 0.55, st + 0.06);
        gain.gain.setValueAtTime(0.08, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.065);
        osc.connect(gain);
        gain.connect(this.getMasterOut(ctx));
        osc.start(st);
        osc.stop(st + 0.07);
      });

      // High-frequency static crackle noise
      const crackle = ctx.createBufferSource();
      crackle.buffer = this.createNoiseBuffer(ctx, 0.75);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(3800, now);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.11, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      crackle.connect(hp);
      hp.connect(cg);
      cg.connect(this.getMasterOut(ctx));
      crackle.start(now);
      crackle.stop(now + 0.75);
      return;
    }

    if (eventId === 'mars_global_dust_storm') {
      // Roaring 95 km/h Martian Gale-Force Dust Storm with dual howling wind gusts
      const wind = ctx.createBufferSource();
      wind.buffer = this.createNoiseBuffer(ctx, 1.35);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(2.5, now);
      filter.frequency.setValueAtTime(210, now);
      filter.frequency.exponentialRampToValueAtTime(680, now + 0.55);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.95);
      filter.frequency.exponentialRampToValueAtTime(540, now + 1.35);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);

      wind.connect(filter);
      filter.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      wind.start(now);
      wind.stop(now + 1.35);
      return;
    }

    if (eventId === 'mars_co2_frost_vortex') {
      // Swirling Martian dust-devil vortex whoosh + crystalline dry-ice freezing chimes
      const vortex = ctx.createBufferSource();
      vortex.buffer = this.createNoiseBuffer(ctx, 0.95);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(4.0, now);
      bp.frequency.setValueAtTime(380, now);
      bp.frequency.exponentialRampToValueAtTime(1250, now + 0.45);
      bp.frequency.exponentialRampToValueAtTime(320, now + 0.95);
      const vGain = ctx.createGain();
      vGain.gain.setValueAtTime(0.14, now);
      vGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      vortex.connect(bp);
      bp.connect(vGain);
      vGain.connect(this.getMasterOut(ctx));
      vortex.start(now);
      vortex.stop(now + 0.95);

      // Icy CO2 crystal chimes
      [2093, 2637, 3136, 2349].forEach((freq, idx) => {
        const st = now + 0.12 + idx * 0.14;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, st);
        g.gain.setValueAtTime(0.07, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
        osc.connect(g);
        g.connect(this.getMasterOut(ctx));
        osc.start(st);
        osc.stop(st + 0.24);
      });
      return;
    }

    if (eventId === 'donki_x2_flare' || eventId === 'donki_gcr_spike') {
      // Solar radiation magnetic surge + rapid Geiger-Müller dosimeter clicks + siren warble
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.linearRampToValueAtTime(820, now + 0.22);
      osc.frequency.linearRampToValueAtTime(340, now + 0.44);
      osc.frequency.linearRampToValueAtTime(790, now + 0.66);
      osc.frequency.linearRampToValueAtTime(310, now + 0.88);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(now);
      osc.stop(now + 0.92);

      // Rapid Geiger counter clicks
      for (let c = 0; c < 12; c++) {
        const clickTime = now + c * 0.065 + (c % 3) * 0.012;
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(1600 + (c % 4) * 300, clickTime);
        clickGain.gain.setValueAtTime(0.09, clickTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.015);
        clickOsc.connect(clickGain);
        clickGain.connect(this.getMasterOut(ctx));
        clickOsc.start(clickTime);
        clickOsc.stop(clickTime + 0.018);
      }
      return;
    }

    if (eventId === 'artemis_shadow_freeze') {
      // Deep cryo temperature plunge sweep + brittle ice-crystal pings
      const cryo = ctx.createOscillator();
      const cryoGain = ctx.createGain();
      cryo.type = 'triangle';
      cryo.frequency.setValueAtTime(1100, now);
      cryo.frequency.exponentialRampToValueAtTime(130, now + 0.65);
      cryoGain.gain.setValueAtTime(0.11, now);
      cryoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      cryo.connect(cryoGain);
      cryoGain.connect(this.getMasterOut(ctx));
      cryo.start(now);
      cryo.stop(now + 0.68);

      [1760, 1480, 1174].forEach((freq, idx) => {
        const st = now + 0.15 + idx * 0.15;
        const ice = ctx.createOscillator();
        const ig = ctx.createGain();
        ice.type = 'sine';
        ice.frequency.setValueAtTime(freq, st);
        ig.gain.setValueAtTime(0.065, st);
        ig.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
        ice.connect(ig);
        ig.connect(this.getMasterOut(ctx));
        ice.start(st);
        ice.stop(st + 0.2);
      });
      return;
    }

    if (eventId === 'osdr_microbiome_bloom') {
      // Hydroponic water-scrubber percolating bubbles
      [260, 340, 290, 410, 320].forEach((baseF, idx) => {
        const st = now + idx * 0.11;
        const bub = ctx.createOscillator();
        const bg = ctx.createGain();
        bub.type = 'sine';
        bub.frequency.setValueAtTime(baseF, st);
        bub.frequency.exponentialRampToValueAtTime(baseF * 2.4, st + 0.09);
        bg.gain.setValueAtTime(0.09, st);
        bg.gain.exponentialRampToValueAtTime(0.001, st + 0.095);
        bub.connect(bg);
        bg.connect(this.getMasterOut(ctx));
        bub.start(st);
        bub.stop(st + 0.1);
      });
      return;
    }

    // nominal_clear_skies or fallback: NASA Quindar telemetry beep + harmonic chord
    [2525, 523.25, 659.25, 783.99].forEach((freq, idx) => {
      const st = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      g.gain.setValueAtTime(0.075, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.2);
      osc.connect(g);
      g.connect(this.getMasterOut(ctx));
      osc.start(st);
      osc.stop(st + 0.22);
    });
  }

  public playMiniGameAction(eventCode: string, progressRatio = 0.5) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, progressRatio));

    if (eventCode === 'ECLSS-O2-SEAL-404') {
      // Plasma arc weld sizzle + rising pitch lock
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320 + clamped * 480, now);
      osc.frequency.exponentialRampToValueAtTime(880 + clamped * 300, now + 0.08);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(now);
      osc.stop(now + 0.09);
      return;
    }

    if (eventCode === 'ARTEMIS-DUST-LEV-09') {
      // Electrostatic dust repeller snap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200 + clamped * 900, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.055);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(now);
      osc.stop(now + 0.065);
      return;
    }

    if (eventCode === 'LRO-IMPACT-SWARM-12') {
      // Whipple shield metallic deflection ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(740 + clamped * 320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.11);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    // Default harmonic progress ping scaled by performanceRatio
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 440 + clamped * 520;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.07);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playMiniGameTick(urgent = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = urgent ? 'square' : 'sine';
    osc.frequency.setValueAtTime(urgent ? 880 : 660, now);
    gain.gain.setValueAtTime(urgent ? 0.06 : 0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playMiniGameResult(performanceRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes =
      performanceRatio >= 0.75
        ? [523.25, 659.25, 783.99, 1046.5]
        : performanceRatio >= 0.4
        ? [440, 523.25, 659.25]
        : [311.13, 277.18, 220];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = performanceRatio >= 0.4 ? 'triangle' : 'sawtooth';
      const st = now + idx * 0.075;
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.09, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(st);
      osc.stop(st + 0.19);
    });
  }

  public playValveTurn(progressRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = 240 + Math.max(0, Math.min(1, progressRatio)) * 320;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.18, now + 0.05);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playHullOverheat() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [190, 145].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const st = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.11, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.075);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(st);
      osc.stop(st + 0.08);
    });
  }

  public playProtonDeflect(deflectionRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, deflectionRatio));

    // Electromagnetic phase-lock harmonic chord pulse
    [520 + clamped * 240, 780 + clamped * 320].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.22, now + 0.09);
      gain.gain.setValueAtTime(0.085, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(now);
      osc.stop(now + 0.1);
    });
  }

  public playProtonHullHit(arraysOpen: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Rapid frantic Geiger counter clicks that speed up when protons hit the hull
    const clickCount = arraysOpen ? 10 : 6;
    const spacing = arraysOpen ? 0.022 : 0.032;
    for (let i = 0; i < clickCount; i++) {
      const t = now + i * spacing;
      const click = ctx.createOscillator();
      const cg = ctx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(1900 + (i % 3) * 450, t);
      cg.gain.setValueAtTime(0.11, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.014);
      click.connect(cg);
      cg.connect(this.getMasterOut(ctx));
      click.start(t);
      click.stop(t + 0.016);
    }

    // Low magnetic hull thud
    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(arraysOpen ? 175 : 220, now);
    sub.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    sg.gain.setValueAtTime(0.12, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.145);
    sub.connect(sg);
    sg.connect(this.getMasterOut(ctx));
    sub.start(now);
    sub.stop(now + 0.15);
  }

  public playArrayGimbalToggle(feathered: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(feathered ? 640 : 380, now);
    osc.frequency.exponentialRampToValueAtTime(feathered ? 380 : 640, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playPipeJunctionRotate(isOpen: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isOpen ? 340 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(isOpen ? 680 : 290, now + 0.07);
    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playHydraulicPumpFlow(fillRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, fillRatio));

    // Pressurized water flow whoosh + rising bladder fill tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 260 + clamped * 380;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.24, now + 0.085);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playGcrDosimeterClick(absorbedByWater: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const clicks = absorbedByWater ? 2 : 5;
    for (let i = 0; i < clicks; i++) {
      const t = now + i * 0.024;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = absorbedByWater ? 'sine' : 'square';
      osc.frequency.setValueAtTime(absorbedByWater ? 920 + i * 180 : 2100 + (i % 3) * 420, t);
      g.gain.setValueAtTime(absorbedByWater ? 0.065 : 0.095, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      osc.connect(g);
      g.connect(this.getMasterOut(ctx));
      osc.start(t);
      osc.stop(t + 0.018);
    }
  }

  public playWaveformTune(matchRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, matchRatio));

    // Harmonic sine wave phase-lock + percolating bubble pop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 310 + clamped * 350;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.18, now + 0.075);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playUvSporeZap(sterilizedRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, sterilizedRatio));

    // High-frequency UV-C pulse beam + hydroponic bubble confirmation
    const beam = ctx.createOscillator();
    const bg = ctx.createGain();
    beam.type = 'triangle';
    beam.frequency.setValueAtTime(1180 + clamped * 440, now);
    beam.frequency.exponentialRampToValueAtTime(540, now + 0.07);
    bg.gain.setValueAtTime(0.09, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    beam.connect(bg);
    bg.connect(this.getMasterOut(ctx));
    beam.start(now);
    beam.stop(now + 0.08);

    const bub = ctx.createOscillator();
    const bubG = ctx.createGain();
    bub.type = 'sine';
    bub.frequency.setValueAtTime(320, now + 0.03);
    bub.frequency.exponentialRampToValueAtTime(760, now + 0.095);
    bubG.gain.setValueAtTime(0.075, now + 0.03);
    bubG.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    bub.connect(bubG);
    bubG.connect(this.getMasterOut(ctx));
    bub.start(now + 0.03);
    bub.stop(now + 0.105);
  }

  public playCoreDrillThrottle(scienceRatio: number, heatRatio = 0.3) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clampedSci = Math.max(0, Math.min(1, scienceRatio));
    const clampedHeat = Math.max(0, Math.min(1, heatRatio));

    // Low rotary core-drill hum + high spectrometer crystal harmonic
    const drill = ctx.createOscillator();
    const dg = ctx.createGain();
    drill.type = 'sawtooth';
    drill.frequency.setValueAtTime(140 + clampedSci * 90 + clampedHeat * 60, now);
    drill.frequency.linearRampToValueAtTime(185 + clampedSci * 110, now + 0.08);
    dg.gain.setValueAtTime(0.075, now);
    dg.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    drill.connect(dg);
    dg.connect(this.getMasterOut(ctx));
    drill.start(now);
    drill.stop(now + 0.09);

    const spec = ctx.createOscillator();
    const sg = ctx.createGain();
    spec.type = 'sine';
    spec.frequency.setValueAtTime(660 + clampedSci * 440, now + 0.02);
    sg.gain.setValueAtTime(0.065, now + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    spec.connect(sg);
    sg.connect(this.getMasterOut(ctx));
    spec.start(now + 0.02);
    spec.stop(now + 0.095);
  }

  public playMaintenancePatch(maintenanceRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, maintenanceRatio));

    // Pneumatic hull micro-pit seal + greywater filter lock chime
    [440 + clamped * 220, 660 + clamped * 330].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const st = now + idx * 0.04;
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.08, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.075);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(st);
      osc.stop(st + 0.08);
    });
  }

  public playCapacitorRepellerPulse(inGreenPeak: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // High-voltage dielectric capacitor discharge wave + Tesla-arc snap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = inGreenPeak ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(inGreenPeak ? 1680 : 620, now);
    osc.frequency.exponentialRampToValueAtTime(inGreenPeak ? 340 : 220, now + 0.11);
    gain.gain.setValueAtTime(inGreenPeak ? 0.11 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.getMasterOut(ctx));
    osc.start(now);
    osc.stop(now + 0.125);

    if (inGreenPeak) {
      const chime = ctx.createOscillator();
      const cg = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(987.77, now + 0.03);
      chime.frequency.exponentialRampToValueAtTime(1480, now + 0.12);
      cg.gain.setValueAtTime(0.075, now + 0.03);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      chime.connect(cg);
      cg.connect(this.getMasterOut(ctx));
      chime.start(now + 0.03);
      chime.stop(now + 0.135);
    }
  }

  public playEvaBrushSwipe(hitArcNode: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (hitArcNode) {
      // Electrostatic Tesla-arc suit shock crackle
      const zap = ctx.createOscillator();
      const zg = ctx.createGain();
      zap.type = 'sawtooth';
      zap.frequency.setValueAtTime(1950, now);
      zap.frequency.linearRampToValueAtTime(280, now + 0.08);
      zg.gain.setValueAtTime(0.11, now);
      zg.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      zap.connect(zg);
      zg.connect(this.getMasterOut(ctx));
      zap.start(now);
      zap.stop(now + 0.09);
      return;
    }

    // Dielectric bristle sweep whoosh
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.09);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, now);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.075, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(this.getMasterOut(ctx));
    noise.start(now);
    noise.stop(now + 0.095);
  }

  public playWhippleShutterSlam(sectorIndex: number, isPowered: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Heavy armored Whipple & Regolith shutter hydraulic slam + relay lock
    const slam = ctx.createOscillator();
    const sg = ctx.createGain();
    slam.type = isPowered ? 'sawtooth' : 'triangle';
    const baseFreq = isPowered ? 240 + (sectorIndex % 6) * 28 : 180;
    slam.frequency.setValueAtTime(baseFreq, now);
    slam.frequency.exponentialRampToValueAtTime(isPowered ? 72 : 110, now + 0.09);
    sg.gain.setValueAtTime(0.11, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    slam.connect(sg);
    sg.connect(this.getMasterOut(ctx));
    slam.start(now);
    slam.stop(now + 0.1);

    if (isPowered) {
      const lock = ctx.createOscillator();
      const lg = ctx.createGain();
      lock.type = 'square';
      lock.frequency.setValueAtTime(620 + (sectorIndex % 6) * 45, now + 0.025);
      lg.gain.setValueAtTime(0.065, now + 0.025);
      lg.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      lock.connect(lg);
      lg.connect(this.getMasterOut(ctx));
      lock.start(now + 0.025);
      lock.stop(now + 0.09);
    }
  }

  public playMeteorShutterImpact(blocked: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (blocked) {
      // Hypervelocity micrometeoroid shattered by active Whipple bumper wall (crisp metallic deflection ping + seismic chime)
      [880, 1320].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        const st = now + idx * 0.03;
        osc.frequency.setValueAtTime(freq, st);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.45, st + 0.11);
        gain.gain.setValueAtTime(0.11, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.115);
        osc.connect(gain);
        gain.connect(this.getMasterOut(ctx));
        osc.start(st);
        osc.stop(st + 0.12);
      });
      return;
    }

    // Unshielded hull impact: deep sub-bass explosion boom + hull rattle
    const subBoom = ctx.createOscillator();
    const subGain = ctx.createGain();
    subBoom.type = 'sawtooth';
    subBoom.frequency.setValueAtTime(160, now);
    subBoom.frequency.exponentialRampToValueAtTime(30, now + 0.24);
    subGain.gain.setValueAtTime(0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    subBoom.connect(subGain);
    subGain.connect(this.getMasterOut(ctx));
    subBoom.start(now);
    subBoom.stop(now + 0.26);
  }

  public playThermalBusHeaterRoute(heaterRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, heaterRatio));

    // Warm Kilopower electrical heater bus hum + pipe thaw harmonic
    [220 + clamped * 160, 440 + clamped * 280].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      const st = now + idx * 0.03;
      osc.frequency.setValueAtTime(freq, st);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, st + 0.085);
      gain.gain.setValueAtTime(0.08, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.09);
      osc.connect(gain);
      gain.connect(this.getMasterOut(ctx));
      osc.start(st);
      osc.stop(st + 0.095);
    });
  }

  public playEvaRoverRegolithDozer(bermRatio: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, bermRatio));

    // Crunching lunar regolith berm bulldozer scrape + brittle cryo-crystal ping
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.11);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520 + clamped * 340, now);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.09, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(this.getMasterOut(ctx));
    noise.start(now);
    noise.stop(now + 0.115);

    const ice = ctx.createOscillator();
    const ig = ctx.createGain();
    ice.type = 'sine';
    ice.frequency.setValueAtTime(1480 - clamped * 320, now + 0.02);
    ig.gain.setValueAtTime(0.055, now + 0.02);
    ig.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    ice.connect(ig);
    ig.connect(this.getMasterOut(ctx));
    ice.start(now + 0.02);
    ice.stop(now + 0.1);
  }

  public playCompressorBackPurge(inWindTrough: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (inWindTrough) {
      // High-pressure pneumatic CO2 compressor back-purge blast + clean intake mesh chime
      const blast = ctx.createBufferSource();
      blast.buffer = this.createNoiseBuffer(ctx, 0.22);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(2.2, now);
      bp.frequency.setValueAtTime(1600, now);
      bp.frequency.exponentialRampToValueAtTime(420, now + 0.21);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.16, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      blast.connect(bp);
      bp.connect(bg);
      bg.connect(this.getMasterOut(ctx));
      blast.start(now);
      blast.stop(now + 0.225);

      [587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const st = now + idx * 0.055;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, st);
        g.gain.setValueAtTime(0.08, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.11);
        osc.connect(g);
        g.connect(this.getMasterOut(ctx));
        osc.start(st);
        osc.stop(st + 0.115);
      });
    } else {
      // Stalled back-purge against peak 95 km/h gust: turbulent backpressure groan + battery drain buzz
      const buzz = ctx.createOscillator();
      const bg = ctx.createGain();
      buzz.type = 'sawtooth';
      buzz.frequency.setValueAtTime(165, now);
      buzz.frequency.linearRampToValueAtTime(98, now + 0.18);
      bg.gain.setValueAtTime(0.12, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      buzz.connect(bg);
      bg.connect(this.getMasterOut(ctx));
      buzz.start(now);
      buzz.stop(now + 0.2);
    }
  }

  public playBreakerLoadShed(activeBreakersCount: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Heavy mechanical breaker clunk + reserve O2 tank valve hiss
    const clunk = ctx.createOscillator();
    const cg = ctx.createGain();
    clunk.type = 'square';
    clunk.frequency.setValueAtTime(240 + activeBreakersCount * 70, now);
    clunk.frequency.exponentialRampToValueAtTime(110, now + 0.075);
    cg.gain.setValueAtTime(0.11, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    clunk.connect(cg);
    cg.connect(this.getMasterOut(ctx));
    clunk.start(now);
    clunk.stop(now + 0.085);
  }

  public playThermalCoilDeIce(coilProgress: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, coilProgress));

    // Warm electrical thermal coil hum + CO2 dry-ice sublimation hiss + harmonic chime
    const coilOsc = ctx.createOscillator();
    const coilGain = ctx.createGain();
    coilOsc.type = 'triangle';
    coilOsc.frequency.setValueAtTime(220 + clamped * 160, now);
    coilOsc.frequency.linearRampToValueAtTime(340 + clamped * 220, now + 0.14);
    coilGain.gain.setValueAtTime(0.08, now);
    coilGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    coilOsc.connect(coilGain);
    coilGain.connect(this.getMasterOut(ctx));
    coilOsc.start(now);
    coilOsc.stop(now + 0.155);

    const hiss = ctx.createBufferSource();
    hiss.buffer = this.createNoiseBuffer(ctx, 0.14);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.0, now);
    bp.frequency.setValueAtTime(2100, now);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.06, now);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    hiss.connect(bp);
    bp.connect(hg);
    hg.connect(this.getMasterOut(ctx));
    hiss.start(now);
    hiss.stop(now + 0.145);
  }

  public playAcousticChiselTap(inVortexHazard: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (inVortexHazard) {
      // Swirling convective dust devil vortex buffet roar + suit impact alarm
      const vortex = ctx.createBufferSource();
      vortex.buffer = this.createNoiseBuffer(ctx, 0.24);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(3.5, now);
      bp.frequency.setValueAtTime(420, now);
      bp.frequency.exponentialRampToValueAtTime(1180, now + 0.12);
      bp.frequency.exponentialRampToValueAtTime(310, now + 0.24);
      const vg = ctx.createGain();
      vg.gain.setValueAtTime(0.16, now);
      vg.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      vortex.connect(bp);
      bp.connect(vg);
      vg.connect(this.getMasterOut(ctx));
      vortex.start(now);
      vortex.stop(now + 0.25);

      const alarm = ctx.createOscillator();
      const ag = ctx.createGain();
      alarm.type = 'sawtooth';
      alarm.frequency.setValueAtTime(185, now);
      alarm.frequency.linearRampToValueAtTime(112, now + 0.19);
      ag.gain.setValueAtTime(0.11, now);
      ag.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      alarm.connect(ag);
      ag.connect(this.getMasterOut(ctx));
      alarm.start(now);
      alarm.stop(now + 0.21);
    } else {
      // Crisp acoustic chisel tap + shattering -85°C CO2 dry-ice crystal chime
      [1760, 2637].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const st = now + idx * 0.035;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, st);
        g.gain.setValueAtTime(0.08, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.11);
        osc.connect(g);
        g.connect(this.getMasterOut(ctx));
        osc.start(st);
        osc.stop(st + 0.115);
      });
    }
  }
}

export const soundFX = new RetroAudioManager();






