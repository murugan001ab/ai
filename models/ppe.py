import cv2
import os
import time
import json
import signal
import sys
import torch
import numpy as np

from ultralytics import YOLO
from threading import Thread, Lock
from confluent_kafka import Producer

# ========================= OPTIMIZATION =========================
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

torch.backends.cudnn.benchmark = True

# ========================= KAFKA =========================
KAFKA_BROKER = "localhost:9092"
KAFKA_TOPIC = "ppe-events"

producer = Producer({
    "bootstrap.servers": KAFKA_BROKER
})


def delivery_report(err, msg):
    if err is not None:
        print(f"Kafka delivery failed: {err}")


# ========================= MODEL =========================
model = YOLO("best.pt")

if torch.cuda.is_available():
    model.to("cuda")
    print("Using GPU acceleration")
else:
    print("Using CPU")

# ========================= SETTINGS =========================
PERSON_CLASS = "Person"
REQUIRED_PPE = ["helmet", "gloves", "vest"]

DETECTION_INTERVAL = 0.2
VIOLATION_COOLDOWN = 10
IOU_THRESHOLD = 0.15

SAVE_FOLDER = "ppe_violations"
os.makedirs(SAVE_FOLDER, exist_ok=True)

# ========================= CAMERA CONFIG =========================
CAMERAS = [
    {
        "url": "rtsp://192.168.0.122:8554/cam1",
        "zone_id": "R&D",
        "enabled": True
    },
    {
        "url": "rtsp://192.168.0.122:8554/cam2",
        "zone_id": "Zone 2",
        "enabled": True
    },
]

# ========================= IOU =========================
def calculate_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    intersection = max(0, x2 - x1) * max(0, y2 - y1)

    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])

    union = area1 + area2 - intersection

    return intersection / union if union > 0 else 0


