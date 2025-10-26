'use client';

import { useMemo } from 'react';

export default function SimpleSummary({ csvData, fileName, zones }) {
  const stats = useMemo(() => {
    if (!csvData || csvData.length === 0) return null;

    // Debug: Log first row to see data structure
    console.log('SimpleSummary - First CSV row:', csvData[0]);
    console.log('SimpleSummary - Total rows:', csvData.length);

    // Calculate key metrics
    const personIds = new Set();
    const personFirstSeen = {};
    const personLastSeen = {};
    const personFirstFrame = {};
    const personLastFrame = {};
    const frameTimestamps = [];
    const frameNumbers = [];
    const zoneOccupancy = {};

    csvData.forEach(row => {
      const personId = row.person_id || row.track_id;
      // Match TimelineChart's field priority: frame_time_sec > timestamp > calculated
      const timestamp = parseFloat(row.frame_time_sec || row.timestamp || 0) || (parseFloat(row.frame) / 30) || 0;
      const frame = parseFloat(row.frame) || 0;
      const zoneId = row.zone_id;

      if (personId !== undefined) {
        personIds.add(personId);

        // Track first and last seen for dwell time (using timestamps)
        if (!personFirstSeen[personId]) {
          personFirstSeen[personId] = timestamp;
        }
        personLastSeen[personId] = timestamp;

        // Also track frames as fallback
        if (!personFirstFrame[personId]) {
          personFirstFrame[personId] = frame;
        }
        personLastFrame[personId] = frame;
      }

      // Track timestamps for video duration (only valid timestamps)
      if (!isNaN(timestamp) && timestamp > 0) {
        frameTimestamps.push(timestamp);
      }
      // Also track frame numbers as fallback
      if (!isNaN(frame) && frame > 0) {
        frameNumbers.push(frame);
      }

      // Track zone occupancy
      if (zoneId !== undefined) {
        if (!zoneOccupancy[zoneId]) {
          zoneOccupancy[zoneId] = new Set();
        }
        if (personId !== undefined) {
          zoneOccupancy[zoneId].add(personId);
        }
      }
    });

    // Calculate total people
    const totalPeople = personIds.size;

    // Check if we have valid timestamps first
    const validTimestamps = frameTimestamps.filter(t => t > 0);
    const hasValidTimestamps = validTimestamps.length > 0;

    // Calculate average dwell time (time between first and last detection)
    const dwellTimes = [];

    personIds.forEach(personId => {
      let dwellTime = 0;

      if (hasValidTimestamps) {
        // Use timestamps if available
        const firstSeen = personFirstSeen[personId];
        const lastSeen = personLastSeen[personId];

        if (firstSeen !== undefined && lastSeen !== undefined &&
            !isNaN(firstSeen) && !isNaN(lastSeen) &&
            firstSeen > 0 && lastSeen > 0) {
          dwellTime = lastSeen - firstSeen;
        }
      } else {
        // Fallback to frame-based calculation
        const firstFrame = personFirstFrame[personId];
        const lastFrame = personLastFrame[personId];

        if (firstFrame !== undefined && lastFrame !== undefined &&
            !isNaN(firstFrame) && !isNaN(lastFrame) &&
            firstFrame > 0 && lastFrame > 0) {
          dwellTime = (lastFrame - firstFrame) / 30; // Assume 30fps
        }
      }

      if (dwellTime >= 0) {
        dwellTimes.push(dwellTime);
      }
    });

    const avgDwellTime = dwellTimes.length > 0
      ? dwellTimes.reduce((sum, time) => sum + time, 0) / dwellTimes.length
      : 0;

    // Debug: Log dwell time calculation for troubleshooting
    console.log('Dwell Time Debug:', {
      totalPeople: personIds.size,
      hasValidTimestamps,
      samplesWithDwellTime: dwellTimes.length,
      minDwellTime: dwellTimes.length > 0 ? Math.min(...dwellTimes) : 'N/A',
      maxDwellTime: dwellTimes.length > 0 ? Math.max(...dwellTimes) : 'N/A',
      avgDwellTime: avgDwellTime,
      examplePerson: Array.from(personIds)[0],
      firstSeen: personFirstSeen[Array.from(personIds)[0]],
      lastSeen: personLastSeen[Array.from(personIds)[0]],
      firstFrame: personFirstFrame[Array.from(personIds)[0]],
      lastFrame: personLastFrame[Array.from(personIds)[0]]
    });

    // Calculate video duration - match TimelineChart approach
    let videoDuration = 0;

    if (hasValidTimestamps) {
      // Use max timestamp (last time point)
      videoDuration = Math.max(...validTimestamps);
    } else if (frameNumbers.length > 0) {
      // Fallback: use frame numbers (assume 30fps)
      videoDuration = Math.max(...frameNumbers) / 30;
    }

    console.log('Video Duration Debug:', {
      totalRows: csvData.length,
      frameTimestamps: frameTimestamps.length,
      validTimestamps: validTimestamps.length,
      frameNumbers: frameNumbers.length,
      calculatedDuration: videoDuration,
      sampleRow: csvData[0],
      maxTimestamp: validTimestamps.length > 0 ? Math.max(...validTimestamps) : 'N/A'
    });

    // Calculate peak occupancy (max people detected at same time)
    const frameOccupancy = {};
    csvData.forEach(row => {
      const frame = row.frame || 0;
      const personId = row.person_id || row.track_id;

      if (personId !== undefined) {
        if (!frameOccupancy[frame]) {
          frameOccupancy[frame] = new Set();
        }
        frameOccupancy[frame].add(personId);
      }
    });

    const peakOccupancy = Math.max(...Object.values(frameOccupancy).map(set => set.size), 0);

    // Calculate busiest zone and get zone-specific occupancy levels
    let busiestZone = null;
    let maxZoneOccupancy = 0;
    const zoneOccupancyDetails = {};

    Object.entries(zoneOccupancy).forEach(([zoneId, people]) => {
      const count = people.size;

      // Find zone configuration
      const zoneConfig = zones?.find(z => z.id.toString() === zoneId.toString());
      const thresholds = zoneConfig?.occupancyThresholds || { low: 5, medium: 15, high: 30 };

      // Determine occupancy level
      let level = 'Low';
      let color = 'green';
      if (count > thresholds.medium) {
        level = 'High';
        color = 'red';
      } else if (count > thresholds.low) {
        level = 'Medium';
        color = 'yellow';
      }

      zoneOccupancyDetails[zoneId] = {
        count,
        level,
        color,
        thresholds,
        name: zoneConfig?.name || `Zone ${zoneId}`
      };

      if (count > maxZoneOccupancy) {
        maxZoneOccupancy = count;
        busiestZone = zoneId;
      }
    });

    // Calculate average occupancy rate
    const avgOccupancy = Object.keys(frameOccupancy).length > 0
      ? Object.values(frameOccupancy).reduce((sum, set) => sum + set.size, 0) / Object.keys(frameOccupancy).length
      : 0;

    // Check if activity detection was used
    const hasActivity = csvData[0]?.activity !== undefined;

    // Calculate overall occupancy level percentage
    // Take the worst-case zone (highest percentage)
    let overallOccupancyPercentage = 0;
    let overallOccupancyLevel = 'Low';
    let overallOccupancyColor = 'green';

    if (Object.keys(zoneOccupancyDetails).length > 0) {
      Object.values(zoneOccupancyDetails).forEach(details => {
        const percentage = (details.count / details.thresholds.high) * 100;
        if (percentage > overallOccupancyPercentage) {
          overallOccupancyPercentage = percentage;
          overallOccupancyLevel = details.level;
          overallOccupancyColor = details.color;
        }
      });
    }

    return {
      totalPeople,
      avgDwellTime,
      videoDuration,
      peakOccupancy,
      busiestZone,
      maxZoneOccupancy,
      avgOccupancy,
      totalZones: Object.keys(zoneOccupancy).length,
      hasActivity,
      zoneOccupancyDetails,
      overallOccupancyPercentage,
      overallOccupancyLevel,
      overallOccupancyColor
    };
  }, [csvData, zones]);

  if (!stats) return null;

  // Format time in a friendly way
  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl shadow-lg border border-blue-100">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          📊 Analytics Summary
        </h2>
        <p className="text-gray-600">
          Quick insights from your video analysis
        </p>
      </div>

      {/* Key Metrics - Infographic Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total People */}
        <div className="bg-white p-6 rounded-xl shadow-md text-center transform hover:scale-105 transition-transform">
          <div className="text-5xl mb-2">👥</div>
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {stats.totalPeople}
          </div>
          <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
            Total Detections 
          </div>
          <div className="text-xs text-gray-500 mt-1">
            amount of foot traffic
          </div>
        </div>

        {/* Average Dwell Time */}
        <div className="bg-white p-6 rounded-xl shadow-md text-center transform hover:scale-105 transition-transform">
          <div className="text-5xl mb-2">⏱️</div>
          <div className="text-4xl font-bold text-green-600 mb-2">
            {formatTime(stats.avgDwellTime)}
          </div>
          <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
            Average Dwell Time
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Time spent per person
          </div>
        </div>

        {/* Occupancy Level */}
        <div className="bg-white p-6 rounded-xl shadow-md text-center transform hover:scale-105 transition-transform">
          <div className="text-5xl mb-2">📈</div>
          <div className="text-4xl font-bold text-orange-600 mb-2">
            {stats.overallOccupancyPercentage > 0
              ? `${Math.round(stats.overallOccupancyPercentage)}%`
              : `${stats.peakOccupancy}`
            }
          </div>
          <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
            Occupancy Level
          </div>
          <div className={`text-xs mt-1 font-semibold ${
            stats.overallOccupancyColor === 'green' ? 'text-green-600' :
            stats.overallOccupancyColor === 'yellow' ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {stats.overallOccupancyPercentage > 0
              ? stats.overallOccupancyLevel
              : 'Based on peak count'
            }
          </div>
        </div>

        {/* Average Occupancy */}
        <div className="bg-white p-6 rounded-xl shadow-md text-center transform hover:scale-105 transition-transform">
          <div className="text-5xl mb-2">📊</div>
          <div className="text-4xl font-bold text-purple-600 mb-2">
            {stats.avgOccupancy.toFixed(1)}
          </div>
          <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
            Average Occupancy
          </div>
          <div className="text-xs text-gray-500 mt-1">
            People per frame
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Video Duration */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Video Duration
              </div>
              <div className="text-xl font-bold text-gray-800">
                {formatTime(stats.videoDuration)}
              </div>
            </div>
            <div className="text-3xl">🎬</div>
          </div>
        </div>

        {/* Busiest Zone */}
        {stats.busiestZone !== null && (
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Busiest Zone
                </div>
                <div className="text-xl font-bold text-gray-800">
                  Zone {stats.busiestZone}
                </div>
                <div className="text-xs text-gray-500">
                  {stats.maxZoneOccupancy} people
                </div>
              </div>
              <div className="text-3xl">🎯</div>
            </div>
          </div>
        )}

        {/* Activity Detection */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Activity Detection
              </div>
              <div className="text-xl font-bold text-gray-800">
                {stats.hasActivity ? 'Enabled' : 'Disabled'}
              </div>
              <div className="text-xs text-gray-500">
                {stats.hasActivity ? 'Pose analysis active' : 'Zone tracking only'}
              </div>
            </div>
            <div className="text-3xl">
              {stats.hasActivity ? '🏃' : '📍'}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Zone Occupancy Levels */}
      {stats.zoneOccupancyDetails && Object.keys(stats.zoneOccupancyDetails).length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Zone Occupancy Levels</h3>
          <div className="space-y-4">
            {Object.entries(stats.zoneOccupancyDetails).map(([zoneId, details]) => (
              <div key={zoneId}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{details.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">{details.count} people</span>
                    <span className={`text-sm font-semibold px-2 py-1 rounded ${
                      details.color === 'green' ? 'bg-green-100 text-green-700' :
                      details.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {details.level}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      details.color === 'green' ? 'bg-green-500' :
                      details.color === 'yellow' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min((details.count / details.thresholds.high) * 100, 100)}%`
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Low (1-{details.thresholds.low})</span>
                  <span>Med ({details.thresholds.low + 1}-{details.thresholds.medium})</span>
                  <span>High ({details.thresholds.medium + 1}+)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-6 text-center text-xs text-gray-500">
        💡 Toggle &ldquo;More In-Depth Data&rdquo; below for detailed analytics and charts
      </div>
    </div>
  );
}
