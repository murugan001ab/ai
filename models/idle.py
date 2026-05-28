import cv2
import numpy as np
import pickle
import threading
import time
import os
import json
import torch

from ultralytics import YOLO
from confluent_kafka import Producer
from insightface.app import FaceAnalysis
import onnxruntime as ort

from db_config import db_manager

# =========================================================
# DATABASE
# =========================================================

camera_list = db_manager.get_cameras()

db_manager.load_user_zone_permissions()

# =========================================================
# KAFKA
# =========================================================

KAFKA_BROKER = "192.168.0.122:9092"

FACE_TOPIC = "face-events"

IDLE_TOPIC = "idle-events"

producer = Producer({
    "bootstrap.servers": KAFKA_BROKER
})

def delivery_report(err, msg):

    if err:

        print(f"Kafka Error: {err}")

    else:

        print(
            f"Delivered to {msg.topic()} "
            f"partition={msg.partition()}"
        )

# =========================================================
# CAMERA CONFIG
# =========================================================

CAMERAS = {}

for cam in camera_list:

    CAMERAS[cam["name"]] = {

        "camera_id": cam["id"],

        "zone_id": cam["zone_id"],

        "rtsp_link": cam["rtsp_url"]
    }

CAM_SELECT = "cam4"

camera_data = CAMERAS[CAM_SELECT]

CAMERA_ID = camera_data["camera_id"]

ZONE_ID = camera_data["zone_id"]

RTSP_URL = camera_data["rtsp_link"]

# =========================================================
# SETTINGS
# =========================================================

EMBEDDINGS_DIR = "embeddings"

FACE_CAPTURE_DIR = "facecaptures"

IDLE_CAPTURE_DIR = "idle_snapshots"

os.makedirs(FACE_CAPTURE_DIR, exist_ok=True)

os.makedirs(IDLE_CAPTURE_DIR, exist_ok=True)

SIM_THRESHOLD = 0.40

DET_SIZE = (640, 640)

UPSCALE = 1.5

PROCESS_EVERY_N = 2

UNKNOWN_MAX_WAIT = 1.2

UNKNOWN_MIN_FRAMES = 3

UNAUTHORIZED_CONFIRM_TIME = 1

UNAUTHORIZED_MIN_FRAMES = 2

# =========================================================
# IMPROVED IDLE SETTINGS
# =========================================================

IDLE_START_DELAY = 10

IDLE_THRESHOLD_SECONDS = 15

WRIST_MOVEMENT_THRESHOLD = 14

UPPER_BODY_MOVEMENT_THRESHOLD = 10

TORSO_MOVEMENT_THRESHOLD = 7

HEAD_MOVEMENT_THRESHOLD = 5

# =========================================================
# COLORS
# =========================================================

AUTHORIZED_COLOR = (0, 255, 0)

UNAUTHORIZED_COLOR = (0, 0, 255)

UNKNOWN_COLOR = (0, 255, 255)

IDLE_COLOR = (255, 0, 255)

ACTIVE_COLOR = (0, 255, 0)

CHECKING_COLOR = (0, 165, 255)

# =========================================================
# FACE STATE
# =========================================================

ACTIVE_DETECTIONS = {}

PENDING_UNKNOWN = {}

PENDING_UNAUTHORIZED = {}

# =========================================================
# PERSON TRACKING
# =========================================================

person_history = {}

id_map = {}

next_id = 1

# =========================================================
# LOAD EMBEDDINGS
# =========================================================

MEMBERS = [

    os.path.splitext(f)[0]

    for f in os.listdir(EMBEDDINGS_DIR)

    if f.endswith(".pkl")
]

known_people = []

for name in MEMBERS:

    path = os.path.join(
        EMBEDDINGS_DIR,
        f"{name.lower()}.pkl"
    )

    try:

        with open(path, "rb") as f:

            data = pickle.load(f)

        embeddings = data["embeddings"]

        embeddings = [

            e / np.linalg.norm(e)

            for e in embeddings
        ]

        known_people.append({

            "name": name,

            "matrix": np.stack(embeddings)
        })

        print(f"Loaded: {name}")

    except Exception as e:

        print(f"FAILED {name}: {e}")

