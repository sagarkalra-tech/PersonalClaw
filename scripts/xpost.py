import json
import time
import pyautogui
import pyperclip
import sys
import os

# --- Constants ---
MAX_TWEET_LENGTH = 280
CLICK_MOVE_DURATION = 0.4   # How smoothly the mouse moves (seconds)
PASTE_WAIT = 0.6            # Wait after pasting before next action
POST_WAIT = 2.0             # Wait after clicking Post for submission

def validate_steps(steps_file):
    """Validate the recorded steps file."""
    if not os.path.exists(steps_file):
        print(f"Error: {steps_file} not found.")
        print("Run: python Teacher.py twitter")
        sys.exit(1)

    with open(steps_file, "r") as f:
        steps = json.load(f)

    clicks = [s for s in steps if s["type"] == "click"]

    if len(clicks) < 2:
        print(f"Error: Expected 2 recorded clicks, found {len(clicks)}.")
        print("Need: (1) compose box click, (2) Post button click.")
        print("Run: python Teacher.py twitter")
        sys.exit(1)

    return steps, clicks

def play_recording(steps_file, content_file, dry_run=False):
    # --- Read content ---
    if not os.path.exists(content_file):
        print(f"Error: {content_file} not found.")
        sys.exit(1)

    with open(content_file, "r", encoding="utf-8") as f:
        content = f.read().strip()

    if not content:
        print("Error: post_content.txt is empty.")
        sys.exit(1)

    # --- Validate length ---
    if len(content) > MAX_TWEET_LENGTH:
        print(f"Error: Content is {len(content)} characters. Twitter limit is {MAX_TWEET_LENGTH}.")
        print(f"Trim {len(content) - MAX_TWEET_LENGTH} characters and try again.")
        sys.exit(1)

    print(f"Content: {len(content)}/{MAX_TWEET_LENGTH} characters")
    try:
        print(f"Preview: {content[:80]}{'...' if len(content) > 80 else ''}")
    except UnicodeEncodeError:
        print("Preview contains non-encodable characters.")

    if dry_run:
        print("\n[DRY RUN]: Setup validated. Ready to post.")
        return True

    # --- Validate steps ---
    steps, clicks = validate_steps(steps_file)
    print(f"Steps loaded: {len(clicks)} clicks recorded.")

    # --- Copy content to clipboard ---
    pyperclip.copy(content)
    print("\nStarting in 3 seconds. Do NOT touch your mouse or keyboard...")
    time.sleep(3)

    # --- Replay ---
    click_count = 0
    last_time = 0

    for step in steps:
        delay = step["time"] - last_time
        time.sleep(max(0, delay))

        if step["type"] == "click":
            click_count += 1
            pyautogui.moveTo(step["x"], step["y"], duration=CLICK_MOVE_DURATION)
            pyautogui.click()
            print(f"Click {click_count} at ({step['x']}, {step['y']})")

            if click_count == 1:
                # Compose box — paste content
                time.sleep(PASTE_WAIT)
                pyautogui.hotkey("ctrl", "v")
                print("Content pasted.")
                time.sleep(1.0)

            if click_count == 2:
                # Post button — wait for submission
                time.sleep(POST_WAIT)
                print("Post button clicked. Waiting for submission...")

        last_time = step["time"]

    print("\n[Done]: Tweet should be live.")
    return True


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    steps_file = os.path.join(script_dir, "twitter_steps.json")
    content_file = os.path.join(script_dir, "post_content.txt")
    dry_run = False

    for i, arg in enumerate(sys.argv):
        if arg == "--content-file" and i + 1 < len(sys.argv):
            content_file = sys.argv[i + 1]
        if arg == "--dry-run":
            dry_run = True

    play_recording(steps_file, content_file, dry_run)