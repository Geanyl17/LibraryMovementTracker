#!/usr/bin/env python3
"""
Script to configure zones interactively
"""

import argparse
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ui.zone_configurator import ZoneConfigurator


def main():
    parser = argparse.ArgumentParser(description="Interactive zone configuration tool")
    parser.add_argument("--source", required=True, help="Path to image or video file")
    parser.add_argument("--output", required=True, help="Output path for zone configuration JSON")
    parser.add_argument("--load", action="store_true", help="Load existing zones if available")
    
    args = parser.parse_args()
    
    try:
        configurator = ZoneConfigurator(args.source)
        configurator.run(args.output, load_existing=args.load)
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()