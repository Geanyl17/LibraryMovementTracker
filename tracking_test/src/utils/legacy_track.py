import cv2
import pandas as pd
from ultralytics import YOLO
from strong_sort.strong_sort import StrongSORT
from strong_sort.utils.parser import get_config
import time

# =====================
# CONFIG
# =====================
VIDEO_PATH = "video.mp4"
YOLO_WEIGHTS = "yolov8n.pt"
REID_MODEL = "osnet_x0_25_msmt17.pt"
CONFIG_PATH = "path/to/strong_sort/configs/strong_sort.yaml"
CSV_OUTPUT = "tracking_log.csv"
XLSX_OUTPUT = "tracking_log.xlsx"
DEVICE = "cuda"  # or 'cpu'

# =====================
# LOAD MODELS
# =====================
print("[INFO] Loading YOLOv8...")
model = YOLO(YOLO_WEIGHTS)

print("[INFO] Loading StrongSORT config...")
cfg = get_config()
cfg.merge_from_file(CONFIG_PATH)

print("[INFO] Initializing StrongSORT...")
tracker = StrongSORT(
    model_weights=REID_MODEL,
    device=DEVICE,
    half=True,
    max_dist=cfg.STRONGSORT.MAX_DIST,
    max_iou_distance=cfg.STRONGSORT.MAX_IOU_DISTANCE,
    max_age=cfg.STRONGSORT.MAX_AGE,
    n_init=cfg.STRONGSORT.N_INIT,
    nn_budget=cfg.STRONGSORT.NN_BUDGET
)

# =====================
# VIDEO LOOP
# =====================
cap = cv2.VideoCapture(VIDEO_PATH)
fps = cap.get(cv2.CAP_PROP_FPS)

tracking_data = []
frame_num = 0

print("[INFO] Starting video tracking...")
while True:
    ret, frame = cap.read()
    if not ret:
        break
    frame_num += 1
    timestamp = frame_num / fps

    # Run YOLO detection
    results = model(frame)[0]

    detections = []
    for box in results.boxes:
        xyxy = box.xyxy.cpu().numpy().flatten()
        conf = float(box.conf.cpu().numpy())
        cls = int(box.cls.cpu().numpy())
        detections.append([*xyxy, conf, cls])

    # Update tracker
    tracks = tracker.update(detections, frame)

    # Draw and log
    for track in tracks:
        x1, y1, x2, y2, track_id = track[:5]
        cls = int(track[5]) if len(track) > 5 else -1  # Sometimes tracker adds class info
        conf = float(track[6]) if len(track) > 6 else None

        cv2.putText(frame, f"ID {track_id}", (int(x1), int(y1) - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)

        tracking_data.append({
            "frame": frame_num,
            "time_sec": round(timestamp, 2),
            "track_id": int(track_id),
            "class_id": cls,
            "confidence": conf,
            "x1": int(x1),
            "y1": int(y1),
            "x2": int(x2),
            "y2": int(y2)
        })

    cv2.imshow("Tracking", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

# =====================
# SAVE RESULTS
# =====================
print(f"[INFO] Saving tracking data to {CSV_OUTPUT} and {XLSX_OUTPUT}...")
df = pd.DataFrame(tracking_data)
df.to_csv(CSV_OUTPUT, index=False)
df.to_excel(XLSX_OUTPUT, index=False)

print("[INFO] Tracking complete.")
