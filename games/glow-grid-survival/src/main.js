import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './scenes/BootScene.js';
import { HubScene } from './scenes/HubScene.js';
import { GameScene } from './scenes/GameScene.js';
import { SummaryScene } from './scenes/SummaryScene.js';

const root = document.querySelector('#app');
root.innerHTML = '';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#2c1022',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844,
  },
  render: {
    antialias: true,
    pixelArt: false,
    powerPreference: 'low-power',
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  scene: [BootScene, HubScene, GameScene, SummaryScene],
};

window.GlowzaGame = window.GlowzaGame || {};
window.GlowzaPhaser = new Phaser.Game(config);
