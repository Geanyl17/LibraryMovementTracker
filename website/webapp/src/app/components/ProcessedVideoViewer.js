'use client';

import { useState } from 'react';

export default function ProcessedVideoViewer({ result }) {
  const [loading, setLoading] = useState(true);

  if (!result || !result.files) {
    return null;
  }

  const videoUrl = `/api/download?file=videos/${result.files.processedVideo}&timestamp=${result.timestamp}&inline=true`;
  const downloadUrl = `/api/download?file=videos/${result.files.processedVideo}&timestamp=${result.timestamp}`;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Processed Video</h2>
        <p className="text-sm text-gray-600">
          Video with zone tracking annotations and person IDs
        </p>
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
            <div className="text-white">
              <svg className="animate-spin h-10 w-10 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm">Loading video...</p>
            </div>
          </div>
        )}

        <video
          controls
          className="w-full"
          onLoadedData={() => setLoading(false)}
          onError={() => setLoading(false)}
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <a
          href={downloadUrl}
          download
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Video
        </a>

        <button
          onClick={() => window.open(videoUrl, '_blank')}
          className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in New Tab
        </button>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
        <h4 className="font-semibold mb-2">Video Legend:</h4>
        <ul className="space-y-1 text-xs text-gray-700">
          <li><span className="font-mono bg-blue-100 px-1 rounded">Blue Box</span> - Person in Zone 0</li>
          <li><span className="font-mono bg-green-100 px-1 rounded">Green Box</span> - Person in Zone 1</li>
          <li><span className="font-mono bg-yellow-100 px-1 rounded">Yellow Box</span> - Person in Zone 2</li>
          <li><span className="font-mono bg-gray-100 px-1 rounded">Gray Box</span> - Person outside zones</li>
          <li className="mt-2"><strong>Label Format:</strong> #[ID] [MM:SS] - Person ID and time in zone</li>
        </ul>
      </div>
    </div>
  );
}
