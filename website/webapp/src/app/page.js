"use client";

import { useState } from "react";
import Navigation from "./components/Navigation";
import CSVReader from "./components/CSVReader";
import Statistics from "./components/Statistics";
import EnhancedStatistics from "./components/EnhancedStatistics";
import VideoUpload from "./components/VideoUpload";
import ZoneSelector from "./components/ZoneSelector";
import VideoProcessor from "./components/VideoProcessor";
import ProcessedVideoViewer from "./components/ProcessedVideoViewer";
import ZoneAnalytics from "./components/ZoneAnalytics";
import ActivityAnalytics from "./components/ActivityAnalytics";
import TimelineChart from "./components/TimelineChart";
import Charts from "./components/Charts";
import EnhancedCharts from "./components/EnhancedCharts";
import SimpleSummary from "./components/SimpleSummary";

export default function Home() {
  const [csvData, setCsvData] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [zones, setZones] = useState([]);
  const [videoSize, setVideoSize] = useState(null);
  const [processingResult, setProcessingResult] = useState(null);
  const [showInDepthData, setShowInDepthData] = useState(false);

  const handleDataLoad = (data, fileName) => {
    setCsvData(data);
    setCsvFileName(fileName);
  };

  const handleVideoLoad = (file, url) => {
    setVideoFile(file);
    setVideoUrl(url);
  };

  const handleZonesChange = (newZones, size) => {
    setZones(newZones);
    if (size) {
      setVideoSize(size);
    }
  };

  const handleProcessingComplete = async (result) => {
    console.log("Processing complete:", result);
    setProcessingResult(result);

    // Auto-load the CSV analytics
    if (result.files && result.files.csvPath) {
      try {
        const response = await fetch(
          `/api/download?file=${result.files.csvPath}&timestamp=${result.timestamp}`
        );

        if (!response.ok) {
          console.error(
            "Failed to fetch CSV:",
            response.status,
            response.statusText
          );
          return;
        }

        const csvText = await response.text();
        console.log("CSV loaded, length:", csvText.length);

        // Parse CSV - handle both simple and quoted values
        const lines = csvText.split("\n").filter((line) => line.trim());
        if (lines.length === 0) {
          console.error("CSV is empty");
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim());
        console.log("CSV headers:", headers);

        const data = lines.slice(1).map((line) => {
          const values = line.split(",");
          const row = {};
          headers.forEach((header, i) => {
            const value = values[i]?.trim() || "";
            // Convert numeric strings to numbers
            row[header] = isNaN(value) ? value : parseFloat(value);
          });
          return row;
        });

        console.log("Parsed CSV data:", data.length, "rows");
        setCsvData(data);
        setCsvFileName(result.files.csvPath.split("/").pop().split("\\").pop());
      } catch (error) {
        console.error("Failed to load CSV:", error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <Navigation />

      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Video Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Analyze tracking results from your thesis project and create video
            zone selections
          </p>
          <div className="mt-3 flex items-center space-x-4 text-sm">
            <div className="flex items-center text-green-600">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Connected to tracking_test project
            </div>
            <div className="text-gray-500">
              Auto-loading CSV results from:{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">
                tracking_test/data/outputs/
              </code>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* CSV Analysis Section - Now First Priority */}
          <section>
            <CSVReader onDataLoad={handleDataLoad} />
          </section>

          {/* Video Upload Section */}
          <section>
            <VideoUpload onVideoLoad={handleVideoLoad} />
          </section>

          {/* Zone Selection Section */}
          <section>
            <ZoneSelector
              videoUrl={videoUrl}
              onZonesChange={handleZonesChange}
            />
          </section>

          {/* Video Processing Section */}
          {videoFile && zones.length > 0 && (
            <section>
              <VideoProcessor
                videoFile={videoFile}
                zones={zones}
                videoSize={videoSize}
                onProcessingComplete={handleProcessingComplete}
              />
            </section>
          )}

          {/* Processed Video Viewer */}
          {processingResult && (
            <section>
              <ProcessedVideoViewer result={processingResult} />
            </section>
          )}

          {/* Simple Summary - Always show first when data is available */}
          {csvData.length > 0 && (
            <section>
              <SimpleSummary csvData={csvData} fileName={csvFileName} zones={zones} />
            </section>
          )}

          {/* Toggle for In-Depth Data */}
          {csvData.length > 0 && (
            <section className="text-center">
              <button
                onClick={() => setShowInDepthData(!showInDepthData)}
                className="inline-flex items-center space-x-3 px-6 py-3 bg-white border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors shadow-md"
              >
                <span className="text-lg font-semibold">
                  {showInDepthData ? '📊 Hide' : '📈 Show'} More In-Depth Data
                </span>
                <svg
                  className={`w-5 h-5 transition-transform ${showInDepthData ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </section>
          )}

          {/* All advanced analytics - Only show when toggle is ON */}
          {showInDepthData && (
            <>
              {/* Timeline Chart - Show for any data with zones */}
              {csvData.length > 0 && csvData[0]?.zone_id !== undefined && (
                <section>
                  <TimelineChart csvData={csvData} fileName={csvFileName} />
                </section>
              )}

              {/* Activity Analytics - Show for activity detection data */}
              {csvData.length > 0 && csvData[0]?.activity && (
                <section>
                  <ActivityAnalytics csvData={csvData} fileName={csvFileName} />
                </section>
              )}

              {/* Zone Analytics - Show for zone tracking data */}
              {csvData.length > 0 &&
                csvFileName.includes("analytics") &&
                !csvData[0]?.activity && (
                  <section>
                    <ZoneAnalytics csvData={csvData} fileName={csvFileName} />
                  </section>
                )}

              {/* Enhanced Statistics Section */}
              {csvData.length > 0 && (
                <section>
                  <EnhancedStatistics data={csvData} fileName={csvFileName} />
                </section>
              )}

              {/* Original Statistics Section (for comparison) */}
              {csvData.length > 0 && (
                <section>
                  <div className="bg-gray-50 p-3 rounded-lg mb-4">
                    <h3 className="text-sm font-medium text-gray-700">
                      📈 Raw Data Statistics (Before Deduplication)
                    </h3>
                    <p className="text-xs text-gray-600">
                      Shows statistics from the original data without processing
                    </p>
                  </div>
                  <Statistics data={csvData} fileName={csvFileName} />
                </section>
              )}

              {/* Enhanced Charts Section */}
              {csvData.length > 0 && (
                <section>
                  <EnhancedCharts data={csvData} fileName={csvFileName} />
                </section>
              )}

              {/* Original Charts Section (for comparison) */}
              {csvData.length > 0 && (
                <section>
                  <div className="bg-gray-50 p-3 rounded-lg mb-4">
                    <h3 className="text-sm font-medium text-gray-700">
                      📊 Raw Data Visualizations (Before Processing)
                    </h3>
                    <p className="text-xs text-gray-600">
                      Shows charts from the original data without deduplication
                    </p>
                  </div>
                  <Charts data={csvData} fileName={csvFileName} />
                </section>
              )}
            </>
          )}

          {/* Summary Section */}
          {(csvData.length > 0 || videoFile || zones.length > 0) && (
            <section className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">Session Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800">CSV Data</h3>
                  <p className="text-sm text-blue-600">
                    {csvData.length > 0
                      ? `${csvData.length} rows loaded from ${csvFileName}`
                      : "No CSV data loaded"}
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800">Video</h3>
                  <p className="text-sm text-green-600">
                    {videoFile
                      ? `${videoFile.name} (${(
                          videoFile.size /
                          (1024 * 1024)
                        ).toFixed(1)} MB)`
                      : "No video uploaded"}
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-800">Zones</h3>
                  <p className="text-sm text-purple-600">
                    {zones.length > 0
                      ? `${zones.length} zones created`
                      : "No zones created"}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500">
            Video Analytics Dashboard - Built with Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
