# Webapp Activity Detection Integration

## Overview
The webapp now has **full integration** with the new Pose-Temporal activity detection system. Users can enable activity detection via a checkbox, and the system will automatically classify activities for people in zones.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Webapp                         │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ Video Upload   │→ │ Zone Selector  │→ │ VideoProcessor│ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
│                                                   ↓          │
│                                          [Activity Checkbox] │
└──────────────────────────────────────────────────┬──────────┘
                                                   ↓
                                     ┌─────────────────────────┐
                                     │   API Route Handler     │
                                     │  /api/process-video     │
                                     └─────────┬───────────────┘
                                               ↓
                      ┌────────────────────────┴────────────────────────┐
                      ↓                                                  ↓
         ┌────────────────────────┐                    ┌────────────────────────┐
         │  track_zones_          │                    │ detect_activity_       │
         │  configurable.py       │                    │ zones.py               │
         │                        │                    │                        │
         │ - Zone tracking only   │                    │ - Zone tracking        │
         │ - EnhancedTracker      │                    │ - EnhancedTracker      │
         │ - No activity detect   │                    │ - PoseTemporalDetector │
         └────────────────────────┘                    └────────────────────────┘
                      ↓                                                  ↓
         ┌────────────────────────┐                    ┌────────────────────────┐
         │   CSV, JSON, Excel     │                    │   CSV, JSON, Excel     │
         │   (zone data only)     │                    │   (zone + activity)    │
         └────────────────────────┘                    └────────────────────────┘
                                                                  ↓
                                                   ┌──────────────────────────┐
                                                   │  ActivityAnalytics.js    │
                                                   │  - Activity distribution │
                                                   │  - Person activities     │
                                                   │  - Zone activities       │
                                                   └──────────────────────────┘
```

## Components

### 1. Backend Script: `detect_activity_zones.py`

**Location:** `tracking_test/scripts/detect_activity_zones.py`

**Purpose:** Integrates zone tracking with pose-temporal activity detection

**Features:**
- Uses `EnhancedTracker` for consistent person IDs
- Uses `PoseTemporalDetector` for activity classification
- Only runs pose detection on people **inside zones** (performance optimization)
- Exports CSV, JSON, and Excel analytics
- Annotated video output with zones, IDs, and activities

**Activities Detected:**
- `sitting` - Person sitting down
- `reading` - Person reading while sitting (head tilted)
- `reading_standing` - Person reading while standing
- `standing` - Person standing still
- `walking_slow` - Slow walking (< 100 px/sec)
- `walking` - Normal walking (100-200 px/sec)
- `walking_fast` - Fast walking (200-350 px/sec)
- `jogging` - Jogging pace (350-700 px/sec)
- `running` - Running (> 700 px/sec)

**Usage:**
```bash
python scripts/detect_activity_zones.py \
  --video data/uploads/video.mp4 \
  --zones config/zones/zones.json \
  --output outputs/videos/processed.mp4 \
  --analytics outputs/analytics.json \
  --conf 0.3 \
  --ghost-buffer-seconds 5 \
  --ghost-iou-threshold 0.2 \
  --ghost-distance-threshold 200 \
  --no-display
