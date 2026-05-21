import Phaser from 'phaser';
import { BEAUTY_TYPES, COLORS, LANES, RUN_CONFIG, UPGRADE_POOL } from '../config/gameConfig.js';
import { BackendClient } from '../services/backendClient.js';
import { GameBridge } from '../services/bridge.js';
import { AntiAbuseMonitor } from '../systems/antiAbuse.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  async create() {
    this.items = [];
    this.activeTypeIndex = 0;
    this.stats = {
      sessionId: '',
      startedAt: Date.now(),
      score: 0,
      level: 1,
      lives: RUN_CONFIG.baseLives,
      combo: 0,
      bestCombo: 0,
      sorted: 0,
      missed: 0,
      mistakes: 0,
      rewardedAdsCompleted: 0,
      levelAdsCompleted: 0,
      revivesUsed: 0,
      speedMultiplier: 1,
      scoreMultiplier: 1,
      comboLocks: 0,
    };
    this.monitor = new AntiAbuseMonitor();
    const session = await BackendClient.startSession({ gameId: 'glow-sort-rush' });
    this.stats.sessionId = session.sessionId;
    GameBridge.sessionStarted({ sessionId: this.stats.sessionId, startedAt: this.stats.startedAt });

    this.drawBackground();
    this.drawHud();
    this.drawLanes();
    this.createInput();
    this.startLevel();
  }

  drawBackground() {
    this.add.rectangle(195, 422, 390, 844, COLORS.plum);
    this.add.circle(330, 86, 130, COLORS.hot, 0.18);
    this.add.circle(48, 734, 170, COLORS.lavender, 0.10);
  }

  drawHud() {
    this.add.text(22, 34, 'Sort Rush', { fontSize: '27px', fontStyle: '900', color: '#ffffff' });
    this.scoreText = this.add.text(248, 36, '0', { fontSize: '24px', fontStyle: '900', color: '#ffffff' });
    this.add.text(248, 66, 'score', { fontSize: '12px', color: '#ffd6e7' });
    this.levelText = this.add.text(22, 72, 'Level 1', { fontSize: '14px', color: '#ffd6e7' });
    this.comboText = this.add.text(22, 102, 'Combo x0', { fontSize: '15px', fontStyle: '800', color: '#ffffff' });
    this.livesText = this.add.text(266, 102, 'Lives 5', { fontSize: '15px', fontStyle: '800', color: '#ffffff' });
    this.timerBg = this.add.rectangle(22, 132, 346, 10, 0x4c253a).setOrigin(0);
    this.timerBar = this.add.rectangle(22, 132, 346, 10, COLORS.hot).setOrigin(0);
  }

  drawLanes() {
    BEAUTY_TYPES.slice(0, LANES.count).forEach((type, index) => {
      const x = this.laneX(index);
      this.add.rectangle(x, LANES.top + 264, LANES.width, 528, 0xffffff, 0.055);
      const bin = this.add.rectangle(x, LANES.shelfY, LANES.width, 76, type.color, 0.95);
      bin.setStrokeStyle(2, 0xffffff, 0.35);
      this.add.text(x, LANES.shelfY - 6, type.short, { fontSize: '24px', fontStyle: '900', color: '#ffffff' }).setOrigin(0.5);
      this.add.text(x, LANES.shelfY + 22, type.label, { fontSize: '11px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
    });
  }

  createInput() {
    this.input.on('pointerdown', (pointer) => {
      this.monitor.input();
      const index = Phaser.Math.Clamp(Math.floor((pointer.x - LANES.left) / (LANES.width + LANES.gap)), 0, LANES.count - 1);
      this.activeTypeIndex = index;
      this.flashLane(index);
    });
  }

  startLevel() {
    this.levelStartedAt = Date.now();
    this.levelEndsAt = Date.now() + RUN_CONFIG.levelSeconds * 1000;
    this.spawnDelay = Math.max(RUN_CONFIG.minSpawnMs, RUN_CONFIG.baseSpawnMs - this.stats.level * 62);
    this.spawnTimer?.remove();
    this.levelTimer?.remove();
    this.spawnTimer = this.time.addEvent({ delay: this.spawnDelay, loop: true, callback: () => this.spawnItem() });
    this.levelTimer = this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickLevel() });
    this.updateHud();
  }

  spawnItem() {
    const lane = Phaser.Math.Between(0, LANES.count - 1);
    const type = Phaser.Utils.Array.GetRandom(BEAUTY_TYPES.slice(0, LANES.count));
    const x = this.laneX(lane);
    const sprite = this.add.image(x, LANES.top, `product_${type.id}`).setDisplaySize(54, 54);
    sprite.setData({ lane, type: type.id, speed: (RUN_CONFIG.baseSpeed + this.stats.level * RUN_CONFIG.speedPerLevel) * this.stats.speedMultiplier });
    this.items.push(sprite);
    this.tweens.add({
      targets: sprite,
      scale: { from: 0.82, to: 1 },
      duration: 180,
      ease: 'Back.Out',
    });
  }

  update(_time, delta) {
    if (!this.items) return;
    const dt = delta / 1000;
    this.items.slice().forEach((sprite) => {
      sprite.y += sprite.getData('speed') * dt;
      if (sprite.y >= LANES.shelfY - 38) this.resolveItem(sprite);
    });
  }

  resolveItem(sprite) {
    const expectedType = BEAUTY_TYPES[this.activeTypeIndex].id;
    const correct = sprite.getData('type') === expectedType;
    this.items = this.items.filter((item) => item !== sprite);
    sprite.destroy();
    if (correct) this.handleCorrect();
    else this.handleMistake();
  }

  handleCorrect() {
    this.stats.combo += 1;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
    this.stats.sorted += 1;
    const score = Math.round((90 + this.stats.combo * 7 + this.stats.level * 11) * this.stats.scoreMultiplier);
    this.stats.score += score;
    if (this.stats.combo % 10 === 0) this.floatText(`Combo ${this.stats.combo}`, 195, 186, COLORS.gold);
    this.monitor.event('correct_sort', { score: this.stats.score, combo: this.stats.combo });
    this.updateHud();
  }

  handleMistake() {
    this.stats.mistakes += 1;
    if (this.stats.comboLocks > 0) {
      this.stats.comboLocks -= 1;
      this.floatText('Combo saved', 195, 186, COLORS.mint);
      return;
    }
    this.stats.combo = 0;
    this.stats.lives -= 1;
    this.cameras.main.shake(130, 0.006);
    this.updateHud();
    if (this.stats.lives <= 0) void this.failRun();
  }

  tickLevel() {
    const remaining = Math.max(0, this.levelEndsAt - Date.now());
    this.timerBar.width = 346 * (remaining / (RUN_CONFIG.levelSeconds * 1000));
    if (remaining <= 0) void this.completeLevel();
  }

  async completeLevel() {
    this.spawnTimer.paused = true;
    this.levelTimer.paused = true;
    this.clearItems();
    GameBridge.sessionEvent(this.stats.sessionId, 'level_completed', this.publicSummary());
    await BackendClient.submitEvent(this.stats.sessionId, { type: 'level_completed', ...this.publicSummary() });
    this.stats.level += 1;

    if ((this.stats.level - 1) % RUN_CONFIG.adBreakEveryLevels === 0) {
      const result = await GameBridge.requestRewardedAd('level_break', { level: this.stats.level - 1, score: this.stats.score });
      if (result.completed) this.stats.levelAdsCompleted += 1;
    }
    this.showUpgradeChoice();
  }

  showUpgradeChoice() {
    const choices = Phaser.Utils.Array.Shuffle([...UPGRADE_POOL]).slice(0, 3);
    const overlay = this.add.container(0, 0);
    overlay.add(this.add.rectangle(195, 422, 390, 844, 0x000000, 0.58));
    overlay.add(this.add.text(42, 180, `Level ${this.stats.level - 1} Complete`, { fontSize: '30px', fontStyle: '900', color: '#ffffff' }));
    overlay.add(this.add.text(42, 218, 'Choose one upgrade. No points shown here.', { fontSize: '14px', color: '#ffd6e7' }));
    choices.forEach((choice, index) => {
      const y = 284 + index * 108;
      const card = this.add.rectangle(42, y, 306, 84, COLORS.white, 0.96).setOrigin(0);
      const title = this.add.text(62, y + 16, choice.title, { fontSize: '18px', fontStyle: '900', color: '#2c1022' });
      const text = this.add.text(62, y + 44, choice.text, { fontSize: '13px', color: '#746370' });
      overlay.add([card, title, text]);
      card.setInteractive();
      card.on('pointerdown', () => {
        choice.apply(this.stats);
        overlay.destroy();
        this.startLevel();
      });
    });
  }

  async failRun() {
    this.spawnTimer.paused = true;
    this.levelTimer.paused = true;
    this.clearItems();
    if (this.stats.revivesUsed < RUN_CONFIG.maxRevivesPerRun) {
      const revived = await this.offerRevive();
      if (revived) return;
    }
    await this.endRun();
  }

  offerRevive() {
    const overlay = this.add.container(0, 0);
    overlay.add(this.add.rectangle(195, 422, 390, 844, 0x000000, 0.66));
    overlay.add(this.add.text(48, 252, 'Almost saved it.', { fontSize: '32px', fontStyle: '900', color: '#ffffff' }));
    overlay.add(this.add.text(48, 294, 'Revive and continue your score run.', { fontSize: '15px', color: '#ffd6e7' }));
    const revive = this.button(48, 356, 294, 58, 'Revive Run', COLORS.hot);
    const end = this.button(48, 432, 294, 50, 'End Run', COLORS.wine);
    overlay.add([revive, end]);
    return new Promise((resolve) => {
      revive.on('pointerdown', async () => {
        const result = await GameBridge.requestRewardedAd('revive', { level: this.stats.level, score: this.stats.score });
        if (result.completed) {
          this.stats.rewardedAdsCompleted += 1;
          this.stats.revivesUsed += 1;
          this.stats.lives = 3;
          overlay.destroy();
          this.startLevel();
          resolve(true);
        }
      });
      end.on('pointerdown', async () => {
        await GameBridge.requestRewardedAd('end_run_soft_ad', { level: this.stats.level, score: this.stats.score });
        overlay.destroy();
        resolve(false);
      });
    });
  }

  async endRun() {
    const summary = this.publicSummary();
    summary.duration = Math.round((Date.now() - this.stats.startedAt) / 1000);
    summary.antiAbuse = this.monitor.snapshot();
    await BackendClient.endSession(this.stats.sessionId, summary);
    GameBridge.sessionEnded(summary);
    this.scene.start('SummaryScene', { summary });
  }

  publicSummary() {
    const attempts = this.stats.sorted + this.stats.mistakes;
    return {
      sessionId: this.stats.sessionId,
      score: this.stats.score,
      level: this.stats.level,
      lives: this.stats.lives,
      bestCombo: this.stats.bestCombo,
      sorted: this.stats.sorted,
      mistakes: this.stats.mistakes,
      rewardedAdsCompleted: this.stats.rewardedAdsCompleted,
      levelAdsCompleted: this.stats.levelAdsCompleted,
      accuracy: attempts ? Number((this.stats.sorted / attempts).toFixed(2)) : 1,
    };
  }

  updateHud() {
    this.scoreText.setText(this.stats.score.toLocaleString());
    this.levelText.setText(`Level ${this.stats.level}`);
    this.comboText.setText(`Combo x${this.stats.combo}`);
    this.livesText.setText(`Lives ${this.stats.lives}`);
  }

  laneX(index) {
    return LANES.left + index * (LANES.width + LANES.gap) + LANES.width / 2;
  }

  flashLane(index) {
    const x = this.laneX(index);
    const flash = this.add.rectangle(x, LANES.shelfY, LANES.width, 76, COLORS.white, 0.26);
    this.tweens.add({ targets: flash, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
  }

  clearItems() {
    this.items.forEach((sprite) => sprite.destroy());
    this.items = [];
  }

  button(x, y, width, height, label, color) {
    const group = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, width, height, color, 1).setOrigin(0);
    const text = this.add.text(width / 2, height / 2, label, { fontSize: '15px', fontStyle: '900', color: '#ffffff' }).setOrigin(0.5);
    group.add([rect, text]);
    group.setSize(width, height);
    group.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    return group;
  }

  floatText(text, x, y, color) {
    const label = this.add.text(x, y, text, { fontSize: '22px', fontStyle: '900', color: `#${color.toString(16).padStart(6, '0')}` }).setOrigin(0.5);
    this.tweens.add({ targets: label, y: y - 34, alpha: 0, duration: 700, onComplete: () => label.destroy() });
  }
}
