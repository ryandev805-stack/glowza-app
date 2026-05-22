import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/theme/app_theme.dart';
import '../../models/game_reward_signal.dart';
import '../../providers/app_state.dart';
import '../../services/rewarded_ad_service.dart';

class GlowTileMergeScreen extends StatefulWidget {
  const GlowTileMergeScreen({super.key});

  @override
  State<GlowTileMergeScreen> createState() => _GlowTileMergeScreenState();
}

class _GlowTileMergeScreenState extends State<GlowTileMergeScreen> {
  static const _size = 4;
  final _random = Random();
  final _adService = RewardedAdService();
  late List<List<int>> _board;
  late DateTime _startedAt;
  int _score = 0;
  int _moves = 0;
  int _combo = 0;
  int _bestCombo = 0;
  int _highestTile = 2;
  int _milestone = 64;
  int _rewardedAds = 0;
  bool _ended = false;
  @override
  void initState() {
    super.initState();
    _adService.load();
    _restart();
  }

  @override
  void dispose() {
    _adService.dispose();
    super.dispose();
  }

  void _restart() {
    _board = List.generate(_size, (_) => List.filled(_size, 0));
    _score = 0;
    _moves = 0;
    _combo = 0;
    _bestCombo = 0;
    _highestTile = 2;
    _milestone = 64;
    _rewardedAds = 0;
    _ended = false;
    _startedAt = DateTime.now();
    _spawn();
    _spawn();
    setState(() {});
  }

  void _spawn() {
    final empty = <Point<int>>[];
    for (var row = 0; row < _size; row++) {
      for (var col = 0; col < _size; col++) {
        if (_board[row][col] == 0) empty.add(Point(row, col));
      }
    }
    if (empty.isEmpty) return;
    final pick = empty[_random.nextInt(empty.length)];
    _board[pick.x][pick.y] = _random.nextDouble() < 0.86 ? 2 : 4;
  }

  Future<void> _move(_Direction direction) async {
    if (_ended) return;
    final before = _snapshot();
    var gained = 0;
    var merged = false;

    for (var index = 0; index < _size; index++) {
      final line = _readLine(index, direction);
      final result = _mergeLine(line);
      gained += result.score;
      merged = merged || result.merged;
      _writeLine(index, direction, result.values);
    }

    if (_same(before, _board)) {
      _combo = 0;
      setState(() {});
      return;
    }

    _moves++;
    _combo = merged ? _combo + 1 : 0;
    _bestCombo = max(_bestCombo, _combo);
    _score += gained + (_combo * 8);
    _highestTile = max(_highestTile, _board.expand((row) => row).reduce(max));
    _spawn();
    setState(() {});

    if (_highestTile >= _milestone) {
      await _handleMilestone();
    }
    if (!_hasMoves()) {
      await _handleGameOver();
    }
  }

  List<int> _readLine(int index, _Direction direction) {
    switch (direction) {
      case _Direction.left:
        return List<int>.from(_board[index]);
      case _Direction.right:
        return List<int>.from(_board[index].reversed);
      case _Direction.up:
        return List.generate(_size, (row) => _board[row][index]);
      case _Direction.down:
        return List.generate(_size, (row) => _board[_size - 1 - row][index]);
    }
  }

  void _writeLine(int index, _Direction direction, List<int> values) {
    switch (direction) {
      case _Direction.left:
        _board[index] = values;
      case _Direction.right:
        _board[index] = List<int>.from(values.reversed);
      case _Direction.up:
        for (var row = 0; row < _size; row++) {
          _board[row][index] = values[row];
        }
      case _Direction.down:
        for (var row = 0; row < _size; row++) {
          _board[_size - 1 - row][index] = values[row];
        }
    }
  }

  _MergeResult _mergeLine(List<int> line) {
    final compact = line.where((value) => value != 0).toList();
    final result = <int>[];
    var score = 0;
    var merged = false;
    var index = 0;
    while (index < compact.length) {
      if (index + 1 < compact.length && compact[index] == compact[index + 1]) {
        final value = compact[index] * 2;
        result.add(value);
        score += value;
        merged = true;
        index += 2;
      } else {
        result.add(compact[index]);
        index++;
      }
    }
    while (result.length < _size) {
      result.add(0);
    }
    return _MergeResult(result, score, merged);
  }

