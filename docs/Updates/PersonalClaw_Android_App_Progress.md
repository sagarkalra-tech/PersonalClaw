# PersonalClaw Android App — Build Progress

**Last updated:** 2026-03-23 (session 2)
**App package:** `com.personalclaw.app`
**Expo SDK:** 55 (bare workflow)
**React Native:** 0.83.2

---

## Status: Phases 0–8 Complete ✅

---

## Phases Completed

### Phase 0 — Pre-flight fixes
- Fixed package ID: `com.personalclaw.PersonalClawApp` → `com.personalclaw.app`
- Updated `android/app/build.gradle` namespace + applicationId
- Moved Kotlin files to `com/personalclaw/app/` package
- Fixed all Expo SDK version mismatches to SDK 55
- Added `"main": "expo-router/entry"` to package.json
- Added scheme `"personalclaw"` to app.json
- Added `metro.config.js` with punycode shim (fixes markdown-it 500 error)
- Pinned Gradle to 8.13 (9.0.0 breaks RN with IBM_SEMERU field removal)

### Phase 1 — Backend push notifications
- Installed `expo-server-sdk` on backend
- `POST /api/push/register` and `DELETE /api/push/register` endpoints
- Push triggers on: blocker created, proposal created, worker completed, worker failed
- Tokens persisted to `data/push-tokens.json`

### Phase 2 — Expo Router structure
- `app/_layout.tsx` — root Stack with auth guard
- `app/(tabs)/_layout.tsx` — 5-tab layout: Chat, Orgs, Activity, Metrics, Settings
- `app/auth.tsx` — biometric + PIN auth screen
- `app/org/[orgId].tsx` — org detail screen (dynamic route)

### Phase 3 — Core services
- `services/socket.ts` — SocketService singleton, polling+WS transport, AppState reconnect
- `services/api.ts` — REST wrapper (GET/POST/DELETE)
- `services/secure-store.ts` — expo-secure-store wrapper
- `services/biometric.ts` — expo-local-authentication wrapper
- `services/push-notifications.ts` — Expo push token registration, Android channel, notification categories
- `services/voice.ts` — expo-audio recording + STT upload helper
- `store/index.ts` — Zustand stores: Auth, Connection, Chat, Orgs, Activity, Metrics
- `constants/index.ts` — server URL, secure store keys, reauth timeout
- `types/index.ts` — all TypeScript types

### Phase 4 — Chat tab
- Conversation switcher (horizontal pills, max 3, +/× buttons)
- FlatList inverted with MessageBubble (markdown rendering via `@ronradtke/react-native-markdown-display`)
- TypingIndicator (animated 3-dot bounce)
- ToolBanner (active tool name + elapsed timer)
- WorkerPanel (collapsible sub-agent list)
- Auto-expanding TextInput, Send/Stop buttons
- History loaded via `conversation:history` socket event

### Phase 5 — Voice + Image
- **Mic button** (hold to talk): `expo-audio` records → POSTs to `/api/voice/transcribe` → Gemini 1.5 Flash transcribes → text fills input
- **TTS toggle** (🔊): `expo-speech` speaks every AI reply; mutable per session
- **Image attach** (🖼️): `expo-image-picker` → base64 → sent with socket message (backend already handles image uploads)
- Backend: added `multer` + `/api/voice/transcribe` endpoint using Gemini

### Phase 6 — Orgs tab
- `app/(tabs)/orgs.tsx` — org list with cards, pause/resume Switch, pull-to-refresh
- `app/org/[orgId].tsx` — org detail with 5-tab internal nav (Agents / Tickets / Proposals / Blockers / Memory)
- `components/orgs/AgentsView.tsx` — 2-column grid, status dots, trigger/pause controls, real-time run updates
- `components/orgs/TicketsView.tsx` — horizontal kanban board (Open / In Progress / Blocked / Done)
- `components/orgs/ProposalsView.tsx` — pending/resolved proposals, Approve/Reject buttons
- `components/orgs/BlockersView.tsx` — open/resolved blockers, Mark Resolved with confirmation alert
- `components/orgs/MemoryView.tsx` — scoped memory browser (Shared + per-agent tabs), search, expandable entries
- Backend: added `org:proposal:action` unified handler, `org:memory:list` handler

### Phase 7 — Activity + Metrics tabs
- `app/(tabs)/activity.tsx` — real-time event stream, type-based icon/color, clear button, live count badge
- `app/(tabs)/metrics.tsx` — CPU ring gauge, RAM bar, Disk bar, animated fills, stat chips, live updates

### Phase 8 — Push notifications
- `services/push-notifications.ts` — permission request, token registration, Android notification channel, notification categories
- Notification categories: `proposal` (Approve/Reject inline), `blocker` (Resolve inline)
- `app/_layout.tsx` — notification response listener, deep-links to correct org tab on tap, cold-start handling
- `app/org/[orgId].tsx` — reads `tab` URL param to open correct tab from deep-link
- Backend: `categoryId` added to push messages, `blockerId` included in blocker payloads

