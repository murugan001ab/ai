import cv2
import numpy as np
import time
import os
import psycopg2
from ultralytics import YOLO

from dotenv import load_dotenv


import torch
from ultralytics import YOLO
from dotenv import load_dotenv
from threading import Thread, Lock
import signal
import sys
from collections import deque

# ========================= LOAD ENV =========================
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT")
<<<<<<< HEAD
# ========================= MODEL =========================
model = YOLO("yolo11n-pose.pt")

# ========================= SETTINGS =========================
IDLE_THRESHOLD_SECONDS = 10
MOTION_SENSITIVITY = 0.005

ZONE_ID = "Zone 1"
SAVE_FOLDER = "idle_snapshots"

os.makedirs(SAVE_FOLDER, exist_ok=True)

=======

# ========================= OPTIMIZATION SETTINGS =========================
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "fflags;nobuffer"

# ========================= MODEL =========================
model = YOLO("yolo11n.onnx", task="detect")
if torch.cuda.is_available():
    model.to('cuda')
    print("Using GPU acceleration")
else:
    print("Using CPU - will be slower")

# ========================= SETTINGS =========================
IDLE_THRESHOLD_SECONDS = 10
MOTION_DISTANCE_THRESHOLD = 25  # Increased - requires significant body movement
HAND_MOVEMENT_THRESHOLD = 20     # Increased - requires clear arm/hand movement
DETECTION_INTERVAL = 0.3
MAX_TRACK_AGE = 50
CLEANUP_INTERVAL = 300

SAVE_FOLDER = "../storage/idle_snapshots"
os.makedirs(SAVE_FOLDER, exist_ok=True)

# ========================= CAMERA CONFIGURATION =========================
CAMERAS = [
    {"url": "rtsp://192.168.0.122:8554/cam1", "zone_id": "Zone 1", "enabled": True},
    {"url": "rtsp://192.168.0.122:8554/cam2", "zone_id": "Zone 2", "enabled": True},
    {"url": "rtsp://192.168.0.122:8554/cam3", "zone_id": "Zone 3", "enabled": True},
    {"url": "rtsp://192.168.0.122:8554/cam4", "zone_id": "Zone 4", "enabled": True}
]

>>>>>>> c3504d3f1525d446ac879e649fa46a2baddfd655
# ========================= DATABASE =========================
DB_PARAMS = {
    "host": DB_HOST,
    "database": DB_NAME,
    "user": DB_USER,
    "password": DB_PASSWORD,
    "port": DB_PORT,
    "sslmode": "require"
}

def init_db():
<<<<<<< HEAD
    conn = psycopg2.connect(**DB_PARAMS)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS inactivity_log (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            zone_id TEXT,
            worker_id TEXT,
            idle_duration_seconds INTEGER,
            image_path TEXT
        );
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Database Ready")

