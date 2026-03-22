# PersonalClaw v12.8 — Complete Setup Guide

Everything you need to get PersonalClaw running on your machine, including the optional Android app and remote access.

---

## Prerequisites

| Requirement | Required? | How to get it |
|-------------|-----------|---------------|
| **Node.js 18+** | Yes | [nodejs.org](https://nodejs.org/) |
| **Git** | Yes | [git-scm.com](https://git-scm.com/) |
| **Google Gemini API Key** | Yes | Free at [AI Studio](https://aistudio.google.com/) |
| **Chrome Browser** | Recommended | For browser automation + extension relay |
| **Python 3.8+** | Optional | For `run_python_script` skill and Twitter/LinkedIn automation |
| **Android Studio** | Optional | Only if building the Android app |
| **Cloudflare Account** | Optional | Only for remote access (mobile app outside local WiFi) |

---

## 1. Quick Start (Desktop Only)

### Clone & Setup
```bash
git clone https://github.com/sagarkalra-tech/PersonalClaw.git
cd PersonalClaw
setup.bat
```

The setup wizard will:
- Install backend dependencies (Node.js packages)
- Install Playwright browser (for browser automation)
- Install dashboard UI dependencies
- Optionally check Python installation
- Create your `.env` file and prompt for your Gemini API key
- Optionally configure Telegram bot
- Create required directories

### Run
```bash
start.bat
```

This launches the backend (port 3000) and dashboard (port 5173) in separate terminals.
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 2. Chrome Extension (Browser Relay)

The extension lets PersonalClaw interact with your real Chrome tabs (not just its own Playwright browser).

1. Open `chrome://extensions` in Chrome
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load Unpacked** → select the `extension/` folder from the project
4. You'll see a green "ON" badge when connected
5. Type `/relay` in PersonalClaw chat to verify

---

## 3. Telegram Bot (Optional)

Control PersonalClaw from your phone via Telegram — useful for quick commands when you're away from your desk.

1. Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → get your **Bot Token**
2. Message [@userinfobot](https://t.me/userinfobot) to get your **Chat ID**
3. Add both to your `.env` file:
   ```
   TELEGRAM_BOT_TOKEN=your_token_here
   AUTHORIZED_CHAT_ID=your_chat_id_here
   ```
4. Restart the backend — the bot connects automatically

---

## 4. Android App (Optional)

Full mobile app for controlling PersonalClaw from your phone — chat, manage orgs, push notifications, voice input.

### Prerequisites
- **Android Studio** with Android SDK installed
- **Java 17+** (bundled with Android Studio at `Android Studio/jbr`)
- A physical Android device or emulator

### Install & Run

```bash
cd PersonalClawApp
npm install
```

Set `JAVA_HOME` if not already set (use Android Studio's bundled JDK):
```bash
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
```

Connect your Android device via USB (with USB debugging enabled) or start an emulator, then:
```bash
npx expo run:android
```

### Connect to Backend

**Same WiFi (simplest):**
1. Find your PC's local IP: `ipconfig` → look for `192.168.x.x`
2. Open the app → Settings tab → enter `http://192.168.x.x:3000`
3. The green dot should appear

**Remote Access (Cloudflare Tunnel):**
See [Section 6: Cloudflare Tunnel](#6-cloudflare-tunnel-remote-access) below.

### Push Notifications (Firebase FCM)

Push notifications let you receive AI responses, proposal alerts, and blocker notifications even when the app is backgrounded.

1. Go to [Firebase Console](https://console.firebase.google.com/) → Create a new project (or use existing)
2. Add an **Android app** with package name `com.personalclaw.app`
3. Download `google-services.json` → place it in `PersonalClawApp/android/app/`
4. Create a **Service Account key**:
   - Firebase Console → Project Settings → Service accounts
   - Click **Generate new private key** → download the JSON
5. Upload the key to Expo:
   ```bash
   cd PersonalClawApp
   npx eas-cli credentials -p android
   ```
   Select **production** → **Google Service Account** → upload the JSON file
6. Rebuild the app: `npx expo run:android`

### EAS Build (Production APK/AAB)

For a production build (Play Store or sideload):
```bash
cd PersonalClawApp
npx eas-cli build -p android --profile production
```

---

## 5. First Organisation

1. Open the Dashboard at [http://localhost:5173](http://localhost:5173)
2. Go to the **Organisations** tab in the sidebar
3. Click **Add Organisation** → provide a name, mission, and root directory path
4. Add agents (CEO, CTO, Developer, etc.) and set their heartbeat schedules
5. Create a ticket and watch the agents collaborate

---

## 6. Cloudflare Tunnel (Remote Access)

Cloudflare Tunnel exposes your local backend to the internet so the Android app (or Telegram) works from anywhere — no port forwarding or VPN needed.

### Setup

1. **Get a domain** — You need a domain managed by Cloudflare (even a free one works). Add it in [Cloudflare Dashboard](https://dash.cloudflare.com/) → DNS.

2. **Install cloudflared**:
   ```bash
   winget install Cloudflare.cloudflared
   ```

3. **Authenticate**:
   ```bash
   cloudflared tunnel login
   ```
   This opens a browser — select your domain.

4. **Create a tunnel**:
   ```bash
   cloudflared tunnel create personalclaw
   ```
   Note the **Tunnel ID** from the output.

5. **Add a DNS record**:
   ```bash
   cloudflared tunnel route dns personalclaw api.yourdomain.com
   ```
   Replace `api.yourdomain.com` with your preferred subdomain.

6. **Create config file** at `C:\Users\<you>\.cloudflared\config.yml`:
   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json

   ingress:
     - hostname: api.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

7. **Start the tunnel**:
   ```bash
   cloudflared tunnel run personalclaw
   ```

8. **Update the Android app** — Settings tab → enter `https://api.yourdomain.com`

### Run as Windows Service (auto-start on boot)
```bash
cloudflared service install
```

### Verify
- Visit `https://api.yourdomain.com/status` in a browser — you should see the PersonalClaw status JSON
- The Android app Settings screen should show a green connection dot

---

## 7. Environment Variables

All config lives in the `.env` file in the project root:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-3-flash-preview` | Primary AI model |
| `PORT` | No | `3000` | Backend server port |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot (from @BotFather) |
| `AUTHORIZED_CHAT_ID` | No | — | Lock Telegram bot to your chat ID |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `JAVA_HOME is not set` | `set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr` |
| `SDK location not found` | Create `PersonalClawApp/android/local.properties` with `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk` |
| Socket keeps disconnecting | Normal on mobile background — push notifications handle delivery |
| Push notifications not arriving | Ensure FCM service account key is uploaded to Expo (`npx eas-cli credentials`) |
| `npx expo run:android` fails | Ensure USB debugging is on and device is connected (`adb devices` to check) |
| Dashboard won't load | Check that both backend (port 3000) and dashboard (port 5173) terminals are running |
| Browser relay not connecting | Reload the Chrome extension and check the popup shows "Connected" |

---

*"Your machine, your command, anywhere."*
