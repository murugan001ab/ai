from ultralytics import YOLO

# 1. Load Ultralytics YOLO26
model = YOLO("yolo26n.pt")

# 2. Export to ONNX
onnx_path = model.export(format="onnx", imgsz=640, dynamic=True)

# 3. Export to TensorRT (NVIDIA GPU Optimized)
engine_path = model.export(format="engine", imgsz=640, dynamic=True, half=True)

# 4. Run inference with ONNX
onnx_model = YOLO("yolo26n.onnx")
onnx_results = onnx_model("https://ultralytics.com/images/bus.jpg")

# 5. Run inference with TensorRT
trt_model = YOLO("yolo26n.engine")
trt_results = trt_model("https://ultralytics.com/images/bus.jpg")
