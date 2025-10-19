#!/usr/bin/env python3
"""
Configurable activity detection script with enhanced tracker parameters
"""

import argparse
import sys
import os
from pathlib import Path

# Suppress OpenCV warnings
os.environ['OPENCV_VIDEOIO_DEBUG'] = '0'
os.environ['OPENCV_LOG_LEVEL'] = 'ERROR'

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from detect_activity import ActivityVideoProcessor


def main():
    parser = argparse.ArgumentParser(description="Activity detection with configurable tracking parameters")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--zones", required=True, help="Path to zone configuration JSON")
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO model path")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="Device")
    parser.add_argument("--confidence", type=float, default=0.3, help="Confidence threshold")
    parser.add_argument("--output", help="Output video path (optional)")
    parser.add_argument("--analytics", default="activity_analytics.json", help="Analytics output")
    parser.add_argument("--no-display", action="store_true", help="Disable video display")

    # Enhanced tracking parameters (optimized defaults)
    parser.add_argument("--ghost-buffer-seconds", type=float, default=5.0, help="Ghost buffer duration in seconds")
    parser.add_argument("--ghost-iou-threshold", type=float, default=0.2, help="IoU threshold for ghost matching")
    parser.add_argument("--ghost-distance-threshold", type=float, default=200.0, help="Distance threshold for ghost matching")
    parser.add_argument("--fps", type=int, default=30, help="Video FPS (for ghost buffer calculation)")

    args = parser.parse_args()

    # Calculate ghost buffer frames based on FPS
    ghost_buffer_frames = int(args.ghost_buffer_seconds * args.fps)

    from core.enhanced_tracker import EnhancedTracker

    processor = ActivityVideoProcessor(
        model_path=args.model,
        device=args.device,
        confidence_threshold=args.confidence
    )

    # Replace the tracker with custom parameters (optimized for production)
    processor.tracker = EnhancedTracker(
        track_activation_threshold=0.25,       # Lower threshold for initial detection
        lost_track_buffer=150,                 # 5 seconds patience (150 frames at 30fps)
        minimum_matching_threshold=0.8,        # HIGHER = stricter matching (fewer new IDs)
        minimum_consecutive_frames=3,          # Require 3 frames before assigning new ID
        ghost_buffer_frames=ghost_buffer_frames,
        ghost_iou_threshold=args.ghost_iou_threshold,
        ghost_distance_threshold=args.ghost_distance_threshold
    )

    print(f"Enhanced Tracker Configuration:")
    print(f"  Ghost Buffer: {args.ghost_buffer_seconds}s ({ghost_buffer_frames} frames)")
    print(f"  Ghost IoU Threshold: {args.ghost_iou_threshold}")
    print(f"  Ghost Distance Threshold: {args.ghost_distance_threshold}px")

    processor.process_video(
        video_path=args.video,
        zone_config_path=args.zones,
        output_path=args.output,
        analytics_output=args.analytics,
        show_display=not args.no_display
    )


if __name__ == "__main__":
    main()
