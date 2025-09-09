#!/usr/bin/env python3
"""
Script to run activity detection analysis
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv

# Add src to path  
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.activity_detector import ActivityDetector


class ActivityZoneTracker:
    """Zone tracker with activity detection capabilities"""
    
    def __init__(self, fps: int = 30):
        self.fps = fps
        self.frame_count = 0
        self.activity_detector = ActivityDetector()
        
        # Zone tracking data
        self.zone_entries: Dict[int, Dict[int, datetime]] = {}
        self.zone_activities: Dict[int, Dict[int, List[str]]] = {}  # zone -> person -> activities
        self.analytics_data: List[Dict] = []
        
    def initialize_zone(self, zone_id: int):
        """Initialize tracking data for a new zone"""
        if zone_id not in self.zone_entries:
            self.zone_entries[zone_id] = {}
            self.zone_activities[zone_id] = {}
    
    def update_zone_tracking(self, zone_id: int, detections_in_zone: sv.Detections):
        """Update zone tracking with activity analysis"""
        self.initialize_zone(zone_id)
        
        current_time = datetime.now()
        frame_time = self.frame_count / self.fps
        
        # Process each person in the zone
        for i, tracker_id in enumerate(detections_in_zone.tracker_id):
            bbox = detections_in_zone.xyxy[i]
            
            # Detect activity
            activity = self.activity_detector.classify_activity(
                person_id=tracker_id,
                bbox=bbox,
                timestamp=frame_time
            )
            
            # Track entry if new
            if tracker_id not in self.zone_entries[zone_id]:
                self.zone_entries[zone_id][tracker_id] = current_time
                self.zone_activities[zone_id][tracker_id] = []
                print(f"Person {tracker_id} entered Zone {zone_id}: {activity}")
            
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


class ActivityVideoProcessor:
    """Video processor with activity detection"""
    
    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        device: str = "cpu",
        confidence_threshold: float = 0.3
    ):
        self.model = YOLO(model_path)
        self.tracker = sv.ByteTrack()
        self.device = device
        self.confidence_threshold = confidence_threshold
        
        # Activity colors
        self.activity_colors = {
            'standing': sv.Color.GREEN,
            'walking': sv.Color.BLUE,
            'walking_slow': sv.Color.from_rgb_tuple((0, 255, 255)),  # Cyan
            'running': sv.Color.RED,
            'sitting/crouching': sv.Color.YELLOW,
            'loitering': sv.Color.from_rgb_tuple((255, 165, 0)),     # Orange
            'erratic_movement': sv.Color.from_rgb_tuple((255, 0, 255)), # Magenta
            'potential_fall': sv.Color.WHITE,
            'unknown': sv.Color.from_rgb_tuple((128, 128, 128))      # Gray
        }
    
    def load_zones(self, zone_config_path: str) -> List[sv.PolygonZone]:
        """Load zones from configuration file"""
        with open(zone_config_path, 'r') as f:
            polygons = json.load(f)
        
        zones = []
        for polygon_points in polygons:
            polygon = np.array(polygon_points, dtype=np.int32)
            zone = sv.PolygonZone(
                polygon=polygon,
                triggering_anchors=(sv.Position.CENTER,)
            )
            zones.append(zone)
        
        return zones
    
    def process_video(
        self,
        video_path: str,
        zone_config_path: str,
        output_path: str = None,
        analytics_output: str = "activity_analytics.json",
        show_display: bool = True
    ):
        """Process video with activity detection"""
        
        zones = self.load_zones(zone_config_path)
        zone_annotators = [
            sv.PolygonZoneAnnotator(zone=zone, color=sv.Color.WHITE, thickness=2)
            for zone in zones
        ]
        
        video_info = sv.VideoInfo.from_video_path(video_path)
        activity_tracker = ActivityZoneTracker(fps=video_info.fps)
        
        # Video writer
        video_writer = None
        if output_path:
            video_writer = cv2.VideoWriter(
                output_path,
                cv2.VideoWriter_fourcc(*'mp4v'),
                video_info.fps,
                (video_info.width, video_info.height)
            )
        
        frame_generator = sv.get_video_frames_generator(video_path)
        
        print(f"Processing video with activity detection: {video_path}")
        
        for frame in frame_generator:
            activity_tracker.frame_count += 1
            
            # Detection and tracking
            results = self.model(frame, verbose=False, device=self.device, conf=self.confidence_threshold)[0]
            detections = sv.Detections.from_ultralytics(results)
            
            # Filter for person class
            person_mask = detections.class_id == 0
            detections = detections[person_mask]
            detections = self.tracker.update_with_detections(detections)
            
            annotated_frame = frame.copy()
            
            # Process each zone
            for zone_idx, (zone, zone_annotator) in enumerate(zip(zones, zone_annotators)):
                # Draw zone
                annotated_frame = zone_annotator.annotate(annotated_frame)
                
                # Get detections in zone
                detections_in_zone = detections[zone.trigger(detections)]
                
                if len(detections_in_zone) > 0:
                    # Update activity tracking
                    activity_tracker.update_zone_tracking(zone_idx, detections_in_zone)
                    
                    # Annotate with activity-based colors
                    for i, tracker_id in enumerate(detections_in_zone.tracker_id):
                        bbox = detections_in_zone.xyxy[i]
                        
                        # Get recent activity for this person
                        recent_activity = "unknown"
                        if (zone_idx in activity_tracker.zone_activities and 
                            tracker_id in activity_tracker.zone_activities[zone_idx] and
                            activity_tracker.zone_activities[zone_idx][tracker_id]):
                            recent_activity = activity_tracker.zone_activities[zone_idx][tracker_id][-1]
                        
                        # Get activity color
                        color = self.activity_colors.get(recent_activity, sv.Color.from_rgb_tuple((128, 128, 128))).as_bgr()
                        
                        # Draw bounding box with activity color
                        cv2.rectangle(
                            annotated_frame,
                            (int(bbox[0]), int(bbox[1])),
                            (int(bbox[2]), int(bbox[3])),
                            color,
                            3
                        )
                        
                        # Draw activity label
                        label = f"#{tracker_id}: {recent_activity}"
                        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
                        
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
                            0.5,
                            (255, 255, 255),
                            2
                        )
            
            # Add activity legend
            self._draw_activity_legend(annotated_frame)
            
            # Add frame info
            frame_text = f"Frame: {activity_tracker.frame_count} | People: {len(detections)}"
            cv2.putText(annotated_frame, frame_text, (10, annotated_frame.shape[0] - 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Save and display
            if video_writer:
                video_writer.write(annotated_frame)
            
            if show_display:
                cv2.imshow("Activity Detection", annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        # Cleanup
        if video_writer:
            video_writer.release()
        if show_display:
            cv2.destroyAllWindows()
        
        print("\n=== ACTIVITY DETECTION COMPLETE ===")
    
    def _draw_activity_legend(self, frame: np.ndarray):
        """Draw activity color legend"""
        y_start = 30
        for i, (activity, color) in enumerate(self.activity_colors.items()):
            y_pos = y_start + i * 25
            
            # Draw color box
            cv2.rectangle(frame, (10, y_pos - 10), (30, y_pos + 10), color.as_bgr(), -1)
            
            # Draw text
            cv2.putText(frame, activity, (40, y_pos + 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)


def main():
    parser = argparse.ArgumentParser(description="Privacy-friendly activity detection")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--zones", required=True, help="Path to zone configuration JSON")
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO model path")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="Device")
    parser.add_argument("--confidence", type=float, default=0.3, help="Confidence threshold")
    parser.add_argument("--output", help="Output video path (optional)")
    parser.add_argument("--analytics", default="activity_analytics.json", help="Analytics output")
    parser.add_argument("--no-display", action="store_true", help="Disable video display")
    
    args = parser.parse_args()
    
    processor = ActivityVideoProcessor(
        model_path=args.model,
        device=args.device,
        confidence_threshold=args.confidence
    )
    
    processor.process_video(
        video_path=args.video,
        zone_config_path=args.zones,
        output_path=args.output,
        analytics_output=args.analytics,
        show_display=not args.no_display
    )


if __name__ == "__main__":
    main()