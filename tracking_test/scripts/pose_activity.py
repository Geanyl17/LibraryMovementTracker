#!/usr/bin/env python3
"""
Pose-based activity detection using YOLOv8-pose
"""

import argparse
import json
import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv
from typing import Dict, List


class PoseActivityDetector:
    """Detect activities based on pose keypoints"""

    # COCO keypoint indices
    NOSE = 0
    LEFT_EYE = 1
    RIGHT_EYE = 2
    LEFT_EAR = 3
    RIGHT_EAR = 4
    LEFT_SHOULDER = 5
    RIGHT_SHOULDER = 6
    LEFT_ELBOW = 7
    RIGHT_ELBOW = 8
    LEFT_WRIST = 9
    RIGHT_WRIST = 10
    LEFT_HIP = 11
    RIGHT_HIP = 12
    LEFT_KNEE = 13
    RIGHT_KNEE = 14
    LEFT_ANKLE = 15
    RIGHT_ANKLE = 16

    def __init__(self):
        self.pose_history: Dict[int, List] = {}

    def calculate_angle(self, p1, p2, p3):
        """Calculate angle between three points"""
        if p1 is None or p2 is None or p3 is None:
            return None

        vector1 = np.array([p1[0] - p2[0], p1[1] - p2[1]])
        vector2 = np.array([p3[0] - p2[0], p3[1] - p2[1]])

        dot_product = np.dot(vector1, vector2)
        magnitude1 = np.linalg.norm(vector1)
        magnitude2 = np.linalg.norm(vector2)

        if magnitude1 == 0 or magnitude2 == 0:
            return None

        cos_angle = dot_product / (magnitude1 * magnitude2)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        angle = np.arccos(cos_angle)

        return np.degrees(angle)

    def get_keypoint(self, keypoints, index, confidence_threshold=0.5):
        """Extract keypoint if confidence is above threshold"""
        if index >= len(keypoints):
            return None

        kp = keypoints[index]
        if len(kp) < 3:
            return None

        x, y, conf = kp[0], kp[1], kp[2]

        if conf < confidence_threshold:
            return None

        return (float(x), float(y))

    def classify_pose_activity(self, keypoints, person_id: int) -> str:
        """Classify activity based on pose keypoints"""

        # Extract key points
        left_shoulder = self.get_keypoint(keypoints, self.LEFT_SHOULDER)
        right_shoulder = self.get_keypoint(keypoints, self.RIGHT_SHOULDER)
        left_hip = self.get_keypoint(keypoints, self.LEFT_HIP)
        right_hip = self.get_keypoint(keypoints, self.RIGHT_HIP)
        left_knee = self.get_keypoint(keypoints, self.LEFT_KNEE)
        right_knee = self.get_keypoint(keypoints, self.RIGHT_KNEE)
        left_ankle = self.get_keypoint(keypoints, self.LEFT_ANKLE)
        right_ankle = self.get_keypoint(keypoints, self.RIGHT_ANKLE)
        nose = self.get_keypoint(keypoints, self.NOSE)

        # Calculate torso angle (vertical = standing, horizontal = lying)
        if left_shoulder and left_hip:
            torso_vertical = abs(left_hip[1] - left_shoulder[1])
            torso_horizontal = abs(left_hip[0] - left_shoulder[0])
            torso_angle = np.degrees(np.arctan2(torso_horizontal, torso_vertical))
        elif right_shoulder and right_hip:
            torso_vertical = abs(right_hip[1] - right_shoulder[1])
            torso_horizontal = abs(right_hip[0] - right_shoulder[0])
            torso_angle = np.degrees(np.arctan2(torso_horizontal, torso_vertical))
        else:
            return "unknown"

        # Calculate knee angles
        left_knee_angle = None
        right_knee_angle = None

        if left_hip and left_knee and left_ankle:
            left_knee_angle = self.calculate_angle(left_hip, left_knee, left_ankle)

        if right_hip and right_knee and right_ankle:
            right_knee_angle = self.calculate_angle(right_hip, right_knee, right_ankle)

        # Store current pose for movement analysis
        if person_id not in self.pose_history:
            self.pose_history[person_id] = []

        current_pose = {
            'left_ankle': left_ankle,
            'right_ankle': right_ankle,
            'left_knee_angle': left_knee_angle,
            'right_knee_angle': right_knee_angle,
            'torso_angle': torso_angle
        }

        self.pose_history[person_id].append(current_pose)
        if len(self.pose_history[person_id]) > 10:
            self.pose_history[person_id] = self.pose_history[person_id][-10:]

        # Classify based on pose
        # Sitting/Crouching: bent knees + upright torso
        if (left_knee_angle and left_knee_angle < 120) or (right_knee_angle and right_knee_angle < 120):
            if torso_angle < 30:  # Torso relatively upright
                return "sitting/crouching"

        # Lying down: torso horizontal
        if torso_angle > 60:
            return "lying_down"

        # Check for walking/running based on ankle movement
        if len(self.pose_history[person_id]) >= 5:
            ankle_movements = []
            for i in range(1, min(5, len(self.pose_history[person_id]))):
                prev = self.pose_history[person_id][-i-1]
                curr = self.pose_history[person_id][-i]

                # Check left ankle movement
                if prev['left_ankle'] and curr['left_ankle']:
                    dist = np.linalg.norm(np.array(curr['left_ankle']) - np.array(prev['left_ankle']))
                    ankle_movements.append(dist)

                # Check right ankle movement
                if prev['right_ankle'] and curr['right_ankle']:
                    dist = np.linalg.norm(np.array(curr['right_ankle']) - np.array(prev['right_ankle']))
                    ankle_movements.append(dist)

            if ankle_movements:
                avg_movement = np.mean(ankle_movements)

                # Walking: moderate ankle movement
                if avg_movement > 5 and avg_movement < 30:
                    return "walking"
                # Running: high ankle movement
                elif avg_movement >= 30:
                    return "running"

        # Default: standing
        return "standing"


