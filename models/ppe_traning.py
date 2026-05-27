from ultralytics import YOLO

# Load the nano model - it's fast and perfect for Colab
model = YOLO("yolov8n.pt")

# Start training
results = model.train(
    data="construction-ppe.yaml",
    epochs=100,
    imgsz=640, # It Resizes images. 640 is the standard "goldilocks" resolution for YOLOv8.
    device=0  # This tells YOLO to use the GPU
)