def log_idle_event(zone, worker_id, duration, image_path):
    conn = psycopg2.connect(**DB_PARAMS)
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO inactivity_log (zone_id, worker_id, idle_duration_seconds, image_path)
        VALUES (%s, %s, %s, %s)
    """, (zone, worker_id, int(duration), image_path))

    conn.commit()
    cur.close()
    conn.close()

# ========================= INIT =========================
init_db()

# ========================= TRACKING =========================
person_history = {}
id_map = {}
next_id = 1

print("System Started...")

# ========================= YOLO TRACK =========================
results = model.track(
    source=1,
    stream=True,
    persist=True,
    tracker="bytetrack.yaml"
)

# ========================= MAIN LOOP =========================
for result in results:

    frame = result.orig_img.copy()
    current_time = time.time()

    if result.boxes.id is None:
        cv2.imshow("Monitor", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        continue

    boxes = result.boxes.xyxy.cpu().numpy()
    track_ids = result.boxes.id.cpu().numpy().astype(int)

    for box, tid in zip(boxes, track_ids):

        x1, y1, x2, y2 = map(int, box)

        # assign simple display ID
        if tid not in id_map:
            id_map[tid] = next_id
            next_id += 1

        display_id = id_map[tid]

        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2

        if tid not in person_history:
            person_history[tid] = {
                "last_pos": (cx, cy),
                "start_time": current_time,
                "idle_logged": False
            }

        last_x, last_y = person_history[tid]["last_pos"]
        dist = np.sqrt((cx - last_x)**2 + (cy - last_y)**2)

        # ================= ACTIVE =================
        if dist > 20:
            person_history[tid]["last_pos"] = (cx, cy)
            person_history[tid]["start_time"] = current_time
            person_history[tid]["idle_logged"] = False

            status = "ACTIVE"
            color = (0, 255, 0)

        # ================= IDLE =================
        else:
            idle_time = current_time - person_history[tid]["start_time"]

            if idle_time > IDLE_THRESHOLD_SECONDS:
                status = f"IDLE {int(idle_time)}s"
                color = (0, 0, 255)

                if not person_history[tid]["idle_logged"]:

                    timestamp = time.strftime("%Y%m%d_%H%M%S")

                    filename = f"worker_{display_id}_{timestamp}.jpg"
                    path = os.path.join(SAVE_FOLDER, filename)

                    crop = frame[y1:y2, x1:x2]
                    cv2.imwrite(path, crop)

                    log_idle_event(
                        ZONE_ID,
                        f"Worker_{display_id}",
                        idle_time,
                        path
                    )

                    person_history[tid]["idle_logged"] = True

            else:
                status = "Watching..."
                color = (0, 255, 255)

        # DRAW
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            frame,
            f"ID {display_id}: {status}",
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2
        )

    cv2.imshow("AI Monitoring System", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cv2.destroyAllWindows()
=======
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS inactivity_log (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                zone_id TEXT,
                worker_id TEXT,
                idle_duration_seconds INTEGER,
                image_path TEXT
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
        print(f"Database ready.")
    except Exception as e:
        print(f"DB Init Error: {e}")

def log_idle_event(zone, worker_id, duration, image_path):
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO inactivity_log (zone_id, worker_id, idle_duration_seconds, image_path)
            VALUES (%s, %s, %s, %s)
        """, (zone, worker_id, int(duration), image_path))
        conn.commit()
        cur.close()
        conn.close()
        print(f"Logged: {worker_id} in {zone} (idle: {int(duration)}s)")
    except Exception as e:
        print(f"Logging Error: {e}")

# ========================= MOTION DETECTOR =========================
class MotionDetector:
    def __init__(self, history_size=15):
        self.history_size = history_size
        self.position_history = deque(maxlen=history_size)
        self.bbox_history = deque(maxlen=history_size)
        self.last_motion_time = time.time()
        self.small_motions = 0  # Counter for small movements
        
    def update(self, current_center, current_bbox):
        """Update motion detection and return if person is active"""
        current_time = time.time()
        
        # Add current data to history
        self.position_history.append(current_center)
        self.bbox_history.append(current_bbox)
        
        if len(self.position_history) < 5:
            self.last_motion_time = current_time
            return True  # Not enough history, assume active
        
        # Calculate center movement (body movement)
        prev_center = self.position_history[-2]
        center_movement = np.sqrt(
            (current_center[0] - prev_center[0])**2 + 
            (current_center[1] - prev_center[1])**2
        )
        
        # Calculate bounding box changes (arm/hand movements)
        if len(self.bbox_history) >= 2:
            prev_bbox = self.bbox_history[-2]
            width_change = abs((current_bbox[2] - current_bbox[0]) - (prev_bbox[2] - prev_bbox[0]))
            height_change = abs((current_bbox[3] - current_bbox[1]) - (prev_bbox[3] - prev_bbox[1]))
            bbox_movement = max(width_change, height_change)
        else:
            bbox_movement = 0
        
        # Only consider significant movements as activity
        # Small movements (like breathing, slight swaying) are ignored
        significant_movement = (
            center_movement > MOTION_DISTANCE_THRESHOLD or
            bbox_movement > HAND_MOVEMENT_THRESHOLD
        )
        
        # If significant movement detected, reset timer
        if significant_movement:
            self.last_motion_time = current_time
            self.small_motions = 0
            return True
        else:
            # Check for small movements - don't reset idle timer for tiny movements
            if center_movement > 5 or bbox_movement > 5:
                self.small_motions += 1
                # Only reset if there are several small movements (not just breathing)
                if self.small_motions > 10:
                    self.last_motion_time = current_time
                    self.small_motions = 0
                    return True
            
            return False
    
    def get_idle_duration(self, current_time):
        """Get current idle duration in seconds"""
        return current_time - self.last_motion_time

