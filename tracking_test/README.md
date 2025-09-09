# Zone-Based Person Tracking System

A comprehensive person tracking system that monitors people entering and exiting user-defined zones, with detailed analytics on time spent in each zone.

## Project Structure

```
tracking_test/
├── src/                    # Source code
│   ├── core/              # Core tracking classes
│   │   ├── zone_tracker.py      # Zone entry/exit tracking
│   │   ├── activity_detector.py # Activity classification
│   │   └── zone_analyzer.py     # Main video processing
│   ├── ui/                # User interface tools
│   │   └── zone_configurator.py # Interactive zone drawing
│   └── utils/             # Utility functions
│       ├── interactive_zone_creator.py
│       └── legacy_track.py
├── scripts/               # Executable scripts
│   ├── configure_zones.py  # Zone configuration script
│   ├── track_zones.py     # Zone tracking script
│   └── detect_activity.py # Activity detection script
├── data/                  # Data files
│   ├── models/           # YOLO model files
│   ├── zones/            # Zone configurations
│   ├── videos/           # Input videos
│   └── outputs/          # Generated outputs
├── config/               # Configuration files
│   └── zones/           # Zone JSON files
├── requirements.txt
└── README.md
```

## Features

- **ByteTrack Integration**: Uses robust ByteTrack for reliable person tracking
- **Interactive Zone Configuration**: Draw custom zones with user-friendly interface
- **Entry/Exit Detection**: Tracks when people enter and leave zones
- **Time Analytics**: Measures how long people spend in each zone
- **Activity Detection**: Classifies activities (walking, standing, running, etc.)
- **Real-time Visualization**: Live display with person IDs and timers
- **Data Export**: Exports detailed analytics to CSV, Excel, and JSON

## Installation

```bash
pip install -r requirements.txt
```

## Quick Start

### 1. Configure Zones

First, create zones by drawing on your video:

```bash
python scripts/configure_zones.py --source data/videos/your_video.mp4 --output config/zones/zones.json
```

**Controls:**
- **Left Click**: Add point to current zone
- **ENTER**: Complete current zone
- **ESC**: Cancel current zone
- **u**: Undo last zone
- **c**: Clear all zones
- **s**: Save zones
- **h**: Show help
- **q**: Quit

### 2. Run Zone Tracking

Process your video with the configured zones:

```bash
python scripts/track_zones.py --video data/videos/your_video.mp4 --zones config/zones/zones.json --output data/outputs/tracked_output.mp4
```

**Arguments:**
- `--video`: Input video file
- `--zones`: Zone configuration JSON file
- `--model`: YOLO model (default: yolov8n.pt)
- `--device`: cpu or cuda (default: cpu)
- `--confidence`: Detection confidence threshold (default: 0.3)
- `--iou`: IoU threshold for NMS (default: 0.7)
- `--output`: Output video path (optional)
- `--analytics`: Analytics output file (default: zone_analytics.json)
- `--no-display`: Disable video display

### 3. Activity Detection (Optional)

Run activity detection for behavioral analysis:

```bash
python scripts/detect_activity.py --video data/videos/your_video.mp4 --zones config/zones/zones.json --output data/outputs/activity_output.mp4
```

## Example Usage

```bash
# Configure zones interactively
python scripts/configure_zones.py --source data/videos/store_footage.mp4 --output config/zones/store_zones.json

# Run tracking with GPU acceleration
python scripts/track_zones.py \
  --video data/videos/store_footage.mp4 \
  --zones config/zones/store_zones.json \
  --device cuda \
  --confidence 0.4 \
  --output data/outputs/tracked_store.mp4 \
  --analytics data/outputs/store_analytics.json

# Run activity detection
python scripts/detect_activity.py \
  --video data/videos/store_footage.mp4 \
  --zones config/zones/store_zones.json \
  --output data/outputs/activity_store.mp4 \
  --analytics data/outputs/activity_analytics.json
```

## Output Analytics

The system generates comprehensive analytics:

### 1. Event Log (CSV)
Detailed log of all entry/exit events:
```csv
timestamp,frame,frame_time_sec,person_id,zone_id,event,duration_sec
2024-01-01T10:00:01,150,5.0,1,0,entry,
2024-01-01T10:00:15,450,15.0,1,0,exit,10.5
```

### 2. Summary Analytics (JSON)
Zone-level summary statistics:
```json
{
  "total_frames": 3000,
  "total_duration_sec": 100.0,
  "zones": {
    "0": {
      "zone_id": 0,
      "current_occupancy": 2,
      "current_people": [1, 3],
      "total_entries": 15,
      "total_exits": 13,
      "average_duration": 8.5,
      "durations_by_person": {
        "1": 25.2,
        "2": 12.1
      }
    }
  }
}
```

### 3. Activity Analytics
When using activity detection, additional data includes:
- Activity classifications per person
- Activity frequency analysis
- Behavioral pattern detection

## Key Components

### Core Classes

- **ZoneTracker**: Manages zone entry/exit events and time tracking
- **ActivityDetector**: Classifies human activities based on movement patterns
- **ZoneAnalyzer**: Main video processing engine with YOLO + ByteTrack
- **ZoneConfigurator**: Interactive zone drawing interface

### Scripts

- **configure_zones.py**: Interactive zone configuration tool
- **track_zones.py**: Main zone tracking processor
- **detect_activity.py**: Activity detection and analysis

## Zone Configuration Format

Zones are stored as JSON arrays of polygon coordinates:

```json
[
  [[100, 200], [300, 200], [300, 400], [100, 400]],
  [[500, 150], [700, 150], [600, 300]]
]
```

Each zone is a polygon defined by (x, y) coordinate points.

## Performance Tips

1. **Use GPU**: Add `--device cuda` for faster processing
2. **Adjust Confidence**: Lower `--confidence` for more detections
3. **Optimize Zones**: Keep zones simple for better performance
4. **Model Selection**: Use `yolov8s.pt` or larger for better accuracy

## API Usage

```python
# Programmatic usage
from src.core.zone_analyzer import ZoneAnalyzer
from src.ui.zone_configurator import ZoneConfigurator

# Configure zones programmatically
configurator = ZoneConfigurator("video.mp4")
configurator.run("zones.json")

# Run analysis
analyzer = ZoneAnalyzer(model_path="yolov8n.pt", device="cuda")
analyzer.process_video(
    video_path="video.mp4",
    zone_config_path="zones.json",
    output_path="output.mp4",
    analytics_output="analytics.json"
)
```

## Integration Notes

- **Supervision Library**: Built on the supervision framework for robust computer vision pipelines
- **ByteTrack**: Uses ByteTrack for consistent person ID tracking across frames
- **YOLO**: Supports all YOLOv8 model variants for person detection
- **Multi-format Export**: CSV, Excel, and JSON output formats for easy integration

## Why This Architecture?

- **Modular Design**: Clean separation between UI, core logic, and scripts
- **Extensible**: Easy to add new tracking features or analysis methods  
- **Maintainable**: Well-organized code structure with clear responsibilities
- **Professional**: Production-ready with comprehensive error handling and documentation

This system provides a complete solution for zone-based person analytics with professional-grade tracking and comprehensive data export capabilities.