"""
YOLOv8-Pose based temporal activity detector
Optimized for slow CCTV footage with subtle movements
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from collections import deque
from ultralytics import YOLO


class PoseTemporalDetector:
    """
    Activity detector using pose keypoints and temporal analysis
    Works well for slow, subtle movements in CCTV footage
    """

    # COCO keypoint indices
    NOSE = 0
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

    def __init__(self, pose_model: str = "yolov8x-pose.pt"):
        """Initialize pose-based activity detector"""
        print(f"Loading YOLOv8-Pose model: {pose_model}")
        self.pose_model = YOLO(pose_model)

        # Tracking buffers
        self.keypoint_history: Dict[int, deque] = {}
        self.activity_history: Dict[int, List[str]] = {}
        self.history_length = 30  # Keep 30 frames of history

        # Thresholds (calibrated for library CCTV - slow movements)
        # Very conservative to account for perspective (people near camera move more pixels)
        self.standing_speed_threshold = 25.0   # px/sec - minimal movement
        self.walking_threshold = 100.0         # px/sec - any walking movement
        self.sitting_hip_angle_max = 120.0     # degrees
        self.reading_head_angle_min = 30.0     # degrees

    def detect_pose(self, frame: np.ndarray, bbox: np.ndarray) -> Optional[np.ndarray]:
        """Detect pose keypoints for a person"""
        x1, y1, x2, y2 = bbox.astype(int)

        # Ensure valid crop
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        if x2 <= x1 or y2 <= y1:
            return None

        person_crop = frame[y1:y2, x1:x2]

        # Run pose detection
        results = self.pose_model(person_crop, verbose=False, conf=0.25)

        if not results or results[0].keypoints is None or len(results[0].keypoints.xy) == 0:
            return None

        # Get keypoints and convert to frame coordinates
        keypoints = results[0].keypoints.xy[0].cpu().numpy()
        keypoints[:, 0] += x1
        keypoints[:, 1] += y1

        return keypoints

    def calculate_angle(self, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
        """Calculate angle at p2 between p1-p2-p3"""
        if np.any(p1 == 0) or np.any(p2 == 0) or np.any(p3 == 0):
            return 180.0

        v1 = p1 - p2
        v2 = p3 - p2

        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)

        return np.degrees(np.arccos(cos_angle))

    def calculate_head_tilt(self, keypoints: np.ndarray) -> float:
        """Calculate head tilt angle (for reading detection)"""
        nose = keypoints[self.NOSE]
        left_shoulder = keypoints[self.LEFT_SHOULDER]
        right_shoulder = keypoints[self.RIGHT_SHOULDER]

        if np.all(nose == 0) or np.all(left_shoulder == 0) or np.all(right_shoulder == 0):
            return 0.0

        shoulder_center = (left_shoulder + right_shoulder) / 2.0
        head_vector = nose - shoulder_center

        # Calculate angle from vertical
        if head_vector[1] > 0:  # Nose below shoulders
            vertical = np.array([0, 1])
            cos_angle = np.dot(head_vector, vertical) / (np.linalg.norm(head_vector) + 1e-6)
            cos_angle = np.clip(cos_angle, -1.0, 1.0)
            angle = np.degrees(np.arccos(cos_angle))
            return 90.0 - angle

        return 0.0

    def calculate_velocity(self, person_id: int) -> float:
        """Calculate smoothed hip velocity (px/sec)"""
        if person_id not in self.keypoint_history or len(self.keypoint_history[person_id]) < 2:
            return 0.0

        history = list(self.keypoint_history[person_id])
        velocities = []

        for i in range(len(history) - 1, max(0, len(history) - 5), -1):
            if i == 0:
                break

            curr_kp, curr_time = history[i]
            prev_kp, prev_time = history[i - 1]

            # Calculate hip center movement
            curr_hip = (curr_kp[self.LEFT_HIP] + curr_kp[self.RIGHT_HIP]) / 2.0
            prev_hip = (prev_kp[self.LEFT_HIP] + prev_kp[self.RIGHT_HIP]) / 2.0

            if np.all(curr_hip == 0) or np.all(prev_hip == 0):
                continue

            distance = np.linalg.norm(curr_hip - prev_hip)
            time_diff = curr_time - prev_time

            if time_diff > 0:
                velocities.append(distance / time_diff)

        return np.mean(velocities) if velocities else 0.0

    def is_sitting(self, keypoints: np.ndarray) -> bool:
        """Detect sitting posture"""
        left_hip = keypoints[self.LEFT_HIP]
        right_hip = keypoints[self.RIGHT_HIP]
        left_knee = keypoints[self.LEFT_KNEE]
        right_knee = keypoints[self.RIGHT_KNEE]
        left_shoulder = keypoints[self.LEFT_SHOULDER]
        right_shoulder = keypoints[self.RIGHT_SHOULDER]

        # Check if key joints detected
        if np.all(left_hip == 0) or np.all(left_knee == 0):
            return False

        # Calculate hip-knee angle
        left_angle = self.calculate_angle(left_shoulder, left_hip, left_knee)

        # Sitting = bent hips
        return left_angle < self.sitting_hip_angle_max

    def classify_activity(
        self,
        person_id: int,
        frame: np.ndarray,
        bbox: np.ndarray,
        timestamp: float
    ) -> str:
        """Classify activity based on pose and temporal analysis"""

        # Detect pose
        keypoints = self.detect_pose(frame, bbox)

        if keypoints is None:
            return "no_pose"

        # Initialize history
        if person_id not in self.keypoint_history:
            self.keypoint_history[person_id] = deque(maxlen=self.history_length)
            self.activity_history[person_id] = []

        # Store keypoints
        self.keypoint_history[person_id].append((keypoints, timestamp))

        # Need warmup period
        if len(self.keypoint_history[person_id]) < 5:
            return "initializing"

        # Calculate features
        velocity = self.calculate_velocity(person_id)
        head_tilt = self.calculate_head_tilt(keypoints)
        sitting = self.is_sitting(keypoints)

        # Classify activity
        activity = "unknown"

        if sitting:
            if head_tilt > self.reading_head_angle_min:
                activity = "reading"
            else:
                activity = "sitting"
        else:
            # Standing/moving - simplified classification (all movement = walking)
            if velocity < self.standing_speed_threshold:
                if head_tilt > self.reading_head_angle_min:
                    activity = "reading_standing"
                else:
                    activity = "standing"
            else:
                # Treat all movement as walking (no jogging/running classification)
                activity = "walking"

        # Store in history
        self.activity_history[person_id].append(activity)
        if len(self.activity_history[person_id]) > 30:
            self.activity_history[person_id] = self.activity_history[person_id][-30:]

        return activity

    def get_dominant_activity(self, person_id: int, window: int = 10) -> str:
        """Get most common activity in recent window"""
        if person_id not in self.activity_history or not self.activity_history[person_id]:
            return "unknown"

        recent = self.activity_history[person_id][-window:]

        counts = {}
        for activity in recent:
            counts[activity] = counts.get(activity, 0) + 1

        return max(counts, key=counts.get) if counts else "unknown"

    def cleanup_person(self, person_id: int):
        """Remove tracking data for person who left"""
        if person_id in self.keypoint_history:
            del self.keypoint_history[person_id]
        if person_id in self.activity_history:
            del self.activity_history[person_id]