def main():
    parser = argparse.ArgumentParser(description="Pose-based activity detection")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--zones", help="Path to zone configuration JSON (optional)")
    parser.add_argument("--model", default="yolov8n-pose.pt", help="YOLO pose model")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"])
    parser.add_argument("--confidence", type=float, default=0.5, help="Confidence threshold")
    parser.add_argument("--output", help="Output video path")
    parser.add_argument("--analytics", default="pose_activity.json", help="Analytics output")
    parser.add_argument("--no-display", action="store_true", help="Disable display")

    args = parser.parse_args()

    # Load model
    print(f"Loading pose model: {args.model}")
    model = YOLO(args.model)

    # Tracker
    tracker = sv.ByteTrack(
        track_activation_threshold=0.5,
        lost_track_buffer=30,
        minimum_matching_threshold=0.7,
        minimum_consecutive_frames=3
    )

    # Activity detector
    activity_detector = PoseActivityDetector()

    # Load zones if provided
    zones = []
    if args.zones:
        with open(args.zones, 'r') as f:
            polygons = json.load(f)
        for polygon_points in polygons:
            polygon = np.array(polygon_points, dtype=np.int32)
            zone = sv.PolygonZone(polygon=polygon, triggering_anchors=(sv.Position.CENTER,))
            zones.append(zone)
        print(f"Loaded {len(zones)} zones")

    # Video setup
    video_info = sv.VideoInfo.from_video_path(args.video)
    cap = cv2.VideoCapture(args.video)

    video_writer = None
    if args.output:
        video_writer = cv2.VideoWriter(
            args.output,
            cv2.VideoWriter_fourcc(*'mp4v'),
            video_info.fps,
            (video_info.width, video_info.height)
        )

    # Activity colors
    activity_colors = {
        'standing': (0, 255, 0),      # Green
        'walking': (255, 165, 0),      # Orange
        'running': (0, 0, 255),        # Red
        'sitting/crouching': (0, 255, 255),  # Yellow
        'lying_down': (255, 0, 255),   # Magenta
        'unknown': (128, 128, 128)     # Gray
    }

    analytics_data = []
    frame_count = 0

    print(f"Processing video: {args.video}")
    print(f"Resolution: {video_info.width}x{video_info.height}, FPS: {video_info.fps}")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # Run pose detection
        results = model(frame, verbose=False, device=args.device, conf=args.confidence)[0]

        # Extract detections and keypoints
        if results.keypoints is not None and len(results.boxes) > 0:
            # Create detections from boxes
            detections = sv.Detections.from_ultralytics(results)

            # Filter for person class only
            person_mask = detections.class_id == 0
            detections = detections[person_mask]

            # Track
            detections = tracker.update_with_detections(detections)

            # Filter valid tracker IDs
            valid_mask = detections.tracker_id != -1
            detections = detections[valid_mask]

            # Get keypoints for valid detections
            keypoints_data = results.keypoints.data.cpu().numpy()

            annotated_frame = frame.copy()

            # Draw zones if available
            if zones:
                for zone_idx, zone in enumerate(zones):
                    cv2.polylines(annotated_frame, [zone.polygon], True, (255, 255, 255), 2)

            # Process each detected person
            for i, tracker_id in enumerate(detections.tracker_id):
                bbox = detections.xyxy[i]

                # Get corresponding keypoints
                if i < len(keypoints_data):
                    keypoints = keypoints_data[i]

                    # Classify activity
                    activity = activity_detector.classify_pose_activity(keypoints, tracker_id)
                    color = activity_colors.get(activity, (128, 128, 128))

                    # Draw bounding box
                    cv2.rectangle(
                        annotated_frame,
                        (int(bbox[0]), int(bbox[1])),
                        (int(bbox[2]), int(bbox[3])),
                        color,
                        2
                    )

                    # Draw label
                    label = f"#{tracker_id}: {activity}"
                    cv2.putText(
                        annotated_frame,
                        label,
                        (int(bbox[0]), int(bbox[1]) - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        color,
                        2
                    )

                    # Draw skeleton
                    for j in range(len(keypoints)):
                        kp = keypoints[j]
                        if len(kp) >= 3 and kp[2] > 0.5:
                            cv2.circle(annotated_frame, (int(kp[0]), int(kp[1])), 3, color, -1)

                    # Store analytics
                    analytics_data.append({
                        'frame': frame_count,
                        'person_id': int(tracker_id),
                        'activity': activity,
                        'bbox': [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])]
                    })

            # Add frame info
            cv2.putText(
                annotated_frame,
                f"Frame: {frame_count} | People: {len(detections)}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

            # Save and display
            if video_writer:
                video_writer.write(annotated_frame)

            if not args.no_display:
                cv2.imshow("Pose Activity Detection", annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        else:
            # No detections
            if video_writer:
                video_writer.write(frame)

            if not args.no_display:
                cv2.imshow("Pose Activity Detection", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    # Cleanup
    cap.release()
    if video_writer:
        video_writer.release()
    if not args.no_display:
        cv2.destroyAllWindows()

    # Save analytics
    with open(args.analytics, 'w') as f:
        json.dump(analytics_data, f, indent=2)

    print(f"\nProcessed {frame_count} frames")
    print(f"Analytics saved to: {args.analytics}")
    if args.output:
        print(f"Video saved to: {args.output}")


if __name__ == "__main__":
    main()
