# Glow Grid Survival Architecture

## Purpose

Glow Grid Survival is a mobile-first Phaser game built for Glowza's future Games & Rewards section. It is hosted independently on Vercel and can be loaded inside the Flutter app through a WebView.

## Core Gameplay

- Portrait endless survival puzzle game.
- 6 x 8 strategic match board.
- Pressure rises over time.
- Blockers spawn as waves become harder.
- Matching tiles lowers pressure and increases combo score.
- Waves last 42 seconds.
- Between waves, players choose upgrades.
- Runs can last 5-20 minutes depending on skill.

## Game Loop

```text
Hub
  -> Start run
  -> Match tiles
  -> Clear blockers
  -> Survive pressure
  -> Complete wave
  -> Choose upgrade
  -> Optional bonus chest ad
  -> Continue
  -> Fail
  -> Optional revive ad
  -> Summary
  -> Rewards / missions / retry
```

## Scenes

```text
BootScene
  Generates lightweight procedural textures.

HubScene
  Wallet, streak, level, daily missions, local leaderboard.

GameScene
  Main survival board, waves, pressure, blockers, combos, upgrades, revive hook.

SummaryScene
  Run result, reward preview, mission claims, double-reward hook, retry loop.
```

## Systems

```text
services/bridge.js
  Flutter WebView bridge, rewarded ad request/result events.

services/backendClient.js
  Placeholder API client for future Firebase Cloud Functions or backend APIs.

services/storage.js
  Local profile, wallet, streak, missions, achievements, local leaderboard.

systems/rewardEngine.js
  Coins, gems, XP, caps, mission claiming, level math.

systems/antiAbuse.js
  Idle detection, input cadence, focus loss, impossible score-jump signals.
```

## Rewarded Ad Hooks

Ad placements are optional:

```text
revive
double_rewards
bonus_loot
```

The game emits:

```js
{
  type: 'ad_requested',
  requestId,
  placement,
  context
}
```

Flutter should show AdMob rewarded video, then call:

```js
window.GlowzaGame.onRewardedAdResult(requestId, true, {
  network: 'admob',
  adUnitId: '...',
});
```

If the ad fails or user closes it:

```js
window.GlowzaGame.onRewardedAdResult(requestId, false, {
  reason: 'closed',
});
```

## Backend Integration Points

Replace `src/services/backendClient.js` with Cloud Functions calls later:

```text
POST /gameSessions/start
POST /gameSessions/:id/events
POST /gameSessions/:id/end
POST /rewardedAds/verify
POST /rewards/claim
POST /leaderboards/submit
```

For Flutter + Firebase, these can be callable Cloud Functions:

```text
startGameSession()
recordGameEvent()
finishGameSession()
verifyRewardedAd()
claimGameReward()
submitLeaderboardScore()
```

## Firestore Collections Later

```text
game_sessions
reward_wallets
reward_ledger
daily_missions
user_missions
achievements
leaderboards
ad_reward_events
suspicious_events
coupons
```

## Anti-Abuse Strategy

Client emits telemetry only. Final rewards must be verified server-side.

Signals:

- session duration
- input count
- idle time
- average input interval
- focus losses
- score jumps
- ad completion metadata
- wave reached
- tiles cleared
- combo max

Server should reject or reduce rewards when:

- session is too short
- no meaningful inputs
- impossible score changes
- too many ad-assisted rewards
- daily caps reached
- repeated identical payloads
- suspicious device/user pattern

## Reward Economy

User sees:

```text
coins
gems
XP
missions
badges
streak
```

Backend should privately control:

```text
daily caps
reward cost
ad revenue estimate
abuse score
coupon value
minimum order value
expiration
```

Coupons should remain low-cost:

```text
PKR 30-100 off
free shipping
minimum order value required
expires in 3-7 days
one coupon per order
```

## Future Expansion

The project is ready for:

- new game modes
- seasonal waves
- tournaments
- skins
- global leaderboards
- cloud saves
- special event missions
- product-linked rewards
- multiplayer later

Add new scenes under `src/scenes` and shared logic under `src/systems`.
