# Glow Grid Survival

Mobile-first Phaser game for Glowza's Games & Rewards section.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to Vercel

```bash
vercel
vercel --prod
```

## Flutter WebView bridge

The game emits events through:

- `window.ReactNativeWebView.postMessage(JSON.stringify(payload))`
- `window.GlowzaGameBridge.postMessage(payload)`
- browser `CustomEvent('glowza-game-event')`

Rewarded ad request event:

```json
{
  "type": "ad_requested",
  "placement": "revive",
  "requestId": "..."
}
```

Flutter should respond by calling:

```js
window.GlowzaGame.onRewardedAdResult(requestId, true, { network: "admob" })
```

Backend reward verification hooks are isolated in `src/services/backendClient.js`.
