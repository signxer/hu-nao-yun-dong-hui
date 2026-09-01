export type AudioScene = 'home' | 'draft' | 'mild' | 'wild' | 'result' | 'silent';
export type AudioCue =
  | 'button' | 'select' | 'confirm' | 'cancel' | 'invalid'
  | 'dice-shake' | 'dice-land' | 'step-forward' | 'step-back' | 'jump' | 'warp' | 'collision'
  | 'star' | 'modifier' | 'trip' | 'recover' | 'eliminate' | 'ability' | 'first' | 'second'
  | 'score' | 'join' | 'leave' | 'disconnect' | 'reconnect';

export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean; }
type Score = { bpm: number; bass: number[]; melody: number[]; chords: number[][]; character: 'whimsy' | 'sneaky' | 'parade' | 'chase' | 'fanfare'; };

export const defaultAudioSettings: AudioSettings = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };
const storageKey = 'hu-nao-yun-dong-hui-audio-v2';

export function loadAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') return defaultAudioSettings;
  try { return { ...defaultAudioSettings, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<AudioSettings> }; }
  catch { return defaultAudioSettings; }
}

// Original playful chamber-orchestra themes. MIDI note -1 represents a rest.
const sceneData: Record<Exclude<AudioScene, 'silent'>, Score> = {
  home: { bpm: 96, character: 'whimsy', bass: [48, 48, 53, 55], melody: [72, -1, 76, 79, 76, -1, 74, 72, 69, -1, 72, 76, 74, 72, 67, -1], chords: [[60, 64, 67], [60, 64, 67], [65, 69, 72], [67, 71, 74]] },
  draft: { bpm: 112, character: 'sneaky', bass: [50, 57, 53, 55], melody: [74, 77, -1, 81, 77, 76, 79, -1, 83, 79, 76, 74, 77, -1, 76, 72], chords: [[62, 65, 69], [69, 72, 76], [65, 69, 72], [67, 71, 74]] },
  mild: { bpm: 124, character: 'parade', bass: [48, 55, 52, 57], melody: [72, 76, 79, -1, 84, 81, 79, 76, 74, 76, 79, 81, 79, 76, 74, -1], chords: [[60, 64, 67], [67, 71, 74], [64, 67, 71], [69, 72, 76]] },
  wild: { bpm: 138, character: 'chase', bass: [45, 52, 48, 55], melody: [69, 72, 76, 81, -1, 79, 83, 86, 84, 81, 79, 76, 78, 79, 83, -1], chords: [[57, 60, 64], [64, 67, 71], [60, 64, 67], [67, 71, 74]] },
  result: { bpm: 108, character: 'fanfare', bass: [48, 52, 55, 60], melody: [72, 76, 79, 84, -1, 79, 84, 88, 86, 84, 81, 79, 84, -1, 79, -1], chords: [[60, 64, 67], [64, 67, 71], [67, 71, 74], [60, 64, 67]] },
};

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextStepAt = 0;
  private intensity = 0;
  private scene: AudioScene = 'silent';
  private settings: AudioSettings;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(settings = defaultAudioSettings) { this.settings = settings; }

  async unlock() {
    if (typeof window === 'undefined') return;
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    if (!this.context) {
      this.context = new Context();
      this.master = this.context.createGain(); this.music = this.context.createGain(); this.sfx = this.context.createGain();
      this.limiter = this.context.createDynamicsCompressor(); this.limiter.threshold.value = -12; this.limiter.knee.value = 12; this.limiter.ratio.value = 6; this.limiter.attack.value = .004; this.limiter.release.value = .18;
      this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.limiter).connect(this.context.destination);
      this.reverb = this.context.createConvolver(); this.reverb.buffer = this.makeImpulseBuffer(); this.reverbGain = this.context.createGain(); this.reverbGain.gain.value = 0.34; this.reverb.connect(this.reverbGain).connect(this.music);
      this.noiseBuffer = this.makeNoiseBuffer(); this.applyVolumes();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.scene !== 'silent' && this.timer === null) this.startLoop();
  }

  setSettings(settings: AudioSettings) {
    this.settings = settings;
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(settings));
    this.applyVolumes();
  }

  setScene(scene: AudioScene) {
    if (scene === this.scene) return;
    this.scene = scene; this.step = 0; this.stopLoop();
    if (scene !== 'silent' && this.context) this.startLoop();
  }

  setIntensity(value: number) { this.intensity = Math.max(0, Math.min(1, value)); }

  private applyVolumes() {
    if (!this.context || !this.master || !this.music || !this.sfx) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.04);
    this.music.gain.setTargetAtTime(this.settings.music * 0.62, now, 0.05);
    this.sfx.gain.setTargetAtTime(this.settings.sfx * 0.68, now, 0.02);
  }

  private tone(frequency: number, duration: number, gain: number, destination: GainNode, type: OscillatorType = 'square', delay = 0) {
    if (!this.context) return;
    const at = this.context.currentTime + delay; const oscillator = this.context.createOscillator(); const envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(0.0001, at); envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.012); envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope).connect(destination); oscillator.start(at); oscillator.stop(at + duration + 0.03);
  }

  private uiInstrument(frequency: number, delay: number, gain: number, kind: 'woodblock' | 'pizz' | 'horn' | 'mallet') {
    if (!this.context || !this.sfx) return;
    const at = this.context.currentTime + delay; const envelope = this.context.createGain(); const filter = this.context.createBiquadFilter();
    const profile = kind === 'woodblock' ? { ratios: [1, 2.7, 4.2], levels: [1, .32, .11], attack: .002, duration: .075, cutoff: 2400 }
      : kind === 'pizz' ? { ratios: [1, 2, 3], levels: [1, .38, .14], attack: .003, duration: .14, cutoff: 3000 }
      : kind === 'horn' ? { ratios: [1, 2, 3, 4], levels: [1, .48, .23, .09], attack: .025, duration: .24, cutoff: 1500 }
      : { ratios: [1, 2.76, 5.4], levels: [1, .28, .09], attack: .002, duration: .2, cutoff: 4600 };
    filter.type = 'lowpass'; filter.frequency.value = profile.cutoff; filter.Q.value = .65;
    envelope.gain.setValueAtTime(.0001, at); envelope.gain.linearRampToValueAtTime(gain, at + profile.attack); envelope.gain.exponentialRampToValueAtTime(.0001, at + profile.duration);
    profile.ratios.forEach((ratio, index) => { const oscillator = this.context!.createOscillator(); const partial = this.context!.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency * ratio; partial.gain.value = profile.levels[index]; oscillator.connect(partial).connect(filter); oscillator.start(at); oscillator.stop(at + profile.duration + .03); });
    filter.connect(envelope).connect(this.sfx);
  }

  private playUiCue(cue: 'button' | 'select' | 'confirm' | 'cancel' | 'invalid') {
    if (cue === 'button') { this.uiInstrument(196, 0, .18, 'woodblock'); this.uiInstrument(392, .012, .07, 'pizz'); return; }
    if (cue === 'select') { this.uiInstrument(midi(67), 0, .16, 'pizz'); this.uiInstrument(midi(74), .035, .13, 'pizz'); return; }
    if (cue === 'confirm') { [60, 64, 67].forEach((note, index) => this.uiInstrument(midi(note), index * .018, .105, 'horn')); this.uiInstrument(midi(84), .08, .09, 'mallet'); return; }
    if (cue === 'cancel') { this.uiInstrument(midi(55), 0, .13, 'pizz'); this.uiInstrument(midi(50), .07, .11, 'pizz'); return; }
    this.uiInstrument(118, 0, .2, 'woodblock'); this.uiInstrument(108, .08, .16, 'woodblock');
  }

  private connectMusic(node: AudioNode, pan: number, wet = 0.2) {
    if (!this.context || !this.music) return;
    const panner = this.context.createStereoPanner(); panner.pan.value = pan; node.connect(panner); panner.connect(this.music);
    if (this.reverb && wet > 0) { const send = this.context.createGain(); send.gain.value = wet; panner.connect(send).connect(this.reverb); }
  }

  private instrument(note: number, at: number, duration: number, gain: number, kind: 'pizz' | 'strings' | 'woodwind' | 'brass' | 'mallet' | 'bass') {
    if (!this.context || !this.music || note < 0) return;
    const profiles = {
      pizz: { ratios: [1, 2, 3, 4], levels: [1, .42, .2, .08], attack: .004, length: Math.min(duration, .22), cutoff: 2600, q: .7, pan: -.35, wet: .16 },
      strings: { ratios: [1, 2, 3, 5], levels: [1, .3, .13, .05], attack: .13, length: duration, cutoff: 1900, q: .45, pan: -.28, wet: .42 },
      woodwind: { ratios: [1, 3, 5, 7], levels: [1, .48, .17, .06], attack: .065, length: duration, cutoff: 3400, q: 1.5, pan: .24, wet: .34 },
      brass: { ratios: [1, 2, 3, 4, 5], levels: [1, .58, .34, .17, .07], attack: .038, length: duration, cutoff: 1550, q: .65, pan: .08, wet: .4 },
      mallet: { ratios: [1, 2.76, 5.4], levels: [1, .31, .12], attack: .003, length: Math.min(duration, .32), cutoff: 5200, q: .4, pan: .4, wet: .48 },
      bass: { ratios: [1, 2, 3], levels: [1, .2, .07], attack: .025, length: duration, cutoff: 720, q: .5, pan: -.08, wet: .18 },
    } as const;
    const profile = profiles[kind]; const filter = this.context.createBiquadFilter(); const envelope = this.context.createGain(); const end = at + Math.max(profile.length, profile.attack + .04);
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(profile.cutoff, at); filter.Q.value = profile.q;
    envelope.gain.setValueAtTime(0.0001, at); envelope.gain.linearRampToValueAtTime(gain, at + profile.attack);
    if (kind === 'strings' || kind === 'woodwind' || kind === 'brass') { envelope.gain.setValueAtTime(gain * .76, Math.max(at + profile.attack, end - .1)); envelope.gain.exponentialRampToValueAtTime(0.0001, end); }
    else envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    profile.ratios.forEach((ratio, index) => { const oscillator = this.context!.createOscillator(); const partial = this.context!.createGain(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(midi(note) * ratio, at); oscillator.detune.value = (index - profile.ratios.length / 2) * (kind === 'strings' ? 2.6 : .7); partial.gain.value = profile.levels[index]; oscillator.connect(partial).connect(filter); oscillator.start(at); oscillator.stop(end + .05); });
    filter.connect(envelope); this.connectMusic(envelope, profile.pan, profile.wet);
  }

  private timpani(note: number, at: number, gain = 0.12) {
    if (!this.context || !this.music) return;
    const oscillator = this.context.createOscillator(); const envelope = this.context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(midi(note) * 1.6, at); oscillator.frequency.exponentialRampToValueAtTime(midi(note), at + 0.12);
    envelope.gain.setValueAtTime(gain, at); envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.34); oscillator.connect(envelope); this.connectMusic(envelope, -.12, .32); oscillator.start(at); oscillator.stop(at + 0.36);
  }

  private noiseHit(at: number, gain: number, bright = false) {
    if (!this.context || !this.music || !this.noiseBuffer) return;
    const source = this.context.createBufferSource(); const filter = this.context.createBiquadFilter(); const envelope = this.context.createGain();
    source.buffer = this.noiseBuffer; filter.type = bright ? 'highpass' : 'bandpass'; filter.frequency.value = bright ? 5200 : 1700; filter.Q.value = bright ? 0.5 : 1.5;
    envelope.gain.setValueAtTime(gain, at); envelope.gain.exponentialRampToValueAtTime(0.0001, at + (bright ? 0.045 : 0.09)); source.connect(filter).connect(envelope); this.connectMusic(envelope, bright ? .32 : .08, .18); source.start(at); source.stop(at + 0.11);
  }

  private makeNoiseBuffer() {
    if (!this.context) return null;
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * 0.25), this.context.sampleRate); const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  }

  private makeImpulseBuffer() {
    if (!this.context) return null;
    const length = Math.floor(this.context.sampleRate * 1.45); const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) { const data = impulse.getChannelData(channel); for (let index = 0; index < length; index += 1) { const seed = Math.sin((index + 1) * (channel ? 78.233 : 12.9898)) * 43758.5453; const noise = (seed - Math.floor(seed)) * 2 - 1; data[index] = noise * ((1 - index / length) ** 2.7); } }
    return impulse;
  }

  private scheduleStep(data: Score, step: number, at: number, eighth: number) {
    const melody = data.melody[step % data.melody.length]; const bass = data.bass[Math.floor(step / 4) % data.bass.length]; const chord = data.chords[Math.floor(step / 8) % data.chords.length];
    const finale = this.intensity > 0.72 && (this.scene === 'mild' || this.scene === 'wild');
    const melodyKind = data.character === 'sneaky' ? 'mallet' : data.character === 'fanfare' || (data.character === 'chase' && step % 4 === 0) ? 'brass' : 'woodwind';
    if (melody >= 0) this.instrument(melody + (finale && step % 4 === 2 ? 12 : 0), at, eighth * (melodyKind === 'brass' ? 1.45 : .9), melodyKind === 'brass' ? .055 : .07, melodyKind);
    if (step % 4 === 0) { this.instrument(bass, at, eighth * 1.8, 0.08, 'bass'); this.timpani(bass - 12, at, data.character === 'chase' ? 0.1 : 0.055); }
    if (step % 8 === 0) chord.forEach((note, index) => this.instrument(note, at + index * .018, eighth * 7.5, .023, 'strings'));
    if (step % 4 === 2) chord.forEach((note, index) => this.instrument(note + 12, at + index * 0.018, eighth * .65, .028, 'pizz'));
    if ((data.character === 'parade' || data.character === 'fanfare') && step % 8 === 0) chord.forEach((note, index) => this.instrument(note + 12, at + index * .025, eighth * 1.7, .024, 'brass'));
    if (data.character === 'chase') { if (step % 2 === 0) this.noiseHit(at, 0.033, step % 4 === 2); if (step % 4 === 3) this.instrument(chord[1] + 12, at, eighth * 0.42, 0.035, 'brass'); }
    else if (step % 4 === 2) this.noiseHit(at, 0.018, true);
    if (finale) { if (step % 2 === 1) this.instrument(chord[step % chord.length] + 24, at, eighth * 0.38, 0.028, 'pizz'); if (step % 2 === 0) this.noiseHit(at, 0.02, true); }
  }

  private startLoop() {
    if (!this.context || !this.music || this.scene === 'silent') return;
    this.nextStepAt = this.context.currentTime + 0.06;
    const schedule = () => {
      if (!this.context || this.context.state !== 'running' || this.scene === 'silent') return;
      const data = sceneData[this.scene]; const eighth = 30 / data.bpm;
      while (this.nextStepAt < this.context.currentTime + 0.18) { this.scheduleStep(data, this.step, this.nextStepAt, eighth); this.nextStepAt += eighth; this.step += 1; }
    };
    schedule(); this.timer = window.setInterval(schedule, 40);
  }

  private stopLoop() { if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; } }

  play(cue: AudioCue) {
    if (!this.context || !this.sfx || this.settings.muted) return;
    if (cue === 'button' || cue === 'select' || cue === 'confirm' || cue === 'cancel' || cue === 'invalid') { this.playUiCue(cue); return; }
    const presets: Partial<Record<AudioCue, [number, number, number, OscillatorType]>> = {
      'dice-shake': [230, 0.18, 0.15, 'sawtooth'], 'dice-land': [92, 0.18, 0.2, 'square'], 'step-forward': [520, 0.055, 0.1, 'triangle'], 'step-back': [290, 0.07, 0.1, 'triangle'], jump: [760, 0.12, 0.14, 'sine'], warp: [880, 0.24, 0.13, 'sine'], collision: [75, 0.22, 0.2, 'square'],
      star: [1040, 0.22, 0.17, 'sine'], modifier: [680, 0.14, 0.14, 'square'], trip: [88, 0.28, 0.2, 'sawtooth'], recover: [410, 0.16, 0.14, 'triangle'], eliminate: [64, 0.34, 0.2, 'sawtooth'], ability: [740, 0.28, 0.16, 'triangle'], first: [988, 0.36, 0.2, 'triangle'], second: [740, 0.3, 0.18, 'triangle'], score: [830, 0.16, 0.16, 'sine'], join: [540, 0.12, 0.14, 'triangle'], leave: [260, 0.12, 0.12, 'triangle'], disconnect: [120, 0.2, 0.15, 'square'], reconnect: [660, 0.2, 0.15, 'triangle'],
    };
    const preset = presets[cue] ?? [196, .08, .12, 'sine'] as [number, number, number, OscillatorType]; this.tone(preset[0], preset[1], preset[2], this.sfx, preset[3]);
    if (cue === 'first' || cue === 'ability') this.tone(preset[0] * 1.25, preset[1], preset[2] * 0.75, this.sfx, preset[3], 0.08);
  }

  duck(db: -8 | -12, durationMs: number) {
    if (!this.context || !this.music) return;
    const now = this.context.currentTime; const base = this.settings.music * 0.62; const factor = 10 ** (db / 20);
    this.music.gain.cancelScheduledValues(now); this.music.gain.setTargetAtTime(base * factor, now, 0.03); this.music.gain.setTargetAtTime(base, now + durationMs / 1000, 0.12);
  }

  suspend() { if (this.context?.state === 'running') void this.context.suspend(); }
  resume() { if (this.context?.state === 'suspended') void this.context.resume(); }
  destroy() { this.stopLoop(); void this.context?.close(); }
}
