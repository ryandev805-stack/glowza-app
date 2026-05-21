export const GAME_ID = 'glow-sort-rush';

export const COLORS = {
  plum: 0x2c1022,
  wine: 0x651238,
  pink: 0xb0125b,
  hot: 0xff4fa3,
  blush: 0xffd6e7,
  lavender: 0xe9d5ff,
  gold: 0xd4af37,
  mint: 0x66d9a3,
  sky: 0x72c7ff,
  coral: 0xff7c7c,
  white: 0xffffff,
  ink: 0x21141e,
};

export const LANES = {
  count: 4,
  width: 78,
  gap: 10,
  left: 24,
  top: 156,
  bottom: 684,
  shelfY: 710,
};

export const BEAUTY_TYPES = [
  { id: 'makeup', label: 'Makeup', short: 'M', color: COLORS.hot },
  { id: 'skin', label: 'Skin', short: 'S', color: COLORS.sky },
  { id: 'hair', label: 'Hair', short: 'H', color: COLORS.gold },
  { id: 'scent', label: 'Scent', short: 'F', color: COLORS.lavender },
  { id: 'tool', label: 'Tools', short: 'T', color: COLORS.mint },
];

export const RUN_CONFIG = {
  levelSeconds: 90,
  baseLives: 5,
  baseSpawnMs: 1120,
  minSpawnMs: 360,
  baseSpeed: 94,
  speedPerLevel: 10,
  adBreakEveryLevels: 2,
  maxRevivesPerRun: 2,
};

export const UPGRADE_POOL = [
  {
    id: 'slow_belt',
    title: 'Silky Belt',
    text: 'Products move 8% slower.',
    apply: (stats) => {
      stats.speedMultiplier *= 0.92;
    },
  },
  {
    id: 'extra_life',
    title: 'Safety Pouch',
    text: 'Gain one extra life.',
    apply: (stats) => {
      stats.lives += 1;
    },
  },
  {
    id: 'combo_guard',
    title: 'Combo Lock',
    text: 'First mistake keeps combo.',
    apply: (stats) => {
      stats.comboLocks += 1;
    },
  },
  {
    id: 'premium_score',
    title: 'Premium Finish',
    text: 'Correct sorting scores 12% more.',
    apply: (stats) => {
      stats.scoreMultiplier += 0.12;
    },
  },
];
