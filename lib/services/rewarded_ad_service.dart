import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

class RewardedAdService {
  RewardedAd? _rewardedAd;
  bool _isLoading = false;
  Completer<bool>? _loadCompleter;

  static String get rewardedAdUnitId {
    if (kIsWeb) {
      return '';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'ca-app-pub-3940256099942544/5224354917';
    }
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return 'ca-app-pub-3940256099942544/1712485313';
    }
    return '';
  }

  Future<bool> load() async {
    if (kIsWeb || rewardedAdUnitId.isEmpty || _rewardedAd != null) {
      return _rewardedAd != null;
    }
    if (_isLoading) {
      return _loadCompleter?.future ?? false;
    }
    _isLoading = true;
    _loadCompleter = Completer<bool>();
    try {
      await RewardedAd.load(
        adUnitId: rewardedAdUnitId,
        request: const AdRequest(),
        rewardedAdLoadCallback: RewardedAdLoadCallback(
          onAdLoaded: (ad) {
            _rewardedAd = ad;
            _isLoading = false;
            _completeLoad(true);
          },
          onAdFailedToLoad: (error) {
            debugPrint('Glowza rewarded ad failed to load: $error');
            _isLoading = false;
            _completeLoad(false);
          },
        ),
      );
    } catch (error) {
      debugPrint('Glowza rewarded ad load exception: $error');
      _isLoading = false;
      _completeLoad(false);
    }
    return (_loadCompleter?.future ?? Future.value(_rewardedAd != null))
        .timeout(const Duration(seconds: 8), onTimeout: () => false);
  }

  void _completeLoad(bool loaded) {
    if (!(_loadCompleter?.isCompleted ?? true)) {
      _loadCompleter?.complete(loaded);
    }
    _loadCompleter = null;
  }

  Future<bool> show({required String placement}) async {
    if (kIsWeb || rewardedAdUnitId.isEmpty) {
      return false;
    }
    if (_rewardedAd == null) {
      final loaded = await load();
      if (!loaded) {
        debugPrint('Glowza rewarded ad unavailable for placement: $placement');
      }
    }
    final ad = _rewardedAd;
    if (ad == null) {
      return false;
    }
    _rewardedAd = null;
    var earned = false;
    final dismissed = Completer<bool>();
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        if (!dismissed.isCompleted) {
          dismissed.complete(earned);
        }
        unawaited(load());
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        debugPrint('Glowza rewarded ad failed to show: $error');
        ad.dispose();
        if (!dismissed.isCompleted) {
          dismissed.complete(false);
        }
        unawaited(load());
      },
    );
    try {
      await ad.show(
        onUserEarnedReward: (_, reward) {
          earned = true;
        },
      );
    } catch (error) {
      debugPrint('Glowza rewarded ad show exception: $error');
      ad.dispose();
      unawaited(load());
      return false;
    }
    return dismissed.future.timeout(
      const Duration(minutes: 2),
      onTimeout: () => earned,
    );
  }

  void dispose() {
    _rewardedAd?.dispose();
    _rewardedAd = null;
  }
}
