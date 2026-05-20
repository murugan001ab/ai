import cv2
from ultralytics import YOLO

# ================= LOAD YOLO MODEL =================
model = YOLO("yolov8n.pt")

# ================= RTSP URLs =================
urls = [
    # "rtsp://192.168.0.122:8554/cam1",
    # "rtsp://192.168.0.122:8554/cam2",
    # "rtsp://192.168.0.122:8554/cam3",
    "rtsp://192.168.0.122:8554/cam4"
]

# ================= OPEN CAMERAS =================
caps = []

for url in urls:

    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)

    if not cap.isOpened():
        print(f"Failed to open: {url}")

    # Reduce latency
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    caps.append(cap)

# ================= MAIN LOOP =================
while True:

    for i, cap in enumerate(caps):

        ret, frame = cap.read()

        if not ret:
            print(f"Frame failed from Camera {i+1}")
            continue

        # ================= YOLO DETECTION =================
        results = model(frame)

        for result in results:

            boxes = result.boxes

            for box in boxes:

                cls = int(box.cls[0])

                # COCO class 0 = person
                if cls == 0:

                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    conf = float(box.conf[0])

                    label = f"Person {conf:.2f}"

                    # Draw rectangle
                    cv2.rectangle(
                        frame,
                        (x1, y1),
                        (x2, y2),
                        (0, 255, 0),
                        2
                    )

                    # Draw label
                    cv2.putText(
                        frame,
                        label,
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 255, 0),
                        2
                    )

        # ================= SHOW CAMERA =================
        cv2.imshow(f"Camera {i+1}", frame)

    # ================= EXIT =================
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# ================= CLEANUP =================
for cap in caps:
    cap.release()

cv2.destroyAllWindows()