/* Track playback: uploaded/remote audio or a built-in synthwave demo loop. */
export interface Player {
  play(): void;
  pause(): void;
  dispose(): void;
}

class SynthPlayer implements Player {
  ctx?: AudioContext;
  timer?: number;
  step = 0;
  master?: GainNode;
  play() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }
    this.ctx.resume();
    if (this.timer) return;
    const bass = [45, 45, 57, 45, 41, 41, 53, 41, 48, 48, 60, 48, 43, 43, 55, 43];
    const chords = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
    const stepDur = 60 / 104 / 2;
    this.timer = window.setInterval(() => {
      const ctx = this.ctx!;
      const t = ctx.currentTime;
      const s = this.step++ % 16;
      this.note(bass[s], t, stepDur * 0.9, "sawtooth", 0.5);
      if (s % 4 === 0) chords[Math.floor(s / 4)].forEach((n) => this.note(n, t, stepDur * 4, "triangle", 0.18));
      if (s % 2 === 0) this.kick(t);
    }, stepDur * 1000);
  }
  note(midi: number, t: number, d: number, type: OscillatorType, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1400;
    o.type = type;
    o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(f).connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + d);
  }
  kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.2);
  }
  pause() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  dispose() {
    this.pause();
    this.ctx?.close();
  }
}

class FilePlayer implements Player {
  a: HTMLAudioElement;
  constructor(src: string, loop: boolean) {
    this.a = new Audio(src);
    this.a.loop = loop;
  }
  play() {
    this.a.play().catch(() => {});
  }
  pause() {
    this.a.pause();
  }
  dispose() {
    this.a.pause();
    this.a.src = "";
  }
}

export function createPlayer(src: string, loop = true): Player {
  return src.startsWith("synth:") ? new SynthPlayer() : new FilePlayer(src, loop);
}
