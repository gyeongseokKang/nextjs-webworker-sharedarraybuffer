"use client";

import {
  BarElement,
  CategoryScale,
  ChartData,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Define basic types
type RunResult = {
  runNumber: number;
  standardTime: number;
  standardProcessing: number;
  standardTransfer: number;
  sharedTime: number | null;
  sharedProcessing: number | null;
  sharedTransfer: number | null;
};

// Type for benchmark history items including settings and results
type BenchmarkHistoryItem = {
  id: string;
  audioDuration: number; // in seconds
  iterations: number;
  avgStandardTime: number;
  avgStandardProcessing: number;
  avgStandardTransfer: number;
  avgSharedTime: number | null;
  avgSharedProcessing: number | null;
  avgSharedTransfer: number | null;
  timestamp: Date;
};

// Performance comparison chart component (same as before)
type PerformanceComparisonProps = {
  standardTimes: {
    total: number | null;
    processing: number | null;
    transfer: number | null;
  };
  sharedTimes: {
    total: number | null;
    processing: number | null;
    transfer: number | null;
  };
};

export function PerformanceComparisonChart({
  standardTimes,
  sharedTimes,
}: PerformanceComparisonProps) {
  // Same implementation as before
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Web Worker Performance Comparison (ms)",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Time (ms)",
        },
      },
    },
  };

  const labels = ["Total Time", "Processing Time", "Transfer Time"];

  const data = {
    labels,
    datasets: [
      {
        label: "Standard Web Worker",
        data: [
          standardTimes.total || 0,
          standardTimes.processing || 0,
          standardTimes.transfer || 0,
        ],
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
      {
        label: "SharedArrayBuffer Worker",
        data: [
          sharedTimes.total || 0,
          sharedTimes.processing || 0,
          sharedTimes.transfer || 0,
        ],
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ],
  };

  return <Bar options={options} data={data} />;
}

// New component: Performance change chart by audio duration
type DurationPerformanceChartProps = {
  historyItems: BenchmarkHistoryItem[];
};

export function DurationPerformanceChart({
  historyItems,
}: DurationPerformanceChartProps) {
  // Group data by audio duration for a fixed number of iterations
  const [chartData, setChartData] = useState<ChartData<"line">>({
    datasets: [],
    labels: [],
  });

  useEffect(() => {
    // Find the most used iteration count
    const iterationCounts: Record<number, number> = {};
    historyItems.forEach((item) => {
      iterationCounts[item.iterations] =
        (iterationCounts[item.iterations] || 0) + 1;
    });

    // Determine the most used iteration count
    let mostUsedIteration = 5; // Default value
    let maxCount = 0;

    for (const [iteration, count] of Object.entries(iterationCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostUsedIteration = Number(iteration);
      }
    }

    // Filter by the determined iteration count
    const filteredItems = historyItems.filter(
      (item) => item.iterations === mostUsedIteration
    );

    // Sort by audio duration (in minutes)
    filteredItems.sort((a, b) => a.audioDuration - b.audioDuration);

    // Prepare chart data
    const durationLabels = filteredItems.map(
      (item) => `${item.audioDuration / 60} min`
    );

    const newChartData = {
      labels: durationLabels,
      datasets: [
        {
          label: "Standard Worker Total Time",
          data: filteredItems.map((item) => item.avgStandardTime),
          borderColor: "rgb(53, 162, 235)",
          backgroundColor: "rgba(53, 162, 235, 0.5)",
        },
        {
          label: "SharedArrayBuffer Total Time",
          data: filteredItems.map((item) => item.avgSharedTime || 0),
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.5)",
        },
      ],
    };

    setChartData(newChartData);
  }, [historyItems]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Performance Change by Audio Duration (Fixed Iterations)`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Time (ms)",
        },
      },
      x: {
        title: {
          display: true,
          text: "Audio Duration",
        },
      },
    },
  };

  return <Line options={options} data={chartData} />;
}

// New component: Performance change chart by iteration count
type IterationPerformanceChartProps = {
  historyItems: BenchmarkHistoryItem[];
};

export function IterationPerformanceChart({
  historyItems,
}: IterationPerformanceChartProps) {
  const [chartData, setChartData] = useState<ChartData<"line">>({
    datasets: [],
    labels: [],
  });

  useEffect(() => {
    // Find the most used audio duration
    const durationCounts: Record<number, number> = {};
    historyItems.forEach((item) => {
      durationCounts[item.audioDuration] =
        (durationCounts[item.audioDuration] || 0) + 1;
    });

    let mostUsedDuration = 60; // Default value 1 minute
    let maxCount = 0;

    for (const [duration, count] of Object.entries(durationCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostUsedDuration = Number(duration);
      }
    }

    // Filter by the determined audio duration
    const filteredItems = historyItems.filter(
      (item) => item.audioDuration === mostUsedDuration
    );

    // Sort by iteration count
    filteredItems.sort((a, b) => a.iterations - b.iterations);

    // Prepare chart data
    const iterationLabels = filteredItems.map(
      (item) => `${item.iterations} times`
    );

    const newChartData = {
      labels: iterationLabels,
      datasets: [
        {
          label: "Standard Worker Total Time",
          data: filteredItems.map((item) => item.avgStandardTime),
          borderColor: "rgb(53, 162, 235)",
          backgroundColor: "rgba(53, 162, 235, 0.5)",
        },
        {
          label: "SharedArrayBuffer Total Time",
          data: filteredItems.map((item) => item.avgSharedTime || 0),
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.5)",
        },
      ],
    };

    setChartData(newChartData);
  }, [historyItems]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Performance Change by Iteration Count (Fixed Audio Duration)`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Time (ms)",
        },
      },
      x: {
        title: {
          display: true,
          text: "Iteration Count",
        },
      },
    },
  };

  return <Line options={options} data={chartData} />;
}

