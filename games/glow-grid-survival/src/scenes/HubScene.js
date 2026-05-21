import Phaser from 'phaser';
import { COLORS } from '../config/gameConfig.js';
import { loadProfile } from '../services/storage.js';

const missions = [
  { label: 'Sort 120 products today', get: (p) => p.daily.sorted, target: 120 },
  { label: 'Reach combo 25', get: (p) => p.daily.bestCombo, target: 25 },
  { label: 'Clear level 6', get: (p) => p.daily.levels, target: 6 },
];

export class HubScene extends Phaser.Scene {
  constructor() {
    super('HubScene');
  }

  create() {
    this.profile = loadProfile();
    this.drawBackground();
    this.drawHero();
    this.drawMissions();
    this.drawLeaderboard();
    this.drawPlayButton();
  }

  drawBackground() {
    this.add.rectangle(195, 422, 390, 844, COLORS.plum);
    this.add.circle(330, 94, 160, COLORS.hot, 0.24);
    this.add.circle(42, 724, 190, COLORS.lavender, 0.12);
  }

  drawHero() {
    this.add.text(24, 36, 'Glow Sort Rush', { fontSize: '33px', fontStyle: '900', color: '#ffffff' });
    this.add.text(24, 76, 'Sort fast. Build combos. Survive levels.', { fontSize: '14px', color: '#ffd6e7' });
    this.card(24, 112, 342, 156, COLORS.white, 0.96);
    this.add.text(44, 136, 'High Score', { fontSize: '13px', fontStyle: '800', color: '#746370' });
    this.add.text(44, 158, this.profile.highScore.toLocaleString(), { fontSize: '42px', fontStyle: '900', color: '#b0125b' });
    this.add.text(44, 214, `Best Level ${this.profile.bestLevel}  |  Best Combo ${this.profile.bestCombo}`, { fontSize: '14px', color: '#2c1022' });
    this.add.text(44, 238, `${this.profile.streak} day play streak`, { fontSize: '13px', color: '#746370' });
    this.add.image(324, 176, 'sparkle').setScale(0.9);
  }

  drawMissions() {
    this.add.text(24, 298, 'Today\'s Goals', { fontSize: '20px', fontStyle: '900', color: '#ffffff' });
    missions.forEach((mission, index) => {
      const y = 334 + index * 76;
      const value = Math.min(mission.get(this.profile) || 0, mission.target);
      const done = value >= mission.target;
      this.card(24, y, 342, 60, done ? COLORS.gold : COLORS.white, done ? 0.96 : 0.92);
      this.add.text(42, y + 11, mission.label, { fontSize: '14px', fontStyle: '800', color: '#2c1022' });
      this.add.rectangle(42, y + 42, 260, 7, 0xf2d8e5).setOrigin(0);
      this.add.rectangle(42, y + 42, 260 * (value / mission.target), 7, done ? COLORS.pink : COLORS.hot).setOrigin(0);
      this.add.text(314, y + 35, done ? 'Done' : `${value}`, { fontSize: '12px', fontStyle: '900', color: '#b0125b' });
    });
  }

  drawLeaderboard() {
    this.add.text(24, 586, 'Local Board', { fontSize: '20px', fontStyle: '900', color: '#ffffff' });
    this.card(24, 620, 342, 96, COLORS.white, 0.92);
    const scores = this.profile.leaderboard?.slice(0, 3) || [];
    if (!scores.length) {
      this.add.text(44, 660, 'Play a run to enter your board.', { fontSize: '13px', color: '#746370' });
      return;
    }
    scores.forEach((score, index) => {
      this.add.text(44, 638 + index * 25, `${index + 1}. Level ${score.level}`, { fontSize: '13px', fontStyle: '800', color: '#2c1022' });
      this.add.text(260, 638 + index * 25, `${score.score}`, { fontSize: '13px', fontStyle: '900', color: '#b0125b' });
    });
  }

  drawPlayButton() {
    const play = this.button(24, 752, 342, 58, 'Start Sorting', COLORS.hot);
    play.on('pointerdown', () => this.scene.start('GameScene'));
  }

  card(x, y, width, height, color, alpha = 1) {
    const rect = this.add.rectangle(x, y, width, height, color, alpha).setOrigin(0);
    rect.setStrokeStyle(1, 0xffffff, 0.16);
    return rect;
  }

  button(x, y, width, height, label, color) {
    const group = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, width, height, color, 1).setOrigin(0);
    const text = this.add.text(width / 2, height / 2, label, { fontSize: '16px', fontStyle: '900', color: '#ffffff' }).setOrigin(0.5);
    group.add([rect, text]);
    group.setSize(width, height);
    group.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    return group;
  }
}