# =========================================================
# INSIGHTFACE
# =========================================================

print("\nLoading InsightFace...")

providers = ["CPUExecutionProvider"]

ctx_id = -1

try:

    if "CUDAExecutionProvider" in ort.get_available_providers():

        providers = ["CUDAExecutionProvider"]

        ctx_id = 0

        print("InsightFace GPU ENABLED")

    else:

        print("InsightFace CPU MODE")

except:

    print("InsightFace CPU FALLBACK")

face_app = FaceAnalysis(

    name="buffalo_l",

    providers=providers
)

face_app.prepare(

    ctx_id=ctx_id,

    det_size=DET_SIZE
)

# =========================================================
# YOLO POSE MODEL
# =========================================================

print("\nLoading YOLO Pose Model...")

yolo_model = YOLO("yolo11n-pose.pt")

if torch.cuda.is_available():

    yolo_model.to("cuda")

    print("YOLO GPU ENABLED")

else:

    print("YOLO CPU MODE")

# =========================================================
# CAMERA THREAD
# =========================================================

class CameraReader:

    def __init__(self, url):

        self.cap = cv2.VideoCapture(url)

        self.cap.set(
            cv2.CAP_PROP_BUFFERSIZE,
            1
        )

        self.frame = None

        self.lock = threading.Lock()

        self.running = True

        self.thread = threading.Thread(
            target=self.update,
            daemon=True
        )

        self.thread.start()

    def update(self):

        while self.running:

            ret, frame = self.cap.read()

            if ret:

                with self.lock:

                    self.frame = frame

            time.sleep(0.01)

    def read(self):

        with self.lock:

            if self.frame is None:
                return None

            return self.frame.copy()

    def release(self):

        self.running = False

        self.thread.join()

        self.cap.release()

# =========================================================
# FACE IDENTIFICATION
# =========================================================

def identify(face_embedding):

    emb = (
        face_embedding /
        np.linalg.norm(face_embedding)
    )

    best_name = "Unknown"

    best_score = -1

    for person in known_people:

        scores = person["matrix"] @ emb

        score = float(scores.max())

        if score > best_score:

            best_score = score

            if score >= SIM_THRESHOLD:

                best_name = person["name"]

            else:

                best_name = "Unknown"

    return best_name, best_score

# =========================================================
# FACE ID
# =========================================================

def generate_face_id(bbox):

    x1, y1, x2, y2 = bbox

    return (
        f"{x1//30}_"
        f"{y1//30}_"
        f"{x2//30}_"
        f"{y2//30}"
    )

# =========================================================
# CAMERA INIT
# =========================================================

cam = CameraReader(RTSP_URL)

time.sleep(2)

if cam.read() is None:

    print("Camera not opening")

    exit()

# =========================================================
# MAIN LOOP
# =========================================================

frame_count = 0

last_face_results = []

fps_start = time.time()

fps = 0

