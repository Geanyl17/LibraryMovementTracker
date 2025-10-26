'use client';

import { useMemo } from 'react';

export default function ActivityAnalytics({ csvData, fileName }) {
  const activityStats = useMemo(() => {
    if (!csvData || csvData.length === 0) return null;

    // Check if this is activity data
    const hasActivityColumn = csvData[0]?.activity !== undefined;
    if (!hasActivityColumn) return null;

    // Count activities by type and track unique IDs
    const activityCounts = {};
    const uniquePersonIds = new Set();
    const activityByZone = {};
    let totalDetections = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    csvData.forEach(row => {
      const activity = row.activity || 'unknown';
      const personId = row.person_id || row.track_id;
      const zoneId = row.zone_id;
      const confidence = parseFloat(row.confidence || 0);

      // Count by activity type
      activityCounts[activity] = (activityCounts[activity] || 0) + 1;
      totalDetections++;

      // Track unique person IDs
      if (personId !== undefined) {
        uniquePersonIds.add(personId);
      }

      // Track confidence scores
      if (confidence > 0) {
        totalConfidence += confidence;
        confidenceCount++;
      }

      // Count by zone (with activity breakdown)
      if (zoneId !== undefined) {
        if (!activityByZone[zoneId]) {
          activityByZone[zoneId] = {};
        }
        activityByZone[zoneId][activity] = (activityByZone[zoneId][activity] || 0) + 1;
      }
    });

    // Calculate average confidence as percentage
    const avgConfidencePercent = confidenceCount > 0
      ? ((totalConfidence / confidenceCount) * 100).toFixed(1)
      : 0;

    // Sort activities by count
    const sortedActivities = Object.entries(activityCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([activity, count]) => ({
        activity,
        count,
        percentage: ((count / totalDetections) * 100).toFixed(1)
      }));

    // Calculate zone activity percentages
    const zoneActivityPercentages = {};
    Object.entries(activityByZone).forEach(([zoneId, activities]) => {
      const zoneTotal = Object.values(activities).reduce((sum, count) => sum + count, 0);
      zoneActivityPercentages[zoneId] = {};
      Object.entries(activities).forEach(([activity, count]) => {
        zoneActivityPercentages[zoneId][activity] = {
          count,
          percentage: ((count / zoneTotal) * 100).toFixed(1)
        };
      });
    });

    return {
      activityCounts,
      sortedActivities,
      activityByZone,
      zoneActivityPercentages,
      totalDetections: uniquePersonIds.size, // Changed: now using unique IDs
      uniqueActivities: Object.keys(activityCounts).length,
      avgConfidencePercent // Changed: now average confidence instead of unique people
    };
  }, [csvData]);

  if (!activityStats) return null;

  // Activity color mapping (updated for Pose-Temporal detector)
  const activityColors = {
    // Stationary
    'sitting': 'bg-yellow-500',
    'reading': 'bg-orange-500',
    'reading_standing': 'bg-amber-600',
    'standing': 'bg-green-500',

    // Movement
    'walking_slow': 'bg-cyan-400',
    'walking': 'bg-blue-500',
    'walking_fast': 'bg-blue-700',
    'jogging': 'bg-indigo-600',
    'running': 'bg-red-600',

    // Meta states
    'initializing': 'bg-gray-300',
    'no_pose': 'bg-gray-400',
    'unknown': 'bg-gray-500'
  };

  const getActivityColor = (activity) => {
    return activityColors[activity] || 'bg-gray-400';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🏃 Activity Detection Analytics
        </h2>
        <p className="text-sm text-gray-600">
          Analyzing {fileName || 'activity data'}
        </p>
        <div className="mt-2 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
          <p className="text-xs text-blue-800">
            <strong>Pose-Temporal Detector:</strong> Using YOLOv8-Pose keypoints + temporal velocity analysis for accurate activity classification
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-1">
            Total People Tracked
          </h3>
          <p className="text-3xl font-bold text-blue-600">
            {activityStats.totalDetections}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Unique IDs detected
          </p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-green-800 mb-1">
            Avg Confidence
          </h3>
          <p className="text-3xl font-bold text-green-600">
            {activityStats.avgConfidencePercent}%
          </p>
          <p className="text-xs text-green-700 mt-1">
            Detection accuracy
          </p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-800 mb-1">
            Activity Types
          </h3>
          <p className="text-3xl font-bold text-purple-600">
            {activityStats.uniqueActivities}
          </p>
          <p className="text-xs text-purple-700 mt-1">
            Distinct activities
          </p>
        </div>
      </div>

      {/* Activity Distribution */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Activity Distribution
        </h3>
        <div className="space-y-3">
          {activityStats.sortedActivities.map(({ activity, count, percentage }) => (
            <div key={activity} className="flex items-center">
              <div className="w-48 flex items-center">
                <div className={`w-4 h-4 rounded mr-2 ${getActivityColor(activity)}`}></div>
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {activity.replace('_', ' ')}
                </span>
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full ${getActivityColor(activity)} opacity-70 flex items-center justify-end pr-2`}
                    style={{ width: `${percentage}%` }}
                  >
                    {parseFloat(percentage) > 5 && (
                      <span className="text-xs font-semibold text-white">
                        {percentage}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-16 text-right">
                <span className="text-sm font-semibold text-gray-700">
                  {percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity by Zone */}
      {Object.keys(activityStats.activityByZone).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Activity by Zone
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(activityStats.activityByZone).map(([zoneId, activities]) => {
              const totalInZone = Object.values(activities).reduce((sum, count) => sum + count, 0);
              const sortedZoneActivities = Object.entries(activities)
                .sort((a, b) => b[1] - a[1]);

              return (
                <div key={zoneId} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Zone {zoneId}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {totalInZone} detections
                  </p>
                  <div className="space-y-2">
                    {sortedZoneActivities.slice(0, 3).map(([activity, count]) => (
                      <div key={activity} className="flex items-center justify-between text-sm">
                        <span className="flex items-center">
                          <div className={`w-3 h-3 rounded mr-2 ${getActivityColor(activity)}`}></div>
                          <span className="capitalize">{activity.replace('_', ' ')}</span>
                        </span>
                        <span className="font-semibold text-gray-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
