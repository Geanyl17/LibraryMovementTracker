# Activity Detection Integration Guide

## Overview
The Pose-Temporal activity detector can be used as an **optional add-on** to your existing zone tracking system. It uses the same `EnhancedTracker` for consistent ID tracking.

## Architecture

### Separate but Compatible
```
Zone Tracking (Always On)
    ↓
EnhancedTracker (Shared ID System)
    ↓
Activity Detection (Optional - Checkbox in Webapp)
```

## Components

### 1. Core Detector
**File:** `src/core/pose_temporal_detector.py`
- Uses YOLOv8-Pose for keypoint detection
- Temporal analysis for activity classification
- Conservative thresholds (600px/sec for running)

**Activities Detected:**
- `sitting`, `reading`, `reading_standing`
- `standing`
- `walking_slow`, `walking`, `walking_fast`
- `jogging`, `running`

### 2. Standalone Script
**File:** `scripts/detect_activity.py`
- Uses `EnhancedTracker` (same as zone tracking)
- Command-line interface
- Video output support

## Webapp Integration

### Option 1: Activity Detection as Optional Module

```python
from src.core.enhanced_tracker import EnhancedTracker
from src.core.pose_temporal_detector import PoseTemporalDetector

# Initialize tracker (shared between zone tracking and activity detection)
tracker = EnhancedTracker(
    track_activation_threshold=0.25,
    lost_track_buffer=150,
    minimum_matching_threshold=0.8,
    minimum_consecutive_frames=3,
    ghost_buffer_frames=150,
    ghost_iou_threshold=0.2,
    ghost_distance_threshold=200.0
)

# Optional: Initialize activity detector (based on checkbox)
activity_detector = None
if enable_activity_detection:  # User checkbox
    activity_detector = PoseTemporalDetector(pose_model="yolov8x-pose.pt")

# Main processing loop
for frame in video:
    # 1. Detect people
    detections = yolo_model(frame)

    # 2. Track with EnhancedTracker (always)
    tracked_detections = tracker.update_with_detections(detections)

    # 3. Optionally classify activities
    if activity_detector:
        for tracker_id, bbox in tracked_detections:
            activity = activity_detector.classify_activity(
                tracker_id,
                frame,
                bbox,
                timestamp
            )
            # Store or display activity
```

### Option 2: Unified Wrapper Class

```python
class WebappTracker:
    def __init__(self, enable_activity_detection=False):
        # Always initialize EnhancedTracker
        self.tracker = EnhancedTracker(
            track_activation_threshold=0.25,
            lost_track_buffer=150,
            minimum_matching_threshold=0.8,
            minimum_consecutive_frames=3,
            ghost_buffer_frames=150,
            ghost_iou_threshold=0.2,
            ghost_distance_threshold=200.0
        )

        # Optionally initialize activity detector
        self.activity_detector = None
        if enable_activity_detection:
            self.activity_detector = PoseTemporalDetector()

    def process_frame(self, frame, detections, timestamp):
        # Track people
        tracked = self.tracker.update_with_detections(detections)

        # Optionally detect activities
        activities = {}
        if self.activity_detector:
            for tracker_id, bbox in tracked:
                activity = self.activity_detector.classify_activity(
                    tracker_id, frame, bbox, timestamp
                )
                activities[tracker_id] = activity

        return tracked, activities
```

## Usage Examples

### Command Line (Standalone)
```bash
# With activity detection
python scripts/detect_activity.py \
    --video data/videos/library.mp4 \
    --output output/result.mp4 \
    --show

# Zone tracking (existing)
python scripts/track_zones_configurable.py \
    --video data/videos/library.mp4 \
    --zones data/zones/library.json \
    --output output/zones.mp4
```

### Python API
```python
from src.core.enhanced_tracker import EnhancedTracker
from src.core.pose_temporal_detector import PoseTemporalDetector

# Setup
tracker = EnhancedTracker(...)
activity_detector = PoseTemporalDetector()

# Per frame
detections = tracker.update_with_detections(yolo_results)

for tracker_id, bbox in detections:
    # Get activity
    activity = activity_detector.classify_activity(
        person_id=tracker_id,
        frame=current_frame,
        bbox=bbox,
        timestamp=frame_timestamp
    )

    # Get smoothed activity (recommended)
    dominant = activity_detector.get_dominant_activity(tracker_id, window=10)
```

## Configuration

### Activity Thresholds
Edit `src/core/pose_temporal_detector.py`:

```python
# Adjust these based on your camera setup
self.standing_speed_threshold = 25.0    # px/sec
self.walking_slow_threshold = 100.0     # px/sec
self.walking_threshold = 200.0          # px/sec
self.fast_walking_threshold = 350.0     # px/sec
self.running_speed_threshold = 600.0    # px/sec (very conservative)
```

### Tracker Settings
Both zone tracking and activity detection use the same `EnhancedTracker` settings:

```python
EnhancedTracker(
    track_activation_threshold=0.25,       # Detection confidence
    lost_track_buffer=150,                 # 5 sec patience
    minimum_matching_threshold=0.8,        # ID matching strictness
    minimum_consecutive_frames=3,          # Frames before new ID
    ghost_buffer_frames=150,               # Re-ID window
    ghost_iou_threshold=0.2,
    ghost_distance_threshold=200.0
)
```

## Benefits of Shared Tracker

1. **Consistent IDs**: Activity detection uses same IDs as zone tracking
2. **Better Re-identification**: EnhancedTracker maintains IDs during occlusions
3. **Lower Resource Usage**: Only one tracker instance needed
4. **Synchronized Data**: Activities and zone events use same person IDs

## Performance

- **FPS:** ~15-20 FPS (with activity detection enabled)
- **Accuracy:** High for library CCTV (slow movements)
- **Memory:** Moderate (stores 30 frames of keypoint history per person)

## Webapp Checkbox Logic

```javascript
// Frontend
<input type="checkbox" id="enableActivity" name="activity_detection">
<label for="enableActivity">Enable Activity Detection</label>

// Backend (Flask/FastAPI example)
@app.route('/process', methods=['POST'])
def process_video():
    enable_activity = request.form.get('activity_detection') == 'on'

    tracker = WebappTracker(enable_activity_detection=enable_activity)

    for frame in video:
        tracked, activities = tracker.process_frame(frame, detections, timestamp)

        # Return data
        response = {
            'tracked_people': tracked,
            'activities': activities if enable_activity else None
        }
```

## Testing

Verify ID consistency:
```bash
# Run zone tracking
python scripts/track_zones_configurable.py --video test.mp4 --zones zones.json

# Run activity detection on same video
python scripts/detect_activity.py --video test.mp4 --output activity.mp4

# Compare IDs - they should match!
```

## Notes

- Activity detection adds ~5-10ms per person per frame
- Pose detection may fail in crowded scenes or with occlusions
- Use `get_dominant_activity()` for smoother labels (recommended over raw classification)
- Adjust `running_speed_threshold` based on camera height/angle
