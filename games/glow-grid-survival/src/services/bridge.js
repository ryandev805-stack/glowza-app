import { GAME_ID } from '../config/gameConfig.js';

const pendingAds = new Map();

function emit(payload) {
  const event = {
    gameId: GAME_ID,
    timestamp: Date.now(),
    ...payload,
  };

  if (window.ReactNativeWebView?.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify(event));
  }
  if (window.GlowzaGameBridge?.postMessage) {
    window.GlowzaGameBridge.postMessage(JSON.stringify(event));
  }
  window.dispatchEvent(new CustomEvent('glowza-game-event', { detail: event }));
  return event;
}

export const GameBridge = {
  emit,
  sessionStarted(session) {
    return emit({ type: 'session_started', session });
  },
  sessionEvent(sessionId, eventType, data = {}) {
    return emit({ type: 'session_event', sessionId, eventType, data });
  },
  sessionEnded(summary) {
    return emit({ type: 'session_ended', summary });
  },
  rewardPreview(reward) {
    return emit({ type: 'hidden_reward_signal', reward });
  },
  async requestRewardedAd(placement, context = {}) {
    const requestId = `ad_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    emit({ type: 'ad_requested', requestId, placement, context });

    const result = await new Promise((resolve) => {
      pendingAds.set(requestId, resolve);
      window.setTimeout(() => {
        if (pendingAds.has(requestId)) {
          pendingAds.delete(requestId);
          resolve({ completed: false, reason: 'timeout' });
        }
      }, 45000);
    });
    emit({ type: 'ad_result', requestId, placement, result });
    return result;
  },
};

window.GlowzaGame = window.GlowzaGame || {};
window.GlowzaGame.onRewardedAdResult = (requestId, completed, metadata = {}) => {
  const resolve = pendingAds.get(requestId);
  if (!resolve) return;
  pendingAds.delete(requestId);
  resolve({ completed: Boolean(completed), ...metadata });
};

if (import.meta.env.DEV) {
  window.GlowzaGame.devCompleteAd = () => {
    const first = pendingAds.keys().next().value;
    if (first) window.GlowzaGame.onRewardedAdResult(first, true, { network: 'dev-simulator' });
  };
}
