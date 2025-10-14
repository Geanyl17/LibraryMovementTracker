'use client';

import { useMemo } from 'react';

export default function ActivityAnalytics({ csvData, fileName }) {
  const activityStats = useMemo(() => {
    if (!csvData || csvData.length === 0) return null;

    // Check if this is activity data
    const hasActivityColumn = csvData[0]?.activity !== undefined;
    if (!hasActivityColumn) return null;

    // Count activities by type
    const activityCounts = {};
    const activityByPerson = {};
    const activityByZone = {};
    let totalDetections = 0;

    csvData.forEach(row => {
      const activity = row.activity || 'unknown';
      const personId = row.person_id || row.track_id;
      const zoneId = row.zone_id;

      // Count by activity type
      activityCounts[activity] = (activityCounts[activity] || 0) + 1;
      totalDetections++;

      // Count by person
      if (personId) {
        if (!activityByPerson[personId]) {
          activityByPerson[personId] = {};
        }
        activityByPerson[personId][activity] = (activityByPerson[personId][activity] || 0) + 1;
      }

      // Count by zone
      if (zoneId !== undefined) {
        if (!activityByZone[zoneId]) {
          activityByZone[zoneId] = {};
        }
        activityByZone[zoneId][activity] = (activityByZone[zoneId][activity] || 0) + 1;
      }
    });

    // Sort activities by count
    const sortedActivities = Object.entries(activityCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([activity, count]) => ({
        activity,
        count,
        percentage: ((count / totalDetections) * 100).toFixed(1)
      }));

    return {
      activityCounts,
      sortedActivities,
      activityByPerson,
      activityByZone,
      totalDetections,
      uniqueActivities: Object.keys(activityCounts).length,
      uniquePeople: Object.keys(activityByPerson).length
    };
  }, [csvData]);

  if (!activityStats) return null;

  // Activity color mapping
  const activityColors = {
    'standing': 'bg-green-500',
    'walking': 'bg-blue-500',
    'walking_slow': 'bg-cyan-500',
    'running': 'bg-red-500',
    'sitting/crouching': 'bg-yellow-500',
    'loitering': 'bg-orange-500',
    'erratic_movement': 'bg-purple-500',
    'potential_fall': 'bg-white',
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-1">
            Total Detections
          </h3>
          <p className="text-3xl font-bold text-blue-600">
            {activityStats.totalDetections.toLocaleString()}
          </p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-green-800 mb-1">
            Unique People
          </h3>
          <p className="text-3xl font-bold text-green-600">
            {activityStats.uniquePeople}
          </p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-800 mb-1">
            Activity Types
          </h3>
          <p className="text-3xl font-bold text-purple-600">
            {activityStats.uniqueActivities}
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
              <div className="w-20 text-right">
                <span className="text-sm font-semibold text-gray-700">
                  {count.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity by Person */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Activity by Person
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Person ID
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Primary Activity
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Frames
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(activityStats.activityByPerson).map(([personId, activities]) => {
                const totalFrames = Object.values(activities).reduce((sum, count) => sum + count, 0);
                const primaryActivity = Object.entries(activities)
                  .sort((a, b) => b[1] - a[1])[0];

                return (
                  <tr key={personId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{personId}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <span className="flex items-center">
                        <div className={`w-3 h-3 rounded mr-2 ${getActivityColor(primaryActivity[0])}`}></div>
                        <span className="capitalize">{primaryActivity[0].replace('_', ' ')}</span>
                        <span className="ml-2 text-gray-500">
                          ({((primaryActivity[1] / totalFrames) * 100).toFixed(0)}%)
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {totalFrames}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
