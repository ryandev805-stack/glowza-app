import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart' hide AppState;

import 'app.dart';
import 'providers/app_state.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  if (!kIsWeb) {
    await MobileAds.instance.initialize();
  }

  final appState = AppState();
  await appState.loadSavedState();

  runApp(
    ChangeNotifierProvider.value(value: appState, child: const GlowzaApp()),
  );
}