# ========================= TRACKER =========================
class PersistentTracker:
    def __init__(self, max_distance=50, max_age=50):
        self.next_id = 1
        self.tracks = {}
        self.max_distance = max_distance
        self.max_age = max_age
        self.frame_count = 0
        
    def update(self, detections):
        """Update tracks with new detections and return matched tracks"""
        self.frame_count += 1
        
        # Mark all tracks as lost initially
        for tid in self.tracks:
            self.tracks[tid]['lost_frames'] += 1
        
        # Match detections to existing tracks
        used_detections = set()
        matched_tracks = []
        
        for tid, track in self.tracks.items():
            best_match = -1
            best_score = self.max_distance
            
            for i, det in enumerate(detections):
                if i in used_detections:
                    continue
                
                # Calculate distance
                track_cx, track_cy = track['last_position']
                det_cx, det_cy = det['center']
                dist = np.sqrt((track_cx - det_cx)**2 + (track_cy - det_cy)**2)
                
                # Calculate IoU
                iou = self._calculate_iou(track['last_bbox'], det['bbox'])
                
                # Combined score
                score = dist * (1 - iou)
                
                if score < best_score:
                    best_score = score
                    best_match = i
            
            if best_match >= 0:
                used_detections.add(best_match)
                det = detections[best_match]
                
                # Update track
                track['last_position'] = det['center']
                track['last_bbox'] = det['bbox']
                track['lost_frames'] = 0
                track['last_seen'] = self.frame_count
                
                matched_tracks.append((tid, det))
        
        # Create new tracks for unmatched detections
        for i, det in enumerate(detections):
            if i not in used_detections:
                new_id = self.next_id
                self.next_id += 1
                
                self.tracks[new_id] = {
                    'last_position': det['center'],
                    'last_bbox': det['bbox'],
                    'lost_frames': 0,
                    'last_seen': self.frame_count,
                    'created_at': self.frame_count
                }
                
                matched_tracks.append((new_id, det))
        
        # Clean up old tracks
        if self.frame_count % CLEANUP_INTERVAL == 0:
            to_delete = [tid for tid, track in self.tracks.items() 
                        if track['lost_frames'] > self.max_age]
            for tid in to_delete:
                del self.tracks[tid]
            
            if len(self.tracks) == 0:
                self.next_id = 1
        
        return matched_tracks
    
    def _calculate_iou(self, bbox1, bbox2):
        """Calculate Intersection over Union"""
        x1_1, y1_1, x2_1, y2_1 = bbox1
        x1_2, y1_2, x2_2, y2_2 = bbox2
        
        xi1 = max(x1_1, x1_2)
        yi1 = max(y1_1, y1_2)
        xi2 = min(x2_1, x2_2)
        yi2 = min(y2_1, y2_2)
        
        if xi2 <= xi1 or yi2 <= yi1:
            return 0.0
        
        intersection = (xi2 - xi1) * (yi2 - yi1)
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0.0

