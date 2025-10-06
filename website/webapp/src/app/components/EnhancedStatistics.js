'use client';

import { useState, useEffect } from 'react';
import { DataProcessor } from './DataProcessor';

export default function EnhancedStatistics({ data, fileName }) {
  const [processedData, setProcessedData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (data && data.length > 0) {
      const processed = DataProcessor.preprocessTrackingData(data);
      setProcessedData(processed);
    }
  }, [data]);

  if (!processedData) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Enhanced Analytics</h2>
        <p className="text-gray-500">No data to analyze</p>
      </div>
    );
  }

  const { summary, personActivities, zoneAnalysis, temporalData } = processedData;
  const insights = DataProcessor.getActivityInsights(processedData);

  const TabButton = ({ id, label, count }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        activeTab === id 
          ? 'bg-blue-500 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label} {count && <span className="text-xs">({count})</span>}
    </button>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600">Total People</h3>
          <p className="text-2xl font-bold text-blue-900">{summary.totalPersons}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-600">Unique Activities</h3>
          <p className="text-2xl font-bold text-green-900">{summary.totalUniqueActivities}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-600">Active Zones</h3>
          <p className="text-2xl font-bold text-purple-900">{summary.totalZones}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-orange-600">Total Frames</h3>
          <p className="text-2xl font-bold text-orange-900">{summary.totalFrames}</p>
        </div>
      </div>

      {/* Data Quality Comparison */}
      <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
        <h3 className="font-semibold text-yellow-800 mb-2">📊 Data Deduplication Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-yellow-700">Raw records:</span>
            <span className="font-bold ml-2">{summary.totalRawRecords.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-yellow-700">Unique activities:</span>
            <span className="font-bold ml-2">{summary.totalUniqueActivities.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-yellow-700">Reduction:</span>
            <span className="font-bold ml-2 text-green-600">
              {((1 - summary.totalUniqueActivities / summary.totalRawRecords) * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-yellow-700">Avg activities/person:</span>
            <span className="font-bold ml-2">{summary.averageActivitiesPerPerson}</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-3">🔍 Key Insights</h3>
        <ul className="space-y-2">
          {insights.map((insight, index) => (
            <li key={index} className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span className="text-blue-700 text-sm">{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Activity Distribution */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3">Activity Distribution (Deduplicated)</h3>
        <div className="space-y-2">
          {Object.entries(summary.activityCounts)
            .sort(([,a], [,b]) => b - a)
            .map(([activity, count]) => (
              <div key={activity} className="flex justify-between items-center">
                <span className="text-gray-700 capitalize">{activity.replace(/_/g, ' ')}</span>
                <div className="flex items-center space-x-2">
                  <div className="bg-blue-200 rounded-full px-2 py-1 text-xs">
                    {count} people
                  </div>
                  <div className="text-gray-500 text-xs">
                    {((count / summary.totalUniqueActivities) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  const renderPersonAnalysis = () => (
    <div className="space-y-4">
      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-3">👥 Person-Level Analysis</h3>
        <p className="text-sm text-green-700 mb-4">
          Detailed breakdown of individual person activities and movements
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Person ID</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Activities</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Zones</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Total Frames</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Duration</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(personActivities)
              .sort((a, b) => b.total_frames - a.total_frames)
              .slice(0, 20) // Show top 20 most active people
              .map((person, index) => (
                <tr key={person.person_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b font-mono">{person.person_id}</td>
                  <td className="px-4 py-2 border-b">
                    <div className="flex flex-wrap gap-1">
                      {person.activities.map(activity => (
                        <span key={activity} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {activity.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 border-b">
                    <div className="flex flex-wrap gap-1">
                      {person.zones.map(zone => (
                        <span key={zone} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                          Zone {zone}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 border-b text-center">{person.total_frames}</td>
                  <td className="px-4 py-2 border-b text-sm text-gray-600">
                    {new Date(person.first_seen).toLocaleTimeString()} - {new Date(person.last_seen).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        
        {Object.keys(personActivities).length > 20 && (
          <p className="text-center text-gray-500 mt-4 text-sm">
            Showing top 20 of {Object.keys(personActivities).length} people
          </p>
        )}
      </div>
    </div>
  );

  const renderZoneAnalysis = () => (
    <div className="space-y-4">
      <div className="bg-purple-50 p-4 rounded-lg">
        <h3 className="font-semibold text-purple-800 mb-3">🎯 Zone Analysis</h3>
        <p className="text-sm text-purple-700 mb-4">
          Activity patterns and occupancy by detection zones
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.values(zoneAnalysis)
          .sort((a, b) => b.unique_person_count - a.unique_person_count)
          .map((zone) => (
            <div key={zone.zone_id} className="bg-white border rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-lg mb-3 text-purple-800">
                Zone {zone.zone_id}
              </h4>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Unique People:</span>
                  <span className="font-bold text-purple-600">{zone.unique_person_count}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Detections:</span>
                  <span className="font-bold">{zone.total_detections}</span>
                </div>
                
                <div>
                  <span className="text-sm text-gray-600 block mb-2">Activity Breakdown:</span>
                  <div className="space-y-1">
                    {Object.entries(zone.activity_percentages)
                      .sort(([,a], [,b]) => parseFloat(b) - parseFloat(a))
                      .map(([activity, percentage]) => (
                        <div key={activity} className="flex justify-between text-xs">
                          <span className="text-gray-700 capitalize">
                            {activity.replace(/_/g, ' ')}
                          </span>
                          <span className="font-medium">{percentage}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  const renderTemporalAnalysis = () => (
    <div className="space-y-4">
      <div className="bg-orange-50 p-4 rounded-lg">
        <h3 className="font-semibold text-orange-800 mb-3">⏰ Temporal Analysis</h3>
        <p className="text-sm text-orange-700 mb-4">
          Activity patterns over time with 5-second intervals
        </p>
      </div>

      {temporalData.intervals && temporalData.intervals.length > 0 ? (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-800">Total Duration</h4>
              <p className="text-xl font-bold text-orange-600">{temporalData.total_duration}s</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-800">Peak Occupancy</h4>
              <p className="text-xl font-bold text-orange-600">{temporalData.peak_occupancy} people</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-800">Average Occupancy</h4>
              <p className="text-xl font-bold text-orange-600">{temporalData.average_occupancy} people</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">Activity Timeline</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {temporalData.intervals.slice(0, 20).map((interval, index) => (
                <div key={index} className="flex items-center space-x-4 p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600 w-20">
                    {interval.time_start}s - {interval.time_end}s
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{interval.person_count} people</span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(interval.activities)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 3)
                          .map(([activity, count]) => (
                            <span key={activity} className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                              {activity}: {count}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {temporalData.intervals.length > 20 && (
              <p className="text-center text-gray-500 mt-2 text-sm">
                Showing first 20 of {temporalData.intervals.length} intervals
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No temporal data available
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">📊 Enhanced Analytics</h2>
      
      {fileName && (
        <p className="text-sm text-gray-600 mb-4">
          Analyzing: <span className="font-medium">{fileName}</span>
        </p>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
        <TabButton id="overview" label="Overview" />
        <TabButton id="persons" label="People" count={Object.keys(personActivities).length} />
        <TabButton id="zones" label="Zones" count={Object.keys(zoneAnalysis).length} />
        <TabButton id="temporal" label="Timeline" count={temporalData.intervals?.length} />
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'persons' && renderPersonAnalysis()}
        {activeTab === 'zones' && renderZoneAnalysis()}
        {activeTab === 'temporal' && renderTemporalAnalysis()}
      </div>
    </div>
  );
}