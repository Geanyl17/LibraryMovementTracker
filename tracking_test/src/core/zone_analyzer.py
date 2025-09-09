"""
Main zone analyzer class for video processing
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv

from .zone_tracker import ZoneTracker


class ZoneAnalyzer:
    """Main class for zone-based person tracking and analysis"""
    
    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        device: str = "cpu",
        confidence_threshold: float = 0.3,
        iou_threshold: float = 0.7
    ):
        self.model = YOLO(model_path)
        # Configure ByteTrack for better ID consistency
        self.tracker = sv.ByteTrack(
            track_activation_threshold=0.25,   # Lower threshold for activation
            lost_track_buffer=60,              # Keep lost tracks longer (60 frames)
            minimum_matching_threshold=0.3,    # Lower matching threshold
            minimum_consecutive_frames=1       # Activate tracks faster
        )
        self.device = device
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        
        # Color scheme for visualization
        self.colors = sv.ColorPalette.from_hex(["#E6194B", "#3CB44B", "#FFE119", "#3C76D1", "#F032E6"])
        self.color_annotator = sv.ColorAnnotator(color=self.colors)
        self.label_annotator = sv.LabelAnnotator(
            color=self.colors, text_color=sv.Color.from_hex("#000000")
        )
    
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
        
        print(f"Loaded {len(zones)} zones from {zone_config_path}")
        return zones
    
    def process_video(
        self,
        video_path: str,
        zone_config_path: str,
        output_path: Optional[str] = None,
        analytics_output: str = "zone_analytics.json",
        show_display: bool = True
    ):
        """Process video with zone tracking"""
        
        # Load zones and initialize tracking
        zones = self.load_zones(zone_config_path)
        video_info = sv.VideoInfo.from_video_path(video_path)
        zone_tracker = ZoneTracker(fps=video_info.fps)
        
        # Video writer setup
        video_writer = None
        if output_path:
            video_writer = cv2.VideoWriter(
                output_path,
                cv2.VideoWriter_fourcc(*'mp4v'),
                video_info.fps,
                (video_info.width, video_info.height)
            )
        
        cap = cv2.VideoCapture(video_path)
        
        print(f"Processing video: {video_path}")
        print(f"FPS: {video_info.fps}, Resolution: {video_info.width}x{video_info.height}")
        print(f"Total frames: {video_info.total_frames}")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            zone_tracker.frame_count += 1
            
            # Run YOLO detection - filter for person class (class_id = 0)
            results = self.model(frame, verbose=False, device=self.device, conf=self.confidence_threshold)[0]
            detections = sv.Detections.from_ultralytics(results)
            
            # Filter for person class only
            person_mask = detections.class_id == 0
            detections = detections[person_mask]
            
            # Apply NMS and tracking with better parameters
            detections = detections.with_nms(threshold=self.iou_threshold)
            detections = self.tracker.update_with_detections(detections)
            
            # Filter out detections without valid tracker IDs
            valid_tracker_mask = detections.tracker_id != -1
            detections = detections[valid_tracker_mask]
            
            # Process each zone
            annotated_frame = frame.copy()
            
            for zone_idx, zone in enumerate(zones):
                # Draw zone
                annotated_frame = sv.draw_polygon(
                    scene=annotated_frame,
                    polygon=zone.polygon,
                    color=self.colors.by_idx(zone_idx)
                )
                
                # Get detections in this zone
                detections_in_zone = detections[zone.trigger(detections)]
                person_ids_in_zone = set(detections_in_zone.tracker_id) if len(detections_in_zone) > 0 else set()
                
                # Update zone tracking
                zone_tracker.update_zone_tracking(zone_idx, person_ids_in_zone)
                
                # Annotate people in zone
                if len(detections_in_zone) > 0:
                    # Draw bounding boxes for people in zone
                    color = self.colors.by_idx(zone_idx).as_bgr()
                    for xyxy in detections_in_zone.xyxy:
                        cv2.rectangle(
                            annotated_frame, 
                            (int(xyxy[0]), int(xyxy[1])), 
                            (int(xyxy[2]), int(xyxy[3])), 
                            color, 
                            2
                        )
                    
                    # Add labels with person ID and time in zone
                    for i, (xyxy, person_id) in enumerate(zip(detections_in_zone.xyxy, detections_in_zone.tracker_id)):
                        # Calculate time in zone if person entered
                        time_in_zone = 0
                        if (zone_idx in zone_tracker.zone_entries and 
                            person_id in zone_tracker.zone_entries[zone_idx]):
                            entry_time = zone_tracker.zone_entries[zone_idx][person_id]
                            time_in_zone = (datetime.now() - entry_time).total_seconds()
                        
                        label = f"#{person_id} {int(time_in_zone//60):02d}:{int(time_in_zone%60):02d}"
                        
                        # Draw label background
                        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                        cv2.rectangle(
                            annotated_frame,
                            (int(xyxy[0]), int(xyxy[1]) - label_size[1] - 10),
                            (int(xyxy[0]) + label_size[0] + 10, int(xyxy[1])),
                            color,
                            -1
                        )
                        
                        # Draw label text
                        cv2.putText(
                            annotated_frame,
                            label,
                            (int(xyxy[0]) + 5, int(xyxy[1]) - 5),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.6,
                            (255, 255, 255),
                            2
                        )
                
                # Add zone info text
                zone_analytics = zone_tracker.get_zone_analytics(zone_idx)
                zone_text = f"Zone {zone_idx}: {zone_analytics['current_occupancy']} people"
                cv2.putText(
                    annotated_frame,
                    zone_text,
                    (10, 30 + zone_idx * 25),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    self.colors.by_idx(zone_idx).as_bgr(),
                    2
                )
            
            # Add frame info and detection stats
            active_ids = list(detections.tracker_id) if len(detections) > 0 else []
            frame_text = f"Frame: {zone_tracker.frame_count} | Time: {zone_tracker.frame_count/video_info.fps:.1f}s"
            ids_text = f"Active IDs: {len(active_ids)} | IDs: {active_ids[:5]}{'...' if len(active_ids) > 5 else ''}"
            
            cv2.putText(annotated_frame, frame_text, (10, annotated_frame.shape[0] - 40),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(annotated_frame, ids_text, (10, annotated_frame.shape[0] - 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Save frame and display
            if video_writer:
                video_writer.write(annotated_frame)
            
            if show_display:
                cv2.imshow("Zone Tracking", annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        # Cleanup
        cap.release()
        if video_writer:
            video_writer.release()
        if show_display:
            cv2.destroyAllWindows()
        
        # Export analytics
        zone_tracker.export_analytics(analytics_output)
        
        # Print final summary
        print("\n=== ZONE TRACKING SUMMARY ===")
        for zone_idx in range(len(zones)):
            analytics = zone_tracker.get_zone_analytics(zone_idx)
            print(f"Zone {zone_idx}:")
            print(f"  Total entries: {analytics['total_entries']}")
            print(f"  Average duration: {analytics['average_duration']:.1f}s")
            print(f"  Current occupancy: {analytics['current_occupancy']}")
            print()