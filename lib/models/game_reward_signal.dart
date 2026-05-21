class GameRewardSignal {
  const GameRewardSignal({
    required this.score,
    required this.level,
    required this.bestCombo,
    required this.durationSeconds,
    required this.sorted,
    required this.accuracy,
    required this.rewardedAdsCompleted,
    required this.placement,
  });

  final int score;
  final int level;
  final int bestCombo;
  final int durationSeconds;
  final int sorted;
  final double accuracy;
  final int rewardedAdsCompleted;
  final String placement;
}
