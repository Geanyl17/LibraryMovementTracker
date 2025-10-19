"""
Main zone analyzer class for video processing
"""

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv

from .zone_tracker import ZoneTracker
from .enhanced_tracker import EnhancedTracker


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
        # Use EnhancedTracker with ghost buffer to prevent ID reassignment
        self.tracker = EnhancedTracker(
            track_activation_threshold=0.25,   # Lower threshold for initial detection
            lost_track_buffer=150,             # Keep lost tracks for 5 seconds at 30fps (more patient)
            minimum_matching_threshold=0.8,    # HIGHER threshold = stricter matching (fewer new IDs)
            minimum_consecutive_frames=3,      # Require 3 frames before assigning new ID (reduce noise)
            ghost_buffer_frames=150,           # Keep ghost tracks for 5 seconds at 30fps
            ghost_iou_threshold=0.2,           # LOWER = more lenient ghost matching
            ghost_distance_threshold=200.0     # HIGHER = match people further away
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
            # Use H.264 codec for better browser compatibility
            # Try different codecs in order of preference
            codecs = ['avc1', 'H264', 'X264', 'mp4v']
            video_writer = None

            for codec in codecs:
                try:
                    fourcc = cv2.VideoWriter_fourcc(*codec)
                    writer = cv2.VideoWriter(
                        output_path,
                        fourcc,
                        video_info.fps,
                        (video_info.width, video_info.height)
                    )
                    if writer.isOpened():
                        video_writer = writer
                        print(f"Using codec: {codec}")
                        break
                    else:
                        writer.release()
                except:
                    continue

            if not video_writer:
                print("Warning: Could not initialize video writer with preferred codec, using default")
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

            # Track which person IDs are in zones (for coloring)
            person_zone_mapping = {}  # person_id -> zone_idx

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

                # Map person IDs to zones
                for person_id in person_ids_in_zone:
                    person_zone_mapping[person_id] = zone_idx

            # Draw ALL detections (both in zones and outside zones)
            if len(detections) > 0:
                for i, (xyxy, person_id) in enumerate(zip(detections.xyxy, detections.tracker_id)):
                    # Determine color based on zone
                    if person_id in person_zone_mapping:
                        zone_idx = person_zone_mapping[person_id]
                        color = self.colors.by_idx(zone_idx).as_bgr()

                        # Calculate time in zone
                        time_in_zone = 0
                        if (zone_idx in zone_tracker.zone_entries and
                            person_id in zone_tracker.zone_entries[zone_idx]):
                            entry_time = zone_tracker.zone_entries[zone_idx][person_id]
                            time_in_zone = (datetime.now() - entry_time).total_seconds()

                        label = f"#{person_id} {int(time_in_zone//60):02d}:{int(time_in_zone%60):02d}"
                    else:
                        # Person outside zones - use gray
                        color = (128, 128, 128)
                        label = f"#{person_id}"

                    # Draw bounding box
                    cv2.rectangle(
                        annotated_frame,
                        (int(xyxy[0]), int(xyxy[1])),
                        (int(xyxy[2]), int(xyxy[3])),
                        color,
                        2
                    )

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

            # Add zone info text for each zone
            for zone_idx in range(len(zones)):
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
            ghost_count = self.tracker.get_ghost_count()

            frame_text = f"Frame: {zone_tracker.frame_count} | Time: {zone_tracker.frame_count/video_info.fps:.1f}s"
            ids_text = f"Active IDs: {len(active_ids)} | Ghosts: {ghost_count} | IDs: {active_ids[:5]}{'...' if len(active_ids) > 5 else ''}"

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

        # Re-encode video with H.264 for browser compatibility
        if output_path and os.path.exists(output_path):
            print("\nRe-encoding video with H.264 for browser compatibility...")
            temp_path = output_path.replace('.mp4', '_temp.mp4')
            os.rename(output_path, temp_path)

            try:
                # Use ffmpeg to re-encode with H.264
                ffmpeg_cmd = [
                    'ffmpeg', '-y', '-i', temp_path,
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                    '-pix_fmt', 'yuv420p',  # Ensure compatibility
                    output_path
                ]
                subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
                os.remove(temp_path)  # Remove temp file
                print(f"Video re-encoded successfully: {output_path}")
            except subprocess.CalledProcessError as e:
                print(f"Warning: Failed to re-encode video: {e}")
                print("Reverting to original encoding...")
                os.rename(temp_path, output_path)
            except FileNotFoundError:
                print("Warning: ffmpeg not found. Video may not be playable in browsers.")
                os.rename(temp_path, output_path)

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