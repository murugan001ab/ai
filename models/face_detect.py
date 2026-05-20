import cv2
import os
import time
import numpy as np
import face_recognition
import psycopg2
from ultralytics import YOLO
from dotenv import load_dotenv

# ================= LOAD ENV =================
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT")

# ================= SETTINGS =================
model = YOLO("yolo11n.onnx")

SAVE_FOLDER = "unauthorized_snapshots"
EMPLOYEE_FOLDER = "employee"

ZONE = "Zone A"
CAMERA_ID = "CAM-01"

LOG_COOLDOWN = 10
last_log_time = 0

os.makedirs(SAVE_FOLDER, exist_ok=True)
os.makedirs(EMPLOYEE_FOLDER, exist_ok=True)

# ================= DATABASE =================
def get_conn():
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT,
        sslmode="require"
    )

def init_db():

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS unauthorized_access (
            id SERIAL PRIMARY KEY,
            person_name TEXT,
            camera_id TEXT,
            zone TEXT,
            image_path TEXT,
            status TEXT,
            access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    cur.close()
    conn.close()

def log_event(name, cam, zone, path, status):

    try:

        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO unauthorized_access
            (person_name, camera_id, zone, image_path, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (name, cam, zone, path, status))

        conn.commit()

        cur.close()
        conn.close()

        print("Unauthorized person logged")

    except Exception as e:
        print("Database Error:", e)

# ================= LOAD EMPLOYEE FACES =================
print("Loading employee faces...")

known_encodings = []
known_names = []

for img_name in os.listdir(EMPLOYEE_FOLDER):

    path = os.path.join(EMPLOYEE_FOLDER, img_name)

    try:

        # Read image with OpenCV
        image = cv2.imread(path)

        if image is None:
            print(f"Cannot read image: {img_name}")
            continue

        # Convert BGR -> RGB
        rgb_image = cv2.cvtColor(
            image,
            cv2.COLOR_BGR2RGB
        )

        # Convert properly
        rgb_image = np.ascontiguousarray(
            rgb_image,
            dtype=np.uint8
        )

        # Face encoding
        encodings = face_recognition.face_encodings(
            rgb_image
        )

        if len(encodings) > 0:

            known_encodings.append(encodings[0])

            employee_name = os.path.splitext(
                img_name
            )[0]

            known_names.append(employee_name)

            print(f"Loaded: {employee_name}")

        else:
            print(f"No face found in {img_name}")

    except Exception as e:
        print(f"Error loading {img_name}: {e}")

print(f"Loaded {len(known_encodings)} employee faces")

# ================= INIT DATABASE =================
init_db()

# ================= CAMERA =================
cap = cv2.VideoCapture(1)

if not cap.isOpened():
    print("Camera not opened")
    exit()

print("System Started...")

# ================= MAIN LOOP =================
while True:

    ret, frame = cap.read()

    if not ret:
        print("Frame read failed")
        break

    # Proper frame format
    frame = np.ascontiguousarray(
        frame,
        dtype=np.uint8
    )

    # ================= PERSON DETECTION =================
    results = model(
        frame,
        classes=[0],
        conf=0.4,
        verbose=False
    )

    # ================= LOOP DETECTIONS =================
    for r in results:

        for box in r.boxes:

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )

            # Safe coordinates
            h, w = frame.shape[:2]

            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)

            # Crop person
            person_crop = frame[
                y1:y2,
                x1:x2
            ]

            if person_crop.size == 0:
                continue

            # Default label
            label = "FACE NOT FOUND"
            color = (0, 255, 255)

            try:

                # Convert crop to RGB
                rgb_crop = cv2.cvtColor(
                    person_crop,
                    cv2.COLOR_BGR2RGB
                )

                rgb_crop = np.ascontiguousarray(
                    rgb_crop,
                    dtype=np.uint8
                )

                # Detect faces
                face_locations = (
                    face_recognition.face_locations(
                        rgb_crop
                    )
                )

                # Encode faces
                face_encodings = (
                    face_recognition.face_encodings(
                        rgb_crop,
                        face_locations
                    )
                )

                # ================= MATCH FACES =================
                for encoding in face_encodings:

                    matches = (
                        face_recognition.compare_faces(
                            known_encodings,
                            encoding,
                            tolerance=0.5
                        )
                    )

                    face_distances = (
                        face_recognition.face_distance(
                            known_encodings,
                            encoding
                        )
                    )

                    if len(face_distances) > 0:

                        best_match_index = np.argmin(
                            face_distances
                        )

                        if matches[best_match_index]:

                            name = known_names[
                                best_match_index
                            ]

                            label = f"AUTHORIZED - {name}"

                            color = (0, 255, 0)

                        else:

                            label = "UNAUTHORIZED"

                            color = (0, 0, 255)

                            # ================= SAVE ALERT =================
                            current_time = time.time()

                            if (
                                current_time
                                - last_log_time
                                > LOG_COOLDOWN
                            ):

                                timestamp = time.strftime(
                                    "%Y%m%d_%H%M%S"
                                )

                                filename = (
                                    f"unauth_{timestamp}.jpg"
                                )

                                filepath = os.path.join(
                                    SAVE_FOLDER,
                                    filename
                                )

                                cv2.imwrite(
                                    filepath,
                                    frame
                                )

                                log_event(
                                    "Unknown",
                                    CAMERA_ID,
                                    ZONE,
                                    filepath,
                                    "ALERT"
                                )

                                last_log_time = current_time

            except Exception as e:
                print("Face Error:", e)

            # ================= DRAW BOX =================
            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                color,
                2
            )

            # ================= LABEL =================
            cv2.putText(
                frame,
                label,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2
            )

    # ================= SHOW WINDOW =================
    cv2.imshow(
        "Access Control System",
        frame
    )

    # Exit with Q
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# ================= CLEANUP =================
cap.release()
cv2.destroyAllWindows()