#!/usr/bin/env python3
"""
Script to run zone tracking analysis
"""

import argparse
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.zone_analyzer import ZoneAnalyzer


def main():
    parser = argparse.ArgumentParser(description="Zone-based person tracking with analytics")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--zones", required=True, help="Path to zone configuration JSON")
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO model path")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="Device for inference")
    parser.add_argument("--confidence", type=float, default=0.3, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.7, help="IoU threshold for NMS")
    parser.add_argument("--output", help="Output video path (optional)")
    parser.add_argument("--analytics", default="zone_analytics.json", help="Analytics output file")
    parser.add_argument("--no-display", action="store_true", help="Disable video display")
    
    args = parser.parse_args()
    
    analyzer = ZoneAnalyzer(
        model_path=args.model,
        device=args.device,
        confidence_threshold=args.confidence,
        iou_threshold=args.iou
    )
    
    analyzer.process_video(
        video_path=args.video,
        zone_config_path=args.zones,
        output_path=args.output,
        analytics_output=args.analytics,
        show_display=not args.no_display
    )


if __name__ == "__main__":
    main()