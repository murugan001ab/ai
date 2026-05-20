import cv2
import os
import time
import psycopg2
import torch
from ultralytics import YOLO
from dotenv import load_dotenv
from threading import Thread, Lock
from collections import deque
import signal
import sys
import numpy as np

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT")

# ========================= OPTIMIZATION SETTINGS =========================
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "fflags;nobuffer"

# ========================= MODEL =========================
model = YOLO("best.pt")  # Your trained PPE model
if torch.cuda.is_available():
    model.to('cuda')
    print("Using GPU acceleration")
else:
    print("Using CPU - will be slower")

# ========================= SETTINGS =========================
PERSON_CLASS = "Person"
REQUIRED_PPE = ["helmet", "gloves", "vest"]
DETECTION_INTERVAL = 0.2
VIOLATION_COOLDOWN = 10
IOU_THRESHOLD = 0.15

SAVE_FOLDER = "ppe_violations"
os.makedirs(SAVE_FOLDER, exist_ok=True)

# ========================= CAMERA CONFIGURATION =========================
CAMERAS = [
    {"url": "rtsp://192.168.0.122:8554/cam1", "zone_id": "Zone 1", "enabled": True},
    {"url": "rtsp://192.168.0.122:8554/cam2", "zone_id": "Zone 2", "enabled": True},
    {"url": "rtsp://192.168.0.122:8554/cam3", "zone_id": "Zone 3", "enabled": True},
    {"url": "rtsp://192.168.0.122:8554/cam4", "zone_id": "Zone 4", "enabled": True}
]

# ========================= DATABASE FUNCTIONS =========================
def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT,
        sslmode="require"
    )