```

### 2. API Route: `/api/process-video`

**Location:** `website/webapp/src/app/api/process-video/route.js`

**Changes:**
- Removed `usePoseDetection` parameter (always uses Pose-Temporal now)
- Simplified logic: checkbox ON → use `detect_activity_zones.py`, OFF → use `track_zones_configurable.py`
- Passes all tracking parameters to Python script

**Request Parameters:**
```javascript
{
  video: File,
  zones: JSON,
  confidence: number,
  detectActivity: boolean,  // NEW: enables activity detection
  ghostBufferSeconds: number,
  ghostIouThreshold: number,
  ghostDistanceThreshold: number
}
```

**Response:**
```javascript
{
  success: true,
  activityDetection: boolean,
  files: {
    processedVideo: string,
    csvPath: string,
    jsonPath: string,
    excelPath: string
  },
  timestamp: number
}
```

### 3. VideoProcessor Component

**Location:** `website/webapp/src/app/components/VideoProcessor.js`

**Changes:**
- Single checkbox: "Enable Activity Detection (Pose-Temporal)"
- Removed sub-option for pose detection (always enabled now)
- Updated UI text to reflect Pose-Temporal capabilities
- Shows all detected activity types in description

**UI Features:**
- Confidence slider (0.1 - 0.9)
- Activity detection checkbox with description
- Advanced tracking settings (collapsible)
- Ghost buffer configuration
- Real-time processing status

### 4. ActivityAnalytics Component

**Location:** `website/webapp/src/app/components/ActivityAnalytics.js`

**Changes:**
- Updated color scheme for new activity types
- Added all pose-temporal activities (sitting, reading, walking variants, jogging, running)
- Added info banner explaining Pose-Temporal detector
- Better visual representation of activities

**Color Scheme:**
- 🟡 Sitting
- 🟠 Reading
- 🟢 Standing
- 🔵 Walking (with variants)
- 🔴 Running

## Data Flow

### CSV Output Format

When activity detection is enabled:

```csv
frame,timestamp,person_id,zone_id,activity,bbox_x1,bbox_y1,bbox_x2,bbox_y2
1,0.03,1,0,standing,245.2,102.1,389.4,512.8
2,0.07,1,0,standing,246.1,102.5,390.2,513.1
3,0.10,1,0,walking,247.8,103.2,391.5,514.3
...
```

### JSON Output Format

```json
{
  "metadata": {
    "video_file": "path/to/video.mp4",
    "zones_file": "path/to/zones.json",
    "total_frames": 1500,
    "fps": 30.0,
    "total_tracked_persons": 12,
    "activity_detection": true,
    "processed_at": "2025-10-26T20:00:00"
  },
  "zone_summary": {
    "0": {
      "standing": 450,
      "walking": 230,
      "sitting": 120
    }
  },
  "person_summary": {
    "1": {
      "standing": 200,
      "walking": 150
    }
  },
  "detections": [...]
}
```

## Performance

### Processing Speed
- **With Activity Detection:** ~10-15 FPS (YOLOv8x + YOLOv8x-Pose)
- **Without Activity Detection:** ~20-25 FPS (YOLOv8x only)

### Optimization
- Activity detection only runs on people **inside zones**
- People outside zones are tracked but not classified
- Uses same `EnhancedTracker` instance (no duplicate tracking)

### Memory Usage
- **Moderate:** Stores 30 frames of keypoint history per person
- **Cleanup:** Automatically removes data for lost tracks

## Configuration

### Activity Thresholds

Edit in `src/core/pose_temporal_detector.py`:

```python
self.standing_speed_threshold = 25.0    # px/sec
self.walking_slow_threshold = 100.0     # px/sec
self.walking_threshold = 200.0          # px/sec
self.fast_walking_threshold = 350.0     # px/sec
self.running_speed_threshold = 700.0    # px/sec
self.sitting_hip_angle_max = 120.0      # degrees
self.reading_head_angle_min = 30.0      # degrees
```

### Tracker Settings

Configured via webapp UI (Advanced Settings):

- **Ghost Buffer Duration:** 5 seconds (default)
- **IoU Threshold:** 0.2 (default)
- **Distance Threshold:** 200 px (default)

## Testing

### End-to-End Test

1. **Start webapp:**
   ```bash
   cd website/webapp
   npm run dev
   ```

2. **Upload video** (e.g., library CCTV footage)

3. **Draw zones** around areas of interest

4. **Enable Activity Detection** checkbox

5. **Process video**

6. **Review results:**
   - Processed video with activity labels
   - CSV with activity data
   - Activity analytics dashboard

### Expected Results

For a typical library CCTV video:
- **Activities detected:** sitting (60%), standing (20%), walking (15%), reading (5%)
- **Zones:** Reading area (mostly sitting/reading), entrance (mostly walking)
- **Processing time:** ~2-3x video duration

## Troubleshooting

### Issue: "No pose detected"

**Cause:** Person too far from camera or occluded

**Solution:** Adjust confidence threshold or camera angle

### Issue: Activities flickering

**Cause:** Using raw classification instead of dominant activity

**Solution:** Script already uses `get_dominant_activity(window=10)` for smoothing

### Issue: Slow processing

**Cause:** Running on CPU or too many people

**Solution:**
- Use GPU if available
- Increase confidence threshold to reduce detections
- Reduce video resolution

### Issue: Wrong activity classification

**Cause:** Thresholds not calibrated for camera setup

**Solution:** Adjust thresholds in `pose_temporal_detector.py` based on camera height/angle

## Future Enhancements

Potential improvements:
- [ ] Real-time processing (websocket streaming)
- [ ] Activity duration tracking (how long person sits/stands)
- [ ] Alert system for suspicious activities
- [ ] Multi-camera support
- [ ] Activity heatmaps over time
- [ ] Person re-identification across zones

## Credits

- **YOLOv8:** Ultralytics
- **Supervision:** Roboflow
- **EnhancedTracker:** Custom implementation with ghost buffer
- **PoseTemporalDetector:** Custom pose + temporal analysis