# ========================= CAMERA PROCESSOR =========================
class OptimizedCameraProcessor:
    def __init__(self, camera_config):
        self.config = camera_config
        self.cap = None
        self.running = False
        self.thread = None
        
        # Frame buffers
        self.current_frame = None
        self.display_frame = None
        self.frame_lock = Lock()
        
        # Detection optimization
        self.last_detection_time = 0
        self.detection_interval = DETECTION_INTERVAL
        
        # Tracking
        self.tracker = PersistentTracker(max_distance=50, max_age=45)
        self.motion_detectors = {}  # tid -> MotionDetector
        
        # Display
        self.window_name = f"{self.config['zone_id']}"
        
        # Performance metrics
        self.fps = 0
        self.last_fps_time = time.time()
        self.frame_count = 0
        
        # ID mapping
        self.display_ids = {}  # track_id -> display_id
        self.next_display_id = 1
        self.last_log_time = {}  # tid -> last log time
        
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
            
        print(f"Started: {self.config['zone_id']}")
        
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
            current_time = time.time()
            
            # Run detection
            if current_time - self.last_detection_time >= self.detection_interval:
                self.last_detection_time = current_time
                
                # Resize for faster detection
                h, w = frame.shape[:2]
                scale = 640 / max(h, w)
                if scale < 1:
                    new_w = int(w * scale)
                    new_h = int(h * scale)
                    detect_frame = cv2.resize(frame, (new_w, new_h))
                else:
                    detect_frame = frame
                
                try:
                    results = model(detect_frame, classes=[0], conf=0.3, iou=0.5, verbose=False)
                    
                    detections = []
                    if len(results) > 0 and results[0].boxes is not None:
                        boxes = results[0].boxes.xyxy.cpu().numpy()
                        
                        for box in boxes:
                            x1, y1, x2, y2 = box
                            
                            if scale < 1:
                                x1, x2 = x1 / scale, x2 / scale
                                y1, y2 = y1 / scale, y2 / scale
                            
                            x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                            cx = (x1 + x2) // 2
                            cy = (y1 + y2) // 2
                            
                            detections.append({
                                'bbox': (x1, y1, x2, y2),
                                'center': (cx, cy)
                            })
                    
                    # Update tracking
                    tracked_objects = self.tracker.update(detections)
                    
                    # Process tracked objects
                    for tid, det in tracked_objects:
                        x1, y1, x2, y2 = det['bbox']
                        
                        # Get or create display ID
                        if tid not in self.display_ids:
                            self.display_ids[tid] = self.next_display_id
                            self.next_display_id += 1
                        
                        display_id = self.display_ids[tid]
                        
                        # Initialize motion detector for this person
                        if tid not in self.motion_detectors:
                            self.motion_detectors[tid] = MotionDetector(history_size=15)
                        
                        # Check if person is active
                        motion_detector = self.motion_detectors[tid]
                        is_active = motion_detector.update(det['center'], det['bbox'])
                        
                        # Get idle duration
                        idle_duration = motion_detector.get_idle_duration(current_time)
                        
                        # Determine status
                        if is_active:
                            status = "ACTIVE"
                            color = (0, 255, 0)  # Green
                        else:
                            if idle_duration > IDLE_THRESHOLD_SECONDS:
                                status = f"IDLE {int(idle_duration)}s"
                                color = (0, 0, 255)  # Red
                                
                                # Log idle event
                                last_log = self.last_log_time.get(tid, 0)
                                if current_time - last_log > 30:
                                    timestamp = time.strftime("%Y%m%d_%H%M%S")
                                    filename = f"worker_{display_id}_{self.config['zone_id']}_{timestamp}.jpg"
                                    path = os.path.join(SAVE_FOLDER, filename)
                                    
                                    crop = frame[y1:y2, x1:x2]
                                    if crop.size > 0:
                                        cv2.imwrite(path, crop)
                                        log_idle_event(
                                            self.config['zone_id'],
                                            f"Worker_{display_id}",
                                            idle_duration,
                                            path
                                        )
                                        self.last_log_time[tid] = current_time
                            else:
                                status = "INACTIVE"
                                color = (0, 255, 255)  # Yellow - present but not moving enough
                        
                        # Draw bounding box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        
                        # Add status label
                        label = f"Worker {display_id}: {status}"
                        cv2.putText(frame, label, (x1, y1-10), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                    
                    # Cleanup old entries
                    if len(self.display_ids) > len(self.tracker.tracks) + 10:
                        active_tids = set(self.tracker.tracks.keys())
                        old_ids = [tid for tid in self.display_ids.keys() if tid not in active_tids]
                        for tid in old_ids:
                            del self.display_ids[tid]
                            if tid in self.motion_detectors:
                                del self.motion_detectors[tid]
                        
                        if len(self.display_ids) == 0:
                            self.next_display_id = 1
                
                except Exception as e:
                    pass
            
            # Add overlay info
            cv2.putText(frame, self.config['zone_id'], (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Calculate and show FPS
            self.frame_count += 1
            if current_time - self.last_fps_time >= 1.0:
                self.fps = self.frame_count
                self.frame_count = 0
                self.last_fps_time = current_time
            
            cv2.putText(frame, f"FPS: {self.fps}", (10, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            
            # Show statistics
            active_count = 0
            for tid in self.display_ids.keys():
                if tid in self.motion_detectors:
                    if self.motion_detectors[tid].get_idle_duration(current_time) < IDLE_THRESHOLD_SECONDS:
                        active_count += 1
            
            cv2.putText(frame, f"Workers: {active_count}/{len(self.display_ids)}", (10, 90),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Store for display
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
        print("ALL 4 CAMERAS ACTIVE - PRACTICAL MOTION DETECTION")
        print("✓ ACTIVE (Green) - Significant body or arm movement")
        print("✓ INACTIVE (Yellow) - Present but minimal movement")
        print("✓ IDLE (Red) - No significant movement for 10+ seconds")
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
    print("\nShutting down...")
    if 'display_manager' in globals():
        display_manager.running = False
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    init_db()
    
    cameras = []
    for cam_config in CAMERAS:
        if cam_config["enabled"]:
            cam = OptimizedCameraProcessor(cam_config)
            cam.start()
            cameras.append(cam)
            time.sleep(0.3)
    
    display_manager = DisplayManager()
    for cam in cameras:
        display_manager.add_camera(cam)
    
    display_manager.run()
    
    for cam in cameras:
        cam.stop()
    
    print("System stopped.")
>>>>>>> c3504d3f1525d446ac879e649fa46a2baddfd655