def init_db():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ppe_violations (
                Sl SERIAL PRIMARY KEY,
                worker_id VARCHAR(50),
                violation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                zone VARCHAR(100),
                missing_ppe TEXT,
                image_path TEXT
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("Database ready.")
    except Exception as e:
        print(f"DB Init Error: {e}")

def log_violation(worker_id, zone, missing_ppe, image_path):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ppe_violations (worker_id, zone, missing_ppe, image_path)
            VALUES (%s, %s, %s, %s)
        """, (worker_id, zone, missing_ppe, image_path))
        conn.commit()
        cur.close()
        conn.close()
        print(f"[ALERT] {worker_id} in {zone} missing: {missing_ppe}")
    except Exception as e:
        print(f"Logging Error: {e}")

# ========================= HELPER FUNCTIONS =========================
def calculate_iou(box1, box2):
    """Calculate Intersection over Union between two bounding boxes"""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0

# ========================= PERSON TRACKER =========================
class PersonTracker:
    def __init__(self, max_distance=50, max_age=30):
        self.next_id = 1
        self.tracks = {}
        self.max_distance = max_distance
        self.max_age = max_age
        self.frame_count = 0
        
    def update(self, detections):
        self.frame_count += 1
        
        for tid in self.tracks:
            self.tracks[tid]['lost_frames'] += 1
        
        used_detections = set()
        matched_tracks = []
        
        for tid, track in self.tracks.items():
            best_match = -1
            best_dist = self.max_distance
            
            for i, det in enumerate(detections):
                if i in used_detections:
                    continue
                
                track_center = track['last_center']
                det_center = det['center']
                dist = np.sqrt((track_center[0] - det_center[0])**2 + 
                              (track_center[1] - det_center[1])**2)
                
                if dist < best_dist:
                    best_dist = dist
                    best_match = i
            
            if best_match >= 0:
                used_detections.add(best_match)
                det = detections[best_match]
                track['last_center'] = det['center']
                track['last_bbox'] = det['bbox']
                track['lost_frames'] = 0
                matched_tracks.append((tid, det))
        
        for i, det in enumerate(detections):
            if i not in used_detections:
                new_id = self.next_id
                self.next_id += 1
                self.tracks[new_id] = {
                    'last_center': det['center'],
                    'last_bbox': det['bbox'],
                    'lost_frames': 0
                }
                matched_tracks.append((new_id, det))
        
        to_delete = [tid for tid, track in self.tracks.items() 
                    if track['lost_frames'] > self.max_age]
        for tid in to_delete:
            del self.tracks[tid]
        
        return matched_tracks

# ========================= CAMERA PROCESSOR =========================
class CameraProcessor:
    def __init__(self, camera_config):
        self.config = camera_config
        self.cap = None
        self.running = False
        self.thread = None
        
        self.current_frame = None
        self.display_frame = None
        self.frame_lock = Lock()
        
        self.last_detection_time = 0
        self.detection_interval = DETECTION_INTERVAL
        
        self.person_tracker = PersonTracker()
        self.violation_cooldown = {}
        
        self.window_name = f"PPE Monitor - {camera_config['zone_id']}"
        
        self.fps = 0
        self.last_fps_time = time.time()
        self.frame_count = 0
        
    def start(self):
        self.running = True
        self.thread = Thread(target=self._process_loop, daemon=True)
        self.thread.start()
        
    def _process_loop(self):
        self.cap = cv2.VideoCapture(self.config["url"], cv2.CAP_FFMPEG)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        
        if not self.cap.isOpened():
            print(f"Error: Cannot open {self.config['zone_id']}")
            self.running = False
            return
        
        print(f"Started PPE Monitoring: {self.config['zone_id']}")
        
        frame_skip = 1
        frame_counter = 0
        
        while self.running:
            ret, frame = self.cap.read()
            
            if not ret:
                print(f"Reconnecting {self.config['zone_id']}...")
                self.cap.release()
                time.sleep(0.5)
                self.cap = cv2.VideoCapture(self.config["url"], cv2.CAP_FFMPEG)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                continue
            
            frame_counter += 1
            
            if frame_counter % frame_skip != 0:
                with self.frame_lock:
                    self.current_frame = frame
                continue
            
            current_time = time.time()
            
            if current_time - self.last_detection_time >= self.detection_interval:
                self.last_detection_time = current_time
                
                h, w = frame.shape[:2]
                scale = 640 / max(h, w)
                if scale < 1:
                    new_w = int(w * scale)
                    new_h = int(h * scale)
                    detect_frame = cv2.resize(frame, (new_w, new_h))
                else:
                    detect_frame = frame
                
                try:
                    results = model(detect_frame, conf=0.4, iou=0.5, verbose=False)
                    
                    persons = []
                    all_ppe_detections = []
                    
                    for r in results:
                        if r.boxes is None:
                            continue
                        
                        boxes = r.boxes.xyxy.cpu().numpy()
                        classes = r.boxes.cls.cpu().numpy()
                        
                        for box, cls_id in zip(boxes, classes):
                            class_name = model.names[int(cls_id)]
                            
                            x1, y1, x2, y2 = box
                            if scale < 1:
                                x1, x2 = x1 / scale, x2 / scale
                                y1, y2 = y1 / scale, y2 / scale
                            
                            x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                            
                            if class_name == PERSON_CLASS:
                                persons.append({
                                    'bbox': (x1, y1, x2, y2),
                                    'center': ((x1 + x2)//2, (y1 + y2)//2),
                                    'ppe_worn': []
                                })
                            elif class_name in REQUIRED_PPE:
                                all_ppe_detections.append({
                                    'bbox': (x1, y1, x2, y2),
                                    'name': class_name,
                                    'used': False
                                })
                    
                    # Match PPE to persons (only if overlapping)
                    for person in persons:
                        person_box = person['bbox']
                        
                        for ppe in all_ppe_detections:
                            if not ppe['used']:
                                iou = calculate_iou(person_box, ppe['bbox'])
                                if iou > IOU_THRESHOLD:
                                    # PPE is being worn by this person
                                    person['ppe_worn'].append(ppe)
                                    ppe['used'] = True
                    
                    # Draw everything
                    # 1. Draw all PPE items (both worn and unused)
                    for ppe in all_ppe_detections:
                        x1, y1, x2, y2 = ppe['bbox']
                        if ppe['used']:
                            # Worn PPE - GREEN
                            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                            cv2.putText(frame, f"{ppe['name']} (WORN)", (x1, y1-5),
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                        else:
                            # Unused PPE - YELLOW
                            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2)
                            cv2.putText(frame, f"{ppe['name']} (UNUSED)", (x1, y1-5),
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
                    
                    # 2. Draw persons with compliance status
                    for idx, person in enumerate(persons):
                        x1, y1, x2, y2 = person['bbox']
                        worn_ppe_names = [ppe['name'] for ppe in person['ppe_worn']]
                        missing_ppe = [item for item in REQUIRED_PPE if item not in worn_ppe_names]
                        
                        # Determine color based on compliance
                        if len(missing_ppe) == 0:
                            color = (0, 255, 0)  # Green - Compliant
                            status = "PPE COMPLIANT"
                        else:
                            color = (0, 0, 255)  # Red - Violation
                            status = f"MISSING: {', '.join(missing_ppe)}"
                            
                            # Log violation
                            worker_id = f"Worker_{idx+1}"
                            person_key = f"{x1}_{y1}_{x2}_{y2}"
                            last_log = self.violation_cooldown.get(person_key, 0)
                            
                            if current_time - last_log > VIOLATION_COOLDOWN:
                                self.violation_cooldown[person_key] = current_time
                                
                                timestamp = time.strftime("%Y%m%d_%H%M%S")
                                filename = f"violation_{self.config['zone_id']}_{timestamp}_W{idx+1}.jpg"
                                filepath = os.path.join(SAVE_FOLDER, filename)
                                
                                margin = 20
                                crop = frame[
                                    max(0, y1-margin):min(frame.shape[0], y2+margin),
                                    max(0, x1-margin):min(frame.shape[1], x2+margin)
                                ]
                                
                                if crop.size > 0:
                                    cv2.imwrite(filepath, crop)
                                    log_violation(
                                        worker_id=f"Worker_{idx+1}",
                                        zone=self.config['zone_id'],
                                        missing_ppe=', '.join(missing_ppe),
                                        image_path=filepath
                                    )
                        
                        # Draw person bounding box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                        
                        # Draw status label
                        label_text = status
                        label_size = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                        cv2.rectangle(frame, (x1, y1-30), (x1 + label_size[0] + 10, y1-5), color, -1)
                        cv2.putText(frame, label_text, (x1 + 5, y1-10),
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                        
                        # Draw worn PPE list
                        y_offset = y1 - 35
                        for ppe in person['ppe_worn']:
                            cv2.putText(frame, f"{ppe['name']}", (x1 + 5, y_offset),
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1)
                            y_offset -= 18
                    
                except Exception as e:
                    print(f"Detection error in {self.config['zone_id']}: {e}")
            
            # Add overlay information
            cv2.putText(frame, self.config['zone_id'], (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            self.frame_count += 1
            if current_time - self.last_fps_time >= 1.0:
                self.fps = self.frame_count
                self.frame_count = 0
                self.last_fps_time = current_time
            
            cv2.putText(frame, f"FPS: {self.fps}", (10, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            
            # Legend
            legend_y = frame.shape[0] - 100
            cv2.putText(frame, "LEGEND:", (10, legend_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
            cv2.putText(frame, "Green Box: Worn PPE / Compliant Person", (10, legend_y + 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
            cv2.putText(frame, "Yellow Box: Unused PPE (lying around)", (10, legend_y + 35),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
            cv2.putText(frame, "Red Box: Person missing PPE (Violation)", (10, legend_y + 50),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
            
            with self.frame_lock:
                self.display_frame = frame
                self.current_frame = frame
    
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

# ========================= DISPLAY MANAGER =========================
class DisplayManager:
    def __init__(self):
        self.cameras = []
        self.running = True
        
    def add_camera(self, camera):
        self.cameras.append(camera)
        
    def run(self):
        for idx, cam in enumerate(self.cameras):
            cv2.namedWindow(cam.window_name, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(cam.window_name, 800, 600)
            row = idx // 2
            col = idx % 2
            cv2.moveWindow(cam.window_name, col * 820, row * 620)
        
        print("\n" + "="*70)
        print("PPE COMPLIANCE MONITORING SYSTEM - ALL CAMERAS ACTIVE")
        print("✓ GREEN Box: PPE being worn OR Person fully compliant")
        print("✓ RED Box: Person missing PPE (violation logged)")
        print("✓ YELLOW Box: PPE item NOT worn by anyone")
        print("Press 'q' in any window to quit")
        print("="*70 + "\n")
        
        while self.running:
            for cam in self.cameras:
                frame = cam.get_frame()
                if frame is not None:
                    cv2.imshow(cam.window_name, frame)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                self.running = False
                break
        
        cv2.destroyAllWindows()

# ========================= MAIN =========================
def signal_handler(sig, frame):
    print("\nShutting down PPE Monitoring System...")
    if 'display_manager' in globals():
        display_manager.running = False
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    
    init_db()
    
    cameras = []
    for cam_config in CAMERAS:
        if cam_config["enabled"]:
            cam = CameraProcessor(cam_config)
            cam.start()
            cameras.append(cam)
            time.sleep(0.3)
    
    display_manager = DisplayManager()
    for cam in cameras:
        display_manager.add_camera(cam)
    
    display_manager.run()
    
    for cam in cameras:
        cam.stop()
    
    print("PPE Monitoring System Stopped.")