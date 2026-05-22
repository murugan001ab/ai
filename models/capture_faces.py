import cv2
import os
import time
import random
import numpy as np
from insightface.app import FaceAnalysis

# ========================= CONFIG =========================
RTSP_URL = "rtsp://192.168.0.122:8554/cam4"
PERSON_NAME = "Malavika"
SAVE_DIR = f"dataset/{PERSON_NAME}"
TARGET_IMAGES = 100
CAPTURE_INTERVAL = 1.0  # 1 second between captures

os.makedirs(SAVE_DIR, exist_ok=True)

# ========================= INITIALIZE DETECTOR =========================
# buffalo_l is the high-accuracy RetinaFace implementation in InsightFace
app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# ========================= CAMERA =========================
cap = cv2.VideoCapture(RTSP_URL)
if not cap.isOpened():
    print("Cannot open RTSP stream")
    exit()

print("Camera started. Press 'q' to stop.")

saved_count = 0
last_capture = 0

# ========================= ENHANCEMENT =========================
def enhance_face(face):
    # Ensure face is valid
    if face.size == 0: return face
    
    gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
    return enhanced

# ========================= MAIN LOOP =========================
while saved_count < TARGET_IMAGES:
    ret, frame = cap.read()
    if not ret:
        print("Frame read failed")
        continue

    current_time = time.time()

    # ================= DETECT FACE =================
    # Using InsightFace instead of the buggy retinaface.detect_faces
    faces = app.get(frame)

    for face_data in faces:
        # Get bounding box [x1, y1, x2, y2]
        bbox = face_data.bbox.astype(int)
        x1, y1, x2, y2 = bbox

        # Boundary checks
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)

        face_crop = frame[y1:y2, x1:x2]

        if face_crop.size == 0:
            continue

        # ================= QUALITY FILTER =================
        h, w = face_crop.shape[:2]
        if w < 80 or h < 80:
            continue

        # ================= CAPTURE TIMER =================
        if current_time - last_capture >= CAPTURE_INTERVAL:
            last_capture = current_time

            # ================= RANDOM LIGHTING (Augmentation) =================
            alpha = random.uniform(0.8, 1.3)
            beta = random.randint(-20, 20)
            adjusted = cv2.convertScaleAbs(face_crop, alpha=alpha, beta=beta)

            # ================= ENHANCE =================
            enhanced = enhance_face(adjusted)

            # ================= RESIZE =================
            # 112x112 is the standard input size for ArcFace
            final_face = cv2.resize(enhanced, (112, 112))

            # ================= SAVE =================
            filename = f"{SAVE_DIR}/{PERSON_NAME}_{saved_count}.jpg"
            cv2.imwrite(filename, final_face)

            saved_count += 1
            print(f"Saved {saved_count}/{TARGET_IMAGES}")

        # ================= DRAW FEEDBACK =================
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

    # ================= DISPLAY =================
    cv2.putText(
        frame, f"Images: {saved_count}/{TARGET_IMAGES}",
        (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2
    )

    cv2.imshow("Face Capture", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
print("Dataset collection complete")