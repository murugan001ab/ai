import cv2
import os
import time
from insightface.app import FaceAnalysis

# =====================================================
# CAMERA SOURCES
# =====================================================

CAMERAS = {
    # "cam1": "rtsp://Ckers2:zeekerslobby@192.168.0.126:554/stream2",
    "cam2": "rtsp://Ckers2:zeekerslobby@192.168.0.127:554/stream2",
    # "cam3": "rtsp://Ckers2:zeekerslobby@192.168.0.104:554/stream2",
    # "cam4": "rtsp://Ckers2:zeekerslobby@192.168.0.101:554/stream2",
}

# =====================================================
# CONFIG
# =====================================================

CAM_SELECT    = "cam2"
TARGET_IMAGES = 60       # images per person
SAVE_INTERVAL = 1.5      # seconds between auto-saves (more variety)

# -------------------------------------------------------
# TEAM MEMBERS  —  edit names here
# -------------------------------------------------------
MEMBERS = [
    "Malavika",
    "Member2",
    "Member3",
    "Member4",
    "Member5",
]

# Angle prompts cycled every ~6 saves so all angles are covered
ANGLE_PROMPTS = [
    "Look STRAIGHT at camera",
    "Turn slightly LEFT",
    "Turn slightly RIGHT",
    "Tilt head UP",
    "Tilt head DOWN",
    "Move CLOSER to camera",
    "Move FURTHER from camera",
    "Tilt head LEFT (ear to shoulder)",
    "Tilt head RIGHT (ear to shoulder)",
    "Look STRAIGHT — different expression",
]

# =====================================================
# SETUP
# =====================================================

RTSP_URL = CAMERAS[CAM_SELECT]

# Create dataset folders for every member upfront
for name in MEMBERS:
    os.makedirs(f"dataset/{name}", exist_ok=True)

print("Loading InsightFace...")
app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=-1, det_size=(320, 320))   # faster det for capture
print("InsightFace loaded\n")

cap = cv2.VideoCapture(RTSP_URL)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
if not cap.isOpened():
    print(f"ERROR: Cannot open RTSP stream ({CAM_SELECT})")
    exit()

# =====================================================
# HELPER — draw centred text with shadow
# =====================================================

def put_centred(frame, text, y, scale=0.8, color=(0, 255, 255), thickness=2):
    h, w = frame.shape[:2]
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    x = (w - tw) // 2
    cv2.putText(frame, text, (x+1, y+1), cv2.FONT_HERSHEY_SIMPLEX,
                scale, (0, 0, 0), thickness + 1)
    cv2.putText(frame, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX,
                scale, color, thickness)

def put_text(frame, text, pos, scale=0.7, color=(255, 255, 255), thickness=2):
    cv2.putText(frame, text, (pos[0]+1, pos[1]+1), cv2.FONT_HERSHEY_SIMPLEX,
                scale, (0, 0, 0), thickness + 1)
    cv2.putText(frame, text, pos, cv2.FONT_HERSHEY_SIMPLEX,
                scale, color, thickness)

# =====================================================
# INTRO SCREEN — shown before each person
# =====================================================

