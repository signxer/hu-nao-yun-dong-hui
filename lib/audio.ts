export type AudioScene = 'home' | 'draft' | 'mild' | 'wild' | 'result' | 'silent';
export type AudioCue =
  | 'button' | 'select' | 'confirm' | 'cancel' | 'invalid'
  | 'dice-shake' | 'dice-land' | 'step-forward' | 'step-back' | 'jump' | 'warp' | 'collision'
  | 'star' | 'modifier' | 'trip' | 'recover' | 'eliminate' | 'ability' | 'first' | 'second'
  | 'score' | 'join' | 'leave' | 'disconnect' | 'reconnect';

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export const defaultAudioSettings: AudioSettings = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };
const storageKey = 'hu-nao-yun-dong-hui-audio-v2';

export function loadAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') return defaultAudioSettings;
  try { return { ...defaultAudioSettings, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<AudioSettings> }; }
  catch { return defaultAudioSettings; }
}

const sceneData: Record<Exclude<AudioScene, 'silent'>, { bpm: number; bass: number[]; melody: number[] }> = {
  home: { bpm: 96, bass: [48, 48, 55, 53], melody: [72, 76, 79, 76, 74, 72, 67, 69] },
  draft: { bpm: 112, bass: [50, 57, 53, 55], melody: [74, 77, 81, 77, 76, 79, 83, 79] },
  mild: { bpm: 124, bass: [48, 55, 52, 57], melody: [72, 76, 79, 84, 81, 79, 76, 74] },
  wild: { bpm: 138, bass: [45, 52, 48, 55], melody: [69, 72, 76, 81, 79, 83, 86, 84] },
  result: { bpm: 108, bass: [48, 52, 55, 60], melody: [72, 76, 79, 84, 88, 84, 79, 76] },
};

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private scene: AudioScene = 'silent';
  private settings: AudioSettings;

  constructor(settings = defaultAudioSettings) { this.settings = settings; }

  async unlock() {
    if (typeof window === 'undefined') return;
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    if (!this.context) {
      this.context = new Context();
      this.master = this.context.createGain(); this.music = this.context.createGain(); this.sfx = this.context.createGain();
      this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.context.destination);
      this.applyVolumes();
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
    this.scene = scene; this.step = 0;
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    if (scene !== 'silent' && this.context) this.startLoop();
  }

  private applyVolumes() {
    if (!this.context || !this.master || !this.music || !this.sfx) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.04);
    this.music.gain.setTargetAtTime(this.settings.music * 0.16, now, 0.04);
    this.sfx.gain.setTargetAtTime(this.settings.sfx * 0.38, now, 0.02);
  }

  private tone(frequency: number, duration: number, gain: number, destination: GainNode, type: OscillatorType = 'square', delay = 0) {
    if (!this.context) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator(); const envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(0.0001, now); envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + 0.012); envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(destination); oscillator.start(now); oscillator.stop(now + duration + 0.03);
  }

  private startLoop() {
    if (!this.context || !this.music || this.scene === 'silent') return;
    const data = sceneData[this.scene]; const interval = (60_000 / data.bpm) / 2;
    const tick = () => {
      if (!this.context || !this.music || this.context.state !== 'running') return;
      const melody = data.melody[this.step % data.melody.length]; const bass = data.bass[Math.floor(this.step / 2) % data.bass.length];
      this.tone(midi(melody), Math.min(0.16, interval / 1600), 0.16, this.music, 'triangle');
      if (this.step % 2 === 0) this.tone(midi(bass), 0.24, 0.12, this.music, 'sine');
      this.step += 1;
    };
    tick(); this.timer = window.setInterval(tick, interval);
  }

  play(cue: AudioCue) {
    if (!this.context || !this.sfx || this.settings.muted) return;
    const presets: Partial<Record<AudioCue, [number, number, number, OscillatorType]>> = {
      button: [190, 0.045, 0.12, 'square'], select: [420, 0.07, 0.15, 'triangle'], confirm: [620, 0.12, 0.16, 'triangle'], cancel: [170, 0.1, 0.12, 'sawtooth'], invalid: [110, 0.16, 0.16, 'square'],
      'dice-shake': [230, 0.18, 0.15, 'sawtooth'], 'dice-land': [92, 0.18, 0.2, 'square'], 'step-forward': [520, 0.055, 0.1, 'triangle'], 'step-back': [290, 0.07, 0.1, 'triangle'], jump: [760, 0.12, 0.14, 'sine'], warp: [880, 0.24, 0.13, 'sine'], collision: [75, 0.22, 0.2, 'square'],
      star: [1040, 0.22, 0.17, 'sine'], modifier: [680, 0.14, 0.14, 'square'], trip: [88, 0.28, 0.2, 'sawtooth'], recover: [410, 0.16, 0.14, 'triangle'], eliminate: [64, 0.34, 0.2, 'sawtooth'], ability: [740, 0.28, 0.16, 'triangle'], first: [988, 0.36, 0.2, 'triangle'], second: [740, 0.3, 0.18, 'triangle'], score: [830, 0.16, 0.16, 'sine'], join: [540, 0.12, 0.14, 'triangle'], leave: [260, 0.12, 0.12, 'triangle'], disconnect: [120, 0.2, 0.15, 'square'], reconnect: [660, 0.2, 0.15, 'triangle'],
    };
    const preset = presets[cue] ?? presets.button!;
    this.tone(preset[0], preset[1], preset[2], this.sfx, preset[3]);
    if (cue === 'first' || cue === 'ability') this.tone(preset[0] * 1.25, preset[1], preset[2] * 0.75, this.sfx, preset[3], 0.08);
  }

  duck(db: -8 | -12, durationMs: number) {
    if (!this.context || !this.music) return;
    const now = this.context.currentTime; const base = this.settings.music * 0.16; const factor = 10 ** (db / 20);
    this.music.gain.cancelScheduledValues(now); this.music.gain.setTargetAtTime(base * factor, now, 0.03); this.music.gain.setTargetAtTime(base, now + durationMs / 1000, 0.12);
  }

  suspend() { if (this.context?.state === 'running') void this.context.suspend(); }
  resume() { if (this.context?.state === 'suspended') void this.context.resume(); }
  destroy() { if (this.timer !== null) window.clearInterval(this.timer); void this.context?.close(); }
}
