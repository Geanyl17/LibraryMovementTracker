"""
Enhanced tracker with ghost buffer to prevent ID reassignment
"""

import time
from typing import Dict, Tuple, Optional, List
import numpy as np
import pandas as pd
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

        # Logging for Excel export
        self.tracking_log: List[Dict] = []  # Detailed log of all comparisons and decisions

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

        # Build mapping of which bboxes have which IDs this frame
        current_bbox_to_id = {}
        if len(tracked_detections) > 0 and tracked_detections.tracker_id is not None:
            for i, tracker_id in enumerate(tracked_detections.tracker_id):
                if tracker_id != -1:
                    current_bbox_to_id[i] = tracker_id

        # Try to match new detections with ghost tracks
        if len(tracked_detections) > 0 and tracked_detections.tracker_id is not None:
            new_tracker_ids = []
            used_ghost_ids = set()  # Track which ghost IDs we've already used

            for i, tracker_id in enumerate(tracked_detections.tracker_id):
                bbox = tracked_detections.xyxy[i]
                bbox_center = ((bbox[0] + bbox[2])/2, (bbox[1] + bbox[3])/2)

                # Check if ByteTrack assigned an ID that's suspicious:
                # 1. ID exists in ghost buffer (was recently lost)
                # 2. This bbox is far from where that ID should be
                suspicious_reassignment = False
                suspicious_distance = None
                suspicious_iou = None

                if tracker_id in self.ghost_tracks:
                    ghost = self.ghost_tracks[tracker_id]
                    distance = ghost.calculate_distance(bbox)
                    iou = ghost.calculate_iou(bbox)
                    suspicious_distance = distance
                    suspicious_iou = iou

                    # If ByteTrack gave us an ID but we're far from where it should be,
                    # this is likely a wrong reassignment
                    if distance > self.ghost_distance_threshold and iou < self.ghost_iou_threshold:
                        suspicious_reassignment = True

                        # Log suspicious reassignment detection
                        self.tracking_log.append({
                            'frame': self.frame_count,
                            'event': 'SUSPICIOUS_REASSIGNMENT_DETECTED',
                            'bytetrack_id': int(tracker_id),
                            'bbox_index': i,
                            'bbox_center_x': float(bbox_center[0]),
                            'bbox_center_y': float(bbox_center[1]),
                            'ghost_id_in_buffer': int(tracker_id),
                            'distance_to_ghost': float(distance),
                            'iou_with_ghost': float(iou),
                            'distance_threshold': float(self.ghost_distance_threshold),
                            'iou_threshold': float(self.ghost_iou_threshold),
                            'decision': 'REJECT - Will search for correct ghost match'
                        })

                # Check if this is a TRULY new ID or suspicious reassignment
                if (tracker_id != -1 and tracker_id not in self.last_frame_active_ids) or suspicious_reassignment:
                    # Try to match with ghost tracks
                    best_ghost_id = None
                    best_score = 0.0
                    ghost_comparisons = []

                    for ghost_id, ghost in self.ghost_tracks.items():
                        # Skip if we already used this ghost for another bbox this frame
                        if ghost_id in used_ghost_ids:
                            ghost_comparisons.append({
                                'ghost_id': int(ghost_id),
                                'status': 'SKIPPED - Already used this frame',
                                'iou': None,
                                'distance': None,
                                'score': None
                            })
                            continue

                        # Calculate IoU and distance
                        iou = ghost.calculate_iou(bbox)
                        distance = ghost.calculate_distance(bbox)

                        # Match if IoU is good AND distance is small
                        match_criteria_met = iou >= self.ghost_iou_threshold and distance <= self.ghost_distance_threshold

                        if match_criteria_met:
                            # Combine IoU and distance for matching score
                            # Normalize distance to 0-1 range (closer = higher score)
                            distance_score = max(0, 1 - (distance / self.ghost_distance_threshold))
                            score = 0.6 * iou + 0.4 * distance_score

                            ghost_comparisons.append({
                                'ghost_id': int(ghost_id),
                                'status': 'MATCH_CRITERIA_MET',
                                'iou': float(iou),
                                'distance': float(distance),
                                'distance_score': float(distance_score),
                                'combined_score': float(score),
                                'is_best': False  # Will update later
                            })

                            if score > best_score:
                                best_score = score
                                best_ghost_id = ghost_id
                        else:
                            ghost_comparisons.append({
                                'ghost_id': int(ghost_id),
                                'status': 'NO_MATCH - Criteria not met',
                                'iou': float(iou),
                                'distance': float(distance),
                                'iou_threshold': float(self.ghost_iou_threshold),
                                'distance_threshold': float(self.ghost_distance_threshold),
                                'score': None
                            })

                    # Mark best match
                    for comp in ghost_comparisons:
                        if comp.get('ghost_id') == best_ghost_id:
                            comp['is_best'] = True

                    # Log the matching attempt
                    self.tracking_log.append({
                        'frame': self.frame_count,
                        'event': 'GHOST_MATCHING_ATTEMPT',
                        'bytetrack_id': int(tracker_id),
                        'bbox_index': i,
                        'bbox_center_x': float(bbox_center[0]),
                        'bbox_center_y': float(bbox_center[1]),
                        'was_suspicious': suspicious_reassignment,
                        'num_ghosts_compared': len(ghost_comparisons),
                        'best_ghost_id': int(best_ghost_id) if best_ghost_id else None,
                        'best_score': float(best_score) if best_ghost_id else None,
                        'ghost_comparisons': str(ghost_comparisons)  # Will be expanded in Excel
                    })

                    # If we found a matching ghost, use its ID
                    if best_ghost_id is not None:
                        new_tracker_ids.append(best_ghost_id)
                        used_ghost_ids.add(best_ghost_id)

                        # Log successful ghost restoration
                        self.tracking_log.append({
                            'frame': self.frame_count,
                            'event': 'ID_RESTORED_FROM_GHOST',
                            'bytetrack_id': int(tracker_id),
                            'restored_id': int(best_ghost_id),
                            'bbox_index': i,
                            'final_decision': f'Changed ID {tracker_id} → {best_ghost_id}'
                        })

                        # Remove from ghost buffer since it's active again
                        if best_ghost_id in self.ghost_tracks:
                            del self.ghost_tracks[best_ghost_id]

                        # Update active tracks with the reassigned ID
                        self.active_tracks[best_ghost_id] = bbox
                    else:
                        # No ghost match, keep the new ID
                        new_tracker_ids.append(tracker_id)

                        self.tracking_log.append({
                            'frame': self.frame_count,
                            'event': 'NEW_ID_ASSIGNED',
                            'bytetrack_id': int(tracker_id),
                            'bbox_index': i,
                            'reason': 'No matching ghost found',
                            'final_decision': f'Keep new ID {tracker_id}'
                        })
                else:
                    # Keep existing ID (it was active last frame and in correct position)
                    new_tracker_ids.append(tracker_id)

                    self.tracking_log.append({
                        'frame': self.frame_count,
                        'event': 'ID_CONTINUED',
                        'tracker_id': int(tracker_id),
                        'bbox_index': i,
                        'reason': 'ID was active in previous frame',
                        'final_decision': f'Continue ID {tracker_id}'
                    })

            # Update the tracker IDs in detections
            tracked_detections.tracker_id = np.array(new_tracker_ids, dtype=int)

            # Build the FINAL set of active IDs after ghost matching
            final_active_ids = set(new_tracker_ids)
        else:
            final_active_ids = current_active_ids

        # Clean up active_tracks for IDs that are no longer active and not in ghost buffer
        self.active_tracks = {
            tid: bbox for tid, bbox in self.active_tracks.items()
            if tid in final_active_ids or tid in self.ghost_tracks
        }

        # Update last_frame_active_ids for next iteration using FINAL IDs (after ghost matching)
        self.last_frame_active_ids = final_active_ids.copy()

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
        self.tracking_log.clear()

    def export_tracking_log_to_excel(self, output_path: str):
        """
        Export detailed tracking log to Excel with multiple sheets

        Args:
            output_path: Path to save Excel file
        """
        if not self.tracking_log:
            print("No tracking data to export")
            return

        # Convert log to DataFrame
        df_main = pd.DataFrame(self.tracking_log)

        # Create Excel writer
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Main log sheet
            df_main.to_excel(writer, sheet_name='Main_Log', index=False)

            # Summary sheet - count events by type
            if 'event' in df_main.columns:
                event_summary = df_main['event'].value_counts().reset_index()
                event_summary.columns = ['Event Type', 'Count']
                event_summary.to_excel(writer, sheet_name='Event_Summary', index=False)

            # ID Restorations - filter only restoration events
            restorations = df_main[df_main['event'] == 'ID_RESTORED_FROM_GHOST'].copy()
            if not restorations.empty:
                restorations.to_excel(writer, sheet_name='ID_Restorations', index=False)

            # Suspicious Reassignments - filter suspicious events
            suspicious = df_main[df_main['event'] == 'SUSPICIOUS_REASSIGNMENT_DETECTED'].copy()
            if not suspicious.empty:
                suspicious.to_excel(writer, sheet_name='Suspicious_Reassignments', index=False)

            # New ID Assignments
            new_ids = df_main[df_main['event'] == 'NEW_ID_ASSIGNED'].copy()
            if not new_ids.empty:
                new_ids.to_excel(writer, sheet_name='New_ID_Assignments', index=False)

            # Ghost Matching Attempts - with detailed comparisons
            ghost_matches = df_main[df_main['event'] == 'GHOST_MATCHING_ATTEMPT'].copy()
            if not ghost_matches.empty:
                ghost_matches.to_excel(writer, sheet_name='Ghost_Matching_Attempts', index=False)

        print(f"Tracking log exported to: {output_path}")
        print(f"Total events logged: {len(df_main)}")
        print(f"Event types: {df_main['event'].nunique()}")

    def get_tracking_summary(self) -> Dict:
        """Get summary statistics of tracking performance"""
        if not self.tracking_log:
            return {}

        df = pd.DataFrame(self.tracking_log)

        summary = {
            'total_events': len(df),
            'total_frames_processed': self.frame_count,
            'event_counts': df['event'].value_counts().to_dict() if 'event' in df.columns else {},
            'id_restorations': len(df[df['event'] == 'ID_RESTORED_FROM_GHOST']),
            'suspicious_reassignments_detected': len(df[df['event'] == 'SUSPICIOUS_REASSIGNMENT_DETECTED']),
            'new_ids_assigned': len(df[df['event'] == 'NEW_ID_ASSIGNED']),
        }

        return summary
