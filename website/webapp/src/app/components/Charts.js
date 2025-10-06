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

export default function Charts({ data, fileName }) {
  const [charts, setCharts] = useState([]);
  const [selectedChart, setSelectedChart] = useState('overview');

  useEffect(() => {
    if (data && data.length > 0) {
      generateCharts(data);
    }
  }, [data]);

  const generateCharts = (csvData) => {
    if (!csvData || csvData.length === 0) {
      setCharts([]);
      return;
    }

    const numericColumns = {};
    const textColumns = {};

    // Identify column types
    const firstRow = csvData[0] || {};
    Object.keys(firstRow).forEach(column => {
      const values = csvData.map(row => row && row[column]).filter(val => val !== '' && val !== null && val !== undefined);
      if (values.length === 0) return;
      
      const numericValues = values.map(val => parseFloat(val)).filter(val => !isNaN(val));
      
      if (numericValues.length > values.length * 0.8 && numericValues.length > 0) {
        numericColumns[column] = numericValues;
      } else if (values.length > 0) {
        textColumns[column] = values;
      }
    });

    const chartConfigs = [];

    // Overview chart - showing data types distribution
    chartConfigs.push({
      id: 'overview',
      title: 'Data Overview',
      type: 'doughnut',
      data: {
        labels: ['Numeric Columns', 'Text Columns'],
        datasets: [{
          data: [Object.keys(numericColumns).length, Object.keys(textColumns).length],
          backgroundColor: ['#36A2EB', '#FF6384'],
          borderColor: ['#36A2EB', '#FF6384'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Column Types Distribution' }
        }
      }
    });

    // Numeric columns - histograms and trends
    Object.entries(numericColumns).forEach(([column, values]) => {
      if (values.length > 0) {
        // Histogram
        const bins = createHistogram(values, 10);
        if (bins && bins.length > 0) {
          chartConfigs.push({
            id: `histogram_${column}`,
            title: `${column} Distribution`,
            type: 'bar',
            data: {
              labels: bins.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`),
              datasets: [{
                label: 'Frequency',
                data: bins.map(bin => bin.count || 0),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `Distribution of ${column}` }
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count' } },
                x: { title: { display: true, text: column } }
              }
            }
          });
        }

        // Time series if we can detect time/sequence
        if (values.length > 2) {
          chartConfigs.push({
            id: `timeseries_${column}`,
            title: `${column} Trend`,
            type: 'line',
            data: {
              labels: values.map((_, index) => index + 1),
              datasets: [{
                label: column,
                data: values,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderWidth: 2,
                fill: false
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `${column} Over Time/Sequence` }
              },
              scales: {
                y: { title: { display: true, text: column } },
                x: { title: { display: true, text: 'Index' } }
              }
            }
          });
        }
      }
    });

    // Text columns - frequency charts
    Object.entries(textColumns).forEach(([column, values]) => {
      const frequency = {};
      values.forEach(value => {
        frequency[value] = (frequency[value] || 0) + 1;
      });

      const sortedEntries = Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10 most frequent values

      if (sortedEntries.length > 1) {
        chartConfigs.push({
          id: `frequency_${column}`,
          title: `${column} Frequency`,
          type: 'bar',
          data: {
            labels: sortedEntries.map(([value]) => value.length > 20 ? value.substring(0, 20) + '...' : value),
            datasets: [{
              label: 'Count',
              data: sortedEntries.map(([, count]) => count),
              backgroundColor: 'rgba(255, 206, 86, 0.6)',
              borderColor: 'rgba(255, 206, 86, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'top' },
              title: { display: true, text: `Top Values in ${column}` }
            },
            scales: {
              y: { beginAtZero: true, title: { display: true, text: 'Count' } },
              x: { 
                title: { display: true, text: column },
                ticks: { maxRotation: 45 }
              }
            }
          }
        });
      }
    });

    // Multi-column correlation if we have multiple numeric columns
    if (Object.keys(numericColumns).length >= 2) {
      const columns = Object.keys(numericColumns).slice(0, 2);
      chartConfigs.push({
        id: 'correlation',
        title: 'Correlation Plot',
        type: 'line',
        data: {
          datasets: [{
            label: `${columns[0]} vs ${columns[1]}`,
            data: csvData.map((row, index) => ({
              x: parseFloat(row[columns[0]]) || 0,
              y: parseFloat(row[columns[1]]) || 0
            })),
            backgroundColor: 'rgba(153, 102, 255, 0.6)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1,
            showLine: false,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: `${columns[0]} vs ${columns[1]}` }
          },
          scales: {
            x: { 
              type: 'linear',
              title: { display: true, text: columns[0] }
            },
            y: { 
              type: 'linear',
              title: { display: true, text: columns[1] }
            }
          }
        }
      });
    }

    setCharts(chartConfigs);
  };

  const createHistogram = (values, numBins = 10) => {
    if (!values || values.length === 0) {
      return [];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Handle case where all values are the same
    if (min === max) {
      return [{
        min: min - 0.5,
        max: max + 0.5,
        count: values.length
      }];
    }
    
    const binSize = (max - min) / numBins;
    
    const bins = Array.from({ length: numBins }, (_, i) => ({
      min: min + i * binSize,
      max: min + (i + 1) * binSize,
      count: 0
    }));

    values.forEach(value => {
      let binIndex = Math.floor((value - min) / binSize);
      // Handle edge case where value equals max
      if (binIndex >= numBins) {
        binIndex = numBins - 1;
      }
      if (binIndex < 0) {
        binIndex = 0;
      }
      
      if (bins[binIndex]) {
        bins[binIndex].count++;
      }
    });

    return bins;
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

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Data Visualization</h2>
        <p className="text-gray-500">Please upload CSV data to generate charts.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Data Visualization</h2>
      
      {fileName && (
        <p className="text-sm text-gray-600 mb-4">
          Showing charts for: <span className="font-medium">{fileName}</span>
        </p>
      )}

      {/* Chart Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Chart:
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
                <div style={{ width: '100%', maxWidth: '800px', height: '400px' }}>
                  {renderChart(chart)}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {charts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No charts available. Please ensure your CSV data contains valid columns.
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