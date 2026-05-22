import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/theme/app_theme.dart';
import '../../models/game_reward_signal.dart';
import '../../providers/app_state.dart';
import '../../services/rewarded_ad_service.dart';

class GlowSortRushScreen extends StatefulWidget {
  const GlowSortRushScreen({super.key});

  @override
  State<GlowSortRushScreen> createState() => _GlowSortRushScreenState();
}

class _GlowSortRushScreenState extends State<GlowSortRushScreen>
    with SingleTickerProviderStateMixin {
  static const _levelDuration = Duration(seconds: 75);
  static const _laneCount = 4;
  static const _baseLives = 5;
  static const _maxRevives = 2;

  final _random = Random();
  final _adService = RewardedAdService();
  final List<_FallingItem> _items = [];
  late final Ticker _ticker;
  DateTime _lastTick = DateTime.now();
  DateTime _levelStarted = DateTime.now();
  DateTime _runStarted = DateTime.now();

  int _score = 0;
  int _level = 1;
  int _combo = 0;
  int _bestCombo = 0;
  int _lives = _baseLives;
  int _sorted = 0;
  int _mistakes = 0;
  int _revives = 0;
  int _rewardedAds = 0;
  int _levelAds = 0;
  int _selectedLane = 0;
  double _spawnClock = 0;
  bool _paused = false;
  bool _ended = false;
  String _status = 'Tap the correct shelf before items land.';

  @override
  void initState() {
    super.initState();
    _adService.load();
    _ticker = createTicker(_tick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    _adService.dispose();
    super.dispose();
  }

  void _tick(Duration _) {
    if (_paused || _ended || !mounted) {
      return;
    }
    final now = DateTime.now();
    final delta = now.difference(_lastTick).inMilliseconds / 1000;
    _lastTick = now;
    _spawnClock += delta;
    final spawnEvery = max(0.42, 1.15 - _level * 0.065);
    if (_spawnClock >= spawnEvery) {
      _spawnClock = 0;
      _spawnItem();
    }
    final speed = 0.18 + _level * 0.018;
    for (final item in _items) {
      item.progress += delta * speed;
    }
    final landed = _items.where((item) => item.progress >= 1).toList();
    for (final item in landed) {
      _resolveItem(item);
    }
    _items.removeWhere((item) => item.progress >= 1);
    if (now.difference(_levelStarted) >= _levelDuration) {
      unawaited(_completeLevel());
    }
    setState(() {});
  }

  void _spawnItem() {
    _items.add(
      _FallingItem(
        lane: _random.nextInt(_laneCount),
        type: _random.nextInt(_laneCount),
        wobble: _random.nextDouble(),
      ),
    );
  }

  void _resolveItem(_FallingItem item) {
    if (item.type == _selectedLane) {
      _combo++;
      _bestCombo = max(_bestCombo, _combo);
      _sorted++;
      _score += ((90 + _level * 14 + _combo * 8) * (1 + _level * 0.03)).round();
      if (_combo % 15 == 0) {
        _status = 'Combo $_combo. Keep the run alive.';
      }
      return;
    }
    _mistakes++;
    _combo = 0;
    _lives--;
    _status = _lives <= 2
        ? 'Near miss. Focus on the shelf color.'
        : 'Wrong shelf.';
    if (_lives <= 0) {
      unawaited(_handleFail());
    }
  }

  Future<void> _completeLevel() async {
    if (_paused || _ended) {
      return;
    }
    _paused = true;
    _items.clear();
    setState(() => _status = 'Level $_level cleared.');
    if (_level % 2 == 0) {
      final watched = await _adService.show(placement: 'level_complete');
      if (watched) {
        _levelAds++;
      }
    }
    if (!mounted) {
      return;
    }
    final choice = await showModalBottomSheet<_Upgrade>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _UpgradeSheet(level: _level),
    );
    choice?.apply(this);
    _level++;
    _levelStarted = DateTime.now();
    _lastTick = DateTime.now();
    _paused = false;
    setState(() {});
  }

  Future<void> _handleFail() async {
    if (_paused || _ended) {
      return;
    }
    _paused = true;
    _items.clear();
    if (_revives < _maxRevives) {
      final revive = await _showReviveSheet();
      if (revive && mounted) {
        final watched = await _adService.show(placement: 'revive');
        if (watched) {
          _rewardedAds++;
          _revives++;
          _lives = 3;
          _levelStarted = DateTime.now();
          _lastTick = DateTime.now();
          _paused = false;
          setState(() => _status = 'Revived. Protect the score.');
          return;
        }
      }
    } else {
      await _adService.show(placement: 'end_run_soft_ad');
    }
    await _finishRun();
  }

  Future<bool> _showReviveSheet() async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isDismissible: false,
      builder: (_) => const _ReviveSheet(),
    );
    return result ?? false;
  }

  Future<void> _finishRun() async {
    if (_ended) {
      return;
    }
    _ended = true;
    final duration = DateTime.now().difference(_runStarted).inSeconds;
    final attempts = max(1, _sorted + _mistakes);
    await context.read<AppState>().grantGameReward(
      GameRewardSignal(
        score: _score,
        level: _level,
        bestCombo: _bestCombo,
        durationSeconds: duration,
        sorted: _sorted,
        accuracy: _sorted / attempts,
        rewardedAdsCompleted: _rewardedAds + _levelAds,
        placement: 'native_sort_rush',
      ),
    );
    if (!mounted) {
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      isDismissible: false,
      backgroundColor: Colors.transparent,
      builder: (_) => _SummarySheet(
        score: _score,
        level: _level,
        bestCombo: _bestCombo,
        sorted: _sorted,
        onRetry: () {
          Navigator.pop(context);
          _restart();
        },
        onHub: () {
          Navigator.pop(context);
          context.go('/games');
        },
      ),
    );
  }

  void _restart() {
    _items.clear();
    _runStarted = DateTime.now();
    _levelStarted = DateTime.now();
    _lastTick = DateTime.now();
    _score = 0;
    _level = 1;
    _combo = 0;
    _bestCombo = 0;
    _lives = _baseLives;
    _sorted = 0;
    _mistakes = 0;
    _revives = 0;
    _rewardedAds = 0;
    _levelAds = 0;
    _paused = false;
    _ended = false;
    _status = 'Tap the correct shelf before items land.';
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final remaining =
        1 -
        DateTime.now().difference(_levelStarted).inMilliseconds /
            _levelDuration.inMilliseconds;
    return Scaffold(
      backgroundColor: AppTheme.plum,
      appBar: AppBar(
        backgroundColor: AppTheme.plum,
        foregroundColor: Colors.white,
        title: const Text('Glow Sort Rush'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            _Hud(
              score: _score,
              level: _level,
              combo: _combo,
              lives: _lives,
              progress: remaining.clamp(0.0, 1.0),
              status: _status,
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTapDown: (details) {
                      final laneWidth = constraints.maxWidth / _laneCount;
                      setState(() {
                        _selectedLane = (details.localPosition.dx / laneWidth)
                            .floor()
                            .clamp(0, _laneCount - 1);
                      });
                    },
                    child: CustomPaint(
                      painter: _GamePainter(
                        items: _items,
                        selectedLane: _selectedLane,
                        theme: Theme.of(context),
                      ),
                      child: const SizedBox.expand(),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FallingItem {
  _FallingItem({required this.lane, required this.type, required this.wobble});
  final int lane;
  final int type;
  final double wobble;
  double progress = 0;
}

class _Hud extends StatelessWidget {
  const _Hud({
    required this.score,
    required this.level,
    required this.combo,
    required this.lives,
    required this.progress,
    required this.status,
  });

  final int score;
  final int level;
  final int combo;
  final int lives;
  final double progress;
  final String status;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Column(
        children: [
          Row(
            children: [
              _Stat(label: 'Score', value: '$score'),
              _Stat(label: 'Level', value: '$level'),
              _Stat(label: 'Combo', value: 'x$combo'),
              _Stat(label: 'Lives', value: '$lives'),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              color: AppTheme.gold,
              backgroundColor: Colors.white.withValues(alpha: 0.16),
            ),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              status,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.78),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.62),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _GamePainter extends CustomPainter {
  _GamePainter({
    required this.items,
    required this.selectedLane,
    required this.theme,
  });

  final List<_FallingItem> items;
  final int selectedLane;
  final ThemeData theme;

  static const colors = [
    Color(0xFFFF4FA3),
    Color(0xFF72C7FF),
    Color(0xFFD4AF37),
    Color(0xFF66D9A3),
  ];
  static const labels = ['Style', 'Tech', 'Home', 'Gifts'];
  static const icons = [
    Icons.brush,
    Icons.water_drop,
    Icons.spa,
    Icons.auto_fix_high,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final laneWidth = size.width / 4;
    final shelfTop = size.height - 92;
    final paint = Paint();
    for (var i = 0; i < 4; i++) {
      final rect = Rect.fromLTWH(
        i * laneWidth + 6,
        0,
        laneWidth - 12,
        size.height,
      );
      paint.color = Colors.white.withValues(
        alpha: i == selectedLane ? 0.12 : 0.055,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(24)),
        paint,
      );
      final shelf = Rect.fromLTWH(
        i * laneWidth + 8,
        shelfTop,
        laneWidth - 16,
        78,
      );
      paint.color = colors[i];
      canvas.drawRRect(
        RRect.fromRectAndRadius(shelf, const Radius.circular(22)),
        paint,
      );
      _drawText(
        canvas,
        labels[i],
        Offset(shelf.center.dx, shelf.center.dy + 18),
        11,
        Colors.white,
      );
      _drawIcon(
        canvas,
        icons[i],
        shelf.center.translate(0, -10),
        Colors.white,
        26,
      );
    }
    for (final item in items) {
      final laneX = item.lane * laneWidth + laneWidth / 2;
      final x = laneX + sin(item.progress * pi * 3 + item.wobble) * 8;
      final y = 18 + item.progress * (shelfTop - 42);
      paint.color = colors[item.type];
      canvas.drawCircle(Offset(x, y), 27, paint);
      paint.color = Colors.white.withValues(alpha: 0.22);
      canvas.drawCircle(Offset(x - 8, y - 9), 8, paint);
      _drawIcon(canvas, icons[item.type], Offset(x, y), Colors.white, 24);
    }
  }

  void _drawText(
    Canvas canvas,
    String text,
    Offset center,
    double size,
    Color color,
  ) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: size,
          fontWeight: FontWeight.w800,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(
      canvas,
      center - Offset(painter.width / 2, painter.height / 2),
    );
  }

  void _drawIcon(
    Canvas canvas,
    IconData icon,
    Offset center,
    Color color,
    double size,
  ) {
    final painter = TextPainter(
      text: TextSpan(
        text: String.fromCharCode(icon.codePoint),
        style: TextStyle(
          fontFamily: icon.fontFamily,
          package: icon.fontPackage,
          color: color,
          fontSize: size,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(
      canvas,
      center - Offset(painter.width / 2, painter.height / 2),
    );
  }

  @override
  bool shouldRepaint(covariant _GamePainter oldDelegate) => true;
}

class _Upgrade {
  const _Upgrade(this.title, this.description, this.apply);
  final String title;
  final String description;
  final void Function(_GlowSortRushScreenState state) apply;
}

class _UpgradeSheet extends StatelessWidget {
  const _UpgradeSheet({required this.level});
  final int level;

  @override
  Widget build(BuildContext context) {
    final upgrades = [
      _Upgrade(
        'Safety Pouch',
        'Gain one extra life.',
        (state) => state._lives++,
      ),
      _Upgrade(
        'Combo Focus',
        'Keep your current combo longer.',
        (state) => state._combo += 3,
      ),
      _Upgrade(
        'Premium Flow',
        'Start next level with bonus score.',
        (state) => state._score += 500 + level * 80,
      ),
    ];
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Level $level cleared',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          const Text('Choose one upgrade for the next level.'),
          const SizedBox(height: 16),
          ...upgrades.map(
            (upgrade) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                tileColor: const Color(AppConstants.blushPink),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                title: Text(
                  upgrade.title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(upgrade.description),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.pop(context, upgrade),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviveSheet extends StatelessWidget {
  const _ReviveSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Almost saved it',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          const Text('Revive this run and continue your score streak.'),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.replay),
            label: const Text('Revive Run'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('End Run'),
          ),
        ],
      ),
    );
  }
}

class _SummarySheet extends StatelessWidget {
  const _SummarySheet({
    required this.score,
    required this.level,
    required this.bestCombo,
    required this.sorted,
    required this.onRetry,
    required this.onHub,
  });

  final int score;
  final int level;
  final int bestCombo;
  final int sorted;
  final VoidCallback onRetry;
  final VoidCallback onHub;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.emoji_events, color: AppTheme.gold, size: 46),
          const SizedBox(height: 12),
          Text(
            'Run Complete',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _SummaryPill('Score', '$score'),
              _SummaryPill('Level', '$level'),
              _SummaryPill('Combo', 'x$bestCombo'),
              _SummaryPill('Sorted', '$sorted'),
            ],
          ),
          const SizedBox(height: 18),
          ElevatedButton(onPressed: onRetry, child: const Text('One More Try')),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: onHub,
            child: const Text('Back to Games Hub'),
          ),
        ],
      ),
    );
  }
}

class _SummaryPill extends StatelessWidget {
  const _SummaryPill(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 138,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(AppConstants.blushPink),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppTheme.wine),
          ),
        ],
      ),
    );
  }
}
