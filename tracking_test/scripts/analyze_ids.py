#!/usr/bin/env python3
"""
Quick script to analyze tracker IDs in a video
"""

import argparse
import sys
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.enhanced_tracker import EnhancedTracker


def main():
    parser = argparse.ArgumentParser(description="Analyze tracker IDs")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--confidence", type=float, default=0.3, help="Confidence threshold")

    args = parser.parse_args()

    # Initialize model and tracker
    model = YOLO("yolov8n.pt")
    tracker = EnhancedTracker(
        track_activation_threshold=0.25,
        lost_track_buffer=150,
        minimum_matching_threshold=0.8,
        minimum_consecutive_frames=3,
        ghost_buffer_frames=150,
        ghost_iou_threshold=0.2,
        ghost_distance_threshold=200.0
    )

    # Video setup
    video_info = sv.VideoInfo.from_video_path(args.video)
    cap = cv2.VideoCapture(args.video)

    print(f"Analyzing video: {args.video}")
    print(f"FPS: {video_info.fps}, Resolution: {video_info.width}x{video_info.height}")
    print(f"Total frames: {video_info.total_frames}")
    print()

    frame_count = 0
    all_ids_seen = set()
    max_simultaneous = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # Run YOLO detection
        results = model(frame, verbose=False, device="cpu", conf=args.confidence)[0]
        detections = sv.Detections.from_ultralytics(results)

        # Filter for person class only
        person_mask = detections.class_id == 0
        detections = detections[person_mask]

        # Apply NMS and tracking
        detections = detections.with_nms(threshold=0.7)
        detections = tracker.update_with_detections(detections)

        # Filter out invalid IDs
        valid_tracker_mask = detections.tracker_id != -1
        detections = detections[valid_tracker_mask]

        # Track IDs
        if len(detections) > 0:
            current_ids = set(detections.tracker_id)
            all_ids_seen.update(current_ids)
            max_simultaneous = max(max_simultaneous, len(current_ids))

        # Progress
        if frame_count % 50 == 0:
            print(f"Frame {frame_count}/{video_info.total_frames} | "
                  f"Total IDs: {len(all_ids_seen)} | "
                  f"Ghosts: {tracker.get_ghost_count()}")

    cap.release()

    print()
    print("=" * 60)
    print("TRACKING ANALYSIS RESULTS")
    print("=" * 60)
    print(f"Total frames processed: {frame_count}")
    print(f"Total unique IDs created: {len(all_ids_seen)}")
    print(f"Max simultaneous people: {max_simultaneous}")
    print(f"All IDs seen: {sorted(all_ids_seen)}")
    print()

    if len(all_ids_seen) <= max_simultaneous * 2:
        print("✅ EXCELLENT: ID count is reasonable (≤ 2x max simultaneous)")
    elif len(all_ids_seen) <= max_simultaneous * 5:
        print("⚠️  MODERATE: Some ID reassignments occurred")
    else:
        print("❌ BAD: Excessive ID reassignments detected")


if __name__ == "__main__":
    main()