def show_intro(person_index, name):
    while True:
        ret, frame = cap.read()
        if not ret:
            continue
        h, w = frame.shape[:2]

        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

        put_centred(frame, f"Person {person_index + 1} of {len(MEMBERS)}",
                    h // 2 - 80, scale=0.9, color=(200, 200, 200))
        put_centred(frame, name.upper(), h // 2 - 30, scale=2.0, color=(0, 255, 255), thickness=3)
        put_centred(frame, f"Capturing {TARGET_IMAGES} images at different angles",
                    h // 2 + 50, scale=0.75, color=(200, 255, 200))
        put_centred(frame, "Press SPACE to start  |  Q to quit",
                    h // 2 + 100, scale=0.7, color=(180, 180, 180))

        cv2.imshow("Face Capture", frame)
        key = cv2.waitKey(1)
        if key == ord(" "):
            return True
        if key == ord("q"):
            return False

# =====================================================
# CAPTURE LOOP — one person at a time
# =====================================================

def capture_person(name):
    save_dir       = f"dataset/{name}"
    saved_count    = 0
    last_save_time = time.time() - SAVE_INTERVAL   # allow immediate first save

    print(f"\n--- Capturing: {name} ---")

    while saved_count < TARGET_IMAGES:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.05)
            continue

        faces = app.get(frame)
        face_found = False

        for face in faces:
            if face.det_score < 0.6:
                continue

            face_found = True
            x1, y1, x2, y2 = face.bbox.astype(int)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            put_text(frame, f"{face.det_score:.2f}", (x1, y1 - 10),
                     color=(0, 255, 0))

            # Auto-save on interval
            now = time.time()
            if now - last_save_time >= SAVE_INTERVAL:
                last_save_time = now
                filename = os.path.join(save_dir, f"{name}_{saved_count:03d}.jpg")
                cv2.imwrite(filename, frame)
                saved_count += 1
                print(f"  [{name}] Saved {saved_count}/{TARGET_IMAGES}")
            break   # one face per frame is enough

        # ── HUD ──────────────────────────────────────────
        h, w = frame.shape[:2]

        # Name banner (top)
        cv2.rectangle(frame, (0, 0), (w, 50), (0, 0, 0), -1)
        put_centred(frame, f"{name}  —  {saved_count}/{TARGET_IMAGES} saved",
                    35, scale=0.85, color=(0, 255, 255))

        # Angle prompt (bottom bar)
        prompt_idx   = (saved_count // 6) % len(ANGLE_PROMPTS)
        angle_prompt = ANGLE_PROMPTS[prompt_idx]
        cv2.rectangle(frame, (0, h - 50), (w, h), (0, 0, 0), -1)
        prompt_color = (0, 255, 0) if face_found else (0, 80, 255)
        put_centred(frame, angle_prompt, h - 18,
                    scale=0.8, color=prompt_color)

        # Progress bar
        bar_w = int(w * saved_count / TARGET_IMAGES)
        cv2.rectangle(frame, (0, h - 52), (bar_w, h - 48), (0, 200, 100), -1)

        # No-face warning
        if not face_found:
            put_centred(frame, "NO FACE DETECTED", h // 2,
                        scale=1.2, color=(0, 80, 255), thickness=3)

        cv2.imshow("Face Capture", frame)
        key = cv2.waitKey(1)
        if key == ord("q"):
            return False    # signal quit

    # ── Done screen ──────────────────────────────────────
    for _ in range(60):
        ret, frame = cap.read()
        if not ret:
            continue
        h, w = frame.shape[:2]
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, frame)
        put_centred(frame, f"✓  {name} complete!",
                    h // 2, scale=1.4, color=(0, 255, 100), thickness=3)
        put_centred(frame, f"{saved_count} images saved to dataset/{name}",
                    h // 2 + 50, scale=0.75, color=(200, 255, 200))
        cv2.imshow("Face Capture", frame)
        cv2.waitKey(30)

    print(f"  DONE: {saved_count} images saved for {name}")
    return True

# =====================================================
# MAIN — iterate through all members
# =====================================================

print(f"\nUsing {CAM_SELECT}: {RTSP_URL}")
print(f"Will capture {TARGET_IMAGES} images each for: {', '.join(MEMBERS)}\n")

for idx, name in enumerate(MEMBERS):
    # Intro/ready screen
    if not show_intro(idx, name):
        print("Quit by user.")
        break

    # Capture
    if not capture_person(name):
        print("Quit by user.")
        break

    print(f"\n--- {name} done ({idx + 1}/{len(MEMBERS)}) ---\n")

# =====================================================
# SUMMARY
# =====================================================

cap.release()
cv2.destroyAllWindows()

print("\n====== CAPTURE SUMMARY ======")
for name in MEMBERS:
    folder = f"dataset/{name}"
    count  = len([f for f in os.listdir(folder) if f.endswith(".jpg")])
    print(f"  {name:<15} {count:>3} images  →  {folder}")
print("=============================\n")