from ultralytics import YOLO

# Load the latest YOLO26 nano model
model = YOLO("yolo26n.pt")

# Start training (VisDrone.yaml will auto-download)
model.train(data="VisDrone.yaml", epochs=100, imgsz=640)