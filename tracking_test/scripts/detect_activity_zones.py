"""
Activity detection with zone tracking integration (WEBAPP VERSION)
Uses Pose-Temporal detector for accurate activity classification + zone tracking
Exports CSV, JSON, and Excel analytics for the webapp
"""

import cv2
import sys
from pathlib import Path
import argparse
import json
import csv
from datetime import datetime
from collections import defaultdict

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from ultralytics import YOLO
from src.core.pose_temporal_detector import PoseTemporalDetector
from src.core.enhanced_tracker import EnhancedTracker
import supervision as sv
import numpy as np


def load_zones(zones_path):
    """Load zone polygons from JSON file"""
    with open(zones_path, 'r') as f:
        zones_data = json.load(f)

    # Convert to supervision PolygonZone objects
    zones = []
    for i, zone_polygon in enumerate(zones_data):
        polygon = np.array(zone_polygon, dtype=np.int32)
        # PolygonZone API changed - now just takes polygon
        zone = sv.PolygonZone(polygon=polygon)
        zones.append({
            'id': i,
            'zone': zone,
            'polygon': polygon
        })

    return zones


def main():
    parser = argparse.ArgumentParser(description="Activity Detection with Zone Tracking")
    parser.add_argument("--video", type=str, required=True, help="Path to video file")
    parser.add_argument("--zones", type=str, required=True, help="Path to zones JSON file")
    parser.add_argument("--output", type=str, required=True, help="Path to output video")
    parser.add_argument("--analytics", type=str, required=True, help="Path to analytics JSON output")
    parser.add_argument("--conf", type=float, default=0.3, help="Detection confidence threshold")
    parser.add_argument("--ghost-buffer-seconds", type=float, default=5.0, help="Ghost buffer duration")
    parser.add_argument("--ghost-iou-threshold", type=float, default=0.2, help="Ghost IoU threshold")
    parser.add_argument("--ghost-distance-threshold", type=float, default=200.0, help="Ghost distance threshold")
    parser.add_argument("--no-display", action="store_true", help="Don't display video while processing")
    args = parser.parse_args()

    VIDEO_PATH = args.video
    ZONES_PATH = args.zones
    OUTPUT_PATH = args.output
    ANALYTICS_PATH = args.analytics
    CONF_THRESHOLD = args.conf

    # Initialize models
    print("Initializing YOLO detector...")
    detector = YOLO("yolov8x.pt")

    print("Initializing Pose-Temporal activity detector...")
    activity_detector = PoseTemporalDetector(pose_model="yolov8x-pose.pt")

    # Load zones
    print(f"Loading zones from {ZONES_PATH}...")
    zones = load_zones(ZONES_PATH)
    print(f"Loaded {len(zones)} zones")

    # Initialize EnhancedTracker
    ghost_buffer_frames = int(args.ghost_buffer_seconds * 30)  # Assume 30fps
    tracker = EnhancedTracker(
        track_activation_threshold=0.25,
        lost_track_buffer=ghost_buffer_frames,
        minimum_matching_threshold=0.5,  # Lowered from 0.8 to prevent duplicate IDs for same person
        minimum_consecutive_frames=3,
        ghost_buffer_frames=ghost_buffer_frames,
        ghost_iou_threshold=args.ghost_iou_threshold,
        ghost_distance_threshold=args.ghost_distance_threshold
    )

    # Initialize annotators
    box_annotator = sv.BoxAnnotator(thickness=2)
    label_annotator = sv.LabelAnnotator(text_thickness=2, text_scale=0.8)

    # Zone annotator
    zone_colors = [
        sv.Color.from_hex("#FF6B6B"),
        sv.Color.from_hex("#4ECDC4"),
        sv.Color.from_hex("#45B7D1"),
        sv.Color.from_hex("#FFA07A"),
        sv.Color.from_hex("#98D8C8")
    ]

    # Open video
    video_info = sv.VideoInfo.from_video_path(VIDEO_PATH)
    frame_generator = sv.get_video_frames_generator(VIDEO_PATH)

    print(f"Processing video: {video_info.width}x{video_info.height} @ {video_info.fps}fps")
    print(f"Total frames: {video_info.total_frames}")

    # Create output video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(OUTPUT_PATH, fourcc, video_info.fps, (video_info.width, video_info.height))
    print(f"Saving output to: {OUTPUT_PATH}")

    # Analytics tracking
    analytics_data = []
    zone_stats = defaultdict(lambda: defaultdict(int))
    person_activities = defaultdict(lambda: defaultdict(int))

    frame_count = 0
    tracked_persons = set()

    for frame in frame_generator:
        frame_count += 1
        timestamp = frame_count / video_info.fps

        # Run detection
        # Lower NMS IoU threshold to 0.3 to better suppress overlapping detections
        results = detector(frame, conf=CONF_THRESHOLD, iou=0.3, classes=[0], verbose=False)[0]
        detections = sv.Detections.from_ultralytics(results)

        # Track objects
        detections = tracker.update_with_detections(detections)

        # Process each tracked person
        labels = []

        if detections.tracker_id is not None:
            for bbox, tracker_id in zip(detections.xyxy, detections.tracker_id):
                # Check which zone(s) person is in
                person_zones = []
                bbox_center = np.array([
                    (bbox[0] + bbox[2]) / 2,
                    (bbox[1] + bbox[3]) / 2
                ])

                for zone_info in zones:
                    # Check if this specific detection's center is in zone
                    if cv2.pointPolygonTest(zone_info['polygon'], tuple(bbox_center), False) >= 0:
                        person_zones.append(zone_info['id'])

                # Classify activity (only if in a zone for performance)
                activity = "no_pose"
                dominant_activity = "unknown"

                if len(person_zones) > 0:
                    activity = activity_detector.classify_activity(tracker_id, frame, bbox, timestamp)
                    dominant_activity = activity_detector.get_dominant_activity(tracker_id, window=10)

                # Create label
                zones_str = f"Z:{','.join(map(str, person_zones))}" if person_zones else "Outside"
                label = f"ID:{tracker_id} | {dominant_activity} | {zones_str}"
                labels.append(label)

                # Track data
                tracked_persons.add(tracker_id)

                # Record analytics
                for zone_id in person_zones:
                    analytics_data.append({
                        'frame': frame_count,
                        'timestamp': round(timestamp, 2),
                        'person_id': int(tracker_id),
                        'zone_id': zone_id,
                        'activity': dominant_activity,
                        'bbox_x1': float(bbox[0]),
                        'bbox_y1': float(bbox[1]),
                        'bbox_x2': float(bbox[2]),
                        'bbox_y2': float(bbox[3])
                    })

                    zone_stats[zone_id][dominant_activity] += 1
                    person_activities[tracker_id][dominant_activity] += 1

        # Annotate frame
        annotated_frame = frame.copy()

        # Draw zones
        for i, zone_info in enumerate(zones):
            color = zone_colors[i % len(zone_colors)]
            sv.draw_polygon(
                scene=annotated_frame,
                polygon=zone_info['polygon'],
                color=color,
                thickness=2
            )

            # Zone label
            centroid = zone_info['polygon'].mean(axis=0).astype(int)
            cv2.putText(
                annotated_frame,
                f"Zone {zone_info['id']}",
                tuple(centroid),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color.as_bgr(),
                2
            )

        # Draw detections
        annotated_frame = box_annotator.annotate(scene=annotated_frame, detections=detections)
        annotated_frame = label_annotator.annotate(
            scene=annotated_frame,
            detections=detections,
            labels=labels
        )

        # Add info overlay
        cv2.putText(
            annotated_frame,
            f"Frame: {frame_count}/{video_info.total_frames} | Tracked: {len(tracked_persons)} | Activity Detection: ON",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2
        )

        # Save to output
        out.write(annotated_frame)

        # Display
        if not args.no_display:
            cv2.imshow("Activity Detection with Zones", annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        # Progress update
        if frame_count % 30 == 0:
            progress = (frame_count / video_info.total_frames) * 100
            print(f"Progress: {frame_count}/{video_info.total_frames} ({progress:.1f}%)")

    # Cleanup
    out.release()
    cv2.destroyAllWindows()

    print(f"\nProcessing complete!")
    print(f"Total tracked persons: {len(tracked_persons)}")
    print(f"Total analytics records: {len(analytics_data)}")

    # Export analytics to JSON
    print(f"\nExporting analytics to JSON: {ANALYTICS_PATH}")
    with open(ANALYTICS_PATH, 'w') as f:
        json.dump({
            'metadata': {
                'video_file': VIDEO_PATH,
                'zones_file': ZONES_PATH,
                'total_frames': frame_count,
                'fps': video_info.fps,
                'total_tracked_persons': len(tracked_persons),
                'activity_detection': True,
                'processed_at': datetime.now().isoformat()
            },
            'zone_summary': {
                str(zone_id): dict(activities)
                for zone_id, activities in zone_stats.items()
            },
            'person_summary': {
                str(person_id): dict(activities)
                for person_id, activities in person_activities.items()
            },
            'detections': analytics_data
        }, f, indent=2)

    # Export to CSV
    csv_path = ANALYTICS_PATH.replace('.json', '.csv')
    print(f"Exporting analytics to CSV: {csv_path}")

    if analytics_data:
        with open(csv_path, 'w', newline='') as f:
            fieldnames = ['frame', 'timestamp', 'person_id', 'zone_id', 'activity',
                         'bbox_x1', 'bbox_y1', 'bbox_x2', 'bbox_y2']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(analytics_data)

    # Export to Excel
    excel_path = ANALYTICS_PATH.replace('.json', '.xlsx')
    print(f"Exporting analytics to Excel: {excel_path}")

    try:
        import pandas as pd

        # Create Excel with multiple sheets
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # Detections sheet
            if analytics_data:
                df_detections = pd.DataFrame(analytics_data)
                df_detections.to_excel(writer, sheet_name='Detections', index=False)

            # Zone summary sheet
            zone_summary_data = []
            for zone_id, activities in zone_stats.items():
                for activity, count in activities.items():
                    zone_summary_data.append({
                        'zone_id': zone_id,
                        'activity': activity,
                        'count': count
                    })
            if zone_summary_data:
                df_zone_summary = pd.DataFrame(zone_summary_data)
                df_zone_summary.to_excel(writer, sheet_name='Zone Summary', index=False)

            # Person summary sheet
            person_summary_data = []
            for person_id, activities in person_activities.items():
                total_frames = sum(activities.values())
                primary_activity = max(activities.items(), key=lambda x: x[1])
                person_summary_data.append({
                    'person_id': person_id,
                    'total_frames': total_frames,
                    'primary_activity': primary_activity[0],
                    'primary_activity_frames': primary_activity[1],
                    'primary_activity_percentage': round((primary_activity[1] / total_frames) * 100, 1)
                })
            if person_summary_data:
                df_person_summary = pd.DataFrame(person_summary_data)
                df_person_summary.to_excel(writer, sheet_name='Person Summary', index=False)

        print(f"✓ Excel export complete")
    except ImportError:
        print("⚠ pandas not available, skipping Excel export")

    print(f"\n✓ All analytics exported successfully!")
    print(f"  - JSON: {ANALYTICS_PATH}")
    print(f"  - CSV: {csv_path}")
    print(f"  - Excel: {excel_path}")


if __name__ == "__main__":
    main()
