'use client';

import { useState, useRef, useEffect } from 'react';

export default function ZoneSelector({ videoUrl, onZonesChange }) {
  const [zones, setZones] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentZone, setCurrentZone] = useState(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [selectedZone, setSelectedZone] = useState(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (onZonesChange) {
      onZonesChange(zones, videoSize);
    }
  }, [zones, videoSize, onZonesChange]);

  const handleVideoLoad = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Store both display size and actual video dimensions
      setVideoSize({
        width: rect.width,
        height: rect.height,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });

      // Redraw zones when video is loaded
      redrawZones();
    }
  };

  const getRelativePosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    const pos = getRelativePosition(e);
    setIsDrawing(true);
    setCurrentZone({
      id: Date.now(),
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y,
      name: `Zone ${zones.length + 1}`,
      color: getRandomColor(),
      occupancyThresholds: {
        low: 5,
        medium: 15,
        high: 30
      }
    });
  };

  const draw = (e) => {
    if (!isDrawing || !currentZone) return;
    
    const pos = getRelativePosition(e);
    setCurrentZone(prev => ({
      ...prev,
      endX: pos.x,
      endY: pos.y
    }));
  };

  const stopDrawing = () => {
    if (isDrawing && currentZone) {
      const minWidth = 20;
      const minHeight = 20;
      const width = Math.abs(currentZone.endX - currentZone.startX);
      const height = Math.abs(currentZone.endY - currentZone.startY);
      
      if (width > minWidth && height > minHeight) {
        setZones(prev => [...prev, currentZone]);
      }
    }
    
    setIsDrawing(false);
    setCurrentZone(null);
  };

  const redrawZones = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all zones
    [...zones, currentZone].filter(Boolean).forEach((zone, index) => {
      drawZone(ctx, zone, selectedZone?.id === zone.id);
    });
  };

  const drawZone = (ctx, zone, isSelected = false) => {
    const x = Math.min(zone.startX, zone.endX);
    const y = Math.min(zone.startY, zone.endY);
    const width = Math.abs(zone.endX - zone.startX);
    const height = Math.abs(zone.endY - zone.startY);
    
    // Draw rectangle
    ctx.strokeStyle = isSelected ? '#ff0000' : zone.color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.strokeRect(x, y, width, height);
    
    // Fill with semi-transparent color
    ctx.fillStyle = zone.color + '33'; // Add alpha
    ctx.fillRect(x, y, width, height);
    
    // Draw label
    ctx.fillStyle = zone.color;
    ctx.font = '14px Arial';
    ctx.fillText(zone.name, x + 5, y - 5);
  };

  const getRandomColor = () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'];
    return colors[zones.length % colors.length];
  };

  const handleZoneClick = (e) => {
    if (isDrawing) return;
    
    const pos = getRelativePosition(e);
    const clickedZone = zones.find(zone => {
      const x = Math.min(zone.startX, zone.endX);
      const y = Math.min(zone.startY, zone.endY);
      const width = Math.abs(zone.endX - zone.startX);
      const height = Math.abs(zone.endY - zone.startY);
      
      return pos.x >= x && pos.x <= x + width && pos.y >= y && pos.y <= y + height;
    });
    
    setSelectedZone(clickedZone || null);
  };

  const deleteZone = (zoneId) => {
    setZones(prev => prev.filter(zone => zone.id !== zoneId));
    if (selectedZone?.id === zoneId) {
      setSelectedZone(null);
    }
  };

  const renameZone = (zoneId, newName) => {
    setZones(prev => prev.map(zone =>
      zone.id === zoneId ? { ...zone, name: newName } : zone
    ));
  };

  const updateOccupancyThresholds = (zoneId, thresholds) => {
    setZones(prev => prev.map(zone =>
      zone.id === zoneId ? { ...zone, occupancyThresholds: thresholds } : zone
    ));
    // Update selected zone to reflect changes
    if (selectedZone?.id === zoneId) {
      setSelectedZone(prev => ({ ...prev, occupancyThresholds: thresholds }));
    }
  };

  const clearAllZones = () => {
    setZones([]);
    setSelectedZone(null);
  };

  useEffect(() => {
    redrawZones();
  }, [zones, currentZone, selectedZone]);

  if (!videoUrl) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Zone Selection</h2>
        <p className="text-gray-500">Please upload a video first to select zones.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Zone Selection</h2>
      
      {/* Instructions */}
      <div className="mb-4 p-3 bg-blue-50 rounded">
        <p className="text-sm text-blue-700">
          Click and drag on the video to create detection zones. Click on a zone to select it.
        </p>
      </div>
      
      {/* Video with Canvas Overlay */}
      <div className="relative mb-4">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full max-w-2xl rounded-lg"
          style={{ maxHeight: '400px' }}
          onLoadedMetadata={handleVideoLoad}
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 cursor-crosshair"
          style={{ 
            maxWidth: '100%',
            maxHeight: '400px'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onClick={handleZoneClick}
        />
      </div>

      {/* Zone Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Zone List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Zones ({zones.length})</h3>
            {zones.length > 0 && (
              <button
                onClick={clearAllZones}
                className="bg-red-500 text-white px-3 py-1 text-sm rounded hover:bg-red-600 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedZone?.id === zone.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => setSelectedZone(zone)}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: zone.color }}
                  ></div>
                  <input
                    type="text"
                    value={zone.name}
                    onChange={(e) => renameZone(zone.id, e.target.value)}
                    className="font-medium bg-transparent border-none outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteZone(zone.id);
                  }}
                  className="text-red-500 hover:text-red-700 transition-colors"
                  title="Delete zone"
                >
                  🗑️
                </button>
              </div>
            ))}
            
            {zones.length === 0 && (
              <p className="text-gray-500 text-sm italic">
                No zones created yet. Draw on the video to create zones.
              </p>
            )}
          </div>
        </div>

        {/* Zone Details */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Zone Details</h3>
          
          {selectedZone ? (
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: selectedZone.color }}
                  ></div>
                  <span className="font-medium">{selectedZone.name}</span>
                </div>
                
                <div>
                  <span className="text-gray-600">Position:</span>
                  <span className="ml-2">
                    ({Math.min(selectedZone.startX, selectedZone.endX).toFixed(0)}, 
                     {Math.min(selectedZone.startY, selectedZone.endY).toFixed(0)})
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-600">Size:</span>
                  <span className="ml-2">
                    {Math.abs(selectedZone.endX - selectedZone.startX).toFixed(0)} × 
                    {Math.abs(selectedZone.endY - selectedZone.startY).toFixed(0)}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-600">ID:</span>
                  <span className="ml-2 font-mono text-xs">{selectedZone.id}</span>
                </div>
              </div>

              {/* Occupancy Thresholds */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-sm mb-3 text-gray-700">
                  Occupancy Thresholds
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Set the number of people to define Low, Medium, and High occupancy levels for this zone
                </p>

                <div className="space-y-3">
                  {/* Low Threshold */}
                  <div>
                    <label className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">🟢 Low (1 to X people)</span>
                      <span className="font-semibold">{selectedZone.occupancyThresholds?.low || 5}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={selectedZone.occupancyThresholds?.low || 5}
                      onChange={(e) => updateOccupancyThresholds(selectedZone.id, {
                        ...selectedZone.occupancyThresholds,
                        low: parseInt(e.target.value)
                      })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Medium Threshold */}
                  <div>
                    <label className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">🟡 Medium (X to Y people)</span>
                      <span className="font-semibold">{selectedZone.occupancyThresholds?.medium || 15}</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={selectedZone.occupancyThresholds?.medium || 15}
                      onChange={(e) => updateOccupancyThresholds(selectedZone.id, {
                        ...selectedZone.occupancyThresholds,
                        medium: parseInt(e.target.value)
                      })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* High Threshold */}
                  <div>
                    <label className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">🔴 High (Y+ people)</span>
                      <span className="font-semibold">{selectedZone.occupancyThresholds?.high || 30}</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={selectedZone.occupancyThresholds?.high || 30}
                      onChange={(e) => updateOccupancyThresholds(selectedZone.id, {
                        ...selectedZone.occupancyThresholds,
                        high: parseInt(e.target.value)
                      })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  <strong>Current ranges:</strong><br/>
                  Low: 1-{selectedZone.occupancyThresholds?.low || 5} |
                  Medium: {(selectedZone.occupancyThresholds?.low || 5) + 1}-{selectedZone.occupancyThresholds?.medium || 15} |
                  High: {(selectedZone.occupancyThresholds?.medium || 15) + 1}+
                </div>
              </div>

              <button
                onClick={() => deleteZone(selectedZone.id)}
                className="mt-4 bg-red-500 text-white px-3 py-1 text-sm rounded hover:bg-red-600 transition-colors w-full"
              >
                Delete Zone
              </button>
            </div>
          ) : (
            <div className="p-4 border border-gray-200 rounded-lg text-gray-500">
              Select a zone to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}