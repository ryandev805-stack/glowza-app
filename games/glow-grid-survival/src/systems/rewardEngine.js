export function createHiddenRewardSignal(summary) {
  const engagementMinutes = Math.min(30, summary.duration / 60);
  const skillScore =
    summary.score / 1000 +
    summary.level * 2 +
    summary.bestCombo * 0.35 +
    summary.accuracy * 12;
  const adWeight = summary.rewardedAdsCompleted * 8 + summary.levelAdsCompleted * 5;
  const qualityPenalty = summary.antiAbuse?.suspicious ? 0.35 : 1;

  return {
    type: 'hidden_reward_signal',
    engagementMinutes,
    skillScore: Math.round(skillScore * qualityPenalty),
    adWeight,
    sorted: summary.sorted,
    level: summary.level,
    accuracy: summary.accuracy,
    recommendedRewardTier: Math.max(1, Math.min(10, Math.round((skillScore + adWeight) / 8))),
  };
}
