"""
Zone tracking core functionality
"""

import json
from datetime import datetime
from typing import Dict, List, Set
import numpy as np
import pandas as pd


class ZoneTracker:
    """Enhanced zone tracker that monitors person entry/exit and time spent"""
    
    def __init__(self, fps: int = 30):
        self.fps = fps
        self.frame_count = 0
        
        # Track person states per zone
        self.zone_entries: Dict[int, Dict[int, datetime]] = {}  # zone_id -> {person_id: entry_time}
        self.zone_exits: Dict[int, Dict[int, datetime]] = {}   # zone_id -> {person_id: exit_time}
        self.zone_durations: Dict[int, Dict[int, float]] = {}  # zone_id -> {person_id: total_duration}
        self.zone_current: Dict[int, Set[int]] = {}            # zone_id -> {person_ids currently in zone}
        
        # Analytics data for export
        self.analytics_data: List[Dict] = []
        
    def initialize_zone(self, zone_id: int):
        """Initialize tracking data for a new zone"""
        if zone_id not in self.zone_entries:
            self.zone_entries[zone_id] = {}
            self.zone_exits[zone_id] = {}
            self.zone_durations[zone_id] = {}
            self.zone_current[zone_id] = set()
    
    def update_zone_tracking(self, zone_id: int, person_ids_in_zone: Set[int]):
        """Update zone tracking for current frame"""
        self.initialize_zone(zone_id)
        
        current_time = datetime.now()
        frame_time = self.frame_count / self.fps
        
        # Check for new entries
        new_entries = person_ids_in_zone - self.zone_current[zone_id]
        for person_id in new_entries:
            self.zone_entries[zone_id][person_id] = current_time
            print(f"Person {person_id} entered Zone {zone_id} at frame {self.frame_count}")
            
            # Log entry event
            self.analytics_data.append({
                'timestamp': current_time.isoformat(),
                'frame': self.frame_count,
                'frame_time_sec': round(frame_time, 2),
                'person_id': person_id,
                'zone_id': zone_id,
                'event': 'entry',
                'duration_sec': None
            })
        
        # Check for exits
        exits = self.zone_current[zone_id] - person_ids_in_zone
        for person_id in exits:
            self.zone_exits[zone_id][person_id] = current_time
            
            # Calculate duration if person entered this zone
            if person_id in self.zone_entries[zone_id]:
                entry_time = self.zone_entries[zone_id][person_id]
                duration = (current_time - entry_time).total_seconds()
                
                # Update total duration for this person in this zone
                if person_id not in self.zone_durations[zone_id]:
                    self.zone_durations[zone_id][person_id] = 0
                self.zone_durations[zone_id][person_id] += duration
                
                print(f"Person {person_id} exited Zone {zone_id} after {duration:.1f}s")
                
                # Log exit event
                self.analytics_data.append({
                    'timestamp': current_time.isoformat(),
                    'frame': self.frame_count,
                    'frame_time_sec': round(frame_time, 2),
                    'person_id': person_id,
                    'zone_id': zone_id,
                    'event': 'exit',
                    'duration_sec': round(duration, 2)
                })
        
        # Update current zone occupancy
        self.zone_current[zone_id] = person_ids_in_zone.copy()
    
    def get_zone_analytics(self, zone_id: int) -> Dict:
        """Get analytics summary for a specific zone"""
        self.initialize_zone(zone_id)
        
        # Convert all numpy types to native Python types for JSON serialization
        durations_by_person = {}
        for person_id, duration in self.zone_durations[zone_id].items():
            durations_by_person[str(int(person_id))] = float(duration)
        
        return {
            'zone_id': int(zone_id),
            'current_occupancy': len(self.zone_current[zone_id]),
            'current_people': [int(p) for p in self.zone_current[zone_id]],
            'total_entries': len(self.zone_entries[zone_id]),
            'total_exits': len(self.zone_exits[zone_id]),
            'average_duration': float(np.mean(list(self.zone_durations[zone_id].values())) 
                                     if self.zone_durations[zone_id] else 0),
            'durations_by_person': durations_by_person
        }
    
    def export_analytics(self, output_path: str):
        """Export analytics data to CSV, Excel and JSON"""
        if not self.analytics_data:
            print("No analytics data to export")
            return

        # Organize outputs into proper folders
        from pathlib import Path
        base_name = Path(output_path).stem
        output_dir = Path(output_path).parent

        # Create organized paths
        csv_path = str(output_dir / 'analytics' / 'csv' / f'{base_name}.csv')
        excel_path = str(output_dir / 'analytics' / 'excel' / f'{base_name}.xlsx')
        json_path = str(output_dir / 'analytics' / 'json' / f'{base_name}.json')

        # Ensure directories exist
        Path(csv_path).parent.mkdir(parents=True, exist_ok=True)
        Path(excel_path).parent.mkdir(parents=True, exist_ok=True)
        Path(json_path).parent.mkdir(parents=True, exist_ok=True)

        # Export detailed events log
        df = pd.DataFrame(self.analytics_data)
        
        # Export to CSV
        df.to_csv(csv_path, index=False)
        
        # Export to Excel with multiple sheets
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # Events sheet
            df.to_excel(writer, sheet_name='Events', index=False)
            
            # Summary sheet
            summary_data = []
            for zone_id in self.zone_entries.keys():
                analytics = self.get_zone_analytics(zone_id)
                summary_data.append({
                    'Zone_ID': zone_id,
                    'Current_Occupancy': analytics['current_occupancy'],
                    'Total_Entries': analytics['total_entries'],
                    'Total_Exits': analytics['total_exits'],
                    'Average_Duration_Sec': round(analytics['average_duration'], 2),
                    'Current_People': ', '.join(map(str, analytics['current_people']))
                })
            
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Zone_Summary', index=False)
            
            # Duration by person sheet
            duration_data = []
            for zone_id in self.zone_durations.keys():
                for person_id, duration in self.zone_durations[zone_id].items():
                    duration_data.append({
                        'Zone_ID': zone_id,
                        'Person_ID': person_id,
                        'Total_Duration_Sec': round(duration, 2)
                    })
            
            if duration_data:
                duration_df = pd.DataFrame(duration_data)
                duration_df.to_excel(writer, sheet_name='Person_Durations', index=False)
        
        # Export summary analytics to JSON
        summary = {
            'total_frames': self.frame_count,
            'total_duration_sec': self.frame_count / self.fps,
            'zones': {}
        }
        
        for zone_id in self.zone_entries.keys():
            summary['zones'][str(zone_id)] = self.get_zone_analytics(zone_id)
        
        with open(json_path, 'w') as f:
            json.dump(summary, f, indent=2)

        print(f"Analytics exported to {csv_path}, {excel_path}, and {json_path}")