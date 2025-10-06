import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Get the path to tracking_test data outputs
const getTrackingTestPath = () => {
  // Go up from webapp to website, then to thesis root, then to tracking_test
  const webappDir = process.cwd(); // website/webapp
  const websiteDir = path.dirname(webappDir); // website
  const thesisDir = path.dirname(websiteDir); // thesis
  return path.join(thesisDir, 'tracking_test', 'data', 'outputs');
};

export async function GET() {
  try {
    const outputsPath = getTrackingTestPath();
    
    // Check if the tracking_test outputs directory exists
    if (!fs.existsSync(outputsPath)) {
      return NextResponse.json(
        { error: 'Tracking test outputs directory not found', path: outputsPath },
        { status: 404 }
      );
    }

    // Read all CSV files from the outputs directory
    const files = fs.readdirSync(outputsPath);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    
    const csvData = {};
    
    for (const file of csvFiles) {
      const filePath = path.join(outputsPath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        csvData[file] = {
          name: file,
          content: content,
          size: fs.statSync(filePath).size,
          modified: fs.statSync(filePath).mtime
        };
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
        csvData[file] = {
          name: file,
          error: `Failed to read file: ${error.message}`
        };
      }
    }

    return NextResponse.json({
      success: true,
      path: outputsPath,
      files: csvData,
      count: csvFiles.length
    });

  } catch (error) {
    console.error('Error accessing CSV files:', error);
    return NextResponse.json(
      { error: 'Failed to access CSV files', details: error.message },
      { status: 500 }
    );
  }
}