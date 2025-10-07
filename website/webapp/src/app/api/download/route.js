import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file');
    const timestamp = searchParams.get('timestamp');

    if (!filePath) {
      return NextResponse.json({ error: 'No file specified' }, { status: 400 });
    }

    // Setup paths
    const projectRoot = path.join(process.cwd(), '..', '..', 'tracking_test');
    const fullPath = path.join(projectRoot, 'outputs', filePath);

    // Security check - ensure path is within outputs directory
    const normalizedPath = path.normalize(fullPath);
    const outputsDir = path.normalize(path.join(projectRoot, 'outputs'));

    if (!normalizedPath.startsWith(outputsDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 });
    }

    // Check if file exists
    if (!existsSync(normalizedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(normalizedPath);

    // Determine content type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    let fileName = path.basename(normalizedPath);

    switch (ext) {
      case '.csv':
        contentType = 'text/csv';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case '.mp4':
        contentType = 'video/mp4';
        break;
    }

    // Create response with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({
      error: 'Failed to download file',
      details: error.message
    }, { status: 500 });
  }
}