---

## Settings Screen
- Server URL input + Test button (REST ping) + Save & Reconnect
- Connection status dot (green/red)
- Lock App button

---

## Known Issues / Pending

### 🔴 Push notifications not working (FCM not configured)
**Error:** `Default FirebaseApp is not initialized in this process com.personalclaw.app`
**Cause:** Expo push notifications on Android require Firebase Cloud Messaging (FCM). Need `google-services.json`.
**Fix:**
1. Go to [Firebase Console](https://console.firebase.google.com) → Create project
2. Add Android app with package `com.personalclaw.app`
3. Download `google-services.json` → place in `android/app/`
4. Rebuild: `npx expo run:android`

### ✅ Notification sound 'default' warning — FIXED
**Was:** `expo-notifications: Custom sound 'default' not found in native app`
**Fix applied:** Removed `sound: 'default'` from Android notification channel in `services/push-notifications.ts` — system default sound is used instead, no bundled file needed.

### 🟡 Socket connection errors (xhr poll error)
**Cause:** Default server URL was changed to `https://api.utilization-tracker.online` which isn't live yet (Cloudflare tunnel not set up).
**Fix:** Either revert default URL to LAN IP temporarily, OR complete the Cloudflare tunnel setup (domain is ready: `utilization-tracker.online`).
**Temporary fix:** In app Settings, manually enter the LAN IP `http://192.168.1.4:3000`

---

## Cloudflare Tunnel Setup (In Progress)
- Domain: `utilization-tracker.online` (idle, needs to be added to Cloudflare)
- Target subdomain: `api.utilization-tracker.online`
- Default URL in constants already updated to `https://api.utilization-tracker.online`
- Steps remaining:
  1. Add domain to Cloudflare (change nameservers at registrar)
  2. `winget install Cloudflare.cloudflared`
  3. `cloudflared tunnel login`
  4. `cloudflared tunnel create personalclaw`
  5. `cloudflared tunnel route dns personalclaw api.utilization-tracker.online`
  6. `cloudflared tunnel run --url http://localhost:3000 personalclaw`
  7. `cloudflared service install` (auto-start on boot)

---

## Phase 9 — Production Build (TODO)
- Generate upload keystore
- `eas build --platform android --profile production` → signed AAB
- Upload to Play Store internal testing track
- Promote to production

## Phase 5 Voice (needs end-to-end test)
- `expo-audio` `prepareToRecordAsync` API may need minor adjustment once tested on device
- Test voice recording end-to-end once connected to server
- TTS and image picker can be tested independently — no server dependency

## Firebase / FCM Setup (TODO — needed for push notifications)
1. [console.firebase.google.com](https://console.firebase.google.com) → New project (free)
2. Add Android app → package name: `com.personalclaw.app`
3. Download `google-services.json` → place in `PersonalClawApp/android/app/`
4. Rebuild: `npx expo run:android`
- Firebase is ONLY used as the Android push delivery pipe (FCM). Not used for auth, DB, or anything else.

---

## Key Files

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Root layout, socket init, push notification wiring |
| `app/auth.tsx` | Biometric + PIN auth |
| `app/(tabs)/_layout.tsx` | Tab bar with connection dot |
| `app/(tabs)/index.tsx` | Chat screen (voice, TTS, image) |
| `app/(tabs)/orgs.tsx` | Org list |
| `app/(tabs)/activity.tsx` | Activity feed |
| `app/(tabs)/metrics.tsx` | System metrics |
| `app/(tabs)/settings.tsx` | Server URL + lock |
| `app/org/[orgId].tsx` | Org detail (5 tabs) |
| `components/orgs/AgentsView.tsx` | Agent grid |
| `components/orgs/TicketsView.tsx` | Kanban board |
| `components/orgs/ProposalsView.tsx` | Proposals |
| `components/orgs/BlockersView.tsx` | Blockers |
| `components/orgs/MemoryView.tsx` | Memory browser |
| `services/socket.ts` | Socket.io singleton |
| `services/push-notifications.ts` | Push token + categories |
| `services/voice.ts` | Audio recording + STT upload |
| `store/index.ts` | All Zustand stores |
| `constants/index.ts` | Server URL, keys |
| `types/index.ts` | TypeScript types |

---

## Backend Changes Made for App

| Change | File |
|--------|------|
| Push token register/unregister endpoints | `src/index.ts` |
| `org:proposal:action` unified socket handler | `src/index.ts` |
| `org:memory:list` socket handler | `src/index.ts` |
| `org:tickets:list`, `org:proposals:list`, `org:blockers:list`, `org:memory:list` added to SERVER_EVENTS | `services/socket.ts` |
| Push `categoryId` for inline actions | `src/index.ts` |
| `blockerId` included in blocker push payload | `src/index.ts` |
| `/api/voice/transcribe` endpoint (multer + Gemini) | `src/index.ts` |
| `multer` package installed | `package.json` |
