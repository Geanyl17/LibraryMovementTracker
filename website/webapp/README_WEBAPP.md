# Video Analytics Dashboard

A Next.js web application for analyzing CSV data and creating video zone selections. This dashboard provides comprehensive statistics, data visualizations, and interactive video zone selection capabilities.

## Features

### 📊 CSV Data Analysis
- **File Upload**: Drag-and-drop or click to upload CSV files
- **Data Preview**: View the first 5 rows of your data in a table format
- **Smart Type Detection**: Automatically identifies numeric and text columns
- **Comprehensive Statistics**: 
  - Row and column counts
  - Numeric columns: min, max, mean, median values
  - Text columns: unique value counts and most common values

### 📈 Data Visualization
- **Multiple Chart Types**: Bar charts, line charts, doughnut charts
- **Automatic Chart Generation**:
  - Distribution histograms for numeric data
  - Time series trends for sequential data
  - Frequency charts for categorical data
  - Correlation plots for multi-variable analysis
- **Interactive Chart Selection**: Switch between different visualizations
- **Overview Dashboard**: Data type distribution and column analysis

### 🎥 Video Upload & Processing
- **Multi-format Support**: MP4, AVI, MOV, WMV, FLV, WebM, MKV
- **Drag-and-Drop Interface**: Easy video upload with visual feedback
- **Video Preview**: Built-in video player with controls
- **File Information**: Display video metadata (size, type, modification date)

### 🎯 Zone Selection System
- **Interactive Drawing**: Click and drag to create detection zones on videos
- **Zone Management**:
  - Create multiple zones with automatic color coding
  - Rename zones with custom labels
  - Select and delete individual zones
  - Clear all zones functionality
- **Visual Feedback**:
  - Semi-transparent zone overlays
  - Zone selection highlighting
  - Real-time position and size display
- **Zone Details Panel**: 
  - Position coordinates
  - Dimensions
  - Unique zone IDs

### 📋 Session Summary
- **Real-time Status**: Track uploaded files and created zones
- **Data Overview**: Quick summary of current session state
- **File Metadata**: Display file sizes and processing status

## Installation

1. **Navigate to the webapp directory:**
   ```bash
   cd website/webapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Dependencies

### Core Framework
- **Next.js 15**: React framework with server-side rendering
- **React 18**: UI library for building interactive components
- **Tailwind CSS**: Utility-first CSS framework for styling

### Data Processing
- **PapaParse**: CSV parsing library for handling file uploads
- **Chart.js**: Powerful charting library for data visualization
- **react-chartjs-2**: React wrapper for Chart.js

### File Handling
- **react-dropzone**: Drag-and-drop file upload component

## Usage Guide

### 1. Upload a Video
1. Click on the "Upload Video" section
2. Drag and drop a video file or click to browse
3. The video will appear with a preview player

### 2. Create Detection Zones
1. After uploading a video, scroll to the "Zone Selection" section
2. Click and drag on the video to create rectangular zones
3. Click on existing zones to select them
4. Use the zone list to rename or delete zones
5. View zone details in the right panel

### 3. Analyze CSV Data
1. Upload a CSV file using the "Upload CSV File" section
2. View the data preview table showing the first 5 rows
3. Check the "Data Statistics" section for comprehensive analysis
4. Explore different visualizations in the "Data Visualization" section

### 4. View Session Summary
The bottom section displays a summary of:
- Loaded CSV data (row count and filename)
- Uploaded video (filename and size)
- Created zones (total count)

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── CSVReader.js       # CSV file upload and parsing
│   │   ├── Statistics.js      # Data analysis and statistics
│   │   ├── VideoUpload.js     # Video file upload component
│   │   ├── ZoneSelector.js    # Interactive zone creation
│   │   └── Charts.js          # Data visualization components
│   └── page.js                # Main application page
```

## Component Details

### CSVReader Component
- Handles CSV file uploads with validation
- Parses CSV data using PapaParse
- Displays data preview in table format
- Provides upload status and error handling

### Statistics Component
- Analyzes uploaded CSV data
- Calculates descriptive statistics
- Identifies column types automatically
- Shows frequency distributions for categorical data

### VideoUpload Component
- Supports multiple video formats
- Drag-and-drop interface with visual feedback
- Video preview with built-in controls
- File metadata display

### ZoneSelector Component
- Canvas-based zone drawing system
- Interactive zone management
- Real-time visual feedback
- Zone properties and details

### Charts Component
- Multiple chart type generation
- Automatic chart configuration
- Interactive chart selection
- Responsive design for different screen sizes

## Technical Features

### Responsive Design
- Mobile-friendly interface
- Adaptive layouts for different screen sizes
- Touch-friendly controls for mobile devices

### Error Handling
- File validation for supported formats
- Upload progress indication
- User-friendly error messages
- Graceful fallbacks for unsupported features

### Performance Optimizations
- Client-side rendering for interactive components
- Efficient data processing algorithms
- Memory-conscious file handling
- Optimized chart rendering

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Video Support**: HTML5 video element
- **Canvas Support**: HTML5 canvas for zone drawing
- **File API**: Modern file upload capabilities

## Development

### Available Scripts
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint for code quality

### Adding New Features
The modular component structure makes it easy to add new features:
1. Create new components in `src/app/components/`
2. Import and use in `src/app/page.js`
3. Follow existing patterns for state management
4. Maintain consistent styling with Tailwind CSS

## Future Enhancements

Potential features for future development:
- Export functionality for zone configurations
- Integration with video analytics APIs
- Real-time video processing
- Advanced statistical analysis
- Data export in multiple formats
- User authentication and session persistence

## Support

For issues or questions about this web application, please refer to the main project documentation or create an issue in the project repository.