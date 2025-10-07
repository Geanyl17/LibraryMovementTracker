'use client';

import { useState, useEffect } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function ZoneAnalytics({ csvData, fileName }) {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (csvData && csvData.length > 0) {
      calculateAnalytics(csvData);
    }
  }, [csvData]);

  const calculateAnalytics = (data) => {
    // Filter valid entries
    const entries = data.filter(row => row.event === 'entry');
    const exits = data.filter(row => row.event === 'exit' && row.duration_sec);

    // Get unique zones
    const zones = [...new Set(data.map(row => parseInt(row.zone_id)))].sort((a, b) => a - b);
    const uniquePeople = [...new Set(data.map(row => parseInt(row.person_id)))];

    // Zone-specific analytics
    const zoneStats = zones.map(zoneId => {
      const zoneEntries = entries.filter(e => parseInt(e.zone_id) === zoneId);
      const zoneExits = exits.filter(e => parseInt(e.zone_id) === zoneId);

      const durations = zoneExits.map(e => parseFloat(e.duration_sec));
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
      const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

      return {
        zoneId,
        totalEntries: zoneEntries.length,
        totalExits: zoneExits.length,
        uniqueVisitors: new Set(zoneEntries.map(e => e.person_id)).size,
        avgDuration,
        maxDuration,
        minDuration,
        totalTime: durations.reduce((a, b) => a + b, 0)
      };
    });

    // Traffic patterns over time (entries per minute)
    const maxFrame = Math.max(...data.map(r => parseInt(r.frame)));
    const fps = data.length > 0 ? 25 : 30; // Assuming 25 fps
    const totalMinutes = Math.ceil(maxFrame / fps / 60);

    const trafficPerMinute = Array(totalMinutes).fill(0);
    entries.forEach(entry => {
      const minute = Math.floor(parseFloat(entry.frame_time_sec) / 60);
      if (minute < totalMinutes) {
        trafficPerMinute[minute]++;
      }
    });

    // Dwell time distribution
    const dwellTimeRanges = {
      '0-5s': 0,
      '5-15s': 0,
      '15-30s': 0,
      '30-60s': 0,
      '60s+': 0
    };

    exits.forEach(exit => {
      const duration = parseFloat(exit.duration_sec);
      if (duration <= 5) dwellTimeRanges['0-5s']++;
      else if (duration <= 15) dwellTimeRanges['5-15s']++;
      else if (duration <= 30) dwellTimeRanges['15-30s']++;
      else if (duration <= 60) dwellTimeRanges['30-60s']++;
      else dwellTimeRanges['60s+']++;
    });

    // Peak hour analysis
    const trafficPerHour = {};
    entries.forEach(entry => {
      const time = new Date(entry.timestamp);
      const hour = time.getHours();
      trafficPerHour[hour] = (trafficPerHour[hour] || 0) + 1;
    });

    setAnalytics({
      zones: zoneStats,
      totalEntries: entries.length,
      totalExits: exits.length,
      uniquePeople: uniquePeople.length,
      trafficPerMinute,
      dwellTimeRanges,
      trafficPerHour,
      totalMinutes
    });
  };

  if (!analytics) {
    return <div className="text-gray-500">Loading analytics...</div>;
  }

  const zoneColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Zone Tracking Analytics</h2>
        <p className="text-sm text-gray-600">Data from: {fileName}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{analytics.uniquePeople}</div>
          <div className="text-sm text-blue-800">Total People Detected</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{analytics.totalEntries}</div>
          <div className="text-sm text-green-800">Total Zone Entries</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{analytics.zones.length}</div>
          <div className="text-sm text-purple-800">Active Zones</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">
            {(analytics.zones.reduce((sum, z) => sum + z.avgDuration, 0) / analytics.zones.length).toFixed(1)}s
          </div>
          <div className="text-sm text-orange-800">Avg Dwell Time</div>
        </div>
      </div>

      {/* Zone-by-Zone Analysis */}
      <div>
        <h3 className="text-xl font-bold mb-4">Zone Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics.zones.map((zone, idx) => (
            <div key={zone.zoneId} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-lg">Zone {zone.zoneId}</h4>
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: zoneColors[idx % zoneColors.length] }}
                ></div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">People Passed:</span>
                  <span className="font-semibold">{zone.uniqueVisitors}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Entries:</span>
                  <span className="font-semibold">{zone.totalEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Duration:</span>
                  <span className="font-semibold">{zone.avgDuration.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Duration:</span>
                  <span className="font-semibold">{zone.maxDuration.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Time:</span>
                  <span className="font-semibold">{(zone.totalTime / 60).toFixed(1)}m</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zone Entries Comparison */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-bold mb-4">Zone Entries Comparison</h3>
          <Bar
            data={{
              labels: analytics.zones.map(z => `Zone ${z.zoneId}`),
              datasets: [{
                label: 'Total Entries',
                data: analytics.zones.map(z => z.totalEntries),
                backgroundColor: zoneColors.slice(0, analytics.zones.length),
              }]
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false }
              }
            }}
          />
        </div>

        {/* Average Dwell Time by Zone */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-bold mb-4">Average Dwell Time by Zone</h3>
          <Bar
            data={{
              labels: analytics.zones.map(z => `Zone ${z.zoneId}`),
              datasets: [{
                label: 'Avg Duration (seconds)',
                data: analytics.zones.map(z => z.avgDuration),
                backgroundColor: zoneColors.slice(0, analytics.zones.length),
              }]
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Seconds'
                  }
                }
              }
            }}
          />
        </div>

        {/* Traffic Over Time */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-bold mb-4">Traffic Over Time (Entries per Minute)</h3>
          <Line
            data={{
              labels: Array.from({ length: analytics.totalMinutes }, (_, i) => `${i}m`),
              datasets: [{
                label: 'Entries per Minute',
                data: analytics.trafficPerMinute,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.3
              }]
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { stepSize: 1 }
                }
              }
            }}
          />
        </div>

        {/* Dwell Time Distribution */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-bold mb-4">Dwell Time Distribution</h3>
          <Doughnut
            data={{
              labels: Object.keys(analytics.dwellTimeRanges),
              datasets: [{
                data: Object.values(analytics.dwellTimeRanges),
                backgroundColor: zoneColors,
              }]
            }}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'bottom'
                }
              }
            }}
          />
        </div>
      </div>

      {/* Insights Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
        <h3 className="font-bold text-lg mb-4">📊 Key Insights</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              <strong>Busiest Zone:</strong> Zone {analytics.zones.reduce((max, z) => z.totalEntries > max.totalEntries ? z : max).zoneId}
              {' '}with {analytics.zones.reduce((max, z) => z.totalEntries > max.totalEntries ? z : max).totalEntries} entries
            </span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              <strong>Longest Dwell Time:</strong> Zone {analytics.zones.reduce((max, z) => z.avgDuration > max.avgDuration ? z : max).zoneId}
              {' '}with average of {analytics.zones.reduce((max, z) => z.avgDuration > max.avgDuration ? z : max).avgDuration.toFixed(1)}s
            </span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              <strong>Most Active Period:</strong> Minute {analytics.trafficPerMinute.indexOf(Math.max(...analytics.trafficPerMinute))}
              {' '}with {Math.max(...analytics.trafficPerMinute)} entries
            </span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              <strong>Total Tracking Time:</strong> {(analytics.totalMinutes).toFixed(1)} minutes
              {' '}({analytics.uniquePeople} unique people tracked)
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
