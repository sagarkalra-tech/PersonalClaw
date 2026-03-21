import json
import time
import os
import sys
from pynput import mouse, keyboard

events = []
start_time = time.time()
m_listener = None

def on_click(x, y, button, pressed):
    if pressed:
        events.append({"type": "click", "x": x, "y": y, "time": time.time() - start_time})
        print(f"  Click {len([e for e in events if e['type'] == 'click'])} recorded at ({x}, {y})")

def on_press(key):
    try:
        k = key.char
    except AttributeError:
        k = str(key)

    events.append({"type": "key", "key": k, "time": time.time() - start_time})

    if key == keyboard.Key.esc:
        click_count = len([e for e in events if e["type"] == "click"])
        print(f"\n--- RECORDING STOPPED ---")
        print(f"Recorded {click_count} clicks and {len(events) - click_count} key events.")

        output_file = output_filename
        with open(output_file, "w") as f:
            json.dump(events, f, indent=2)
        print(f"Saved to: {output_file}")

        # Show click summary
        print("\nClick summary:")
        for i, e in enumerate([e for e in events if e["type"] == "click"], 1):
            print(f"  Click {i}: ({e['x']}, {e['y']}) at t={e['time']:.2f}s")

        m_listener.stop()
        return False

# --- Determine output filename from argument ---
if len(sys.argv) < 2:
    print("Usage: python Teacher.py <platform>")
    print("  python Teacher.py linkedin   → saves linkedin_steps.json")
    print("  python Teacher.py twitter    → saves twitter_steps.json")
    print("  python Teacher.py instagram  → saves instagram_steps.json")
    sys.exit(1)

platform = sys.argv[1].lower()
output_filename = f"{platform}_steps.json"

# --- Platform-specific instructions ---
instructions = {
    "linkedin": [
        "1. Make sure Chrome is open on LinkedIn HOME FEED (linkedin.com/feed)",
        "2. Page must NOT be scrolled — 'Start a post' bar visible at top",
        "3. Chrome zoom must be 100% (Ctrl+0 to reset)",
        "4. Click the 'Start a post' box",
        "5. Click inside the text area that appears",
        "6. Type a few words of dummy text",
        "7. Click the 'Post' button to submit",
        "8. Press ESC to stop recording",
        "",
        "You need exactly 3 clicks recorded.",
    ],
    "twitter": [
        "1. Make sure Chrome is open on X/Twitter HOME (x.com/home)",
        "2. Page must NOT be scrolled — compose box visible at top",
        "3. Chrome zoom must be 100% (Ctrl+0 to reset)",
        "4. Click inside the 'What is happening?!' compose box",
        "5. Type a few words of dummy text",
        "6. Click the 'Post' button (blue button, top right of compose box)",
        "7. Press ESC to stop recording",
        "",
        "You need exactly 2 clicks recorded.",
    ],
    "instagram": [
        "1. Make sure Chrome is open on Instagram (instagram.com)",
        "2. Click the '+ Create' button in the left sidebar",
        "3. Follow the upload flow for your post type",
        "4. Press ESC to stop recording",
    ],
}

print(f"\n=== TEACHER.PY — Recording for: {platform.upper()} ===")
print(f"Output file: {output_filename}\n")

if platform in instructions:
    print("BEFORE YOU START:")
    for line in instructions[platform]:
        print(f"  {line}")
else:
    print(f"No specific instructions for '{platform}'. Record your clicks and press ESC when done.")

print("\n--- RECORDING STARTED — Perform your actions now ---\n")

with mouse.Listener(on_click=on_click) as m:
    m_listener = m
    with keyboard.Listener(on_press=on_press) as k_listener:
        k_listener.join()