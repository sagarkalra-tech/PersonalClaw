import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Skill, SkillMeta } from '../types/skill.js';
import { skillLock } from '../core/skill-lock.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

const execAsync = promisify(exec);

function escapePy(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function runPyScript(code: string, timeoutMs = 30000): Promise<any> {
  const tempFile = path.join(process.cwd(), `temp_desktop_${Date.now()}.py`);
  try {
    fs.writeFileSync(tempFile, code);
    const { stdout, stderr } = await execAsync(`python "${tempFile}"`, { timeout: timeoutMs });
    try { return JSON.parse(stdout.trim()); }
    catch { return { raw_output: stdout.trim(), stderr: stderr.trim() }; }
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

export const desktopAutomationSkill: Skill = {
  name: 'desktop_automation',
  description: `Windows desktop application automation via pywinauto. Use this to interact with ANY native Windows application — Notepad, Excel, VS Code, File Explorer, Settings, etc. This is different from browser automation: use browser tools for web pages, use desktop_automation for native Windows UI.

Requires pywinauto installed: pip install pywinauto

Actions:
- list_windows: List all visible top-level windows with title, handle, rect, process_id.
- focus_window(title): Bring a window to the foreground by partial title match.
- inspect_controls(title, depth?): List all UI controls/elements in a window (buttons, text fields, menus, etc.).
- click_control(title, control, click_type?): Click a control by name or automation_id. Supports left, right, double click.
- type_text(title, control, text, clear_first?): Type text into an input control.
- get_text(title, control): Read text content from a control.
- send_keys(title, keys): Send keyboard shortcuts/hotkeys to a window (e.g. Ctrl+S, Alt+F4).
- wait_for_window(title, timeout?): Wait for a window with a matching title to appear.
- launch_app(app_path, app_args?, title?, timeout?): Launch an application, wait for its window to appear, return handle + rect. Completes the full lifecycle: launch → interact → close.
- screenshot_window(title, prompt?): Capture a screenshot of a specific window and optionally analyze it with Gemini Vision. Returns the saved image path and AI analysis. Use this when UI Automation controls are unreliable — gives you "eyes" on any native app.

Use inspect_controls first to discover what controls are available in a window, then interact with them using click_control, type_text, etc. If controls are hard to find (legacy apps, custom UI), use screenshot_window to see the window visually.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_windows', 'focus_window', 'inspect_controls', 'click_control', 'type_text', 'get_text', 'send_keys', 'wait_for_window', 'launch_app', 'screenshot_window'],
        description: 'The desktop automation action to perform.',
      },
      title: {
        type: 'string',
        description: 'Partial window title to match (required for all actions except list_windows).',
      },
      control: {
        type: 'string',
        description: 'Control name or automation_id to target (required for click_control, type_text, get_text).',
      },
      text: {
        type: 'string',
        description: 'Text to type (required for type_text).',
      },
      keys: {
        type: 'string',
        description: 'Keyboard keys/shortcuts to send (required for send_keys). Use pywinauto key syntax, e.g. "{VK_CONTROL down}s{VK_CONTROL up}" for Ctrl+S.',
      },
      click_type: {
        type: 'string',
        enum: ['left', 'right', 'double'],
        description: 'Click type for click_control (default: left).',
      },
      depth: {
        type: 'number',
        description: 'Max depth for inspect_controls (default: 3).',
      },
      clear_first: {
        type: 'boolean',
        description: 'Clear existing text before typing (default: false).',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds for wait_for_window and launch_app (default: 10).',
      },
      app_path: {
        type: 'string',
        description: 'Path or name of application to launch (required for launch_app). Can be a full path like "C:\\\\Windows\\\\notepad.exe" or just "notepad".',
      },
      app_args: {
        type: 'string',
        description: 'Command-line arguments for the application (optional for launch_app).',
      },
      prompt: {
        type: 'string',
        description: 'Vision analysis prompt for screenshot_window (optional). If provided, the screenshot is sent to Gemini Vision with this prompt and the analysis is returned. If omitted, just captures and saves the screenshot.',
      },
    },
    required: ['action'],
  },
  run: async (args: any, meta: SkillMeta) => {
    const lockHolder = {
      agentId: meta.agentId,
      conversationId: meta.conversationId,
      conversationLabel: meta.conversationLabel ?? 'unknown',
      operation: `desktop_automation:${args.action}`,
      acquiredAt: new Date(),
    };

    const release = await skillLock.acquireExclusive('desktop', lockHolder);

    try {
      switch (args.action) {
        case 'list_windows': {
          const code = `from pywinauto import Desktop
import json
desk = Desktop(backend='uia')
windows = []
for w in desk.windows():
  try:
    if w.is_visible() and w.window_text():
      r = w.rectangle()
      windows.append({"title": w.window_text(), "handle": w.handle, "rect": {"left": r.left, "top": r.top, "right": r.right, "bottom": r.bottom}, "process_id": w.process_id()})
  except: pass
print(json.dumps(windows))
`;
          return await runPyScript(code);
        }

        case 'focus_window': {
          if (!args.title) return { error: 'title is required for focus_window' };
          const title = escapePy(args.title);
          const code = `from pywinauto import Desktop
import json
desk = Desktop(backend='uia')
wins = [w for w in desk.windows() if w.is_visible() and "${title}" in w.window_text()]
if not wins: print(json.dumps({"error": "Window not found"}))
else:
  w = wins[0]
  w.set_focus()
  print(json.dumps({"focused": w.window_text(), "handle": w.handle}))
`;
          return await runPyScript(code);
        }

        case 'inspect_controls': {
          if (!args.title) return { error: 'title is required for inspect_controls' };
          const title = escapePy(args.title);
          const depth = args.depth ?? 3;
          const code = `from pywinauto import Desktop
import json
desk = Desktop(backend='uia')
wins = [w for w in desk.windows() if w.is_visible() and "${title}" in w.window_text()]
if not wins: print(json.dumps({"error": "Window not found"}))
else:
  controls = []
  def walk(ctrl, d=0):
    if d > ${depth}: return
    try:
      r = ctrl.rectangle()
      controls.append({"name": ctrl.window_text(), "type": ctrl.element_info.control_type, "auto_id": ctrl.element_info.automation_id, "rect": {"left": r.left, "top": r.top, "right": r.right, "bottom": r.bottom}, "enabled": ctrl.is_enabled()})
    except: pass
    if d < ${depth}:
      try:
        for c in ctrl.children(): walk(c, d+1)
      except: pass
  walk(wins[0])
  print(json.dumps(controls))
`;
          return await runPyScript(code);
        }

        case 'click_control': {
          if (!args.title) return { error: 'title is required for click_control' };
          if (!args.control) return { error: 'control is required for click_control' };
          const title = escapePy(args.title);
          const control = escapePy(args.control);
          const clickType = args.click_type ?? 'left';
          const code = `from pywinauto import Desktop
import json
desk = Desktop(backend='uia')
wins = [w for w in desk.windows() if w.is_visible() and "${title}" in w.window_text()]
if not wins: print(json.dumps({"error": "Window not found"}))
else:
  w = wins[0]
  w.set_focus()
  try:
    ctrl = w.child_window(best_match="${control}")
    if "${clickType}" == "right": ctrl.click_input(button="right")
    elif "${clickType}" == "double": ctrl.double_click_input()
    else: ctrl.click_input()
    print(json.dumps({"clicked": ctrl.window_text(), "type": ctrl.element_info.control_type}))
  except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
          return await runPyScript(code);
        }

        case 'type_text': {
          if (!args.title) return { error: 'title is required for type_text' };
          if (!args.control) return { error: 'control is required for type_text' };
          if (args.text === undefined) return { error: 'text is required for type_text' };
          const title = escapePy(args.title);
          const control = escapePy(args.control);
          const text = escapePy(args.text);
          const clearFirst = args.clear_first ? 'True' : 'False';
          const code = `from pywinauto import Desktop
import json
desk = Desktop(backend='uia')
wins = [w for w in desk.windows() if w.is_visible() and "${title}" in w.window_text()]
if not wins: print(json.dumps({"error": "Window not found"}))
else:
  w = wins[0]
  w.set_focus()
  try:
    ctrl = w.child_window(best_match="${control}")
    if ${clearFirst}: ctrl.set_edit_text("")
    ctrl.type_keys("${text}", with_spaces=True, pause=0.02)
    print(json.dumps({"typed": len("${text}"), "control": ctrl.window_text()}))
  except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
          return await runPyScript(code);
        }

        case 'get_text': {
          if (!args.title) return { error: 'title is required for get_text' };
          if (!args.control) return { error: 'control is required for get_text' };
          const title = escapePy(args.title);
          const control = escapePy(args.control);
          const code = `from pywinauto import Desktop
import json
desk = Desktop(backend='uia')
wins = [w for w in desk.windows() if w.is_visible() and "${title}" in w.window_text()]
if not wins: print(json.dumps({"error": "Window not found"}))
else:
  w = wins[0]
  w.set_focus()
  try:
    ctrl = w.child_window(best_match="${control}")
    text = ctrl.window_text()
    try: text = ctrl.texts()[0] if ctrl.texts() else text
    except: pass
    print(json.dumps({"text": text, "control_type": ctrl.element_info.control_type}))
  except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
          return await runPyScript(code);
        }

        case 'send_keys': {
          if (!args.title) return { error: 'title is required for send_keys' };
          if (!args.keys) return { error: 'keys is required for send_keys' };
          const title = escapePy(args.title);
          const keys = escapePy(args.keys);
          const code = `from pywinauto import Desktop
import json
desk = Desktop(backend='uia')
wins = [w for w in desk.windows() if w.is_visible() and "${title}" in w.window_text()]
if not wins: print(json.dumps({"error": "Window not found"}))
else:
  w = wins[0]
  w.set_focus()
  try:
    w.type_keys("${keys}", pause=0.02)
    print(json.dumps({"sent_keys": "${keys}", "window": w.window_text()}))
  except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
          return await runPyScript(code);
        }

        case 'wait_for_window': {
          if (!args.title) return { error: 'title is required for wait_for_window' };
          const title = escapePy(args.title);
          const timeout = args.timeout ?? 10;
          const code = `from pywinauto import Desktop
import json, time
desk = Desktop(backend='uia')
deadline = time.time() + ${timeout}
found = None
while time.time() < deadline:
  for w in desk.windows():
    try:
      if w.is_visible() and "${title}" in w.window_text():
        found = w
        break
    except: pass
  if found: break
  time.sleep(0.5)
if found:
  r = found.rectangle()
  print(json.dumps({"found": True, "title": found.window_text(), "handle": found.handle, "rect": {"left": r.left, "top": r.top, "right": r.right, "bottom": r.bottom}}))
else:
  print(json.dumps({"found": False, "error": "Window not found within timeout"}))
`;
          return await runPyScript(code, (timeout + 5) * 1000);
        }

        case 'launch_app': {
          if (!args.app_path) return { error: 'app_path is required for launch_app' };
          const appPath = escapePy(args.app_path);
          const appArgs = args.app_args ? escapePy(args.app_args) : '';
          const title = args.title ? escapePy(args.title) : '';
          const timeout = args.timeout ?? 10;
          // Use the app's basename (without extension) as default title match
          const code = `import subprocess, json, time
from pywinauto import Desktop

app_path = "${appPath}"
app_args = "${appArgs}"
title_match = "${title}"

# Launch the app
cmd = [app_path] + ([app_args] if app_args else [])
try:
  proc = subprocess.Popen(cmd, shell=True)
except Exception as e:
  print(json.dumps({"error": f"Failed to launch: {e}"}))
  exit()

# Derive title match from app name if not provided
if not title_match:
  import os
  title_match = os.path.splitext(os.path.basename(app_path))[0]

# Wait for the window to appear
desk = Desktop(backend='uia')
deadline = time.time() + ${timeout}
found = None
while time.time() < deadline:
  for w in desk.windows():
    try:
      if w.is_visible() and title_match.lower() in w.window_text().lower():
        found = w
        break
    except: pass
  if found: break
  time.sleep(0.5)

if found:
  r = found.rectangle()
  print(json.dumps({"launched": True, "title": found.window_text(), "handle": found.handle, "process_id": proc.pid, "rect": {"left": r.left, "top": r.top, "right": r.right, "bottom": r.bottom}}))
else:
  print(json.dumps({"launched": True, "window_found": False, "process_id": proc.pid, "error": f"App launched (PID {proc.pid}) but window with title containing '{title_match}' not found within {${timeout}}s"}))
`;
          return await runPyScript(code, (timeout + 10) * 1000);
        }

        case 'screenshot_window': {
          if (!args.title) return { error: 'title is required for screenshot_window' };
          const title = escapePy(args.title);
          if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
          const filename = `window_${Date.now()}.png`;
          const filePath = path.join(SCREENSHOTS_DIR, filename);
          const filePathPy = escapePy(filePath);

          // Step 1: Capture just the target window's region
          const code = `from pywinauto import Desktop
import json
try:
  from PIL import ImageGrab
except ImportError:
  print(json.dumps({"error": "Pillow is required for window screenshots. Run: pip install Pillow"}))
  exit()

desk = Desktop(backend='uia')
wins = [w for w in desk.windows() if w.is_visible() and "${title}" in w.window_text()]
if not wins:
  print(json.dumps({"error": "Window not found"}))
else:
  w = wins[0]
  w.set_focus()
  import time
  time.sleep(0.3)
  r = w.rectangle()
  img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom))
  img.save("${filePathPy}")
  print(json.dumps({"captured": True, "title": w.window_text(), "path": "${filePathPy}", "rect": {"left": r.left, "top": r.top, "right": r.right, "bottom": r.bottom}, "size": {"width": r.right - r.left, "height": r.bottom - r.top}}))
`;
          const captureResult = await runPyScript(code);

          if (captureResult?.error) return captureResult;
          if (!captureResult?.captured) return { error: 'Screenshot capture failed', details: captureResult };

          // Step 2: If a prompt is given, analyze with Gemini Vision
          if (args.prompt && fs.existsSync(filePath)) {
            try {
              const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
              const imageData = fs.readFileSync(filePath);
              const result = await model.generateContent([
                args.prompt,
                {
                  inlineData: {
                    data: Buffer.from(imageData).toString('base64'),
                    mimeType: 'image/png',
                  },
                },
              ]);
              const response = await result.response;
              return {
                ...captureResult,
                analysis: response.text(),
              };
            } catch (visionErr: any) {
              return {
                ...captureResult,
                vision_error: visionErr.message,
              };
            }
          }

          return captureResult;
        }

        default:
          return { error: `Unknown action: ${args.action}. Valid actions: list_windows, focus_window, inspect_controls, click_control, type_text, get_text, send_keys, wait_for_window, launch_app, screenshot_window` };
      }
    } finally {
      release();
    }
  },
};