  Future<void> _handleMilestone() async {
    final reached = _milestone;
    _milestone *= 2;
    final action = await showModalBottomSheet<_MilestoneAction>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _MilestoneSheet(tile: reached),
    );
    if (action == _MilestoneAction.boost) {
      final watched = await _adService.show(placement: 'tile_merge_milestone');
      if (watched) {
        _rewardedAds++;
        _score += reached;
        _clearSmallestTiles();
        setState(() {});
      }
    }
  }

  Future<void> _handleGameOver() async {
    _ended = true;
    final revive = await showModalBottomSheet<bool>(
      context: context,
      isDismissible: false,
      backgroundColor: Colors.transparent,
      builder: (_) => const _MergeReviveSheet(),
    );
    if (revive ?? false) {
      final watched = await _adService.show(placement: 'tile_merge_revive');
      if (watched) {
        _rewardedAds++;
        _ended = false;
        _clearSmallestTiles(count: 5);
        _spawn();
        setState(() {});
        return;
      }
    }
    await _finishRun();
  }

  void _clearSmallestTiles({int count = 3}) {
    final cells = <_Cell>[];
    for (var row = 0; row < _size; row++) {
      for (var col = 0; col < _size; col++) {
        final value = _board[row][col];
        if (value > 0) cells.add(_Cell(row, col, value));
      }
    }
    cells.sort((a, b) => a.value.compareTo(b.value));
    for (final cell in cells.take(count)) {
      _board[cell.row][cell.col] = 0;
    }
  }

  Future<void> _finishRun() async {
    final duration = DateTime.now().difference(_startedAt).inSeconds;
    await context.read<AppState>().grantGameReward(
      GameRewardSignal(
        score: _score,
        level: log(_highestTile) ~/ log(2),
        bestCombo: _bestCombo,
        durationSeconds: duration,
        sorted: _moves,
        accuracy: _moves == 0 ? 0.2 : 1,
        rewardedAdsCompleted: _rewardedAds,
        placement: 'native_tile_merge',
      ),
    );
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isDismissible: false,
      backgroundColor: Colors.transparent,
      builder: (_) => _MergeSummarySheet(
        score: _score,
        highestTile: _highestTile,
        moves: _moves,
        bestCombo: _bestCombo,
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

  bool _hasMoves() {
    for (var row = 0; row < _size; row++) {
      for (var col = 0; col < _size; col++) {
        if (_board[row][col] == 0) return true;
        if (row + 1 < _size && _board[row][col] == _board[row + 1][col]) {
          return true;
        }
        if (col + 1 < _size && _board[row][col] == _board[row][col + 1]) {
          return true;
        }
      }
    }
    return false;
  }

  List<List<int>> _snapshot() =>
      _board.map((row) => List<int>.from(row)).toList();

  bool _same(List<List<int>> a, List<List<int>> b) {
    for (var row = 0; row < _size; row++) {
      for (var col = 0; col < _size; col++) {
        if (a[row][col] != b[row][col]) return false;
      }
    }
    return true;
  }

  void _onPanEnd(DragEndDetails details) {
    final velocity = details.velocity.pixelsPerSecond;
    if (velocity.distance < 160) return;
    if (velocity.dx.abs() > velocity.dy.abs()) {
      _move(velocity.dx > 0 ? _Direction.right : _Direction.left);
    } else {
      _move(velocity.dy > 0 ? _Direction.down : _Direction.up);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.plum,
      appBar: AppBar(
        backgroundColor: AppTheme.plum,
        foregroundColor: Colors.white,
        title: const Text('Glow Tile Merge'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            _MergeHud(
              score: _score,
              tile: _highestTile,
              moves: _moves,
              combo: _combo,
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onPanEnd: _onPanEnd,
              child: AspectRatio(aspectRatio: 1, child: _Board(board: _board)),
            ),
            const SizedBox(height: 18),
            Text(
              'Swipe to merge matching Glowza tiles. Reach higher tiles and survive longer.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.72),
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _finishRun,
              icon: const Icon(Icons.flag_outlined),
              label: const Text('End Run'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}

enum _Direction { left, right, up, down }

enum _MilestoneAction { continueRun, boost }

class _MergeResult {
  const _MergeResult(this.values, this.score, this.merged);
  final List<int> values;
  final int score;
  final bool merged;
}

class _Cell {
  const _Cell(this.row, this.col, this.value);
  final int row;
  final int col;
  final int value;
}

class _MergeHud extends StatelessWidget {
  const _MergeHud({
    required this.score,
    required this.tile,
    required this.moves,
    required this.combo,
  });

  final int score;
  final int tile;
  final int moves;
  final int combo;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Row(
        children: [
          _HudStat('Score', '$score'),
          _HudStat('Tile', '$tile'),
          _HudStat('Moves', '$moves'),
          _HudStat('Combo', 'x$combo'),
        ],
      ),
    );
  }
}

class _HudStat extends StatelessWidget {
  const _HudStat(this.label, this.value);
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

class _Board extends StatelessWidget {
  const _Board({required this.board});
  final List<List<int>> board;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(30),
      ),
      child: GridView.builder(
        physics: const NeverScrollableScrollPhysics(),
        itemCount: 16,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemBuilder: (context, index) {
          final row = index ~/ 4;
          final col = index % 4;
          final value = board[row][col];
          return AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            curve: Curves.easeOut,
            decoration: BoxDecoration(
              color: _tileColor(value),
              borderRadius: BorderRadius.circular(20),
              boxShadow: value == 0
                  ? null
                  : [
                      BoxShadow(
                        color: _tileColor(value).withValues(alpha: 0.35),
                        blurRadius: 14,
                        offset: const Offset(0, 8),
                      ),
                    ],
            ),
            child: Center(
              child: value == 0
                  ? const SizedBox.shrink()
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.auto_awesome,
                          color: Colors.white,
                          size: 20,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$value',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
            ),
          );
        },
      ),
    );
  }

  Color _tileColor(int value) {
    if (value == 0) return Colors.white.withValues(alpha: 0.08);
    final palette = [
      const Color(0xFFFF4FA3),
      const Color(0xFFC2185B),
      const Color(0xFFD4AF37),
      const Color(0xFF8E174A),
      const Color(0xFF6A1B9A),
      const Color(0xFF2C1022),
    ];
    final index = (log(value) / log(2)).floor().clamp(1, palette.length) - 1;
    return palette[index];
  }
}

class _MilestoneSheet extends StatelessWidget {
  const _MilestoneSheet({required this.tile});
  final int tile;

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
            '$tile Tile Reached',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          const Text(
            'Keep going or open a boost to clear space and continue stronger.',
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(context, _MilestoneAction.boost),
            icon: const Icon(Icons.play_circle_outline),
            label: const Text('Open Boost'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () =>
                Navigator.pop(context, _MilestoneAction.continueRun),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }
}

class _MergeReviveSheet extends StatelessWidget {
  const _MergeReviveSheet();

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
            'Board is full',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          const Text(
            'Revive this board by clearing small tiles and continue the run.',
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.replay),
            label: const Text('Revive Board'),
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

class _MergeSummarySheet extends StatelessWidget {
  const _MergeSummarySheet({
    required this.score,
    required this.highestTile,
    required this.moves,
    required this.bestCombo,
    required this.onRetry,
    required this.onHub,
  });

  final int score;
  final int highestTile;
  final int moves;
  final int bestCombo;
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
          const Icon(Icons.diamond_outlined, color: AppTheme.gold, size: 48),
          const SizedBox(height: 10),
          Text(
            'Merge Complete',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _SummaryPill('Score', '$score'),
              _SummaryPill('Tile', '$highestTile'),
              _SummaryPill('Moves', '$moves'),
              _SummaryPill('Combo', 'x$bestCombo'),
            ],
          ),
          const SizedBox(height: 18),
          ElevatedButton(onPressed: onRetry, child: const Text('Play Again')),
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
