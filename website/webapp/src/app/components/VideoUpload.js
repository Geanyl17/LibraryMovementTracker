'use client';

import { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';

export default function VideoUpload({ onVideoLoad }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    setError('');
    setVideoFile(file);
    
    // Create video URL for preview
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    
    if (onVideoLoad) {
      onVideoLoad(file, url);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv']
    },
    multiple: false
  });

  const handleRemoveVideo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl('');
    setError('');
  };

  const getVideoInfo = () => {
    if (!videoFile) return null;
    
    return {
      name: videoFile.name,
      size: (videoFile.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: videoFile.type,
      lastModified: new Date(videoFile.lastModified).toLocaleDateString()
    };
  };

  const videoInfo = getVideoInfo();

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Upload Video</h2>
      
      {!videoFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
        >
          <input {...getInputProps()} />
          <div className="space-y-4">
            <div className="text-6xl text-gray-400">📹</div>
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Drop the video here...</p>
            ) : (
              <div>
                <p className="text-gray-700 font-medium">
                  Drag & drop a video file here, or click to select
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Supports: MP4, AVI, MOV, WMV, FLV, WebM, MKV
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Video Preview */}
          <div className="relative">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full max-w-2xl rounded-lg shadow-sm"
              style={{ maxHeight: '400px' }}
            >
              Your browser does not support the video tag.
            </video>
            
            <button
              onClick={handleRemoveVideo}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors"
              title="Remove video"
            >
              ✕
            </button>
          </div>

          {/* Video Information */}
          {videoInfo && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Video Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="ml-2 font-medium">{videoInfo.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Size:</span>
                  <span className="ml-2 font-medium">{videoInfo.size}</span>
                </div>
                <div>
                  <span className="text-gray-600">Type:</span>
                  <span className="ml-2 font-medium">{videoInfo.type}</span>
                </div>
                <div>
                  <span className="text-gray-600">Modified:</span>
                  <span className="ml-2 font-medium">{videoInfo.lastModified}</span>
                </div>
              </div>
            </div>
          )}

          {/* Upload Another Button */}
          <button
            onClick={handleRemoveVideo}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Upload Different Video
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      {isProcessing && (
        <div className="mt-4 text-blue-600 bg-blue-50 p-3 rounded">
          Processing video...
        </div>
      )}
    </div>
  );
}