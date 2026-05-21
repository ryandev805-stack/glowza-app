import Phaser from 'phaser';
import { BEAUTY_TYPES, COLORS } from '../config/gameConfig.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.createProductTextures();
    this.createUiTextures();
    this.scene.start('HubScene');
  }

  createProductTextures() {
    BEAUTY_TYPES.forEach((item) => {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(item.color, 1);
      graphics.fillRoundedRect(0, 0, 72, 72, 20);
      graphics.lineStyle(3, 0xffffff, 0.6);
      graphics.strokeRoundedRect(5, 5, 62, 62, 17);
      graphics.fillStyle(0xffffff, 0.92);
      if (item.id === 'makeup') graphics.fillRoundedRect(27, 14, 18, 44, 9);
      if (item.id === 'skin') graphics.fillRoundedRect(24, 16, 24, 42, 8);
      if (item.id === 'hair') {
        graphics.fillRoundedRect(18, 20, 16, 42, 8);
        graphics.fillTriangle(36, 18, 58, 26, 36, 38);
      }
      if (item.id === 'scent') {
        graphics.fillRoundedRect(24, 24, 24, 34, 9);
        graphics.fillRoundedRect(28, 13, 16, 14, 5);
      }
      if (item.id === 'tool') {
        graphics.fillRoundedRect(18, 18, 12, 42, 6);
        graphics.fillRoundedRect(38, 18, 12, 42, 6);
      }
      graphics.generateTexture(`product_${item.id}`, 72, 72);
      graphics.destroy();
    });
  }

  createUiTextures() {
    const sparkle = this.make.graphics({ x: 0, y: 0 }, false);
    sparkle.fillStyle(COLORS.gold, 1);
    sparkle.fillTriangle(20, 0, 27, 18, 44, 22);
    sparkle.fillTriangle(44, 22, 27, 28, 20, 48);
    sparkle.fillTriangle(20, 48, 14, 28, 0, 22);
    sparkle.fillTriangle(0, 22, 14, 18, 20, 0);
    sparkle.generateTexture('sparkle', 44, 48);
    sparkle.destroy();
  }
}
