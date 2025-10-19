"""
Activity detection core functionality
"""

import math
from typing import Dict, List, Optional, Set, Tuple
import numpy as np


class ActivityDetector:
    """Detects human activities based on pose and movement patterns"""
    
    def __init__(self):
        # Activity classification thresholds (calibrated for 1920x1080 @ 25-30fps)
        # All speeds are in pixels per SECOND (not per frame)
        # Conservative settings for indoor environments (library, office, retail)
        self.standing_movement_threshold = 20.0   # px/sec - minimal movement
        self.speed_threshold_walking = 100.0      # px/sec - slow/normal walking
        self.speed_threshold_running = 300.0      # px/sec - FAST walking/actual running (more conservative)
        self.pose_history_length = 15             # Keep more history for smoother detection
        
        # Track pose history for each person
        self.pose_history: Dict[int, List[Tuple[np.ndarray, float]]] = {}
        self.activity_history: Dict[int, List[str]] = {}
        
    def calculate_speed(self, person_id: int, current_center: Tuple[float, float], timestamp: float) -> float:
        """Calculate smoothed movement speed for a person (pixels per second)"""
        if person_id not in self.pose_history:
            self.pose_history[person_id] = []
            return 0.0

        # Add current position to history
        self.pose_history[person_id].append((np.array(current_center), timestamp))

        # Keep only recent history
        if len(self.pose_history[person_id]) > self.pose_history_length:
            self.pose_history[person_id] = self.pose_history[person_id][-self.pose_history_length:]

        # Need at least 3 points for smoothed calculation
        if len(self.pose_history[person_id]) < 3:
            return 0.0

        # Calculate average speed over last few frames to smooth out jitter
        speeds = []
        for i in range(len(self.pose_history[person_id]) - 1, max(0, len(self.pose_history[person_id]) - 5), -1):
            if i == 0:
                break
            curr_pos, curr_time = self.pose_history[person_id][i]
            prev_pos, prev_time = self.pose_history[person_id][i-1]

            distance = np.linalg.norm(curr_pos - prev_pos)
            time_diff = curr_time - prev_time

            if time_diff > 0:
                speed = distance / time_diff  # pixels per second
                speeds.append(speed)

        # Return average speed to reduce jitter
        return np.mean(speeds) if speeds else 0.0
    
    def analyze_pose_ratio(self, bbox: np.ndarray) -> Dict[str, float]:
        """Analyze bounding box ratios to infer posture"""
        x1, y1, x2, y2 = bbox
        width = x2 - x1
        height = y2 - y1
        
        aspect_ratio = height / width if width > 0 else 1.0
        area = width * height
        
        return {
            'aspect_ratio': aspect_ratio,
            'width': width,
            'height': height,
            'area': area
        }
    
    def classify_activity(self, person_id: int, bbox: np.ndarray, timestamp: float) -> str:
        """Classify activity based on movement and pose"""
        # Get bounding box center
        x1, y1, x2, y2 = bbox
        center = ((x1 + x2) / 2, (y1 + y2) / 2)

        # Calculate movement speed
        speed = self.calculate_speed(person_id, center, timestamp)

        # Warmup period: need at least 5 history points for stable detection
        # This prevents bbox jitter on first detection from causing false "running"
        if person_id not in self.pose_history or len(self.pose_history[person_id]) < 5:
            return "standing"  # Default to standing during warmup

        # Analyze pose characteristics
        pose_info = self.analyze_pose_ratio(bbox)
        aspect_ratio = pose_info['aspect_ratio']
        
        # Activity classification logic
        activity = "unknown"
        
        # Speed-based classification
        if speed < self.standing_movement_threshold:
            # Low movement - check posture
            if aspect_ratio > 2.0:
                activity = "standing"
            elif aspect_ratio < 1.5:
                activity = "sitting/crouching"
            else:
                activity = "standing"
        elif speed < self.speed_threshold_walking:
            activity = "walking_slow"
        elif speed < self.speed_threshold_running:
            activity = "walking"
        else:
            activity = "running"
        
        # Additional behavior analysis
        activity = self._refine_activity_classification(person_id, activity, pose_info, speed)
        
        # Store activity history
        if person_id not in self.activity_history:
            self.activity_history[person_id] = []
        
        self.activity_history[person_id].append(activity)
        if len(self.activity_history[person_id]) > 20:  # Keep last 20 activities
            self.activity_history[person_id] = self.activity_history[person_id][-20:]
        
        return activity
    
    def _refine_activity_classification(self, person_id: int, base_activity: str, pose_info: Dict, speed: float) -> str:
        """Refine activity classification with additional context"""
        
        # Check for loitering (staying in similar area)
        if person_id in self.pose_history and len(self.pose_history[person_id]) >= 5:
            recent_positions = [pos for pos, _ in self.pose_history[person_id][-5:]]
            if len(recent_positions) >= 2:
                distances = []
                for i in range(1, len(recent_positions)):
                    dist = np.linalg.norm(recent_positions[i] - recent_positions[i-1])
                    distances.append(dist)
                
                avg_movement = np.mean(distances) if distances else 0
                if avg_movement < 5.0 and base_activity in ["standing", "walking_slow"]:
                    return "loitering"
        
        # Check for erratic movement (potential suspicious activity)
        # Only flag if there are frequent rapid changes between very different activities
        if person_id in self.activity_history and len(self.activity_history[person_id]) >= 10:
            recent_activities = self.activity_history[person_id][-10:]
            unique_activities = set(recent_activities)
            # Must have at least 4 different activities AND include both running and standing
            if len(unique_activities) >= 4 and speed > 20.0:
                if "running" in unique_activities and "standing" in unique_activities:
                    return "erratic_movement"
        
        # Detect potential falling (sudden change to low aspect ratio)
        if pose_info['aspect_ratio'] < 1.0 and speed > 1.0:
            return "potential_fall"
        
        return base_activity