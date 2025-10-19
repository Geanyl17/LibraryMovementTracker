import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video');
    const zonesData = formData.get('zones');
    const confidence = formData.get('confidence') || '0.3';
    const detectActivity = formData.get('detectActivity') === 'true';

    // Enhanced tracking parameters
    const ghostBufferSeconds = formData.get('ghostBufferSeconds') || '3';
    const ghostIouThreshold = formData.get('ghostIouThreshold') || '0.3';
    const ghostDistanceThreshold = formData.get('ghostDistanceThreshold') || '150';

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    if (!zonesData) {
      return NextResponse.json({ error: 'No zones data provided' }, { status: 400 });
    }

    // Parse zones
    const zones = JSON.parse(zonesData);

    // Setup paths - adjust based on your project structure
    const projectRoot = path.join(process.cwd(), '..', '..', 'tracking_test');
    const uploadsDir = path.join(projectRoot, 'data', 'uploads');
    const configDir = path.join(projectRoot, 'config', 'zones');
    const outputsDir = path.join(projectRoot, 'outputs');

    // Create directories if they don't exist
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }
    if (!existsSync(outputsDir)) {
      await mkdir(outputsDir, { recursive: true });
    }

    // Save uploaded video
    const timestamp = Date.now();
    const videoFileName = `video_${timestamp}.mp4`;
    const videoPath = path.join(uploadsDir, videoFileName);

    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(videoPath, buffer);

    // Save zones configuration
    const zonesFileName = `zones_${timestamp}.json`;
    const zonesPath = path.join(configDir, zonesFileName);
    await writeFile(zonesPath, JSON.stringify(zones, null, 2));

    // Setup output paths
    const outputVideoPath = path.join(outputsDir, 'videos', `processed_${timestamp}.mp4`);
    const analyticsPath = path.join(outputsDir, `analytics_${timestamp}.json`);

    // Ensure output directories exist
    await mkdir(path.join(outputsDir, 'videos'), { recursive: true });
    await mkdir(path.join(outputsDir, 'analytics', 'csv'), { recursive: true });
    await mkdir(path.join(outputsDir, 'analytics', 'json'), { recursive: true });
    await mkdir(path.join(outputsDir, 'analytics', 'excel'), { recursive: true });

    // Run the tracking script - use configurable versions with enhanced tracking
    const pythonScript = detectActivity
      ? path.join(projectRoot, 'scripts', 'detect_activity_configurable.py')
      : path.join(projectRoot, 'scripts', 'track_zones_configurable.py');
    const command = `python "${pythonScript}" --video "${videoPath}" --zones "${zonesPath}" --output "${outputVideoPath}" --analytics "${analyticsPath}" --confidence ${confidence} --ghost-buffer-seconds ${ghostBufferSeconds} --ghost-iou-threshold ${ghostIouThreshold} --ghost-distance-threshold ${ghostDistanceThreshold} --no-display`;

    console.log('Executing command:', command);
    console.log('Activity detection:', detectActivity ? 'enabled' : 'disabled');
    console.log('Ghost buffer settings:', { ghostBufferSeconds, ghostIouThreshold, ghostDistanceThreshold });

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: projectRoot,
        timeout: 300000, // 5 minutes timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer (instead of default 1MB)
      });

      console.log('Processing stdout:', stdout);
      if (stderr) {
        console.log('Processing stderr:', stderr);
      }

      // Return success with file paths
      // Activity detection saves files directly in outputs/, while track_zones saves in subdirectories
      const csvPath = detectActivity
        ? `analytics_${timestamp}.csv`
        : path.join('analytics', 'csv', `analytics_${timestamp}.csv`);
      const jsonPath = detectActivity
        ? `analytics_${timestamp}.json`
        : path.join('analytics', 'json', `analytics_${timestamp}.json`);
      const excelPath = path.join('analytics', 'excel', `analytics_${timestamp}.xlsx`);

      return NextResponse.json({
        success: true,
        message: 'Video processed successfully',
        activityDetection: detectActivity,
        files: {
          video: videoFileName,
          zones: zonesFileName,
          processedVideo: `processed_${timestamp}.mp4`,
          analytics: `analytics_${timestamp}`,
          csvPath,
          jsonPath,
          excelPath
        },
        timestamp
      });

    } catch (execError) {
      console.error('Python script execution error:', execError);
      return NextResponse.json({
        error: 'Video processing failed',
        details: execError.message,
        stdout: execError.stdout,
        stderr: execError.stderr
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json({
      error: 'Server error',
      details: error.message
    }, { status: 500 });
  }
}
