export class AntiAbuseMonitor {
  constructor() {
    this.startedAt = Date.now();
    this.lastInputAt = Date.now();
    this.inputIntervals = [];
    this.events = [];
    this.focusLosses = 0;
    this.scoreJumps = 0;
    this.lastScore = 0;

    window.addEventListener('blur', () => {
      this.focusLosses += 1;
    });
  }

  input() {
    const now = Date.now();
    this.inputIntervals.push(now - this.lastInputAt);
    this.lastInputAt = now;
  }

  event(type, data = {}) {
    this.events.push({ type, data, at: Date.now() });
    if (typeof data.score === 'number') {
      const delta = data.score - this.lastScore;
      if (delta > 1800) this.scoreJumps += 1;
      this.lastScore = data.score;
    }
  }

  snapshot() {
    const duration = (Date.now() - this.startedAt) / 1000;
    const idleSeconds = (Date.now() - this.lastInputAt) / 1000;
    const averageInputInterval = this.inputIntervals.length
      ? this.inputIntervals.reduce((sum, value) => sum + value, 0) / this.inputIntervals.length
      : 99999;
    const suspicious =
      duration > 60 && this.inputIntervals.length < 5 ||
      idleSeconds > 45 ||
      averageInputInterval < 80 ||
      this.scoreJumps > 2;

    return {
      duration,
      idleSeconds,
      inputCount: this.inputIntervals.length,
      averageInputInterval,
      focusLosses: this.focusLosses,
      scoreJumps: this.scoreJumps,
      suspicious,
    };
  }
}