// Main ResultChart component
type ResultChartProps = {
  standardResults: RunResult[];
  sharedResults: RunResult[];
  avgStandardWorkerTime: number | null;
  avgStandardProcessingTime: number | null;
  avgStandardTransferTime: number | null;
  avgSharedBufferWorkerTime: number | null;
  avgSharedProcessingTime: number | null;
  avgSharedTransferTime: number | null;
  audioDuration: number;
  iterations: number;
  benchmarkHistory: BenchmarkHistoryItem[];
};

export default function ResultChart({
  standardResults,
  sharedResults,
  avgStandardWorkerTime,
  avgStandardProcessingTime,
  avgStandardTransferTime,
  avgSharedBufferWorkerTime,
  avgSharedProcessingTime,
  avgSharedTransferTime,
  audioDuration,
  iterations,
  benchmarkHistory = [],
}: ResultChartProps) {
  // Calculate performance improvement ratio
  const calculateRatio = (standard: number | null, shared: number | null) => {
    if (standard === null || shared === null || shared === 0) return null;
    return standard / shared;
  };

  const totalRatio = calculateRatio(
    avgStandardWorkerTime,
    avgSharedBufferWorkerTime
  );
  const processingRatio = calculateRatio(
    avgStandardProcessingTime,
    avgSharedProcessingTime
  );
  const transferRatio = calculateRatio(
    avgStandardTransferTime,
    avgSharedTransferTime
  );

  // 현재 결과 - 데이터 크기 및 반복 횟수 차트용
  const currentResult = {
    audioDuration,
    iterations,
    standardTime: avgStandardWorkerTime,
    sharedTime: avgSharedBufferWorkerTime,
  };

  return (
    <div className="space-y-8">
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Current Benchmark Results</h2>
        </div>
        <div className="mb-4 text-sm text-gray-600">
          <p>Audio Duration: {audioDuration / 60} min</p>
          <p>Iterations: {iterations} times</p>
        </div>
        <PerformanceComparisonChart
          standardTimes={{
            total: avgStandardWorkerTime,
            processing: avgStandardProcessingTime,
            transfer: avgStandardTransferTime,
          }}
          sharedTimes={{
            total: avgSharedBufferWorkerTime,
            processing: avgSharedProcessingTime,
            transfer: avgSharedTransferTime,
          }}
        />
      </div>

      {avgSharedBufferWorkerTime !== null && (
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">
            Performance Improvement Ratio
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold">
                {totalRatio ? totalRatio.toFixed(2) + "x" : "-"}
              </p>
              <p>Total Time Improvement</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold">
                {processingRatio ? processingRatio.toFixed(2) + "x" : "-"}
              </p>
              <p>Processing Time Improvement</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold">
                {transferRatio ? transferRatio.toFixed(2) + "x" : "-"}
              </p>
              <p>Transfer Time Improvement</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts based on history data */}
      {benchmarkHistory.length >= 2 && (
        <>
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">
              Performance Comparison by Audio Duration
            </h2>
            <DurationPerformanceChart historyItems={benchmarkHistory} />
          </div>
        </>
      )}
    </div>
  );
}
