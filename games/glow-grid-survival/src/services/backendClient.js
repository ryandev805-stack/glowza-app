export const BackendClient = {
  async startSession(payload) {
    return {
      sessionId: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      serverTime: Date.now(),
      config: {
        rewardMultiplier: 1,
        dailyCapEnabled: true,
      },
      payload,
    };
  },

  async submitEvent(sessionId, event) {
    return { ok: true, sessionId, event };
  },

  async endSession(sessionId, summary) {
    return {
      ok: true,
      sessionId,
      verified: true,
      summary,
    };
  },
};
