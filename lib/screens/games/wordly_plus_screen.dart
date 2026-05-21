// ignore_for_file: implementation_imports

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:logger/logger.dart' as wordly_logger;
import 'package:wordly/src/feature/app/logic/composition_root.dart';
import 'package:wordly/src/feature/app/model/application_config.dart';
import 'package:wordly/src/feature/app/widget/root_context.dart';

import '../../core/constants/app_constants.dart';
import '../../core/theme/app_theme.dart';

class WordlyPlusScreen extends StatefulWidget {
  const WordlyPlusScreen({super.key});

  @override
  State<WordlyPlusScreen> createState() => _WordlyPlusScreenState();
}

class _WordlyPlusScreenState extends State<WordlyPlusScreen> {
  late final Future<CompositionResult> _composition;

  @override
  void initState() {
    super.initState();
    wordly_logger.createAppLogger(
      observers: [
        if (!kReleaseMode)
          const wordly_logger.PrintingLogObserver(
            logLevel: wordly_logger.LogLevel.warn,
          ),
      ],
    );
    _composition = composeDependencies(config: const ApplicationConfig());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CompositionResult>(
      future: _composition,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          return Stack(
            children: [
              RootContext(compositionResult: snapshot.requireData),
              Positioned(
                top: MediaQuery.paddingOf(context).top + 8,
                left: 12,
                child: SafeArea(
                  child: Material(
                    color: Colors.black.withValues(alpha: 0.18),
                    shape: const CircleBorder(),
                    clipBehavior: Clip.antiAlias,
                    child: IconButton(
                      tooltip: 'Back to games',
                      color: Colors.white,
                      icon: const Icon(Icons.arrow_back),
                      onPressed: () => context.pop(),
                    ),
                  ),
                ),
              ),
            ],
          );
        }
        if (snapshot.hasError) {
          return Scaffold(
            appBar: AppBar(title: const Text('Wordly Plus')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      color: AppTheme.primary,
                      size: 44,
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Wordly Plus could not start.',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${snapshot.error}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppTheme.wine),
                    ),
                  ],
                ),
              ),
            ),
          );
        }
        return const Scaffold(
          backgroundColor: Color(AppConstants.deepPlum),
          body: Center(child: CircularProgressIndicator(color: AppTheme.gold)),
        );
      },
    );
  }
}
