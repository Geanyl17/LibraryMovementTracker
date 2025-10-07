#!/usr/bin/env python3
"""
Simple person tracking without zones
"""

import argparse
import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv


def main():
    parser = argparse.ArgumentParser(description="Simple person tracking")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO model path")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="Device for inference")
    parser.add_argument("--confidence", type=float, default=0.3, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.7, help="IoU threshold for NMS")
    parser.add_argument("--output", help="Output video path (optional)")
    parser.add_argument("--no-display", action="store_true", help="Disable video display")

    args = parser.parse_args()

    # Initialize model and tracker
    model = YOLO(args.model)
    tracker = sv.ByteTrack(
        track_activation_threshold=0.25,
        lost_track_buffer=60,
        minimum_matching_threshold=0.3,
        minimum_consecutive_frames=1
    )

    # Video setup
    video_info = sv.VideoInfo.from_video_path(args.video)
    cap = cv2.VideoCapture(args.video)

    # Video writer setup
    video_writer = None
    if args.output:
        video_writer = cv2.VideoWriter(
            args.output,
            cv2.VideoWriter_fourcc(*'mp4v'),
            video_info.fps,
            (video_info.width, video_info.height)
        )

    # Annotators
    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()

    print(f"Processing video: {args.video}")
    print(f"FPS: {video_info.fps}, Resolution: {video_info.width}x{video_info.height}")
    print(f"Total frames: {video_info.total_frames}")

    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # Run YOLO detection - filter for person class (class_id = 0)
        results = model(frame, verbose=False, device=args.device, conf=args.confidence)[0]
        detections = sv.Detections.from_ultralytics(results)

        # Filter for person class only
        person_mask = detections.class_id == 0
        detections = detections[person_mask]

        # Apply NMS and tracking
        detections = detections.with_nms(threshold=args.iou)
        detections = tracker.update_with_detections(detections)

        # Filter out detections without valid tracker IDs
        valid_tracker_mask = detections.tracker_id != -1
        detections = detections[valid_tracker_mask]

        # Annotate frame
        annotated_frame = frame.copy()
        annotated_frame = box_annotator.annotate(scene=annotated_frame, detections=detections)

        # Add labels with tracker IDs
        if len(detections) > 0:
            labels = [f"#{tracker_id}" for tracker_id in detections.tracker_id]
            annotated_frame = label_annotator.annotate(
                scene=annotated_frame,
                detections=detections,
                labels=labels
            )

        # Add frame info
        frame_text = f"Frame: {frame_count} | People: {len(detections)}"
        cv2.putText(annotated_frame, frame_text, (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Save frame and display
        if video_writer:
            video_writer.write(annotated_frame)

        if not args.no_display:
            cv2.imshow("Simple Tracking", annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    # Cleanup
    cap.release()
    if video_writer:
        video_writer.release()
    if not args.no_display:
        cv2.destroyAllWindows()

    print(f"\nProcessing complete! Processed {frame_count} frames")
    if args.output:
        print(f"Output saved to: {args.output}")


if __name__ == "__main__":
    main()
