'use client';

import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { DataProcessor } from './DataProcessor';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function EnhancedCharts({ data, fileName }) {
  const [charts, setCharts] = useState([]);
  const [selectedChart, setSelectedChart] = useState('activities');
  const [processedData, setProcessedData] = useState(null);

  useEffect(() => {
    if (data && data.length > 0) {
      const processed = DataProcessor.preprocessTrackingData(data);
      setProcessedData(processed);
      generateEnhancedCharts(processed);
    }
  }, [data]);

  const generateEnhancedCharts = (processed) => {
    const { summary, personActivities, zoneAnalysis, temporalData } = processed;
    const chartConfigs = [];

    // 1. Activity Distribution (Deduplicated)
    const activityEntries = Object.entries(summary.activityCounts).sort(([,a], [,b]) => b - a);
    if (activityEntries.length > 0) {
      chartConfigs.push({
        id: 'activities',
        title: 'Activity Distribution (Unique People)',
        type: 'bar',
        data: {
          labels: activityEntries.map(([activity]) => activity.replace(/_/g, ' ')),
          datasets: [{
            label: 'Number of People',
            data: activityEntries.map(([, count]) => count),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Activity Distribution (Deduplicated)' }
          },
          scales: {
            y: { 
              beginAtZero: true, 
              title: { display: true, text: 'Number of People' },
              ticks: { precision: 0 }
            },
            x: { title: { display: true, text: 'Activity Type' } }
          }
        }
      });
    }

    // 2. Zone Occupancy
    const zoneEntries = Object.values(zoneAnalysis)
      .map(zone => [`Zone ${zone.zone_id}`, zone.unique_person_count])
      .sort(([,a], [,b]) => b - a);
    
    if (zoneEntries.length > 0) {
      chartConfigs.push({
        id: 'zones',
        title: 'Zone Occupancy (Unique People)',
        type: 'doughnut',
        data: {
          labels: zoneEntries.map(([zone]) => zone),
          datasets: [{
            data: zoneEntries.map(([, count]) => count),
            backgroundColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
              '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
            ],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right' },
            title: { display: true, text: 'Zone Distribution' }
          }
        }
      });
    }

    // 3. Person Activity Diversity
    const activityCounts = Object.values(personActivities).map(person => person.activity_count);
    const diversityDistribution = {};
    activityCounts.forEach(count => {
      diversityDistribution[count] = (diversityDistribution[count] || 0) + 1;
    });

    if (Object.keys(diversityDistribution).length > 0) {
      chartConfigs.push({
        id: 'diversity',
        title: 'Activity Diversity per Person',
        type: 'bar',
        data: {
          labels: Object.keys(diversityDistribution).sort((a, b) => parseInt(a) - parseInt(b)),
          datasets: [{
            label: 'Number of People',
            data: Object.keys(diversityDistribution)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map(key => diversityDistribution[key]),
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'How many different activities each person performed' }
          },
          scales: {
            y: { 
              beginAtZero: true, 
              title: { display: true, text: 'Number of People' },
              ticks: { precision: 0 }
            },
            x: { title: { display: true, text: 'Number of Different Activities' } }
          }
        }
      });
    }

    // 4. Zone Mobility (People appearing in multiple zones)
    const zoneCounts = Object.values(personActivities).map(person => person.zone_count);
    const mobilityDistribution = {};
    zoneCounts.forEach(count => {
      mobilityDistribution[count] = (mobilityDistribution[count] || 0) + 1;
    });

    if (Object.keys(mobilityDistribution).length > 0) {
      chartConfigs.push({
        id: 'mobility',
        title: 'Zone Mobility',
        type: 'bar',
        data: {
          labels: Object.keys(mobilityDistribution).sort((a, b) => parseInt(a) - parseInt(b)),
          datasets: [{
            label: 'Number of People',
            data: Object.keys(mobilityDistribution)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map(key => mobilityDistribution[key]),
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'How many different zones each person appeared in' }
          },
          scales: {
            y: { 
              beginAtZero: true, 
              title: { display: true, text: 'Number of People' },
              ticks: { precision: 0 }
            },
            x: { title: { display: true, text: 'Number of Different Zones' } }
          }
        }
      });
    }

    // 5. Temporal Activity Timeline
    if (temporalData.intervals && temporalData.intervals.length > 0) {
      const timelineData = temporalData.intervals.slice(0, 50); // First 50 intervals
      
      chartConfigs.push({
        id: 'timeline',
        title: 'Activity Timeline',
        type: 'line',
        data: {
          labels: timelineData.map(interval => `${interval.time_start}s`),
          datasets: [{
            label: 'People Count',
            data: timelineData.map(interval => interval.person_count),
            borderColor: 'rgba(153, 102, 255, 1)',
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'People Count Over Time' }
          },
          scales: {
            y: { 
              beginAtZero: true, 
              title: { display: true, text: 'Number of People' },
              ticks: { precision: 0 }
            },
            x: { title: { display: true, text: 'Time (seconds)' } }
          }
        }
      });
    }

    // 6. Activity Comparison: Before vs After Deduplication
    const rawActivityCounts = {};
    data.forEach(row => {
      if (row.activity) {
        rawActivityCounts[row.activity] = (rawActivityCounts[row.activity] || 0) + 1;
      }
    });

    const comparisonActivities = [...new Set([
      ...Object.keys(rawActivityCounts),
      ...Object.keys(summary.activityCounts)
    ])];

    chartConfigs.push({
      id: 'comparison',
      title: 'Data Quality: Before vs After Deduplication',
      type: 'bar',
      data: {
        labels: comparisonActivities.map(activity => activity.replace(/_/g, ' ')),
        datasets: [
          {
            label: 'Raw Data (with duplicates)',
            data: comparisonActivities.map(activity => rawActivityCounts[activity] || 0),
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          },
          {
            label: 'Processed Data (unique people)',
            data: comparisonActivities.map(activity => summary.activityCounts[activity] || 0),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Impact of Data Deduplication' }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            title: { display: true, text: 'Count' },
            ticks: { precision: 0 }
          },
          x: { title: { display: true, text: 'Activity Type' } }
        }
      }
    });

    setCharts(chartConfigs);
  };

  const renderChart = (chart) => {
    const commonProps = {
      data: chart.data,
      options: chart.options
    };

    switch (chart.type) {
      case 'bar':
        return <Bar {...commonProps} />;
      case 'line':
        return <Line {...commonProps} />;
      case 'doughnut':
        return <Doughnut {...commonProps} />;
      default:
        return null;
    }
  };

  if (!processedData || !data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">📊 Enhanced Visualizations</h2>
        <p className="text-gray-500">Please load CSV data to generate enhanced charts.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">📊 Enhanced Visualizations</h2>
      
      {fileName && (
        <p className="text-sm text-gray-600 mb-4">
          Visualizing processed data from: <span className="font-medium">{fileName}</span>
        </p>
      )}

      <div className="bg-green-50 p-3 rounded-lg mb-6">
        <p className="text-sm text-green-700">
          <strong>✨ Smart Analytics:</strong> These charts show deduplicated data where each person's 
          activity is counted only once, providing accurate insights instead of inflated frame-by-frame counts.
        </p>
      </div>

      {/* Chart Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Visualization:
        </label>
        <select
          value={selectedChart}
          onChange={(e) => setSelectedChart(e.target.value)}
          className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {charts.map((chart) => (
            <option key={chart.id} value={chart.id}>
              {chart.title}
            </option>
          ))}
        </select>
      </div>

      {/* Chart Display */}
      <div className="mb-6">
        {charts.map((chart) => (
          <div
            key={chart.id}
            className={`${selectedChart === chart.id ? 'block' : 'hidden'}`}
          >
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-center">{chart.title}</h3>
              <div className="flex justify-center">
                <div style={{ width: '100%', maxWidth: '900px', height: '500px' }}>
                  {renderChart(chart)}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {charts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No charts available. Please ensure your CSV data contains valid tracking information.
          </div>
        )}
      </div>

      {/* Chart Navigation */}
      {charts.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {charts.map((chart) => (
            <button
              key={chart.id}
              onClick={() => setSelectedChart(chart.id)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                selectedChart === chart.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {chart.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}