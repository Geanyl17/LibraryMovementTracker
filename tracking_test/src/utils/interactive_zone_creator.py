#!/usr/bin/env python3
"""
Interactive Zone Creator
Load first frame of video and click to create zones for tracking
"""

import argparse
import json
import os
from typing import List, Tuple

import cv2
import numpy as np


class InteractiveZoneCreator:
    """Interactive zone creation tool using video first frame"""
    
    def __init__(self, video_path: str):
        self.video_path = video_path
        self.original_frame = None
        self.display_frame = None
        self.current_zone = []
        self.completed_zones = []
        self.mouse_pos = (0, 0)
        
        # UI settings
        self.point_radius = 5
        self.line_thickness = 2
        self.zone_colors = [
            (0, 0, 255),    # Red
            (0, 255, 0),    # Green
            (255, 0, 0),    # Blue
            (0, 255, 255),  # Yellow
            (255, 0, 255),  # Magenta
            (255, 255, 0),  # Cyan
            (128, 128, 128), # Gray
            (255, 165, 0),  # Orange
        ]
        
        self.window_name = "Interactive Zone Creator"
        
    def load_first_frame(self) -> bool:
        """Load the first frame from the video"""
        if not os.path.exists(self.video_path):
            print(f"Error: Video file not found: {self.video_path}")
            return False
        
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            print(f"Error: Could not open video: {self.video_path}")
            return False
        
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            print("Error: Could not read first frame from video")
            return False
        
        self.original_frame = frame.copy()
        self.display_frame = frame.copy()
        
        print(f"Loaded first frame: {frame.shape[1]}x{frame.shape[0]} pixels")
        return True
    
    def get_zone_color(self, zone_index: int) -> Tuple[int, int, int]:
        """Get color for a specific zone"""
        return self.zone_colors[zone_index % len(self.zone_colors)]
    
    def mouse_callback(self, event: int, x: int, y: int, flags: int, param):
        """Handle mouse events"""
        self.mouse_pos = (x, y)
        
        if event == cv2.EVENT_LBUTTONDOWN:
            # Add point to current zone
            self.current_zone.append((x, y))
            print(f"Added point {len(self.current_zone)}: ({x}, {y})")
            self.update_display()
        
        elif event == cv2.EVENT_MOUSEMOVE:
            # Update display to show preview line
            self.update_display()
        
        elif event == cv2.EVENT_RBUTTONDOWN:
            # Complete current zone on right click
            if len(self.current_zone) >= 3:
                self.complete_zone()
            else:
                print("Need at least 3 points to complete a zone")
    
    def update_display(self):
        """Update the display with current zones and preview"""
        # Start with original frame
        self.display_frame = self.original_frame.copy()
        
        # Draw completed zones
        for zone_idx, zone in enumerate(self.completed_zones):
            if len(zone) < 3:
                continue
            
            color = self.get_zone_color(zone_idx)
            
            # Draw filled polygon with transparency
            overlay = self.display_frame.copy()
            cv2.fillPoly(overlay, [np.array(zone, np.int32)], color)
            cv2.addWeighted(overlay, 0.3, self.display_frame, 0.7, 0, self.display_frame)
            
            # Draw zone outline
            cv2.polylines(self.display_frame, [np.array(zone, np.int32)], True, color, self.line_thickness)
            
            # Draw points
            for point in zone:
                cv2.circle(self.display_frame, point, self.point_radius, color, -1)
                cv2.circle(self.display_frame, point, self.point_radius + 2, (255, 255, 255), 1)
            
            # Draw zone label
            if zone:
                center_x = int(np.mean([p[0] for p in zone]))
                center_y = int(np.mean([p[1] for p in zone]))
                cv2.putText(self.display_frame, f"Zone {zone_idx}", 
                           (center_x - 30, center_y), cv2.FONT_HERSHEY_SIMPLEX, 
                           0.7, (255, 255, 255), 2, cv2.LINE_AA)
        
        # Draw current zone being created
        if self.current_zone:
            current_color = (255, 255, 255)  # White for current zone
            
            # Draw lines between points
            for i in range(len(self.current_zone) - 1):
                cv2.line(self.display_frame, self.current_zone[i], 
                        self.current_zone[i + 1], current_color, self.line_thickness)
            
            # Draw preview line to mouse
            if len(self.current_zone) > 0:
                cv2.line(self.display_frame, self.current_zone[-1], self.mouse_pos, 
                        current_color, 1)  # Thinner line for preview
            
            # Draw points
            for point in self.current_zone:
                cv2.circle(self.display_frame, point, self.point_radius, current_color, -1)
                cv2.circle(self.display_frame, point, self.point_radius + 2, (0, 0, 0), 1)
        
        # Draw instructions
        instructions = [
            "Left click: Add point to zone",
            "Right click: Complete zone (need 3+ points)",
            "ESC: Cancel current zone",
            "C: Clear all zones",
            "S: Save zones",
            "Q: Quit",
            f"Zones created: {len(self.completed_zones)} | Current points: {len(self.current_zone)}"
        ]
        
        for i, instruction in enumerate(instructions):
            color = (255, 255, 255) if i < 6 else (0, 255, 255)
            cv2.putText(self.display_frame, instruction, (10, 30 + i * 25),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
        
        cv2.imshow(self.window_name, self.display_frame)
    
    def complete_zone(self):
        """Complete the current zone and add it to completed zones"""
        if len(self.current_zone) >= 3:
            self.completed_zones.append(self.current_zone.copy())
            print(f"Zone {len(self.completed_zones)} completed with {len(self.current_zone)} points")
            self.current_zone = []
            self.update_display()
        else:
            print("Need at least 3 points to complete a zone")
    
    def cancel_current_zone(self):
        """Cancel the current zone"""
        if self.current_zone:
            print(f"Cancelled zone with {len(self.current_zone)} points")
            self.current_zone = []
            self.update_display()
    
    def clear_all_zones(self):
        """Clear all zones"""
        if self.completed_zones or self.current_zone:
            self.completed_zones = []
            self.current_zone = []
            print("Cleared all zones")
            self.update_display()
    
    def save_zones(self, output_path: str) -> bool:
        """Save zones to JSON file"""
        if not self.completed_zones:
            print("No zones to save!")
            return False
        
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
            
            with open(output_path, 'w') as f:
                json.dump(self.completed_zones, f, indent=2)
            
            print(f"Saved {len(self.completed_zones)} zones to {output_path}")
            
            # Also save a readable summary
            summary_path = output_path.replace('.json', '_summary.txt')
            with open(summary_path, 'w') as f:
                f.write(f"Zone Configuration Summary\n")
                f.write(f"Video: {self.video_path}\n")
                f.write(f"Frame size: {self.original_frame.shape[1]}x{self.original_frame.shape[0]}\n")
                f.write(f"Total zones: {len(self.completed_zones)}\n\n")
                
                for i, zone in enumerate(self.completed_zones):
                    f.write(f"Zone {i}:\n")
                    for j, point in enumerate(zone):
                        f.write(f"  Point {j+1}: ({point[0]}, {point[1]})\n")
                    f.write("\n")
            
            print(f"Summary saved to {summary_path}")
            return True
        
        except Exception as e:
            print(f"Error saving zones: {e}")
            return False
    
    def load_existing_zones(self, zones_path: str) -> bool:
        """Load existing zones from file"""
        if not os.path.exists(zones_path):
            return False
        
        try:
            with open(zones_path, 'r') as f:
                zones_data = json.load(f)
            
            self.completed_zones = []
            for zone_points in zones_data:
                # Convert to list of tuples
                zone = [(int(p[0]), int(p[1])) for p in zone_points]
                self.completed_zones.append(zone)
            
            print(f"Loaded {len(self.completed_zones)} zones from {zones_path}")
            return True
        
        except Exception as e:
            print(f"Error loading zones: {e}")
            return False
    
    def run(self, output_path: str, load_existing: bool = False):
        """Run the interactive zone creator"""
        
        # Load first frame
        if not self.load_first_frame():
            return False
        
        # Try to load existing zones
        if load_existing and os.path.exists(output_path):
            self.load_existing_zones(output_path)
        
        # Setup window
        cv2.namedWindow(self.window_name, cv2.WINDOW_AUTOSIZE)
        cv2.setMouseCallback(self.window_name, self.mouse_callback)
        
        self.update_display()
        
        print("\n=== INTERACTIVE ZONE CREATOR ===")
        print("=" * 50)
        print("Video loaded successfully!")
        print("Left click to add points")
        print("Right click to complete zone")
        print("Press 'S' to save, 'Q' to quit")
        print("=" * 50)
        
        while True:
            key = cv2.waitKey(1) & 0xFF
            
            if key == 27:  # ESC - cancel current zone
                self.cancel_current_zone()
            
            elif key == ord('c') or key == ord('C'):  # Clear all zones
                self.clear_all_zones()
            
            elif key == ord('s') or key == ord('S'):  # Save zones
                if self.save_zones(output_path):
                    print("Zones saved! You can continue editing or press Q to quit.")
                
            elif key == ord('q') or key == ord('Q'):  # Quit
                if self.completed_zones:
                    print(f"Exiting with {len(self.completed_zones)} zones created")
                else:
                    print("Exiting without creating zones")
                break
            
            elif key == ord('h') or key == ord('H'):  # Help
                print("\nHELP:")
                print("  Left click: Add point to current zone")
                print("  Right click: Complete zone (needs 3+ points)")
                print("  ESC: Cancel current zone")
                print("  C: Clear all zones")
                print("  S: Save zones to file")
                print("  Q: Quit application")
                print("  H: Show this help")
        
        cv2.destroyAllWindows()
        return True


def main():
    parser = argparse.ArgumentParser(description="Interactive zone creator for video tracking")
    parser.add_argument("--video", required=True, help="Path to video file")
    parser.add_argument("--output", required=True, help="Output path for zone configuration JSON")
    parser.add_argument("--load", action="store_true", help="Load existing zones if available")
    
    args = parser.parse_args()
    
    try:
        creator = InteractiveZoneCreator(args.video)
        success = creator.run(args.output, load_existing=args.load)
        
        if success:
            print("\nZone creation completed successfully!")
            print(f"Zones saved to: {args.output}")
            print(f"Ready to use with tracking: python activity_detector.py --video {args.video} --zones {args.output}")
        else:
            print("\nZone creation failed")
            
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()