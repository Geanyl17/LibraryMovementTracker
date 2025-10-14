'use client';

import { useState } from 'react';

export default function VideoProcessor({ videoFile, zones, videoSize, onProcessingComplete }) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confidence, setConfidence] = useState(0.3);
  const [detectActivity, setDetectActivity] = useState(false);

  const handleProcess = async () => {
    if (!videoFile) {
      setError('Please upload a video first');
      return;
    }

    if (!zones || zones.length === 0) {
      setError('Please create at least one zone');
      return;
    }

    setProcessing(true);
    setError('');
    setProgress('Uploading video and zones...');
    setResult(null);

    try {
      // Convert zones to the format expected by the tracking script
      // Zones from ZoneSelector have {id, startX, startY, endX, endY, name, color}
      // Need to convert to polygon format [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
      // AND scale from display coordinates to actual video coordinates

      // Calculate scaling factors
      let scaleX = 1;
      let scaleY = 1;

      if (videoSize && videoSize.videoWidth && videoSize.width) {
        scaleX = videoSize.videoWidth / videoSize.width;
        scaleY = videoSize.videoHeight / videoSize.height;
        console.log(`Scaling zones: display ${videoSize.width}x${videoSize.height} → video ${videoSize.videoWidth}x${videoSize.videoHeight}`);
        console.log(`Scale factors: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`);
      }

      const polygonZones = zones.map(zone => {
        const x1 = Math.min(zone.startX, zone.endX) * scaleX;
        const y1 = Math.min(zone.startY, zone.endY) * scaleY;
        const x2 = Math.max(zone.startX, zone.endX) * scaleX;
        const y2 = Math.max(zone.startY, zone.endY) * scaleY;

        return [
          [Math.round(x1), Math.round(y1)],  // top-left
          [Math.round(x2), Math.round(y1)],  // top-right
          [Math.round(x2), Math.round(y2)],  // bottom-right
          [Math.round(x1), Math.round(y2)]   // bottom-left
        ];
      });

      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('zones', JSON.stringify(polygonZones));
      formData.append('confidence', confidence.toString());
      formData.append('detectActivity', detectActivity.toString());

      setProgress(detectActivity
        ? 'Processing video with activity detection...'
        : 'Processing video with zone tracking...');

      const response = await fetch('/api/process-video', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      setProgress('Processing complete!');
      setResult(data);

      if (onProcessingComplete) {
        onProcessingComplete(data);
      }

    } catch (err) {
      console.error('Processing error:', err);
      setError(err.message || 'Failed to process video');
      setProgress('');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Process Video</h2>

      {/* Configuration */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Detection Confidence Threshold
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={processing}
            />
            <span className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
              {confidence.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Lower values detect more people (including stationary), higher values are more strict
          </p>
        </div>

        <div className="border-t pt-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={detectActivity}
              onChange={(e) => setDetectActivity(e.target.checked)}
              disabled={processing}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Enable Activity Detection
              </span>
              <p className="text-xs text-gray-500">
                Detect activities: standing, walking, running, sitting/crouching, loitering, erratic movement
              </p>
            </div>
          </label>
        </div>

        {/* Status Display */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className={`p-3 rounded ${videoFile ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            <div className="font-semibold">Video</div>
            <div className="text-xs">
              {videoFile ? `✓ ${videoFile.name}` : '✗ No video'}
            </div>
          </div>
          <div className={`p-3 rounded ${zones && zones.length > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            <div className="font-semibold">Zones</div>
            <div className="text-xs">
              {zones && zones.length > 0 ? `✓ ${zones.length} zones` : '✗ No zones'}
            </div>
          </div>
          <div className={`p-3 rounded ${result ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            <div className="font-semibold">Status</div>
            <div className="text-xs">
              {result ? '✓ Complete' : processing ? '⟳ Processing...' : '○ Ready'}
            </div>
          </div>
        </div>
      </div>

      {/* Process Button */}
      <button
        onClick={handleProcess}
        disabled={processing || !videoFile || !zones || zones.length === 0}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
          processing || !videoFile || !zones || zones.length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {processing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing Video...
          </span>
        ) : (
          detectActivity ? 'Start Activity Detection' : 'Start Zone Tracking'
        )}
      </button>

      {/* Progress */}
      {progress && (
        <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded text-sm">
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && result.success && (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">✓ Processing Complete!</h3>
            <p className="text-sm text-green-700">{result.message}</p>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-semibold mb-3">Generated Files:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-700">📹 Processed Video</span>
                <code className="text-xs bg-white px-2 py-1 rounded">{result.files.processedVideo}</code>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-700">📊 CSV Analytics</span>
                <code className="text-xs bg-white px-2 py-1 rounded">{result.files.csvPath}</code>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-700">📈 Excel Report</span>
                <code className="text-xs bg-white px-2 py-1 rounded">{result.files.excelPath}</code>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-700">📄 JSON Data</span>
                <code className="text-xs bg-white px-2 py-1 rounded">{result.files.jsonPath}</code>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <a
              href={`/api/download?file=${result.files.csvPath}&timestamp=${result.timestamp}`}
              className="flex-1 py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 text-center text-sm font-medium"
            >
              Download CSV
            </a>
            <a
              href={`/api/download?file=${result.files.excelPath}&timestamp=${result.timestamp}`}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 text-center text-sm font-medium"
            >
              Download Excel
            </a>
            <a
              href={`/api/download?file=${result.files.jsonPath}&timestamp=${result.timestamp}`}
              className="flex-1 py-2 px-4 bg-purple-600 text-white rounded hover:bg-purple-700 text-center text-sm font-medium"
            >
              Download JSON
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
