'use client';

import { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';

export default function CSVReader({ onDataLoad }) {
  const [csvData, setCsvData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableFiles, setAvailableFiles] = useState({});
  const [selectedFile, setSelectedFile] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(true);

  const loadCSVData = useCallback((fileName, fileData) => {
    if (!fileData || fileData.error) {
      setError(`Error with file ${fileName}: ${fileData?.error || 'Unknown error'}`);
      return;
    }

    setIsLoading(true);
    setError('');
    setFileName(fileName);

    Papa.parse(fileData.content, {
      complete: (results) => {
        try {
          const data = results.data;
          setCsvData(data);
          onDataLoad(data, fileName);
          setIsLoading(false);
        } catch (err) {
          setError('Error parsing CSV file');
          setIsLoading(false);
        }
      },
      header: true,
      skipEmptyLines: true,
      error: (err) => {
        setError('Error reading file: ' + err.message);
        setIsLoading(false);
      }
    });
  }, [onDataLoad]);

  const loadAvailableFiles = useCallback(async () => {
    setLoadingFiles(true);
    setError('');
    
    try {
      const response = await fetch('/api/csv');
      const data = await response.json();
      
      if (data.success && data.files) {
        setAvailableFiles(data.files);
        
        // Auto-select the first file if available
        const fileNames = Object.keys(data.files);
        if (fileNames.length > 0) {
          const firstFile = fileNames[0];
          setSelectedFile(firstFile);
          loadCSVData(firstFile, data.files[firstFile]);
        }
      } else {
        setError(data.error || 'Failed to load CSV files from tracking_test');
      }
    } catch (err) {
      setError('Failed to connect to tracking_test data: ' + err.message);
    } finally {
      setLoadingFiles(false);
    }
  }, [loadCSVData]);

  // Load available CSV files from tracking_test on component mount
  useEffect(() => {
    loadAvailableFiles();
  }, [loadAvailableFiles]);

  const handleFileSelection = (event) => {
    const selectedFileName = event.target.value;
    setSelectedFile(selectedFileName);
    
    if (selectedFileName && availableFiles[selectedFileName]) {
      loadCSVData(selectedFileName, availableFiles[selectedFileName]);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setIsLoading(true);
    setError('');
    setFileName(file.name);

    Papa.parse(file, {
      complete: (results) => {
        try {
          const data = results.data;
          setCsvData(data);
          onDataLoad(data, file.name);
          setIsLoading(false);
        } catch (err) {
          setError('Error parsing CSV file');
          setIsLoading(false);
        }
      },
      header: true,
      skipEmptyLines: true,
      error: (err) => {
        setError('Error reading file: ' + err.message);
        setIsLoading(false);
      }
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">CSV Data Analysis</h2>
      
      {/* Auto-loaded files from tracking_test */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-green-700">
          📊 Tracking Test Results
        </h3>
        
        {loadingFiles ? (
          <div className="text-blue-600">Loading CSV files from tracking_test...</div>
        ) : Object.keys(availableFiles).length > 0 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV file from tracking_test:
            </label>
            <select
              value={selectedFile}
              onChange={handleFileSelection}
              className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-green-50"
            >
              <option value="">Select a file...</option>
              {Object.entries(availableFiles).map(([fileName, fileData]) => (
                <option key={fileName} value={fileName}>
                  {fileName} {fileData.error ? '(Error)' : `(${(fileData.size / 1024).toFixed(1)} KB)`}
                </option>
              ))}
            </select>
            
            <div className="mt-2 flex justify-between items-center">
              <button
                onClick={loadAvailableFiles}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                🔄 Refresh tracking_test files
              </button>
              
              {selectedFile && availableFiles[selectedFile] && (
                <div className="text-xs text-gray-500">
                  Modified: {new Date(availableFiles[selectedFile].modified).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-amber-600 bg-amber-50 p-3 rounded">
            No CSV files found in tracking_test/data/outputs. Make sure you&apos;ve run the tracking analysis first.
          </div>
        )}
      </div>

      {/* Manual file upload fallback */}
      <div className="mb-4 pt-4 border-t border-gray-200">
        <h3 className="text-lg font-semibold mb-3 text-gray-700">
          📁 Manual Upload (Optional)
        </h3>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="text-xs text-gray-500 mt-1">
          Upload your own CSV file if needed
        </p>
      </div>

      {isLoading && (
        <div className="text-blue-600">Loading CSV data...</div>
      )}

      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {fileName && !isLoading && !error && (
        <div className="text-green-600 bg-green-50 p-3 rounded mb-4">
          Successfully loaded: {fileName} ({csvData.length} rows)
        </div>
      )}

      {csvData.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Data Preview</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(csvData[0] || {}).map((header) => (
                    <th key={header} className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 5).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {Object.values(row).map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900 border-b">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {csvData.length > 5 && (
              <p className="text-sm text-gray-500 mt-2">
                Showing first 5 rows of {csvData.length} total rows
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}