const key = 'glowza_sort_rush_profile_v1';

const todayKey = () => new Date().toISOString().slice(0, 10);

const defaultProfile = () => ({
  lastVisit: todayKey(),
  streak: 1,
  highScore: 0,
  bestLevel: 1,
  bestCombo: 0,
  longestRunSeconds: 0,
  totalRuns: 0,
  achievements: [],
  daily: {
    date: todayKey(),
    sorted: 0,
    bestCombo: 0,
    levels: 0,
    runs: 0,
  },
  leaderboard: [],
});

export function loadProfile() {
  const raw = localStorage.getItem(key);
  const profile = raw ? { ...defaultProfile(), ...JSON.parse(raw) } : defaultProfile();
  return rolloverDaily(profile);
}

export function saveProfile(profile) {
  localStorage.setItem(key, JSON.stringify(profile));
  return profile;
}

export function rolloverDaily(profile) {
  const today = todayKey();
  if (profile.daily?.date === today) return profile;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return saveProfile({
    ...profile,
    streak: profile.lastVisit === yesterday ? Number(profile.streak || 0) + 1 : 1,
    lastVisit: today,
    daily: {
      date: today,
      sorted: 0,
      bestCombo: 0,
      levels: 0,
      runs: 0,
    },
  });
}

export function completeRun(profile, summary) {
  const achievements = new Set(profile.achievements || []);
  if (summary.score >= 10000) achievements.add('score_10k');
  if (summary.bestCombo >= 30) achievements.add('combo_30');
  if (summary.level >= 8) achievements.add('level_8');
  if (summary.duration >= 900) achievements.add('long_session');

  const entry = {
    score: summary.score,
    level: summary.level,
    combo: summary.bestCombo,
    at: new Date().toISOString(),
  };

  return saveProfile({
    ...profile,
    highScore: Math.max(Number(profile.highScore || 0), summary.score),
    bestLevel: Math.max(Number(profile.bestLevel || 1), summary.level),
    bestCombo: Math.max(Number(profile.bestCombo || 0), summary.bestCombo),
    longestRunSeconds: Math.max(Number(profile.longestRunSeconds || 0), summary.duration),
    totalRuns: Number(profile.totalRuns || 0) + 1,
    achievements: Array.from(achievements),
    daily: {
      ...profile.daily,
      sorted: Number(profile.daily.sorted || 0) + summary.sorted,
      bestCombo: Math.max(Number(profile.daily.bestCombo || 0), summary.bestCombo),
      levels: Math.max(Number(profile.daily.levels || 0), summary.level),
      runs: Number(profile.daily.runs || 0) + 1,
    },
    leaderboard: [entry, ...(profile.leaderboard || [])]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10),
  });
}
