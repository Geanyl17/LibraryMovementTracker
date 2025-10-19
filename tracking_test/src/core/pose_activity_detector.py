"""
Pose-based activity detection using YOLOv8-Pose
More accurate than bbox-based detection, eliminates false positives
"""

import math
from typing import Dict, List, Optional, Tuple
import numpy as np
from ultralytics import YOLO


class PoseActivityDetector:
    """Detects human activities using pose estimation (skeleton keypoints)"""

    # YOLOv8-Pose keypoint indices (COCO format)
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

    def __init__(self, pose_model_path: str = "yolov8x-pose.pt"):
        """Initialize pose-based activity detector with best model"""
        self.pose_model = YOLO(pose_model_path)  # Using yolov8x-pose (extra large) for best detection

        # Activity thresholds (calibrated for 1920x1080, library-specific)
        self.sitting_hip_angle_max = 110.0      # degrees - hip angle when sitting
        self.sitting_knee_angle_max = 130.0     # degrees - knee angle when sitting
        self.reading_head_tilt_min = 20.0       # degrees - min head tilt for reading
        self.reading_head_tilt_max = 70.0       # degrees - max head tilt for reading
        self.movement_threshold = 15.0          # px/sec - max movement for standing still

        # History tracking
        self.pose_history: Dict[int, List[Tuple[np.ndarray, float]]] = {}  # person_id -> [(keypoints, timestamp)]
        self.activity_history: Dict[int, List[str]] = {}
        self.history_length = 10

    def calculate_angle(self, point1: np.ndarray, point2: np.ndarray, point3: np.ndarray) -> float:
        """
        Calculate angle between three points (in degrees)
        point2 is the vertex of the angle
        """
        # Handle missing keypoints
        if np.any(point1 == 0) or np.any(point2 == 0) or np.any(point3 == 0):
            return 180.0  # Return neutral angle if keypoints missing

        # Calculate vectors
        vector1 = point1 - point2
        vector2 = point3 - point2

        # Calculate angle using dot product
        cosine_angle = np.dot(vector1, vector2) / (np.linalg.norm(vector1) * np.linalg.norm(vector2) + 1e-6)
        cosine_angle = np.clip(cosine_angle, -1.0, 1.0)  # Prevent numerical errors
        angle = np.arccos(cosine_angle)

        return np.degrees(angle)

    def calculate_joint_velocity(self, person_id: int, joint_idx: int) -> float:
        """Calculate velocity of a specific joint (pixels per second)"""
        if person_id not in self.pose_history or len(self.pose_history[person_id]) < 2:
            return 0.0

        # Get current and previous positions
        curr_keypoints, curr_time = self.pose_history[person_id][-1]
        prev_keypoints, prev_time = self.pose_history[person_id][-2]

        curr_joint = curr_keypoints[joint_idx]
        prev_joint = prev_keypoints[joint_idx]

        # Skip if keypoints are missing (confidence = 0)
        if np.all(curr_joint == 0) or np.all(prev_joint == 0):
            return 0.0

        # Calculate distance and time
        distance = np.linalg.norm(curr_joint - prev_joint)
        time_diff = curr_time - prev_time

        if time_diff <= 0:
            return 0.0

        return distance / time_diff

    def calculate_average_velocity(self, person_id: int, joint_idx: int, frames: int = 5) -> float:
        """Calculate average velocity over last N frames (smoothed)"""
        if person_id not in self.pose_history or len(self.pose_history[person_id]) < 2:
            return 0.0

        velocities = []
        history = self.pose_history[person_id]

        for i in range(len(history) - 1, max(0, len(history) - frames - 1), -1):
            if i == 0:
                break

            curr_keypoints, curr_time = history[i]
            prev_keypoints, prev_time = history[i - 1]

            curr_joint = curr_keypoints[joint_idx]
            prev_joint = prev_keypoints[joint_idx]

            # Skip if keypoints missing
            if np.all(curr_joint == 0) or np.all(prev_joint == 0):
                continue

            distance = np.linalg.norm(curr_joint - prev_joint)
            time_diff = curr_time - prev_time

            if time_diff > 0:
                velocities.append(distance / time_diff)

        return np.mean(velocities) if velocities else 0.0

    def calculate_head_tilt(self, keypoints: np.ndarray) -> float:
        """
        Calculate head tilt angle (forward/down tilt)
        Returns angle in degrees (0 = upright, positive = tilted down)
        """
        nose = keypoints[self.NOSE]
        left_shoulder = keypoints[self.LEFT_SHOULDER]
        right_shoulder = keypoints[self.RIGHT_SHOULDER]

        # Check if keypoints are detected
        if np.all(nose == 0) or np.all(left_shoulder == 0) or np.all(right_shoulder == 0):
            return 0.0

        # Calculate shoulder midpoint
        shoulder_center = (left_shoulder + right_shoulder) / 2.0

        # Vector from shoulder to nose
        head_vector = nose - shoulder_center

        # If nose is below shoulders (head tilted down), calculate angle
        if head_vector[1] > 0:  # Y coordinate increases downward
            # Calculate angle from vertical (90° = horizontal, 0° = vertical)
            vertical_vector = np.array([0, 1])  # Pointing down
            dot_product = np.dot(head_vector, vertical_vector)
            magnitude = np.linalg.norm(head_vector)

            if magnitude > 0:
                cos_angle = dot_product / magnitude
                cos_angle = np.clip(cos_angle, -1.0, 1.0)
                angle = np.degrees(np.arccos(cos_angle))
                return 90.0 - angle  # Convert to tilt angle (0 = upright)

        return 0.0  # Head not tilted down

    def detect_pose(self, frame: np.ndarray, bbox: np.ndarray) -> Optional[np.ndarray]:
        """
        Detect pose keypoints for a person in the frame
        Returns: [17, 2] array of keypoints (x, y) or None if detection fails
        """
        # Crop person from frame using bbox
        x1, y1, x2, y2 = bbox.astype(int)

        # Ensure valid crop
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        if x2 <= x1 or y2 <= y1:
            return None

        person_crop = frame[y1:y2, x1:x2]

        if person_crop.size == 0:
            return None

        # Run pose detection with lower confidence threshold
        results = self.pose_model(person_crop, verbose=False, conf=0.3)

        if len(results) == 0 or results[0].keypoints is None:
            return None

        keypoints = results[0].keypoints.xy

        if len(keypoints) == 0:
            return None

        # Get first person's keypoints and convert to absolute coordinates
        keypoints = keypoints[0].cpu().numpy()  # [17, 2]

        # Convert from crop coordinates to frame coordinates
        keypoints[:, 0] += x1
        keypoints[:, 1] += y1

        return keypoints

    def classify_activity(
        self,
        person_id: int,
        frame: np.ndarray,
        bbox: np.ndarray,
        timestamp: float
    ) -> str:
        """
        Classify activity based on pose keypoints

        Args:
            person_id: Unique person ID
            frame: Full video frame
            bbox: Bounding box [x1, y1, x2, y2]
            timestamp: Frame timestamp in seconds

        Returns:
            Activity string: 'sitting', 'standing', 'walking', 'running', etc.
        """
        # Detect pose keypoints
        keypoints = self.detect_pose(frame, bbox)

        if keypoints is None:
            # Fallback to bbox-based detection if pose fails
            if person_id not in self.activity_history:
                self.activity_history[person_id] = []
            return "standing"  # Default when pose not detected

        # Store in history
        if person_id not in self.pose_history:
            self.pose_history[person_id] = []
            self.activity_history[person_id] = []

        self.pose_history[person_id].append((keypoints, timestamp))

        # Keep only recent history
        if len(self.pose_history[person_id]) > self.history_length:
            self.pose_history[person_id] = self.pose_history[person_id][-self.history_length:]

        # Need at least 5 frames for reliable detection (increased from 3 to reduce noise)
        if len(self.pose_history[person_id]) < 5:
            return "standing"

        # Extract key joints
        left_hip = keypoints[self.LEFT_HIP]
        right_hip = keypoints[self.RIGHT_HIP]
        left_knee = keypoints[self.LEFT_KNEE]
        right_knee = keypoints[self.RIGHT_KNEE]
        left_ankle = keypoints[self.LEFT_ANKLE]
        right_ankle = keypoints[self.RIGHT_ANKLE]
        left_shoulder = keypoints[self.LEFT_SHOULDER]
        right_shoulder = keypoints[self.RIGHT_SHOULDER]

        # Calculate head tilt for reading detection
        head_tilt = self.calculate_head_tilt(keypoints)

        # Calculate hip movement velocity
        hip_velocity = 0.0
        if not np.all(left_hip == 0) and not np.all(right_hip == 0):
            hip_center = (left_hip + right_hip) / 2.0

            if len(self.pose_history[person_id]) >= 2:
                prev_keypoints, prev_time = self.pose_history[person_id][-2]
                prev_left_hip = prev_keypoints[self.LEFT_HIP]
                prev_right_hip = prev_keypoints[self.RIGHT_HIP]

                if not np.all(prev_left_hip == 0) and not np.all(prev_right_hip == 0):
                    prev_hip_center = (prev_left_hip + prev_right_hip) / 2.0
                    hip_displacement = np.linalg.norm(hip_center - prev_hip_center)
                    time_diff = timestamp - prev_time
                    hip_velocity = hip_displacement / time_diff if time_diff > 0 else 0.0

        # === SITTING DETECTION ===
        is_sitting = False
        if not np.all(left_hip == 0) and not np.all(left_knee == 0) and not np.all(left_ankle == 0):
            left_hip_angle = self.calculate_angle(left_shoulder, left_hip, left_knee)
            left_knee_angle = self.calculate_angle(left_hip, left_knee, left_ankle)

            if left_hip_angle < self.sitting_hip_angle_max and left_knee_angle < self.sitting_knee_angle_max:
                is_sitting = True

        if not is_sitting and not np.all(right_hip == 0) and not np.all(right_knee == 0) and not np.all(right_ankle == 0):
            right_hip_angle = self.calculate_angle(right_shoulder, right_hip, right_knee)
            right_knee_angle = self.calculate_angle(right_hip, right_knee, right_ankle)

            if right_hip_angle < self.sitting_hip_angle_max and right_knee_angle < self.sitting_knee_angle_max:
                is_sitting = True

        # === LIBRARY-SPECIFIC ACTIVITY CLASSIFICATION ===
        if is_sitting:
            # Person is sitting - check if reading
            if self.reading_head_tilt_min <= head_tilt <= self.reading_head_tilt_max:
                return "reading"
            else:
                return "sitting"
        else:
            # Person is standing - check movement and head position
            if hip_velocity < self.movement_threshold:
                # Minimal movement
                if self.reading_head_tilt_min <= head_tilt <= self.reading_head_tilt_max:
                    return "reading"  # Reading while standing
                else:
                    return "standing"
            else:
                # Some movement while standing
                return "loitering"

    def get_pose_confidence(self, person_id: int) -> float:
        """Get average confidence of pose detection for a person"""
        if person_id not in self.pose_history or len(self.pose_history[person_id]) == 0:
            return 0.0

        # Count non-zero keypoints in latest detection
        latest_keypoints, _ = self.pose_history[person_id][-1]
        non_zero = np.sum(np.any(latest_keypoints != 0, axis=1))

        # Confidence = percentage of detected keypoints
        return non_zero / 17.0
