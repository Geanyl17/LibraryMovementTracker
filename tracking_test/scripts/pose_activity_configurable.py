#!/usr/bin/env python3
"""
Configurable pose-based activity detection for webapp
Only runs pose detection on people inside zones (performance optimized)
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Suppress OpenCV warnings
os.environ['OPENCV_VIDEOIO_DEBUG'] = '0'
os.environ['OPENCV_LOG_LEVEL'] = 'ERROR'

from core.enhanced_tracker import EnhancedTracker
from core.pose_activity_detector import PoseActivityDetector


class PoseActivityTracker:
    """Zone tracker with pose-based activity detection"""

    def __init__(self, fps: int = 30):
        self.fps = fps
        self.frame_count = 0
        self.activity_detector = PoseActivityDetector()

        # Zone tracking data
        self.zone_entries: dict[int, dict[int, datetime]] = {}
        self.zone_activities: dict[int, dict[int, list[str]]] = {}
        self.analytics_data: list[dict] = []

    def initialize_zone(self, zone_id: int):
        """Initialize tracking data for a new zone"""
        if zone_id not in self.zone_entries:
            self.zone_entries[zone_id] = {}
            self.zone_activities[zone_id] = {}

    def update_zone_tracking(
        self,
        zone_id: int,
        detections_in_zone: sv.Detections,
        frame: np.ndarray
    ):
        """Update zone tracking with pose-based activity analysis"""
        self.initialize_zone(zone_id)

        current_time = datetime.now()
        frame_time = self.frame_count / self.fps

        # Process each person in the zone
        for i, tracker_id in enumerate(detections_in_zone.tracker_id):
            bbox = detections_in_zone.xyxy[i]

            # Detect activity using pose (ONLY for people inside zones)
            activity = self.activity_detector.classify_activity(
                person_id=tracker_id,
                frame=frame,
                bbox=bbox,
                timestamp=frame_time
            )

            # Track entry if new
            if tracker_id not in self.zone_entries[zone_id]:
                self.zone_entries[zone_id][tracker_id] = current_time
                self.zone_activities[zone_id][tracker_id] = []

            # Store activity
            self.zone_activities[zone_id][tracker_id].append(activity)

            # Log activity event
            self.analytics_data.append({
                'timestamp': current_time.isoformat(),
                'frame': self.frame_count,
                'frame_time_sec': round(frame_time, 2),
                'person_id': int(tracker_id),
                'zone_id': zone_id,
                'activity': activity,
                'bbox_x1': float(bbox[0]),
                'bbox_y1': float(bbox[1]),
                'bbox_x2': float(bbox[2]),
                'bbox_y2': float(bbox[3])
            })


def main():
    parser = argparse.ArgumentParser(description="Pose-based activity detection (configurable)")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--zones", required=True, help="Path to zone configuration JSON")
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO detection model")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="Device")
    parser.add_argument("--confidence", type=float, default=0.3, help="Detection confidence")
    parser.add_argument("--output", help="Output video path")
    parser.add_argument("--analytics", default="pose_analytics", help="Analytics output")
    parser.add_argument("--no-display", action="store_true", help="Disable display")

    # Enhanced tracking parameters
    parser.add_argument("--ghost-buffer-seconds", type=float, default=5.0, help="Ghost buffer duration")
    parser.add_argument("--ghost-iou-threshold", type=float, default=0.2, help="IoU threshold")
    parser.add_argument("--ghost-distance-threshold", type=float, default=200.0, help="Distance threshold")
    parser.add_argument("--fps", type=int, default=30, help="Video FPS")

    args = parser.parse_args()

    # Initialize models
    detection_model = YOLO(args.model)

    # Calculate ghost buffer frames
    ghost_buffer_frames = int(args.ghost_buffer_seconds * args.fps)

    # Enhanced tracker
    tracker = EnhancedTracker(
        track_activation_threshold=0.25,
        lost_track_buffer=150,
        minimum_matching_threshold=0.8,
        minimum_consecutive_frames=3,
        ghost_buffer_frames=ghost_buffer_frames,
        ghost_iou_threshold=args.ghost_iou_threshold,
        ghost_distance_threshold=args.ghost_distance_threshold
    )

    # Load zones
    with open(args.zones, 'r') as f:
        polygons = json.load(f)

    zones = []
    for polygon_points in polygons:
        polygon = np.array(polygon_points, dtype=np.int32)
        zone = sv.PolygonZone(
            polygon=polygon,
            triggering_anchors=(sv.Position.CENTER,)
        )
        zones.append(zone)

    # Video setup
    video_info = sv.VideoInfo.from_video_path(args.video)
    activity_tracker = PoseActivityTracker(fps=video_info.fps)

    # Activity colors (library-specific)
    activity_colors = {
        'standing': sv.Color.GREEN,
        'sitting': sv.Color.YELLOW,
        'reading': sv.Color.BLUE,
        'loitering': sv.Color.from_rgb_tuple((255, 165, 0)),
        'unknown': sv.Color.from_rgb_tuple((128, 128, 128))
    }

    # Video writer
    video_writer = None
    if args.output:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(
            args.output,
            fourcc,
            video_info.fps,
            (video_info.width, video_info.height)
        )

    frame_generator = sv.get_video_frames_generator(args.video)

    for frame in frame_generator:
        activity_tracker.frame_count += 1

        # Detection and tracking
        results = detection_model(frame, verbose=False, device=args.device, conf=args.confidence)[0]
        detections = sv.Detections.from_ultralytics(results)

        # Filter for person class
        person_mask = detections.class_id == 0
        detections = detections[person_mask]
        detections = tracker.update_with_detections(detections)

        annotated_frame = frame.copy()

        # Process each zone
        for zone_idx, zone in enumerate(zones):
            # Draw zone
            annotated_frame = sv.draw_polygon(
                scene=annotated_frame,
                polygon=zone.polygon,
                color=sv.Color.WHITE
            )

            # Get detections in zone
            detections_in_zone = detections[zone.trigger(detections)]

            if len(detections_in_zone) > 0:
                # ONLY run pose detection on people inside zones (performance optimization)
                activity_tracker.update_zone_tracking(zone_idx, detections_in_zone, frame)

                # Annotate with activity-based colors
                for i, tracker_id in enumerate(detections_in_zone.tracker_id):
                    bbox = detections_in_zone.xyxy[i]

                    # Get recent activity
                    recent_activity = "unknown"
                    if (zone_idx in activity_tracker.zone_activities and
                        tracker_id in activity_tracker.zone_activities[zone_idx] and
                        activity_tracker.zone_activities[zone_idx][tracker_id]):
                        recent_activity = activity_tracker.zone_activities[zone_idx][tracker_id][-1]

                    # Get color
                    color = activity_colors.get(recent_activity, sv.Color.from_rgb_tuple((128, 128, 128))).as_bgr()

                    # Draw bbox
                    cv2.rectangle(
                        annotated_frame,
                        (int(bbox[0]), int(bbox[1])),
                        (int(bbox[2]), int(bbox[3])),
                        color,
                        3
                    )

                    # Draw label (activity only, no ID)
                    label = recent_activity
                    label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]

                    cv2.rectangle(
                        annotated_frame,
                        (int(bbox[0]), int(bbox[1]) - label_size[1] - 10),
                        (int(bbox[0]) + label_size[0] + 10, int(bbox[1])),
                        color,
                        -1
                    )

                    cv2.putText(
                        annotated_frame,
                        label,
                        (int(bbox[0]) + 5, int(bbox[1]) - 5),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (255, 255, 255),
                        2
                    )

        # Add frame info
        frame_text = f"Frame: {activity_tracker.frame_count} | People: {len(detections)} | POSE-BASED"
        cv2.putText(annotated_frame, frame_text, (10, annotated_frame.shape[0] - 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # Save and display
        if video_writer:
            video_writer.write(annotated_frame)

        if not args.no_display:
            cv2.imshow("Activity Detection", annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    # Cleanup
    if video_writer:
        video_writer.release()
    if not args.no_display:
        cv2.destroyAllWindows()

    # Save analytics
    json_path = f"{args.analytics}.json"
    with open(json_path, 'w') as f:
        json.dump(activity_tracker.analytics_data, f, indent=2)

    # Save CSV
    csv_path = f"{args.analytics}.csv"
    if activity_tracker.analytics_data:
        fieldnames = activity_tracker.analytics_data[0].keys()
        with open(csv_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(activity_tracker.analytics_data)


if __name__ == "__main__":
    main()
