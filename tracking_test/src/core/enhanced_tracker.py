"""
Enhanced tracker with ghost buffer to prevent ID reassignment
"""

import time
from typing import Dict, Tuple, Optional
import numpy as np
import supervision as sv


class GhostTrack:
    """Represents a lost track that's kept in memory for potential re-matching"""

    def __init__(self, tracker_id: int, bbox: np.ndarray, last_seen_frame: int):
        self.tracker_id = tracker_id
        self.bbox = bbox  # [x1, y1, x2, y2]
        self.last_seen_frame = last_seen_frame
        self.center = self._calculate_center(bbox)

    def _calculate_center(self, bbox: np.ndarray) -> Tuple[float, float]:
        """Calculate center point of bounding box"""
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    def calculate_iou(self, bbox: np.ndarray) -> float:
        """Calculate IoU with another bounding box"""
        x1_1, y1_1, x2_1, y2_1 = self.bbox
        x1_2, y1_2, x2_2, y2_2 = bbox

        # Calculate intersection
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)

        if x2_i < x1_i or y2_i < y1_i:
            return 0.0

        intersection = (x2_i - x1_i) * (y2_i - y1_i)

        # Calculate union
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0.0

    def calculate_distance(self, bbox: np.ndarray) -> float:
        """Calculate Euclidean distance between centers"""
        new_center = self._calculate_center(bbox)
        dx = new_center[0] - self.center[0]
        dy = new_center[1] - self.center[1]
        return np.sqrt(dx*dx + dy*dy)


