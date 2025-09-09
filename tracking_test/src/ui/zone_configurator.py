"""
Interactive Zone Configuration Tool
Allows users to draw and configure zones for person tracking
"""

import json
import os
from typing import Any, List, Tuple
import cv2
import numpy as np

# Key bindings
KEY_ENTER = 13
KEY_NEWLINE = 10
KEY_ESCAPE = 27
KEY_QUIT = ord("q")
KEY_SAVE = ord("s")
KEY_UNDO = ord("u")
KEY_CLEAR = ord("c")
KEY_HELP = ord("h")

# Drawing settings
THICKNESS = 3
POINT_RADIUS = 6

# Colors for zones (BGR format)
ZONE_COLORS = [
    (75, 25, 230),   # Red
    (75, 180, 60),   # Green  
    (25, 225, 255),  # Yellow
    (209, 120, 60),  # Blue
    (230, 50, 240),  # Magenta
    (60, 255, 255),  # Cyan
    (128, 128, 128), # Gray
    (0, 165, 255),   # Orange
]

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
CURRENT_COLOR = (255, 255, 255)  # White for current polygon

WINDOW_NAME = "Zone Configurator"


class ZoneConfigurator:
    """Interactive zone drawing and configuration tool"""
    
    def __init__(self, source_path: str):
        self.source_path = source_path
        self.original_image = self._load_source()
        self.image = self.original_image.copy()
        
        # Zone data
        self.completed_zones: List[List[Tuple[int, int]]] = []
        self.current_zone: List[Tuple[int, int]] = []
        self.current_mouse_pos: Tuple[int, int] = (0, 0)
        
        # UI state
        self.show_help = False
        
        if self.original_image is None:
            raise ValueError(f"Could not load source: {source_path}")
        
        print("Zone Configurator loaded successfully!")
        print("Press 'h' for help")
    
    def _load_source(self) -> np.ndarray:
        """Load image or video frame"""
        if not os.path.exists(self.source_path):
            return None
        
        # Try loading as image first
        image = cv2.imread(self.source_path)
        if image is not None:
            return image
        
        # Try loading as video
        cap = cv2.VideoCapture(self.source_path)
        if not cap.isOpened():
            return None
        
        ret, frame = cap.read()
        cap.release()
        return frame if ret else None
    
    def _get_zone_color(self, zone_idx: int) -> Tuple[int, int, int]:
        """Get color for a specific zone"""
        return ZONE_COLORS[zone_idx % len(ZONE_COLORS)]
    
    def _draw_help_overlay(self, image: np.ndarray) -> np.ndarray:
        """Draw help overlay on image"""
        overlay = image.copy()
        h, w = image.shape[:2]
        
        # Semi-transparent background
        cv2.rectangle(overlay, (20, 20), (w-20, h-100), BLACK, -1)
        alpha = 0.8
        image = cv2.addWeighted(overlay, alpha, image, 1-alpha, 0)
        
        help_text = [
            "ZONE CONFIGURATOR HELP",
            "",
            "Mouse Controls:",
            "  Left Click - Add point to current zone",
            "  Mouse Move - Preview next line",
            "",
            "Keyboard Controls:",
            "  ENTER - Complete current zone",
            "  ESC   - Cancel current zone",
            "  u     - Undo last zone",
            "  c     - Clear all zones", 
            "  s     - Save zones to file",
            "  h     - Toggle this help",
            "  q     - Quit without saving",
            "",
            "Instructions:",
            "1. Click points to draw zone boundaries",
            "2. Press ENTER to complete each zone",
            "3. Press 's' to save when done",
            "",
            f"Zones completed: {len(self.completed_zones)}"
        ]
        
        y_start = 50
        for i, text in enumerate(help_text):
            color = WHITE if text else WHITE
            if text.startswith("ZONE CONFIGURATOR"):
                color = (0, 255, 255)  # Cyan for title
            elif text.endswith(":"):
                color = (0, 255, 0)    # Green for headers
            
            cv2.putText(image, text, (40, y_start + i * 25), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1, cv2.LINE_AA)
        
        return image
    
    def _draw_zones(self, image: np.ndarray) -> np.ndarray:
        """Draw all completed zones and current zone"""
        # Draw completed zones
        for zone_idx, zone in enumerate(self.completed_zones):
            if len(zone) < 2:
                continue
                
            color = self._get_zone_color(zone_idx)
            
            # Draw zone lines
            for i in range(len(zone)):
                start_point = zone[i]
                end_point = zone[(i + 1) % len(zone)]
                cv2.line(image, start_point, end_point, color, THICKNESS)
            
            # Draw zone points
            for point in zone:
                cv2.circle(image, point, POINT_RADIUS, color, -1)
                cv2.circle(image, point, POINT_RADIUS + 2, BLACK, 2)
            
            # Draw zone label
            if zone:
                center_x = int(np.mean([p[0] for p in zone]))
                center_y = int(np.mean([p[1] for p in zone]))
                cv2.putText(image, f"Zone {zone_idx}", (center_x - 25, center_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2, cv2.LINE_AA)
        
        # Draw current zone being created
        if len(self.current_zone) > 0:
            # Draw current zone lines
            for i in range(len(self.current_zone) - 1):
                cv2.line(image, self.current_zone[i], self.current_zone[i + 1], 
                        CURRENT_COLOR, THICKNESS)
            
            # Draw preview line to mouse
            if len(self.current_zone) > 0:
                cv2.line(image, self.current_zone[-1], self.current_mouse_pos, 
                        CURRENT_COLOR, THICKNESS // 2)
            
            # Draw current zone points
            for point in self.current_zone:
                cv2.circle(image, point, POINT_RADIUS, CURRENT_COLOR, -1)
                cv2.circle(image, point, POINT_RADIUS + 2, BLACK, 2)
        
        return image
    
    def _draw_status(self, image: np.ndarray) -> np.ndarray:
        """Draw status information"""
        h, w = image.shape[:2]
        
        status_text = [
            f"Zones: {len(self.completed_zones)} | Current points: {len(self.current_zone)}",
            "Press 'h' for help | 's' to save | 'q' to quit"
        ]
        
        for i, text in enumerate(status_text):
            cv2.putText(image, text, (10, h - 40 + i * 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, WHITE, 1, cv2.LINE_AA)
        
        return image
    
    def _update_display(self):
        """Update the display with current state"""
        self.image = self.original_image.copy()
        self.image = self._draw_zones(self.image)
        self.image = self._draw_status(self.image)
        
        if self.show_help:
            self.image = self._draw_help_overlay(self.image)
        
        cv2.imshow(WINDOW_NAME, self.image)
    
    def _mouse_callback(self, event: int, x: int, y: int, flags: int, param: Any):
        """Handle mouse events"""
        if event == cv2.EVENT_MOUSEMOVE:
            self.current_mouse_pos = (x, y)
            self._update_display()
        
        elif event == cv2.EVENT_LBUTTONDOWN:
            self.current_zone.append((x, y))
            print(f"Added point {len(self.current_zone)}: ({x}, {y})")
            self._update_display()
    
    def _complete_current_zone(self):
        """Complete the current zone"""
        if len(self.current_zone) >= 3:
            self.completed_zones.append(self.current_zone.copy())
            print(f"Zone {len(self.completed_zones)} completed with {len(self.current_zone)} points")
            self.current_zone = []
            self._update_display()
        else:
            print("Zone needs at least 3 points to be completed")
    
    def _cancel_current_zone(self):
        """Cancel the current zone"""
        if self.current_zone:
            print(f"Cancelled current zone with {len(self.current_zone)} points")
            self.current_zone = []
            self._update_display()
    
    def _undo_last_zone(self):
        """Remove the last completed zone"""
        if self.completed_zones:
            removed = self.completed_zones.pop()
            print(f"Removed zone {len(self.completed_zones) + 1} with {len(removed)} points")
            self._update_display()
    
    def _clear_all_zones(self):
        """Clear all zones"""
        if self.completed_zones or self.current_zone:
            self.completed_zones = []
            self.current_zone = []
            print("Cleared all zones")
            self._update_display()
    
    def save_zones(self, output_path: str) -> bool:
        """Save zones to JSON file"""
        try:
            zones_data = []
            for zone in self.completed_zones:
                zones_data.append(zone)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
            
            with open(output_path, 'w') as f:
                json.dump(zones_data, f, indent=2)
            
            print(f"Saved {len(zones_data)} zones to {output_path}")
            return True
        
        except Exception as e:
            print(f"Error saving zones: {e}")
            return False
    
    def load_zones(self, zones_path: str) -> bool:
        """Load zones from JSON file"""
        try:
            with open(zones_path, 'r') as f:
                zones_data = json.load(f)
            
            self.completed_zones = []
            for zone_points in zones_data:
                # Convert to list of tuples
                zone = [(int(p[0]), int(p[1])) for p in zone_points]
                self.completed_zones.append(zone)
            
            print(f"Loaded {len(self.completed_zones)} zones from {zones_path}")
            self._update_display()
            return True
        
        except Exception as e:
            print(f"Error loading zones: {e}")
            return False
    
    def run(self, output_path: str, load_existing: bool = False):
        """Run the interactive zone configurator"""
        
        # Try to load existing zones if requested
        if load_existing and os.path.exists(output_path):
            self.load_zones(output_path)
        
        # Setup window and callbacks
        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_AUTOSIZE)
        cv2.setMouseCallback(WINDOW_NAME, self._mouse_callback)
        
        self._update_display()
        
        print("\n=== ZONE CONFIGURATOR ===")
        print("Click to add points, ENTER to complete zone, 's' to save, 'q' to quit")
        print("Press 'h' for full help")
        
        while True:
            key = cv2.waitKey(1) & 0xFF
            
            if key == KEY_ENTER or key == KEY_NEWLINE:
                self._complete_current_zone()
            
            elif key == KEY_ESCAPE:
                self._cancel_current_zone()
            
            elif key == KEY_UNDO:
                self._undo_last_zone()
            
            elif key == KEY_CLEAR:
                self._clear_all_zones()
            
            elif key == KEY_SAVE:
                if self.save_zones(output_path):
                    print("Zones saved successfully!")
                    break
                else:
                    print("Failed to save zones")
            
            elif key == KEY_HELP:
                self.show_help = not self.show_help
                self._update_display()
            
            elif key == KEY_QUIT:
                print("Exiting without saving")
                break
        
        cv2.destroyAllWindows()