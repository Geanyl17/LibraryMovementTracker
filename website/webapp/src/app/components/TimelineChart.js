'use client';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

export default function TimelineChart({ csvData, fileName }) {
  const [selectedZones, setSelectedZones] = useState(new Set());
  const [showAll, setShowAll] = useState(true);

  // Define formatTime function before useMemo
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timelineData = useMemo(() => {
    if (!csvData || csvData.length === 0) return null;

    // Check if we have zone_id column
    const hasZoneData = csvData[0]?.zone_id !== undefined;
    if (!hasZoneData) return null;

    // Group data by time intervals (1 second intervals)
    const timeGroups = {};
    const zones = new Set();

    csvData.forEach(row => {
      const time = parseFloat(row.frame_time_sec || row.timestamp || 0);
      const zoneId = row.zone_id !== undefined ? row.zone_id : 'unknown';
      const personId = row.person_id || row.track_id;

      zones.add(zoneId);

      // Round time to 1 second intervals
      const timeKey = Math.floor(time);

      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = {
          time: timeKey,
          peopleByZone: {}
        };
      }

      if (!timeGroups[timeKey].peopleByZone[zoneId]) {
        timeGroups[timeKey].peopleByZone[zoneId] = new Set();
      }

      if (personId !== undefined) {
        timeGroups[timeKey].peopleByZone[zoneId].add(personId);
      }
    });

    // Convert to array format suitable for recharts
    const timeline = Object.keys(timeGroups)
      .sort((a, b) => parseFloat(a) - parseFloat(b))
      .map(timeKey => {
        const group = timeGroups[timeKey];
        const dataPoint = {
          time: group.time,
          timeLabel: formatTime(group.time),
          total: 0
        };

        // Add count for each zone
        zones.forEach(zoneId => {
          const count = group.peopleByZone[zoneId]?.size || 0;
          dataPoint[`zone_${zoneId}`] = count;
          dataPoint.total += count;
        });

        return dataPoint;
      });

    return {
      timeline,
      zones: Array.from(zones).sort((a, b) => a - b),
      maxPeople: Math.max(...timeline.map(d => d.total)),
      duration: timeline.length > 0 ? timeline[timeline.length - 1].time : 0
    };
  }, [csvData, formatTime]);

  if (!timelineData) return null;

  const toggleZone = (zoneId) => {
    const newSelected = new Set(selectedZones);
    if (newSelected.has(zoneId)) {
      newSelected.delete(zoneId);
    } else {
      newSelected.add(zoneId);
    }
    setSelectedZones(newSelected);
    setShowAll(false);
  };

  const toggleAll = () => {
    setShowAll(true);
    setSelectedZones(new Set());
  };

  // Zone colors
  const zoneColors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];

  const getZoneColor = (zoneId) => {
    const index = parseInt(zoneId) || 0;
    return zoneColors[index % zoneColors.length];
  };

  // Determine which zones to display
  const displayZones = showAll || selectedZones.size === 0
    ? timelineData.zones
    : Array.from(selectedZones);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-800 mb-2">
          Time: {label}
        </p>
        {payload.map((entry, index) => {
          if (entry.value === 0) return null;
          return (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">
                {entry.name}: {entry.value} {entry.value === 1 ? 'person' : 'people'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          📈 Timeline Analysis
        </h2>
        <p className="text-sm text-gray-600">
          People count over time by zone • Duration: {formatTime(timelineData.duration)} • Peak: {timelineData.maxPeople} people
        </p>
      </div>

      {/* Zone Filter Controls */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Filter by Zone:
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleAll}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAll
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Zones
          </button>
          {timelineData.zones.map(zoneId => (
            <button
              key={zoneId}
              onClick={() => toggleZone(zoneId)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedZones.has(zoneId)
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={
                selectedZones.has(zoneId)
                  ? { backgroundColor: getZoneColor(zoneId) }
                  : {}
              }
            >
              Zone {zoneId}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={timelineData.timeline}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timeLabel"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              label={{ value: 'Time (mm:ss)', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              label={{ value: 'Number of People', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => {
                const zoneId = value.replace('zone_', '');
                return `Zone ${zoneId}`;
              }}
            />

            {/* Add a reference line at peak */}
            {timelineData.maxPeople > 0 && (
              <ReferenceLine
                y={timelineData.maxPeople}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: `Peak: ${timelineData.maxPeople}`,
                  position: 'right',
                  fill: '#ef4444',
                  fontSize: 12
                }}
              />
            )}

            {/* Render lines for each zone */}
            {displayZones.map(zoneId => (
              <Line
                key={zoneId}
                type="monotone"
                dataKey={`zone_${zoneId}`}
                stroke={getZoneColor(zoneId)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
                name={`zone_${zoneId}`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Description */}
      <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-gray-700 leading-relaxed">
          <strong>What this shows:</strong> This timeline tracks how many people were detected in each zone throughout the video duration.
          Each colored line represents a different zone, with peaks indicating busy periods and valleys showing quieter moments.
          The red dashed line marks the maximum occupancy reached across all zones.
          Use the zone filters above to focus on specific areas and identify traffic patterns, rush hours, or unusual activity spikes.
          Hover over the graph to see exact counts at any point in time.
        </p>
      </div>

      {/* Statistics Summary */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {displayZones.map(zoneId => {
          const zoneData = timelineData.timeline.map(d => d[`zone_${zoneId}`] || 0);
          const maxCount = Math.max(...zoneData);
          const avgCount = (zoneData.reduce((a, b) => a + b, 0) / zoneData.length).toFixed(1);
          const peakTime = timelineData.timeline[zoneData.indexOf(maxCount)]?.timeLabel || 'N/A';

          return (
            <div
              key={zoneId}
              className="bg-gray-50 p-4 rounded-lg border-l-4"
              style={{ borderColor: getZoneColor(zoneId) }}
            >
              <h4 className="font-semibold text-gray-800 mb-2">Zone {zoneId}</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Peak:</span> {maxCount} people
                </div>
                <div>
                  <span className="font-medium">At:</span> {peakTime}
                </div>
                <div>
                  <span className="font-medium">Avg:</span> {avgCount} people
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
