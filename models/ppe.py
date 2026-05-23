import cv2
import os
import time
import random

from retinaface import RetinaFace

# ========================= CONFIG =========================
RTSP_URL = "rtsp://192.168.0.122:8554/cam4"

PERSON_NAME = "Malavika"

SAVE_DIR = f"dataset/{PERSON_NAME}"

TARGET_IMAGES = 100

CAPTURE_INTERVAL = 1.0

os.makedirs(SAVE_DIR, exist_ok=True)

# ========================= CAMERA =========================
cap = cv2.VideoCapture(RTSP_URL)

if not cap.isOpened():
    print("Cannot open RTSP stream")
    exit()

print("Camera started")

saved_count = 0
last_capture = 0

# ========================= ENHANCEMENT =========================
def enhance_face(face):

    gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    enhanced = clahe.apply(gray)

    enhanced = cv2.cvtColor(
        enhanced,
        cv2.COLOR_GRAY2BGR
    )

    return enhanced

# ========================= MAIN LOOP =========================
while saved_count < TARGET_IMAGES:

    ret, frame = cap.read()

    if not ret:
        print("Frame read failed")
        continue

    current_time = time.time()

    # ================= DETECT FACE =================
    faces = RetinaFace.detect_faces(frame)

    if isinstance(faces, dict):

        for key in faces:

            identity = faces[key]

            x1, y1, x2, y2 = identity["facial_area"]

            x1 = max(0, x1)
            y1 = max(0, y1)

            face = frame[y1:y2, x1:x2]

            if face.size == 0:
                continue

            # ================= QUALITY FILTER =================
            h, w = face.shape[:2]

            if w < 80 or h < 80:
                continue

            # ================= CAPTURE TIMER =================
            if current_time - last_capture >= CAPTURE_INTERVAL:

                last_capture = current_time

                # ================= RANDOM LIGHTING =================
                alpha = random.uniform(0.8, 1.3)
                beta = random.randint(-20, 20)

                adjusted = cv2.convertScaleAbs(
                    face,
                    alpha=alpha,
                    beta=beta
                )

                # ================= ENHANCE =================
                enhanced = enhance_face(adjusted)

                # ================= RESIZE =================
                final_face = cv2.resize(
                    enhanced,
                    (112, 112)
                )

                # ================= SAVE =================
                filename = (
                    f"{SAVE_DIR}/"
                    f"{PERSON_NAME}_{saved_count}.jpg"
                )

                cv2.imwrite(filename, final_face)

                saved_count += 1

                print(
                    f"Saved {saved_count}/"
                    f"{TARGET_IMAGES}"
                )

                # ================= DRAW =================
                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2
                )

    # ================= DISPLAY =================
    cv2.putText(
        frame,
        f"Images: {saved_count}/{TARGET_IMAGES}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )

    cv2.imshow("Face Capture", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()

print("Dataset collection complete")