# ========================= CAMERA PROCESSOR =========================
class CameraProcessor:
    def __init__(self, config):
        self.config = config

        self.cap = None
        self.running = False
        self.thread = None

        self.frame_lock = Lock()
        self.display_frame = None

        self.last_detection_time = 0
        self.violation_cooldown = {}

        self.window_name = f"PPE Monitor - {config['zone_id']}"

    def start(self):
        self.running = True
        self.thread = Thread(target=self.process_loop, daemon=True)
        self.thread.start()

    def process_loop(self):

        self.cap = cv2.VideoCapture(
            self.config["url"],
            cv2.CAP_FFMPEG
        )

        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not self.cap.isOpened():
            print(f"Cannot open {self.config['zone_id']}")
            return

        print(f"Started {self.config['zone_id']}")

        while self.running:

            ret, frame = self.cap.read()

            if not ret:
                print(f"Reconnecting {self.config['zone_id']}")

                self.cap.release()
                time.sleep(1)

                self.cap = cv2.VideoCapture(
                    self.config["url"],
                    cv2.CAP_FFMPEG
                )

                continue

            current_time = time.time()

            if current_time - self.last_detection_time >= DETECTION_INTERVAL:

                self.last_detection_time = current_time

                try:

                    results = model(
                        frame,
                        conf=0.4,
                        iou=0.5,
                        verbose=False
                    )

                    persons = []
                    ppe_items = []

                    for r in results:

                        if r.boxes is None:
                            continue

                        boxes = r.boxes.xyxy.cpu().numpy()
                        classes = r.boxes.cls.cpu().numpy()

                        for box, cls_id in zip(boxes, classes):

                            class_name = model.names[int(cls_id)]

                            x1, y1, x2, y2 = map(int, box)

                            if class_name == PERSON_CLASS:

                                persons.append({
                                    "bbox": (x1, y1, x2, y2),
                                    "ppe": []
                                })

                            elif class_name in REQUIRED_PPE:

                                ppe_items.append({
                                    "bbox": (x1, y1, x2, y2),
                                    "name": class_name,
                                    "used": False
                                })

                    # ================= PPE MATCHING =================
                    for person in persons:

                        for ppe in ppe_items:

                            if ppe["used"]:
                                continue

                            iou = calculate_iou(
                                person["bbox"],
                                ppe["bbox"]
                            )

                            if iou > IOU_THRESHOLD:
                                person["ppe"].append(ppe["name"])
                                ppe["used"] = True

                    # ================= DRAW PPE =================
                    for ppe in ppe_items:

                        x1, y1, x2, y2 = ppe["bbox"]

                        if ppe["used"]:
                            color = (0, 255, 0)
                            label = f"{ppe['name']} WORN"
                        else:
                            color = (0, 255, 255)
                            label = f"{ppe['name']} UNUSED"

                        cv2.rectangle(
                            frame,
                            (x1, y1),
                            (x2, y2),
                            color,
                            2
                        )

                        cv2.putText(
                            frame,
                            label,
                            (x1, y1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.5,
                            color,
                            2
                        )

                    # ================= PERSON CHECK =================
                    for idx, person in enumerate(persons):

                        x1, y1, x2, y2 = person["bbox"]

                        worn = person["ppe"]

                        missing_ppe = [
                            item
                            for item in REQUIRED_PPE
                            if item not in worn
                        ]

                        if len(missing_ppe) == 0:

                            color = (0, 255, 0)
                            status = "PPE OK"

                        else:

                            color = (0, 0, 255)
                            status = f"Missing: {', '.join(missing_ppe)}"

                            person_key = f"{x1}_{y1}_{x2}_{y2}"

                            last_time = self.violation_cooldown.get(
                                person_key,
                                0
                            )

                            if current_time - last_time > VIOLATION_COOLDOWN:

                                self.violation_cooldown[
                                    person_key
                                ] = current_time

                                timestamp = time.strftime(
                                    "%Y%m%d_%H%M%S"
                                )

                                filename = (
                                    f"{self.config['zone_id']}_{timestamp}.jpg"
                                )

                                filepath = os.path.join(
                                    SAVE_FOLDER,
                                    filename
                                )

                                crop = frame[
                                    max(0, y1 - 20):min(frame.shape[0], y2 + 20),
                                    max(0, x1 - 20):min(frame.shape[1], x2 + 20)
                                ]

                                if crop.size > 0:
                                    cv2.imwrite(filepath, crop)

                                # ================= KAFKA EVENT =================
                                event = {
                                    "camera": self.config["zone_id"],
                                    "worker_id": f"Worker_{idx+1}",
                                    "missing_ppe": missing_ppe,
                                    "image_path": filepath,
                                    "timestamp": current_time
                                }

                                producer.produce(
                                    KAFKA_TOPIC,
                                    key=f"Worker_{idx+1}",
                                    value=json.dumps(event),
                                    callback=delivery_report
                                )

                                producer.poll(0)

                                print(
                                    f"[EVENT] {event}"
                                )

                        # ================= DRAW PERSON =================
                        cv2.rectangle(
                            frame,
                            (x1, y1),
                            (x2, y2),
                            color,
                            3
                        )

                        cv2.putText(
                            frame,
                            status,
                            (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.6,
                            color,
                            2
                        )

                except Exception as e:
                    print(f"Detection error: {e}")

            # ================= OVERLAY =================
            cv2.putText(
                frame,
                self.config["zone_id"],
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2
            )

            with self.frame_lock:
                self.display_frame = frame.copy()

    def get_frame(self):

        with self.frame_lock:

            if self.display_frame is not None:
                return self.display_frame.copy()

            return None

    def stop(self):

        self.running = False

        if self.thread:
            self.thread.join(timeout=2)

        if self.cap:
            self.cap.release()


# ========================= DISPLAY =========================
class DisplayManager:

    def __init__(self):
        self.cameras = []
        self.running = True

    def add_camera(self, cam):
        self.cameras.append(cam)

    def run(self):

        for cam in self.cameras:
            cv2.namedWindow(cam.window_name, cv2.WINDOW_NORMAL)

        while self.running:

            for cam in self.cameras:

                frame = cam.get_frame()

                if frame is not None:
                    cv2.imshow(cam.window_name, frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                self.running = False
                break

        cv2.destroyAllWindows()


# ========================= SIGNAL =========================
def signal_handler(sig, frame):

    print("Shutting down...")
    sys.exit(0)


# ========================= MAIN =========================
if __name__ == "__main__":

    signal.signal(signal.SIGINT, signal_handler)

    cameras = []

    for config in CAMERAS:

        if config["enabled"]:

            cam = CameraProcessor(config)

            cam.start()

            cameras.append(cam)

            time.sleep(0.5)

    display_manager = DisplayManager()

    for cam in cameras:
        display_manager.add_camera(cam)

    display_manager.run()

    for cam in cameras:
        cam.stop()

    producer.flush()

    print("Stopped")