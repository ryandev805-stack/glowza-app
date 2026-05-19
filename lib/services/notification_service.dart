import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

class NotificationService {
  NotificationService({FirebaseMessaging? messaging})
    : _messaging = messaging ?? FirebaseMessaging.instance;

  static const _webVapidKey = String.fromEnvironment(
    'GLOWZA_WEB_FCM_VAPID_KEY',
  );

  final FirebaseMessaging _messaging;

  Future<String?> requestAndGetToken() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return null;
    }
    if (kIsWeb && _webVapidKey.isEmpty) {
      debugPrint(
        'Glowza notification token skipped: GLOWZA_WEB_FCM_VAPID_KEY is not set.',
      );
      return null;
    }
    if (kIsWeb) {
      return _messaging.getToken(vapidKey: _webVapidKey);
    }
    return _messaging.getToken();
  }

  String get platform {
    if (kIsWeb) {
      return 'web';
    }
    return defaultTargetPlatform.name;
  }
}