class EnhancedTracker:
    """
    Enhanced tracker with ghost buffer to prevent ID reassignment.

    When a track is lost, it's kept in a "ghost" buffer for a specified duration.
    New detections in the same area are matched to ghost tracks instead of creating new IDs.
    """

    def __init__(
        self,
        track_activation_threshold: float = 0.4,
        lost_track_buffer: int = 90,  # Frames to keep lost tracks (3 sec at 30fps)
        minimum_matching_threshold: float = 0.5,
        minimum_consecutive_frames: int = 1,
        ghost_buffer_frames: int = 90,  # Keep ghost for 3 seconds at 30fps
        ghost_iou_threshold: float = 0.3,  # IoU threshold for ghost matching
        ghost_distance_threshold: float = 150.0  # Max distance for ghost matching (pixels)
    ):
        # Initialize ByteTrack with optimized settings
        self.base_tracker = sv.ByteTrack(
            track_activation_threshold=track_activation_threshold,
            lost_track_buffer=lost_track_buffer,
            minimum_matching_threshold=minimum_matching_threshold,
            minimum_consecutive_frames=minimum_consecutive_frames
        )

        # Ghost buffer settings
        self.ghost_buffer_frames = ghost_buffer_frames
        self.ghost_iou_threshold = ghost_iou_threshold
        self.ghost_distance_threshold = ghost_distance_threshold

        # Ghost tracking data
        self.ghost_tracks: Dict[int, GhostTrack] = {}  # tracker_id -> GhostTrack
        self.active_tracks: Dict[int, np.ndarray] = {}  # tracker_id -> bbox
        self.last_frame_active_ids: set = set()  # IDs that were active in the previous frame
        self.frame_count = 0

        # ID mapping for reassignment
        self.id_mapping: Dict[int, int] = {}  # new_id -> original_id
        self.next_reassigned_id = 0

    def update_with_detections(self, detections: sv.Detections) -> sv.Detections:
        """
        Update tracker with new detections, using ghost buffer to prevent ID reassignment.
        """
        self.frame_count += 1

        # First, run the base ByteTrack
        tracked_detections = self.base_tracker.update_with_detections(detections)

        # Track current active IDs and their bboxes
        current_active_ids = set()
        if len(tracked_detections) > 0 and tracked_detections.tracker_id is not None:
            for i, tracker_id in enumerate(tracked_detections.tracker_id):
                if tracker_id != -1:
                    current_active_ids.add(tracker_id)
                    self.active_tracks[tracker_id] = tracked_detections.xyxy[i]

        # Find tracks that were lost this frame (comparing to last frame's active IDs only)
        lost_ids = self.last_frame_active_ids - current_active_ids

        # Add lost tracks to ghost buffer (only if not already there)
        for lost_id in lost_ids:
            if lost_id in self.active_tracks and lost_id not in self.ghost_tracks:
                self.ghost_tracks[lost_id] = GhostTrack(
                    tracker_id=lost_id,
                    bbox=self.active_tracks[lost_id],
                    last_seen_frame=self.frame_count - 1
                )
                # Reduced logging - only log new ghosts

        # Remove old ghosts that have expired
        expired_ghosts = []
        for ghost_id, ghost in self.ghost_tracks.items():
            frames_since_lost = self.frame_count - ghost.last_seen_frame
            if frames_since_lost > self.ghost_buffer_frames:
                expired_ghosts.append(ghost_id)

        for ghost_id in expired_ghosts:
            del self.ghost_tracks[ghost_id]

        # Try to match new detections with ghost tracks
        if len(tracked_detections) > 0 and tracked_detections.tracker_id is not None:
            new_tracker_ids = []

            for i, tracker_id in enumerate(tracked_detections.tracker_id):
                bbox = tracked_detections.xyxy[i]

                # Check if this is a TRULY new ID (wasn't active last frame)
                # This means ByteTrack created a new ID, not reused an old one
                if tracker_id != -1 and tracker_id not in self.last_frame_active_ids:
                    # Try to match with ghost tracks
                    best_ghost_id = None
                    best_score = 0.0

                    for ghost_id, ghost in self.ghost_tracks.items():
                        # Calculate IoU and distance
                        iou = ghost.calculate_iou(bbox)
                        distance = ghost.calculate_distance(bbox)

                        # Match if IoU is good OR distance is small
                        if iou >= self.ghost_iou_threshold or distance <= self.ghost_distance_threshold:
                            # Combine IoU and distance for matching score
                            # Normalize distance to 0-1 range (closer = higher score)
                            distance_score = max(0, 1 - (distance / self.ghost_distance_threshold))
                            score = 0.6 * iou + 0.4 * distance_score

                            if score > best_score:
                                best_score = score
                                best_ghost_id = ghost_id

                    # If we found a matching ghost, use its ID
                    if best_ghost_id is not None:
                        new_tracker_ids.append(best_ghost_id)

                        # Remove from ghost buffer since it's active again
                        del self.ghost_tracks[best_ghost_id]

                        # Update active tracks with the reassigned ID
                        self.active_tracks[best_ghost_id] = bbox
                    else:
                        # No ghost match, keep the new ID
                        new_tracker_ids.append(tracker_id)
                else:
                    # Keep existing ID
                    new_tracker_ids.append(tracker_id)

            # Update the tracker IDs in detections
            tracked_detections.tracker_id = np.array(new_tracker_ids, dtype=int)

        # Clean up active_tracks for IDs that are no longer active and not in ghost buffer
        self.active_tracks = {
            tid: bbox for tid, bbox in self.active_tracks.items()
            if tid in current_active_ids or tid in self.ghost_tracks
        }

        # Update last_frame_active_ids for next iteration (ONLY currently active IDs, not ghosts)
        self.last_frame_active_ids = current_active_ids.copy()

        return tracked_detections

    def get_ghost_count(self) -> int:
        """Get the current number of ghost tracks"""
        return len(self.ghost_tracks)

    def get_active_count(self) -> int:
        """Get the current number of active tracks"""
        return len(self.active_tracks)

    def reset(self):
        """Reset the tracker state"""
        self.ghost_tracks.clear()
        self.active_tracks.clear()
        self.last_frame_active_ids.clear()
        self.id_mapping.clear()
        self.frame_count = 0