while True:

    frame = cam.read()

    if frame is None:
        continue

    current_time = time.time()

    frame_count += 1

    # =====================================================
    # PERSON + IDLE DETECTION
    # =====================================================

    pose_results = yolo_model.track(

        frame,

        persist=True,

        tracker="bytetrack.yaml",

        verbose=False,

        classes=[0],

        conf=0.4
    )

    if len(pose_results) > 0:

        r = pose_results[0]

        if (

            r.boxes.id is not None

            and

            r.keypoints is not None
        ):

            boxes = r.boxes.xyxy.cpu().numpy()

            track_ids = (
                r.boxes.id.cpu()
                .numpy()
                .astype(int)
            )

            keypoints = (
                r.keypoints.xy.cpu().numpy()
            )

            for box, tid, kps in zip(
                boxes,
                track_ids,
                keypoints
            ):

                x1, y1, x2, y2 = map(int, box)

                # =========================================
                # DISPLAY ID
                # =========================================

                if tid not in id_map:

                    id_map[tid] = next_id

                    next_id += 1

                display_id = id_map[tid]

                # =========================================
                # BODY PART GROUPS
                # =========================================

                upper_body_ids = [
                    5, 6,
                    7, 8
                ]

                wrist_ids = [
                    9, 10
                ]

                torso_ids = [
                    5, 6,
                    11, 12
                ]

                head_ids = [
                    0, 1, 2, 3, 4
                ]

                # =========================================
                # CURRENT POINTS
                # =========================================

                current_points = {}

                for idx, pt in enumerate(kps):

                    px, py = pt

                    if px > 0 and py > 0:

                        current_points[idx] = (
                            float(px),
                            float(py)
                        )

                if len(current_points) == 0:
                    continue

                # =========================================
                # INIT HISTORY
                # =========================================

                if tid not in person_history:

                    person_history[tid] = {

                        "last_points":
                            current_points,

                        "last_move_time":
                            current_time,

                        "idle_logged":
                            False,

                        "checking_started":
                            current_time
                    }

                prev_points = person_history[tid][
                    "last_points"
                ]

                # =========================================
                # MOVEMENT FUNCTION
                # =========================================

                def calc_group_movement(group_ids):

                    distances = []

                    for gid in group_ids:

                        if (
                            gid in current_points
                            and
                            gid in prev_points
                        ):

                            x1p, y1p = prev_points[gid]

                            x2p, y2p = current_points[gid]

                            dist = np.sqrt(
                                (x2p - x1p) ** 2 +
                                (y2p - y1p) ** 2
                            )

                            distances.append(dist)

                    if len(distances) == 0:
                        return 0

                    return np.mean(distances)

                # =========================================
                # MOVEMENTS
                # =========================================

                wrist_move = calc_group_movement(
                    wrist_ids
                )

                upper_move = calc_group_movement(
                    upper_body_ids
                )

                torso_move = calc_group_movement(
                    torso_ids
                )

                head_move = calc_group_movement(
                    head_ids
                )

                # =========================================
                # ACTIVE CHECK
                # =========================================

                ACTIVE = False

                if wrist_move > WRIST_MOVEMENT_THRESHOLD:
                    ACTIVE = True

                elif upper_move > UPPER_BODY_MOVEMENT_THRESHOLD:
                    ACTIVE = True

                elif torso_move > TORSO_MOVEMENT_THRESHOLD:
                    ACTIVE = True

                elif head_move > HEAD_MOVEMENT_THRESHOLD:
                    ACTIVE = True

                # =========================================
                # ACTIVE
                # =========================================

                if ACTIVE:

                    person_history[tid][
                        "last_move_time"
                    ] = current_time

                    person_history[tid][
                        "idle_logged"
                    ] = False

                    person_history[tid][
                        "checking_started"
                    ] = current_time

                    status = f"ACTIVE "

                    color = ACTIVE_COLOR

                # =========================================
                # POSSIBLE IDLE
                # =========================================

                else:

                    checking_time = int(
                        current_time -
                        person_history[tid][
                            "checking_started"
                        ]
                    )

                    if checking_time < IDLE_START_DELAY:

                        status = (
                            f"CHECKING "
                            f"{checking_time}s"
                        )

                        color = CHECKING_COLOR

                    else:

                        idle_time = int(
                            current_time -
                            person_history[tid][
                                "last_move_time"
                            ]
                        )

                        if idle_time >= 1:

                            status = (
                                f"IDLE "
                                f"{idle_time}s"
                            )

                            color = IDLE_COLOR

                        else:

                            # status = (f"PERSON " f"{display_id}")
                            
                            status = f"ACTIVE {display_id}"
                            
                            color = ACTIVE_COLOR

                        # =============================
                        # SAVE IDLE EVENT
                        # =============================

                        if (
                            idle_time >=
                            IDLE_THRESHOLD_SECONDS
                        ):

                            if not person_history[tid][
                                "idle_logged"
                            ]:

                                timestamp = time.strftime(
                                    "%Y%m%d_%H%M%S"
                                )

                                filename = (
                                    f"idle_"
                                    f"{display_id}_"
                                    f"{timestamp}.jpg"
                                )

                                path = os.path.join(
                                    IDLE_CAPTURE_DIR,
                                    filename
                                )

                                crop = frame[
                                    y1:y2,
                                    x1:x2
                                ]

                                if crop.size > 0:

                                    cv2.imwrite(
                                        path,
                                        crop
                                    )

                                event = {

                                    "event_name":
                                        "idle-events",

                                    "camera_id":
                                        CAMERA_ID,

                                    "zone_id":
                                        ZONE_ID,

                                    "worker_id":
                                        f"Worker_{display_id}",

                                    "idle_duration":
                                        idle_time,

                                    "image_path":
                                        path,

                                    "timestamp":
                                        int(current_time)
                                }

                                producer.produce(

                                    IDLE_TOPIC,

                                    key=str(display_id),

                                    value=json.dumps(event),

                                    callback=delivery_report
                                )

                                producer.poll(0)

                                print(
                                    f"IDLE DETECTED: "
                                    f"Worker_{display_id}"
                                )

                                person_history[tid][
                                    "idle_logged"
                                ] = True

                # =========================================
                # UPDATE HISTORY
                # =========================================

                person_history[tid][
                    "last_points"
                ] = current_points

                # =========================================
                # DRAW PERSON
                # =========================================

                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    color,
                    2
                )

                cv2.putText(
                    frame,
                    status,
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    color,
                    2
                )

    # =====================================================
    # FACE RECOGNITION
    # =====================================================

    if frame_count % PROCESS_EVERY_N == 0:

        scaled = cv2.resize(

            frame,

            None,

            fx=UPSCALE,

            fy=UPSCALE
        )

        faces = face_app.get(scaled)

        last_face_results = []

        for face in faces:

            name, score = identify(
                face.embedding
            )

            x1, y1, x2, y2 = (
                face.bbox / UPSCALE
            ).astype(int)

            if name == "Unknown":

                label = "UNKNOWN"

                color = UNKNOWN_COLOR

            else:

                is_allowed = (
                    db_manager.is_zone_allowed(
                        name,
                        ZONE_ID
                    )
                )

                if is_allowed:

                    label = (
                        f"{name} AUTHORIZED"
                    )

                    color = AUTHORIZED_COLOR

                else:

                    label = (
                        f"{name} UNAUTHORIZED"
                    )

                    color = UNAUTHORIZED_COLOR

            last_face_results.append((

                (x1, y1, x2, y2),

                label,

                color
            ))

    # =====================================================
    # DRAW FACE
    # =====================================================

    for (
        (x1, y1, x2, y2),
        label,
        color
    ) in last_face_results:

        cv2.rectangle(
            frame,
            (x1, y1),
            (x2, y2),
            color,
            2
        )

        cv2.rectangle(
            frame,
            (x1, y1 - 30),
            (x2, y1),
            color,
            -1
        )

        cv2.putText(

            frame,

            label,

            (x1 + 5, y1 - 8),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.6,

            (255, 255, 255),

            2
        )

    # =====================================================
    # FPS
    # =====================================================

    if frame_count % 30 == 0:

        fps = 30 / (
            time.time() - fps_start
        )

        fps_start = time.time()

    cv2.putText(

        frame,

        f"FPS: {fps:.1f}",

        (20, 40),

        cv2.FONT_HERSHEY_SIMPLEX,

        1,

        (0, 255, 255),

        2
    )

    # =====================================================
    # DISPLAY
    # =====================================================

    display = cv2.resize(
        frame,
        (1280, 720)
    )

    cv2.imshow(
        "Face + Idle Detection",
        display
    )

    if cv2.waitKey(1) == ord("q"):
        break

# =========================================================
# CLEANUP
# =========================================================

cam.release()
cv2.destroyAllWindows()

producer.flush()

print("Stopped")
