# Computer Vision Tracking System

A comprehensive computer vision tracking system combining custom zone-based person tracking with the supervision library pipeline.

## Project Structure

- `tracking_test/` - Original person tracking project with zone analytics
- `supervision/` - Computer vision pipeline library
- `data/` - Input/output data directory (created when using Docker)

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- For GUI applications: X11 forwarding configured (Linux/macOS)

### Build and Run

1. **Build the Docker image:**
   ```bash
   docker-compose build
   ```

2. **Run interactive development environment:**
   ```bash
   docker-compose run tracking-dev
   ```

3. **Place your video files in the `data/input/` directory**

4. **Inside the container, configure zones:**
   ```bash
   cd tracking_test
   python zone_configurator.py --source /app/data/input/your_video.mp4 --output /app/data/output/zones.json
   ```

5. **Run zone tracking:**
   ```bash
   python zone_tracker.py --video /app/data/input/your_video.mp4 --zones /app/data/output/zones.json --output /app/data/output/tracked_output.mp4
   ```

## Local Development Setup

### Requirements
- Python 3.9+
- See `tracking_test/requirements.txt` for Python dependencies

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd thesis
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r tracking_test/requirements.txt
   cd supervision && pip install -e .
   ```

## Usage

### Zone-Based Person Tracking

The tracking system allows you to:
- Draw custom zones on video
- Track people entering/exiting zones
- Generate detailed analytics
- Export results to CSV/JSON

**Basic workflow:**
1. Configure zones interactively
2. Run tracking analysis
3. Review generated analytics

See `tracking_test/README.md` for detailed usage instructions.

### Supervision Pipeline

The supervision library provides computer vision utilities and pipelines. See the `supervision/` directory for documentation.

## Docker Services

- **tracking-app**: Production-ready container
- **tracking-dev**: Development container with volume mounts for hot reload

## Data Management

- Input files: Place in `data/input/`
- Output files: Generated in `data/output/`
- Model files: Automatically downloaded (yolov8n.pt)

## Contributing

1. Use the development Docker container for consistent environment
2. Test changes with sample videos
3. Update documentation as needed

## GPU Support

For GPU acceleration:
1. Install NVIDIA Docker runtime
2. Add GPU support to docker-compose.yml:
   ```yaml
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             count: 1
             capabilities: [gpu]
   ```
3. Use `--device cuda` flag in tracking commands