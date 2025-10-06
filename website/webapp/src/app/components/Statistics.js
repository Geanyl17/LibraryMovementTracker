'use client';

import { useState, useEffect } from 'react';

export default function Statistics({ data, fileName }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (data && data.length > 0) {
      calculateStats(data);
    }
  }, [data]);

  const calculateStats = (csvData) => {
    const numericColumns = {};
    const textColumns = {};
    const columnStats = {};

    // Identify column types and collect values
    Object.keys(csvData[0] || {}).forEach(column => {
      const values = csvData.map(row => row[column]).filter(val => val !== '' && val !== null && val !== undefined);
      
      // Try to convert to numbers
      const numericValues = values.map(val => parseFloat(val)).filter(val => !isNaN(val));
      
      if (numericValues.length > values.length * 0.8) { // If 80%+ are numeric
        numericColumns[column] = numericValues;
        columnStats[column] = {
          type: 'numeric',
          count: numericValues.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          mean: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length,
          median: getMedian(numericValues.sort((a, b) => a - b))
        };
      } else {
        textColumns[column] = values;
        const uniqueValues = [...new Set(values)];
        const valueCounts = {};
        values.forEach(val => {
          valueCounts[val] = (valueCounts[val] || 0) + 1;
        });
        
        columnStats[column] = {
          type: 'text',
          count: values.length,
          uniqueCount: uniqueValues.length,
          mostCommon: Object.entries(valueCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([value, count]) => ({ value, count }))
        };
      }
    });

    setStats({
      totalRows: csvData.length,
      totalColumns: Object.keys(csvData[0] || {}).length,
      numericColumns: Object.keys(numericColumns).length,
      textColumns: Object.keys(textColumns).length,
      columnStats,
      fileName
    });
  };

  const getMedian = (sortedArray) => {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 !== 0 
      ? sortedArray[mid] 
      : (sortedArray[mid - 1] + sortedArray[mid]) / 2;
  };

  const formatNumber = (num) => {
    return typeof num === 'number' ? num.toFixed(2) : num;
  };

  if (!stats) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Data Statistics</h2>
      
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600">Total Rows</h3>
          <p className="text-2xl font-bold text-blue-900">{stats.totalRows}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-600">Total Columns</h3>
          <p className="text-2xl font-bold text-green-900">{stats.totalColumns}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-600">Numeric Columns</h3>
          <p className="text-2xl font-bold text-purple-900">{stats.numericColumns}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-orange-600">Text Columns</h3>
          <p className="text-2xl font-bold text-orange-900">{stats.textColumns}</p>
        </div>
      </div>

      {/* Column Statistics */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Column Details</h3>
        
        {Object.entries(stats.columnStats).map(([column, columnStat]) => (
          <div key={column} className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">
              {column} <span className="text-sm text-gray-500">({columnStat.type})</span>
            </h4>
            
            {columnStat.type === 'numeric' ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Count:</span>
                  <div className="font-medium">{columnStat.count}</div>
                </div>
                <div>
                  <span className="text-gray-600">Min:</span>
                  <div className="font-medium">{formatNumber(columnStat.min)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Max:</span>
                  <div className="font-medium">{formatNumber(columnStat.max)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Mean:</span>
                  <div className="font-medium">{formatNumber(columnStat.mean)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Median:</span>
                  <div className="font-medium">{formatNumber(columnStat.median)}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Values:</span>
                    <span className="font-medium ml-2">{columnStat.count}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Unique Values:</span>
                    <span className="font-medium ml-2">{columnStat.uniqueCount}</span>
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-600 text-sm">Most Common Values:</span>
                  <div className="mt-1 space-y-1">
                    {columnStat.mostCommon.map(({ value, count }, index) => (
                      <div key={index} className="flex justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                        <span className="truncate">{value}</span>
                        <span className="font-medium text-gray-700">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}