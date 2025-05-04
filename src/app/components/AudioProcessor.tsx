"use client";

import { useEffect, useRef, useState } from "react";
import { generateSampleAudio } from "../utils/audioUtils";
import taskQueue from "../utils/taskQueue"; // Import both default instance and class
import ResultChart from "./ResultChart";

// Define type to store each run result
type RunResult = {
  runNumber: number;
  standardTime: number;
  standardProcessing: number;
  standardTransfer: number;
  sharedTime: number | null;
  sharedProcessing: number | null;
  sharedTransfer: number | null;
};

// Define type for benchmark history item including settings and results
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

export default function AudioProcessor() {
  // Arrays to store each run result
  const [standardRunResults, setStandardRunResults] = useState<RunResult[]>([]);
  const [sharedRunResults, setSharedRunResults] = useState<RunResult[]>([]);

  // Individual run results
  const [standardWorkerTime, setStandardWorkerTime] = useState<number | null>(
    null
  );
  const [sharedBufferWorkerTime, setSharedBufferWorkerTime] = useState<
    number | null
  >(null);
  const [standardTransferTime, setStandardTransferTime] = useState<
    number | null
  >(null);
  const [sharedTransferTime, setSharedTransferTime] = useState<number | null>(
    null
  );
  const [standardProcessingTime, setStandardProcessingTime] = useState<
    number | null
  >(null);
  const [sharedProcessingTime, setSharedProcessingTime] = useState<
    number | null
  >(null);

  // Average results after 5 runs
  const [avgStandardWorkerTime, setAvgStandardWorkerTime] = useState<
    number | null
  >(null);
  const [avgSharedBufferWorkerTime, setAvgSharedBufferWorkerTime] = useState<
    number | null
  >(null);
  const [avgStandardTransferTime, setAvgStandardTransferTime] = useState<
    number | null
  >(null);
  const [avgSharedTransferTime, setAvgSharedTransferTime] = useState<
    number | null
  >(null);
  const [avgStandardProcessingTime, setAvgStandardProcessingTime] = useState<
    number | null
  >(null);
  const [avgSharedProcessingTime, setAvgSharedProcessingTime] = useState<
    number | null
  >(null);

  const [standardVerificationResult, setStandardVerificationResult] =
    useState<string>("");
  const [sharedVerificationResult, setSharedVerificationResult] =
    useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [audioDuration, setAudioDuration] = useState<number>(60); // Default 1 minute (60 seconds)
  const [currentRun, setCurrentRun] = useState<number>(0);
  const [totalRuns, setTotalRuns] = useState<number>(5); // Default 5 runs

  // Arrays to store results from multiple runs
  const standardWorkerTimesRef = useRef<number[]>([]);
  const sharedBufferWorkerTimesRef = useRef<number[]>([]);
  const standardTransferTimesRef = useRef<number[]>([]);
  const sharedTransferTimesRef = useRef<number[]>([]);
  const standardProcessingTimesRef = useRef<number[]>([]);
  const sharedProcessingTimesRef = useRef<number[]>([]);

  const standardWorkerRef = useRef<Worker | null>(null);
  const sharedWorkerRef = useRef<Worker | null>(null);

  // For timing measurements
  const standardStartTimeRef = useRef<number>(0);
  const sharedStartTimeRef = useRef<number>(0);

  // Constants for audio generation
  const SAMPLE_RATE = 44100;

  // State to check if SharedArrayBuffer is supported
  const [sharedArrayBufferSupported, setSharedArrayBufferSupported] = useState<
    boolean | null
  >(null);

  // State to maintain benchmark history
  const [benchmarkHistory, setBenchmarkHistory] = useState<
    BenchmarkHistoryItem[]
  >([]);

  useEffect(() => {
    // Clean up workers on component unmount
    return () => {
      if (standardWorkerRef.current) {
        standardWorkerRef.current.terminate();
      }
      if (sharedWorkerRef.current) {
        sharedWorkerRef.current.terminate();
      }
    };
  }, []);

  // Check if SharedArrayBuffer is supported
  useEffect(() => {
    const checkSharedArrayBufferSupport = () => {
      try {
        if (typeof SharedArrayBuffer === "undefined") {
          console.warn("SharedArrayBuffer is not supported in this browser");
          setSharedArrayBufferSupported(false);
          return false;
        }
        // Test creating a small SharedArrayBuffer
        const testBuffer = new SharedArrayBuffer(1);
        console.log("SharedArrayBuffer is supported");
        setSharedArrayBufferSupported(true);
        return true;
      } catch (error) {
        console.error("Error checking SharedArrayBuffer support:", error);
        setSharedArrayBufferSupported(false);
        return false;
      }
    };

    checkSharedArrayBufferSupport();
  }, []);

  // Calculate the average of an array of numbers
  const calculateAverage = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  };

  // Handle state after completing all runs
  const finishAllRuns = () => {
    // Calculate and set averages only for available data
    if (standardWorkerTimesRef.current.length > 0) {
      setAvgStandardWorkerTime(
        calculateAverage(standardWorkerTimesRef.current)
      );
      setAvgStandardTransferTime(
        calculateAverage(standardTransferTimesRef.current)
      );
      setAvgStandardProcessingTime(
        calculateAverage(standardProcessingTimesRef.current)
      );
    }

    if (sharedBufferWorkerTimesRef.current.length > 0) {
      setAvgSharedBufferWorkerTime(
        calculateAverage(sharedBufferWorkerTimesRef.current)
      );
      setAvgSharedTransferTime(
        calculateAverage(sharedTransferTimesRef.current)
      );
      setAvgSharedProcessingTime(
        calculateAverage(sharedProcessingTimesRef.current)
      );
    } else {
      // Set to null if no results
      setAvgSharedBufferWorkerTime(null);
      setAvgSharedTransferTime(null);
      setAvgSharedProcessingTime(null);
    }

    // Reset state for next batch
    setCurrentRun(0);
    setIsProcessing(false);
    setStatus(
      "All processing completed. Results show average of " +
        totalRuns +
        " runs per worker type."
    );
  };

  // Process next step based on current state
  const processNext = (currentWorkerType: "standard" | "shared") => {
    if (currentWorkerType === "standard") {
      // Store current standard worker results
      if (
        standardWorkerTime !== null &&
        standardProcessingTime !== null &&
        standardTransferTime !== null
      ) {
        const newResult: RunResult = {
          runNumber: currentRun + 1,
          standardTime: standardWorkerTime,
          standardProcessing: standardProcessingTime,
          standardTransfer: standardTransferTime,
          sharedTime: null,
          sharedProcessing: null,
          sharedTransfer: null,
        };

        setStandardRunResults((prev) => [...prev, newResult]);
      }

      // Proceed to next iteration
      const nextRun = currentRun + 1;

      if (nextRun < totalRuns) {
        // Execute next standard worker
        setCurrentRun(nextRun);
        setTimeout(() => {
          console.log("Processing with standard worker");
          processWithStandardWorker();
        }, 100);
      } else {
        // All standard workers completed, switch to shared buffer worker
        setCurrentRun(0);

        // Check if SharedArrayBuffer is supported
        if (!sharedArrayBufferSupported) {
          // Finish if not supported
          finishAllRuns();
        } else {
          setTimeout(() => {
            processWithSharedBuffer();
          }, 100);
        }
      }
    } else if (currentWorkerType === "shared") {
      // Store current shared buffer worker results
      if (sharedBufferWorkerTime !== null) {
        const newResult: RunResult = {
          runNumber: currentRun + 1,
          standardTime: 0, // Actual value not used
          standardProcessing: 0,
          standardTransfer: 0,
          sharedTime: sharedBufferWorkerTime,
          sharedProcessing: sharedProcessingTime || 0,
          sharedTransfer: sharedTransferTime || 0,
        };

        setSharedRunResults((prev) => [...prev, newResult]);
      }

      // Proceed to next iteration
      const nextRun = currentRun + 1;

      if (nextRun < totalRuns) {
        // Execute next shared buffer worker
        setCurrentRun(nextRun);
        setTimeout(() => {
          processWithSharedBuffer();
        }, 500);
      } else {
        // All runs completed
        finishAllRuns();
      }
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const minutes = parseInt(e.target.value, 10);
    setAudioDuration(minutes * 60); // Convert minutes to seconds
  };

  // Add handler for changing number of runs
  const handleRunsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const runs = parseInt(e.target.value, 10);
    setTotalRuns(runs);
  };

  // Function to verify all values are set to 1
  const verifyData = (data: Float32Array): string => {
    console.log(`Verifying data with length ${data.length}`);

    // Check first 10 values
    const firstValues = Array.from(data.slice(0, 10));
    console.log("First 10 values:", firstValues);

    // Check random sample of values
    const sampleSize = 1000;
    let allOnes = true;
    let correct = 0;
    let total = 0;

    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor(Math.random() * data.length);
      total++;
      if (data[index] === 1) {
        correct++;
      } else {
        allOnes = false;
        console.log(`Found non-1 value at index ${index}: ${data[index]}`);
        if (correct < 5) break; // Stop checking after a few errors
      }
    }

    const percentage = (correct / total) * 100;
    return allOnes
      ? "Verification successful: All values are 1"
      : `Verification partial: ${percentage.toFixed(
          2
        )}% of sampled values are 1`;
  };

  const processWithStandardWorker = async () => {
    try {
      setStatus(
        `Standard Worker - Run ${
          currentRun + 1
        }/${totalRuns}: Generating sample audio data (${
          audioDuration / 60
        } minutes)...`
      );
      setStandardWorkerTime(null);
      setStandardTransferTime(null);
      setStandardProcessingTime(null);
      setStandardVerificationResult("");

      // Generate sample audio data
      const audioData = generateSampleAudio(audioDuration, SAMPLE_RATE);

      // Create a new worker
      const worker = new Worker(
        new URL("../workers/standardWorker.ts", import.meta.url)
      );
      standardWorkerRef.current = worker;

      setStatus(
        `Standard Worker - Run ${currentRun + 1}/${totalRuns}: Processing...`
      );
      standardStartTimeRef.current = performance.now();

      // Handle messages from the worker
      worker.onmessage = (event) => {
        const { type, processedData, processingTime } = event.data;

        if (type === "PROCESSING_COMPLETE") {
          const totalTime = performance.now() - standardStartTimeRef.current;

          // Store current run results
          setStandardWorkerTime(totalTime);
          setStandardProcessingTime(processingTime);
          setStandardTransferTime(totalTime - processingTime);

          // Store in arrays for averaging
          standardWorkerTimesRef.current.push(totalTime);
          standardProcessingTimesRef.current.push(processingTime);
          standardTransferTimesRef.current.push(totalTime - processingTime);

          setStatus(
            `Standard Worker - Run ${
              currentRun + 1
            }/${totalRuns}: Processing complete`
          );

          // Verify the processed data
          const result = verifyData(processedData);
          setStandardVerificationResult(result);

          worker.terminate();
          standardWorkerRef.current = null;

          processNext("standard");
        } else if (type === "ERROR") {
          setStatus(`Error: ${event.data.message}`);
          setIsProcessing(false);

          worker.terminate();
          standardWorkerRef.current = null;
        }
      };

      // Send the entire audio data at once
      console.log(
        `Main Thread: Sending audio data to standard worker, length: ${audioData.length}`
      );
      worker.postMessage(
        {
          type: "PROCESS_AUDIO",
          audioData: audioData,
        },
        [audioData.buffer]
      ); // Transfer ownership of buffer to avoid double copy
    } catch (error) {
      setStatus(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      setIsProcessing(false);
    }
  };

  const processWithSharedBuffer = async () => {
    try {
      console.log("Starting SharedArrayBuffer worker process");

      // Check if SharedArrayBuffer is supported - redundant check
      if (
        typeof SharedArrayBuffer === "undefined" ||
        !sharedArrayBufferSupported
      ) {
        console.error("SharedArrayBuffer is not supported in this browser");
        setStatus(
          "Error: SharedArrayBuffer not supported in this browser. Make sure your browser supports it and COOP/COEP headers are properly set."
        );

        // Treat as all runs completed
        finishAllRuns();
        return;
      }

      setStatus(
        `SharedArrayBuffer Worker - Run ${
          currentRun + 1
        }/${totalRuns}: Generating sample audio data (${
          audioDuration / 60
        } minutes)...`
      );
      setSharedBufferWorkerTime(null);
      setSharedTransferTime(null);
      setSharedProcessingTime(null);
      setSharedVerificationResult("");

      // Generate sample audio data
      const audioData = generateSampleAudio(audioDuration, SAMPLE_RATE);
      console.log(
        `Generated audio data for shared buffer, length: ${audioData.length}`
      );

      try {
        // Create SharedArrayBuffer for input and output
        const sharedInputBuffer = new SharedArrayBuffer(audioData.byteLength);
        const sharedOutputBuffer = new SharedArrayBuffer(audioData.byteLength);
        console.log("Successfully created SharedArrayBuffers");

        // Create views of the shared buffers
        const sharedInputArray = new Float32Array(sharedInputBuffer);
        const sharedOutputArray = new Float32Array(sharedOutputBuffer);

        // Copy the audio data into the shared buffer
        sharedInputArray.set(audioData);
        console.log("Audio data copied to shared input buffer");

        // Create a new worker
        const worker = new Worker(
          new URL("../workers/sharedBufferWorker.ts", import.meta.url)
        );
        sharedWorkerRef.current = worker;

        setStatus(
          `SharedArrayBuffer Worker - Run ${
            currentRun + 1
          }/${totalRuns}: Processing...`
        );
        sharedStartTimeRef.current = performance.now();

        // Handle worker timeout
        const workerTimeout = setTimeout(() => {
          console.error("Shared buffer worker timeout - no response received");
          if (sharedWorkerRef.current) {
            sharedWorkerRef.current.terminate();
            sharedWorkerRef.current = null;
          }

          setStatus(
            "Error: Shared buffer worker timeout - no response received"
          );
          setSharedBufferWorkerTime(null);
          setSharedProcessingTime(null);
          setSharedTransferTime(null);
          setSharedVerificationResult("Timeout - no response");

          // Proceed to next run
          processNext("shared");
        }, 10000); // 10-second timeout

        // Handle messages from the worker
        worker.onmessage = (event) => {
          clearTimeout(workerTimeout); // Cancel timeout

          console.log(
            "Received message from shared buffer worker:",
            event.data.type
          );
          const { type, processingTime } = event.data;

          if (type === "PROCESSING_COMPLETE") {
            const totalTime = performance.now() - sharedStartTimeRef.current;
            console.log(
              "Shared buffer worker completed processing:",
              processingTime
            );

            // Store current run results
            setSharedBufferWorkerTime(totalTime);
            setSharedProcessingTime(processingTime);
            setSharedTransferTime(totalTime - processingTime);

            // Store in arrays for averaging
            sharedBufferWorkerTimesRef.current.push(totalTime);
            sharedProcessingTimesRef.current.push(processingTime);
            sharedTransferTimesRef.current.push(totalTime - processingTime);

            setStatus(
              `SharedArrayBuffer Worker - Run ${
                currentRun + 1
              }/${totalRuns}: Processing complete`
            );

            // Verify the processed data in the shared output buffer
            const result = verifyData(sharedOutputArray);
            setSharedVerificationResult(result);

            worker.terminate();
            sharedWorkerRef.current = null;

            // Process next step
            processNext("shared");
          } else if (type === "ERROR") {
            clearTimeout(workerTimeout); // Cancel timeout
            console.error(
              "Error from shared buffer worker:",
              event.data.message
            );
            setStatus(`Error: ${event.data.message}`);
            setIsProcessing(false);

            worker.terminate();
            sharedWorkerRef.current = null;
          }
        };

        // Add error handler
        worker.onerror = (error) => {
          clearTimeout(workerTimeout); // Cancel timeout

          console.error("Shared buffer worker error:", error);
          setStatus(`Worker error: ${error.message}`);
          setIsProcessing(false);

          worker.terminate();
          sharedWorkerRef.current = null;
        };

        // Send buffer references and length information
        console.log(
          `Main Thread: Sending shared buffer info to worker, length: ${audioData.length}`
        );
        worker.postMessage({
          type: "PROCESS_SHARED_AUDIO",
          inputBuffer: sharedInputBuffer,
          outputBuffer: sharedOutputBuffer,
          length: audioData.length,
        });
        console.log("Message posted to shared buffer worker");
      } catch (bufferError) {
        console.error(
          "Error creating or using SharedArrayBuffer:",
          bufferError
        );
        setStatus(
          `SharedArrayBuffer error: ${
            bufferError instanceof Error
              ? bufferError.message
              : String(bufferError)
          }`
        );
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("General error in processWithSharedBuffer:", error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      setIsProcessing(false);
    }
  };

  // Promise-based function for processing with standard worker
  const processStandardWorkerAsync = (runIndex: number): Promise<RunResult> => {
    return new Promise((resolve, reject) => {
      try {
        setStatus(
          `Standard Worker - Run ${
            runIndex + 1
          }/${totalRuns}: Generating sample audio data (${
            audioDuration / 60
          } minutes)...`
        );

        // Reset state
        setStandardWorkerTime(null);
        setStandardTransferTime(null);
        setStandardProcessingTime(null);
        setStandardVerificationResult("");

        // Generate audio data
        const audioData = generateSampleAudio(audioDuration, SAMPLE_RATE);

        // Create worker
        const worker = new Worker(
          new URL("../workers/standardWorker.ts", import.meta.url)
        );
        standardWorkerRef.current = worker;

        setStatus(
          `Standard Worker - Run ${runIndex + 1}/${totalRuns}: Processing...`
        );
        const startTime = performance.now();

        // Worker message handler
        worker.onmessage = (event) => {
          const { type, processedData, processingTime } = event.data;

          if (type === "PROCESSING_COMPLETE") {
            const totalTime = performance.now() - startTime;

            // Store results
            const result: RunResult = {
              runNumber: runIndex + 1,
              standardTime: totalTime,
              standardProcessing: processingTime,
              standardTransfer: totalTime - processingTime,
              sharedTime: null,
              sharedProcessing: null,
              sharedTransfer: null,
            };

            // Update current run result state
            setStandardWorkerTime(totalTime);
            setStandardProcessingTime(processingTime);
            setStandardTransferTime(totalTime - processingTime);

            // Update arrays for averaging
            standardWorkerTimesRef.current.push(totalTime);
            standardProcessingTimesRef.current.push(processingTime);
            standardTransferTimesRef.current.push(totalTime - processingTime);

            // Add to results array
            setStandardRunResults((prev) => [...prev, result]);

            setStatus(
              `Standard Worker - Run ${
                runIndex + 1
              }/${totalRuns}: Processing complete`
            );

            // Verify data
            const verificationResult = verifyData(processedData);
            setStandardVerificationResult(verificationResult);

            worker.terminate();
            standardWorkerRef.current = null;

            // Resolve promise
            resolve(result);
          } else if (type === "ERROR") {
            setStatus(`Error: ${event.data.message}`);
            worker.terminate();
            standardWorkerRef.current = null;
            reject(new Error(event.data.message));
          }
        };

        // Error handler
        worker.onerror = (error) => {
          setStatus(`Worker error: ${error.message}`);
          worker.terminate();
          standardWorkerRef.current = null;
          reject(error);
        };

        // Send audio data
        worker.postMessage(
          {
            type: "PROCESS_AUDIO",
            audioData: audioData,
          },
          [audioData.buffer]
        );
      } catch (error) {
        reject(error);
      }
    });
  };

  // Promise-based function for processing with SharedArrayBuffer worker
  const processSharedBufferWorkerAsync = (
    runIndex: number
  ): Promise<RunResult> => {
    return new Promise((resolve, reject) => {
      try {
        // Check if SharedArrayBuffer is supported
        if (
          typeof SharedArrayBuffer === "undefined" ||
          !sharedArrayBufferSupported
        ) {
          const noSupportResult: RunResult = {
            runNumber: runIndex + 1,
            standardTime: 0,
            standardProcessing: 0,
            standardTransfer: 0,
            sharedTime: null,
            sharedProcessing: null,
            sharedTransfer: null,
          };

          // Return null result if not supported
          resolve(noSupportResult);
          return;
        }

        setStatus(
          `SharedArrayBuffer Worker - Run ${
            runIndex + 1
          }/${totalRuns}: Generating sample audio data (${
            audioDuration / 60
          } minutes)...`
        );

        // Reset state
        setSharedBufferWorkerTime(null);
        setSharedTransferTime(null);
        setSharedProcessingTime(null);
        setSharedVerificationResult("");

        // Generate audio data
        const audioData = generateSampleAudio(audioDuration, SAMPLE_RATE);

        const sharedOutputBuffer = new SharedArrayBuffer(audioData.byteLength);
        // Create Float32Array view
        const sharedOutputArray = new Float32Array(sharedOutputBuffer);

        // Create worker
        const worker = new Worker(
          new URL("../workers/sharedBufferWorker.ts", import.meta.url)
        );
        sharedWorkerRef.current = worker;

        setStatus(
          `SharedArrayBuffer Worker - Run ${
            runIndex + 1
          }/${totalRuns}: Processing...`
        );
        const startTime = performance.now();

        // Set timeout
        const timeoutId = setTimeout(() => {
          if (sharedWorkerRef.current) {
            sharedWorkerRef.current.terminate();
            sharedWorkerRef.current = null;
          }
          reject(new Error("SharedArrayBuffer worker timeout"));
        }, 10000);

        // Worker message handler
        worker.onmessage = (event) => {
          clearTimeout(timeoutId);
          const { type, processingTime } = event.data;

          if (type === "PROCESSING_COMPLETE") {
            const totalTime = performance.now() - startTime;

            // Store results
            const result: RunResult = {
              runNumber: runIndex + 1,
              standardTime: 0,
              standardProcessing: 0,
              standardTransfer: 0,
              sharedTime: totalTime,
              sharedProcessing: processingTime,
              sharedTransfer: totalTime - processingTime,
            };

            // Update current run result state
            setSharedBufferWorkerTime(totalTime);
            setSharedProcessingTime(processingTime);
            setSharedTransferTime(totalTime - processingTime);

            // Update arrays for averaging
            sharedBufferWorkerTimesRef.current.push(totalTime);
            sharedProcessingTimesRef.current.push(processingTime);
            sharedTransferTimesRef.current.push(totalTime - processingTime);

            // Add to results array
            setSharedRunResults((prev) => [...prev, result]);

            setStatus(
              `SharedArrayBuffer Worker - Run ${
                runIndex + 1
              }/${totalRuns}: Processing complete`
            );

            // Verify data
            const verificationResult = verifyData(sharedOutputArray);
            setSharedVerificationResult(verificationResult);

            worker.terminate();
            sharedWorkerRef.current = null;

            // Resolve promise
            resolve(result);
          } else if (type === "ERROR") {
            clearTimeout(timeoutId);
            setStatus(`Error: ${event.data.message}`);
            worker.terminate();
            sharedWorkerRef.current = null;
            reject(new Error(event.data.message));
          }
        };

        // Error handler
        worker.onerror = (error) => {
          clearTimeout(timeoutId);
          setStatus(`Worker error: ${error.message}`);
          worker.terminate();
          sharedWorkerRef.current = null;
          reject(error);
        };

        // Send buffer information
        worker.postMessage({
          type: "PROCESS_SHARED_AUDIO",
          outputBuffer: sharedOutputBuffer,
          length: audioData.length,
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  // Function to start benchmark using TaskQueue
  const startBenchmark = async () => {
    try {
      // Initialize
      setIsProcessing(true);
      setStandardRunResults([]);
      setSharedRunResults([]);

      // Initialize arrays for averages
      standardWorkerTimesRef.current = [];
      standardProcessingTimesRef.current = [];
      standardTransferTimesRef.current = [];
      sharedBufferWorkerTimesRef.current = [];
      sharedProcessingTimesRef.current = [];
      sharedTransferTimesRef.current = [];

      // Use TaskQueue instance (singleton)
      const queue = taskQueue;

      // Add tasks to each queue
      for (let i = 0; i < totalRuns; i++) {
        queue.enqueue(() => processStandardWorkerAsync(i));
        queue.enqueue(() => processSharedBufferWorkerAsync(i));
      }

      // Execute tasks in queue
      setStatus("Running benchmarks...");
      for await (const result of queue.processQueue()) {
        console.log("Run completed:", result);
      }

      // Calculate averages after all runs complete
      calculateAveragesAndComparisons();
      setIsProcessing(false);
      setStatus("All benchmarks complete!");
    } catch (error) {
      console.error("Benchmark error:", error);
      setStatus(
        `Error during benchmark: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setIsProcessing(false);
    }
  };

  // Calculate performance improvement ratios
  const calculateSpeedupRatio = (
    standard: number | null,
    shared: number | null
  ): string => {
    if (standard === null || shared === null || shared === 0) return "-";
    return (standard / shared).toFixed(2) + "x";
  };

  // Function to calculate averages and update history with comparison results
  const calculateAveragesAndComparisons = () => {
    console.log("Calculating averages:", {
      standardTimes: standardWorkerTimesRef.current,
      sharedTimes: sharedBufferWorkerTimesRef.current,
    });

    // Calculate standard worker averages
    let stdTime = 0;
    let stdProcessing = 0;
    let stdTransfer = 0;

    if (standardWorkerTimesRef.current.length > 0) {
      stdTime = calculateAverage(standardWorkerTimesRef.current);
      stdProcessing = calculateAverage(standardProcessingTimesRef.current);
      stdTransfer = calculateAverage(standardTransferTimesRef.current);

      setAvgStandardWorkerTime(stdTime);
      setAvgStandardProcessingTime(stdProcessing);
      setAvgStandardTransferTime(stdTransfer);

      console.log("Standard worker averages calculated:", {
        time: stdTime,
        processing: stdProcessing,
        transfer: stdTransfer,
      });
    }

    // Calculate shared buffer worker averages
    let sharedTime = null;
    let sharedProcessing = null;
    let sharedTransfer = null;

    if (sharedBufferWorkerTimesRef.current.length > 0) {
      sharedTime = calculateAverage(sharedBufferWorkerTimesRef.current);
      sharedProcessing = calculateAverage(sharedProcessingTimesRef.current);
      sharedTransfer = calculateAverage(sharedTransferTimesRef.current);

      setAvgSharedBufferWorkerTime(sharedTime);
      setAvgSharedProcessingTime(sharedProcessing);
      setAvgSharedTransferTime(sharedTransfer);

      console.log("Shared buffer worker averages calculated:", {
        time: sharedTime,
        processing: sharedProcessing,
        transfer: sharedTransfer,
      });
    }

    // Automatically add to history if results exist
    if (standardWorkerTimesRef.current.length > 0) {
      const newHistoryItem: BenchmarkHistoryItem = {
        id: Date.now().toString(),
        audioDuration: audioDuration,
        iterations: totalRuns,
        avgStandardTime: stdTime,
        avgStandardProcessing: stdProcessing,
        avgStandardTransfer: stdTransfer,
        avgSharedTime: sharedTime,
        avgSharedProcessing: sharedProcessing,
        avgSharedTransfer: sharedTransfer,
        timestamp: new Date(),
      };

      // Add to history
      setBenchmarkHistory((prev) => [...prev, newHistoryItem]);
      console.log("Result automatically added to history");
    }

    setStatus("Benchmark complete. Averages calculated.");
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Web Worker with/without SharedArrayBuffer
      </h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="flex flex-col mb-4">
          <label className="mb-2 font-medium">
            Audio Duration:{" "}
            <span className="font-bold">{audioDuration / 60} minutes</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm">1m</span>
            <input
              type="range"
              min="1"
              max="120"
              value={audioDuration / 60}
              onChange={handleDurationChange}
              disabled={isProcessing}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm">120m</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {((audioDuration * SAMPLE_RATE * 4) / 1024 / 1024).toFixed(1)} MB of
            audio data
          </p>

          {/* Add UI for setting number of iterations */}
          <label className="mb-2 mt-6 font-medium">
            Benchmark Iterations:{" "}
            <span className="font-bold">{totalRuns} runs</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm">1</span>
            <input
              type="range"
              min="1"
              max="100"
              value={totalRuns}
              onChange={handleRunsChange}
              disabled={isProcessing}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm">100</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            More iterations provide more accurate averages but increase
            benchmark time.
          </p>

          {sharedArrayBufferSupported !== null && (
            <div
              className={`mt-3 p-3 rounded-md ${
                sharedArrayBufferSupported ? "bg-green-50" : "bg-red-50"
              }`}
            >
              {sharedArrayBufferSupported ? (
                <>
                  <p>
                    Total Time:{" "}
                    {avgSharedBufferWorkerTime !== null
                      ? `${avgSharedBufferWorkerTime.toFixed(2)}ms`
                      : "-"}
                  </p>
                  <p>
                    Processing Time:{" "}
                    {avgSharedProcessingTime !== null
                      ? `${avgSharedProcessingTime.toFixed(2)}ms`
                      : "-"}
                  </p>
                  <p>
                    Transfer Time:{" "}
                    {avgSharedTransferTime !== null
                      ? `${avgSharedTransferTime.toFixed(2)}ms`
                      : "-"}
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    Count of runs: {sharedBufferWorkerTimesRef.current.length}/
                    {totalRuns}
                  </p>
                </>
              ) : (
                <p className="text-red-700">
                  SharedArrayBuffer is not supported in your browser.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex mt-4">
          <button
            onClick={startBenchmark}
            disabled={isProcessing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:bg-gray-400 w-full"
          >
            Run Benchmark ({totalRuns} iterations per worker)
          </button>
        </div>

        {avgStandardWorkerTime !== null && (
          <>
            <h2 className="text-xl font-semibold mb-4 mt-8">
              Benchmark Result Chart
            </h2>
            <ResultChart
              standardResults={standardRunResults}
              sharedResults={sharedRunResults}
              avgStandardWorkerTime={avgStandardWorkerTime}
              avgStandardProcessingTime={avgStandardProcessingTime}
              avgStandardTransferTime={avgStandardTransferTime}
              avgSharedBufferWorkerTime={avgSharedBufferWorkerTime}
              avgSharedProcessingTime={avgSharedProcessingTime}
              avgSharedTransferTime={avgSharedTransferTime}
              audioDuration={audioDuration}
              iterations={totalRuns}
              benchmarkHistory={benchmarkHistory}
            />
          </>
        )}

        {standardRunResults.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mb-4 mt-8">
              Standard Worker - Run Results
            </h2>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Run
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Total Time
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Processing Time
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Transfer Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {standardRunResults.map((result, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        Run {result.runNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {result.standardTime.toFixed(2)}ms
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {result.standardProcessing.toFixed(2)}ms
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {result.standardTransfer.toFixed(2)}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {sharedArrayBufferSupported && sharedRunResults.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mb-4 mt-8">
              SharedArrayBuffer Worker - Run Results
            </h2>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Run
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Total Time
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Processing Time
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Transfer Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sharedRunResults.map((result, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        Run {result.runNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {result.sharedTime !== null
                          ? `${result.sharedTime.toFixed(2)}ms`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {result.sharedProcessing !== null
                          ? `${result.sharedProcessing.toFixed(2)}ms`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {result.sharedTransfer !== null
                          ? `${result.sharedTransfer.toFixed(2)}ms`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* History management UI - keep history table and reset button */}
        {benchmarkHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Benchmark History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Date/Time
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Audio Duration
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Iterations
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Standard Worker
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      SharedArrayBuffer
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Performance Improvement
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {benchmarkHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.timestamp.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.audioDuration / 60} min
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.iterations} times
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.avgStandardTime.toFixed(2)}ms
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.avgSharedTime
                          ? item.avgSharedTime.toFixed(2) + "ms"
                          : "-"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.avgSharedTime
                          ? (item.avgStandardTime / item.avgSharedTime).toFixed(
                              2
                            ) + "x"
                          : "-"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setBenchmarkHistory((prev) =>
                              prev.filter((h) => h.id !== item.id)
                            );
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setBenchmarkHistory([])}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg"
            >
              Reset History
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
