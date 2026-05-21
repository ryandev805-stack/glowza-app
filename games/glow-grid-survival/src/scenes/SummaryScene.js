import Phaser from 'phaser';
import { COLORS } from '../config/gameConfig.js';
import { GameBridge } from '../services/bridge.js';
import { completeRun, loadProfile } from '../services/storage.js';
import { createHiddenRewardSignal } from '../systems/rewardEngine.js';

export class SummaryScene extends Phaser.Scene {
  constructor() {
    super('SummaryScene');
  }

  create(data) {
    this.summary = data.summary;
    this.profile = completeRun(loadProfile(), this.summary);
    this.hiddenRewardSignal = createHiddenRewardSignal(this.summary);
    GameBridge.rewardPreview(this.hiddenRewardSignal);
    this.drawBackground();
    this.drawResult();
    this.drawActions();
  }

  drawBackground() {
    this.add.rectangle(195, 422, 390, 844, COLORS.plum);
    this.add.circle(318, 92, 150, COLORS.hot, 0.22);
    this.add.circle(40, 720, 180, COLORS.lavender, 0.12);
  }

  drawResult() {
    this.add.text(24, 42, 'Run Summary', { fontSize: '34px', fontStyle: '900', color: '#ffffff' });
    this.add.text(24, 84, 'Your game progress was saved.', { fontSize: '14px', color: '#ffd6e7' });
    this.card(24, 126, 342, 178, COLORS.white, 0.96);
    this.add.text(44, 150, 'Score', { fontSize: '13px', fontStyle: '800', color: '#746370' });
    this.add.text(44, 172, this.summary.score.toLocaleString(), { fontSize: '44px', fontStyle: '900', color: '#b0125b' });
    this.add.text(44, 232, `Level ${this.summary.level}  |  Combo ${this.summary.bestCombo}`, { fontSize: '15px', fontStyle: '800', color: '#2c1022' });
    this.add.text(44, 260, `Accuracy ${Math.round(this.summary.accuracy * 100)}%  |  ${this.summary.sorted} sorted`, { fontSize: '13px', color: '#746370' });

    this.card(24, 330, 342, 122, COLORS.wine, 0.92);
    this.add.text(44, 354, 'Personal Bests', { fontSize: '18px', fontStyle: '900', color: '#ffffff' });
    this.add.text(44, 386, `High Score ${this.profile.highScore.toLocaleString()}`, { fontSize: '14px', color: '#ffd6e7' });
    this.add.text(44, 410, `Best Level ${this.profile.bestLevel}  |  Best Combo ${this.profile.bestCombo}`, { fontSize: '14px', color: '#ffd6e7' });

    this.add.text(24, 486, 'Unlocked Milestones', { fontSize: '20px', fontStyle: '900', color: '#ffffff' });
    const badges = [
      ['score_10k', '10K Score'],
      ['combo_30', 'Combo 30'],
      ['level_8', 'Level 8'],
      ['long_session', 'Long Run'],
    ];
    badges.forEach(([id, label], index) => {
      const x = 24 + (index % 2) * 176;
      const y = 526 + Math.floor(index / 2) * 72;
      const unlocked = this.profile.achievements.includes(id);
      this.card(x, y, 166, 52, unlocked ? COLORS.gold : COLORS.white, unlocked ? 0.96 : 0.82);
      this.add.text(x + 16, y + 17, label, { fontSize: '13px', fontStyle: '900', color: unlocked ? '#2c1022' : '#746370' });
    });
  }

  drawActions() {
    const double = this.button(24, 682, 342, 52, 'Watch to Boost Hub Reward', COLORS.hot);
    double.on('pointerdown', async () => {
      double.disableInteractive();
      const result = await GameBridge.requestRewardedAd('double_hidden_reward', {
        score: this.summary.score,
        level: this.summary.level,
      });
      if (result.completed) {
        this.hiddenRewardSignal.adWeight += 10;
        GameBridge.rewardPreview({ ...this.hiddenRewardSignal, boosted: true });
        this.floatText('Boost saved to Hub', 195, 662);
      }
    });
    const retry = this.button(24, 752, 164, 52, 'Try Again', COLORS.pink);
    retry.on('pointerdown', () => this.scene.start('GameScene'));
    const hub = this.button(202, 752, 164, 52, 'Game Hub', COLORS.wine);
    hub.on('pointerdown', () => this.scene.start('HubScene'));
  }

  card(x, y, width, height, color, alpha = 1) {
    const rect = this.add.rectangle(x, y, width, height, color, alpha).setOrigin(0);
    rect.setStrokeStyle(1, 0xffffff, 0.15);
    return rect;
  }

  button(x, y, width, height, label, color) {
    const group = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, width, height, color, 1).setOrigin(0);
    const text = this.add.text(width / 2, height / 2, label, { fontSize: '14px', fontStyle: '900', color: '#ffffff' }).setOrigin(0.5);
    group.add([rect, text]);
    group.setSize(width, height);
    group.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    return group;
  }

  floatText(text, x, y) {
    const label = this.add.text(x, y, text, { fontSize: '19px', fontStyle: '900', color: '#d4af37' }).setOrigin(0.5);
    this.tweens.add({ targets: label, y: y - 34, alpha: 0, duration: 900, onComplete: () => label.destroy() });
  }
}
