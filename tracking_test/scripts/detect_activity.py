"""
Activity detection using Pose-Temporal detector (BEST for CCTV)
Tracks people and classifies their activities using pose keypoints and temporal analysis
Uses EnhancedTracker for better ID persistence
"""

import cv2
import sys
from pathlib import Path
import argparse

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from ultralytics import YOLO
from src.core.pose_temporal_detector import PoseTemporalDetector
from src.core.enhanced_tracker import EnhancedTracker
import supervision as sv


def main():
    parser = argparse.ArgumentParser(description="Activity Detection for CCTV footage")
    parser.add_argument("--video", type=str, required=True, help="Path to video file")
    parser.add_argument("--output", type=str, default=None, help="Path to output video (optional)")
    parser.add_argument("--excel", type=str, default=None, help="Path to Excel tracking log (optional)")
    parser.add_argument("--conf", type=float, default=0.4, help="Detection confidence threshold")
    parser.add_argument("--show", action="store_true", help="Display video while processing")
    args = parser.parse_args()

    VIDEO_PATH = args.video
    OUTPUT_PATH = args.output
    EXCEL_PATH = args.excel
    CONF_THRESHOLD = args.conf

    # Initialize models
    print("Initializing YOLO detector...")
    detector = YOLO("yolov8x.pt")

    print("Initializing Pose-Temporal activity detector...")
    activity_detector = PoseTemporalDetector(pose_model="yolov8x-pose.pt")

    # Initialize EnhancedTracker (same as your zone tracking for better ID persistence)
    tracker = EnhancedTracker(
        track_activation_threshold=0.25,       # Lower threshold for initial detection
        lost_track_buffer=150,                 # 5 seconds patience (150 frames at 30fps)
        minimum_matching_threshold=0.8,        # HIGHER = stricter matching (fewer new IDs)
        minimum_consecutive_frames=3,          # Require 3 frames before assigning new ID
        ghost_buffer_frames=150,               # 5 seconds ghost buffer
        ghost_iou_threshold=0.2,
        ghost_distance_threshold=200.0
    )

    print("Using EnhancedTracker for better ID persistence")

    # Initialize annotators
    box_annotator = sv.BoxAnnotator(thickness=2)
    label_annotator = sv.LabelAnnotator(text_thickness=2, text_scale=0.8)

    # Open video
    video_info = sv.VideoInfo.from_video_path(VIDEO_PATH)
    frame_generator = sv.get_video_frames_generator(VIDEO_PATH)

    print(f"Processing video: {video_info.width}x{video_info.height} @ {video_info.fps}fps")
    print(f"Total frames: {video_info.total_frames}")
    if args.show:
        print("Press 'q' to quit\n")

    # Create output video writer if specified
    out = None
    if OUTPUT_PATH:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(OUTPUT_PATH, fourcc, video_info.fps, (video_info.width, video_info.height))
        print(f"Saving output to: {OUTPUT_PATH}")

    frame_count = 0
    tracked_persons = set()

    for frame in frame_generator:
        frame_count += 1
        timestamp = frame_count / video_info.fps

        # Run detection
        # Lower NMS IoU threshold to 0.3 to better suppress overlapping detections
        results = detector(frame, conf=CONF_THRESHOLD, iou=0.3, classes=[0], verbose=False)[0]
        detections = sv.Detections.from_ultralytics(results)

        # Track objects
        detections = tracker.update_with_detections(detections)

        # Process each tracked person
        labels = []

        if detections.tracker_id is not None:
            for bbox, tracker_id in zip(detections.xyxy, detections.tracker_id):
                # Classify activity
                activity = activity_detector.classify_activity(tracker_id, frame, bbox, timestamp)
                dominant_activity = activity_detector.get_dominant_activity(tracker_id, window=10)

                # Create label
                label = f"ID:{tracker_id} | {dominant_activity}"
                labels.append(label)

                # Track active persons
                tracked_persons.add(tracker_id)

        # Annotate frame
        annotated_frame = box_annotator.annotate(scene=frame.copy(), detections=detections)
        annotated_frame = label_annotator.annotate(
            scene=annotated_frame,
            detections=detections,
            labels=labels
        )

        # Add info overlay
        cv2.putText(
            annotated_frame,
            f"Frame: {frame_count}/{video_info.total_frames} | Tracked: {len(tracked_persons)}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2
        )

        # Save to output video
        if out:
            out.write(annotated_frame)

        # Display
        if args.show:
            cv2.imshow("Pose-Temporal Activity Detection", annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        # Progress update
        if frame_count % 30 == 0:
            progress = (frame_count / video_info.total_frames) * 100
            print(f"Progress: {frame_count}/{video_info.total_frames} ({progress:.1f}%)")

    # Cleanup
    if out:
        out.release()
    if args.show:
        cv2.destroyAllWindows()

    print(f"\nProcessing complete!")
    print(f"Total tracked persons: {len(tracked_persons)}")

    if OUTPUT_PATH:
        print(f"Output video saved to: {OUTPUT_PATH}")

    # Export tracking log to Excel
    if EXCEL_PATH:
        print(f"\nExporting tracking log to Excel...")
        tracker.export_tracking_log_to_excel(EXCEL_PATH)

        # Print summary
        summary = tracker.get_tracking_summary()
        print(f"\nTracking Summary:")
        print(f"  Total frames processed: {summary.get('total_frames_processed', 0)}")
        print(f"  Total events logged: {summary.get('total_events', 0)}")
        print(f"  ID restorations: {summary.get('id_restorations', 0)}")
        print(f"  Suspicious reassignments detected: {summary.get('suspicious_reassignments_detected', 0)}")
        print(f"  New IDs assigned: {summary.get('new_ids_assigned', 0)}")


if __name__ == "__main__":
    main()
