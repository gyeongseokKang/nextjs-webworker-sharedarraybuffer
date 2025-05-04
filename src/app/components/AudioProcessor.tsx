"use client";

import { useEffect, useRef, useState } from "react";
import { generateSampleAudio } from "../utils/audioUtils";
import taskQueue from "../utils/taskQueue"; // Import both default instance and class
import ResultChart from "./ResultChart";

// 각 실행 결과를 저장할 타입 정의
type RunResult = {
  runNumber: number;
  standardTime: number;
  standardProcessing: number;
  standardTransfer: number;
  sharedTime: number | null;
  sharedProcessing: number | null;
  sharedTransfer: number | null;
};

// 벤치마크 설정 및 결과를 포함하는 히스토리 항목 타입
type BenchmarkHistoryItem = {
  id: string;
  audioDuration: number; // 초 단위
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
  // 각 실행 결과를 저장할 배열
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
  const [audioDuration, setAudioDuration] = useState<number>(60); // 기본값 1분 (60초)
  const [currentRun, setCurrentRun] = useState<number>(0);
  const [totalRuns, setTotalRuns] = useState<number>(5); // 기본값 5회

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

  // 워커 지원 여부를 확인하는 상태 추가
  const [sharedArrayBufferSupported, setSharedArrayBufferSupported] = useState<
    boolean | null
  >(null);

  // 벤치마크 히스토리 저장을 위한 상태 유지
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

  // SharedArrayBuffer 지원 여부 확인
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
      // 결과가 없으면 null로 설정
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
      // 현재 표준 워커 결과 저장
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

      // 다음 반복으로 진행
      const nextRun = currentRun + 1;

      if (nextRun < totalRuns) {
        // 다음 표준 워커 실행
        setCurrentRun(nextRun);
        setTimeout(() => {
          console.log("Processing with standard worker");
          processWithStandardWorker();
        }, 100);
      } else {
        // 표준 워커 모두 완료, 이제 공유 버퍼 워커로 전환
        setCurrentRun(0);

        // SharedArrayBuffer 지원 여부 확인
        if (!sharedArrayBufferSupported) {
          // 지원하지 않으면 완료 처리
          finishAllRuns();
        } else {
          setTimeout(() => {
            processWithSharedBuffer();
          }, 100);
        }
      }
    } else if (currentWorkerType === "shared") {
      // 현재 공유 버퍼 워커 결과 저장
      if (sharedBufferWorkerTime !== null) {
        const newResult: RunResult = {
          runNumber: currentRun + 1,
          standardTime: 0, // 실제 값은 사용하지 않음
          standardProcessing: 0,
          standardTransfer: 0,
          sharedTime: sharedBufferWorkerTime,
          sharedProcessing: sharedProcessingTime || 0,
          sharedTransfer: sharedTransferTime || 0,
        };

        setSharedRunResults((prev) => [...prev, newResult]);
      }

      // 다음 반복으로 진행
      const nextRun = currentRun + 1;

      if (nextRun < totalRuns) {
        // 다음 공유 버퍼 워커 실행
        setCurrentRun(nextRun);
        setTimeout(() => {
          processWithSharedBuffer();
        }, 500);
      } else {
        // 모든 실행 완료
        finishAllRuns();
      }
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const minutes = parseInt(e.target.value, 10);
    setAudioDuration(minutes * 60); // 분을 초로 변환
  };

  // 반복 횟수 변경 핸들러 추가
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

      // SharedArrayBuffer 지원 확인 - 중복 체크
      if (
        typeof SharedArrayBuffer === "undefined" ||
        !sharedArrayBufferSupported
      ) {
        console.error("SharedArrayBuffer is not supported in this browser");
        setStatus(
          "Error: SharedArrayBuffer not supported in this browser. Make sure your browser supports it and COOP/COEP headers are properly set."
        );

        // 모든 실행 완료로 처리
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

        // 워커 타임아웃 처리
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

          // 다음 실행으로 진행
          processNext("shared");
        }, 10000); // 10초 타임아웃

        // Handle messages from the worker
        worker.onmessage = (event) => {
          clearTimeout(workerTimeout); // 타임아웃 취소

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
            clearTimeout(workerTimeout); // 타임아웃 취소
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
          clearTimeout(workerTimeout); // 타임아웃 취소

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

  // 표준 워커 처리를 위한 Promise 기반 함수
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

        // 상태 초기화
        setStandardWorkerTime(null);
        setStandardTransferTime(null);
        setStandardProcessingTime(null);
        setStandardVerificationResult("");

        // 오디오 데이터 생성
        const audioData = generateSampleAudio(audioDuration, SAMPLE_RATE);

        // 워커 생성
        const worker = new Worker(
          new URL("../workers/standardWorker.ts", import.meta.url)
        );
        standardWorkerRef.current = worker;

        setStatus(
          `Standard Worker - Run ${runIndex + 1}/${totalRuns}: Processing...`
        );
        const startTime = performance.now();

        // 워커 메시지 핸들러
        worker.onmessage = (event) => {
          const { type, processedData, processingTime } = event.data;

          if (type === "PROCESSING_COMPLETE") {
            const totalTime = performance.now() - startTime;

            // 결과 저장
            const result: RunResult = {
              runNumber: runIndex + 1,
              standardTime: totalTime,
              standardProcessing: processingTime,
              standardTransfer: totalTime - processingTime,
              sharedTime: null,
              sharedProcessing: null,
              sharedTransfer: null,
            };

            // 현재 실행 결과 상태 업데이트
            setStandardWorkerTime(totalTime);
            setStandardProcessingTime(processingTime);
            setStandardTransferTime(totalTime - processingTime);

            // 평균 계산용 배열 업데이트
            standardWorkerTimesRef.current.push(totalTime);
            standardProcessingTimesRef.current.push(processingTime);
            standardTransferTimesRef.current.push(totalTime - processingTime);

            // 결과 배열에 추가
            setStandardRunResults((prev) => [...prev, result]);

            setStatus(
              `Standard Worker - Run ${
                runIndex + 1
              }/${totalRuns}: Processing complete`
            );

            // 데이터 검증
            const verificationResult = verifyData(processedData);
            setStandardVerificationResult(verificationResult);

            worker.terminate();
            standardWorkerRef.current = null;

            // 프로미스 해결
            resolve(result);
          } else if (type === "ERROR") {
            setStatus(`Error: ${event.data.message}`);
            worker.terminate();
            standardWorkerRef.current = null;
            reject(new Error(event.data.message));
          }
        };

        // 오류 핸들러
        worker.onerror = (error) => {
          setStatus(`Worker error: ${error.message}`);
          worker.terminate();
          standardWorkerRef.current = null;
          reject(error);
        };

        // 오디오 데이터 전송
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

  // SharedArrayBuffer 워커 처리를 위한 Promise 기반 함수
  const processSharedBufferWorkerAsync = (
    runIndex: number
  ): Promise<RunResult> => {
    return new Promise((resolve, reject) => {
      try {
        // SharedArrayBuffer 지원 확인
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

          // 지원하지 않으면 null 결과 반환
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

        // 상태 초기화
        setSharedBufferWorkerTime(null);
        setSharedTransferTime(null);
        setSharedProcessingTime(null);
        setSharedVerificationResult("");

        // 오디오 데이터 생성
        const audioData = generateSampleAudio(audioDuration, SAMPLE_RATE);

        const sharedOutputBuffer = new SharedArrayBuffer(audioData.byteLength);
        // Float32Array 뷰 생성
        const sharedOutputArray = new Float32Array(sharedOutputBuffer);

        // 워커 생성
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

        // 타임아웃 설정
        const timeoutId = setTimeout(() => {
          if (sharedWorkerRef.current) {
            sharedWorkerRef.current.terminate();
            sharedWorkerRef.current = null;
          }
          reject(new Error("SharedArrayBuffer worker timeout"));
        }, 10000);

        // 워커 메시지 핸들러
        worker.onmessage = (event) => {
          clearTimeout(timeoutId);
          const { type, processingTime } = event.data;

          if (type === "PROCESSING_COMPLETE") {
            const totalTime = performance.now() - startTime;

            // 결과 저장
            const result: RunResult = {
              runNumber: runIndex + 1,
              standardTime: 0,
              standardProcessing: 0,
              standardTransfer: 0,
              sharedTime: totalTime,
              sharedProcessing: processingTime,
              sharedTransfer: totalTime - processingTime,
            };

            // 현재 실행 결과 상태 업데이트
            setSharedBufferWorkerTime(totalTime);
            setSharedProcessingTime(processingTime);
            setSharedTransferTime(totalTime - processingTime);

            // 평균 계산용 배열 업데이트
            sharedBufferWorkerTimesRef.current.push(totalTime);
            sharedProcessingTimesRef.current.push(processingTime);
            sharedTransferTimesRef.current.push(totalTime - processingTime);

            // 결과 배열에 추가
            setSharedRunResults((prev) => [...prev, result]);

            setStatus(
              `SharedArrayBuffer Worker - Run ${
                runIndex + 1
              }/${totalRuns}: Processing complete`
            );

            // 데이터 검증
            const verificationResult = verifyData(sharedOutputArray);
            setSharedVerificationResult(verificationResult);

            worker.terminate();
            sharedWorkerRef.current = null;

            // 프로미스 해결
            resolve(result);
          } else if (type === "ERROR") {
            clearTimeout(timeoutId);
            setStatus(`Error: ${event.data.message}`);
            worker.terminate();
            sharedWorkerRef.current = null;
            reject(new Error(event.data.message));
          }
        };

        // 오류 핸들러
        worker.onerror = (error) => {
          clearTimeout(timeoutId);
          setStatus(`Worker error: ${error.message}`);
          worker.terminate();
          sharedWorkerRef.current = null;
          reject(error);
        };

        // 버퍼 정보 전송
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

  // TaskQueue를 사용한 벤치마크 실행 함수
  const startBenchmark = async () => {
    try {
      // 초기화
      setIsProcessing(true);
      setStandardRunResults([]);
      setSharedRunResults([]);

      // 평균값 배열 초기화
      standardWorkerTimesRef.current = [];
      standardProcessingTimesRef.current = [];
      standardTransferTimesRef.current = [];
      sharedBufferWorkerTimesRef.current = [];
      sharedProcessingTimesRef.current = [];
      sharedTransferTimesRef.current = [];

      // TaskQueue 인스턴스 사용 (싱글톤)
      const queue = taskQueue;

      // 각 큐에 실행 태스크 추가
      for (let i = 0; i < totalRuns; i++) {
        queue.enqueue(() => processStandardWorkerAsync(i));
        queue.enqueue(() => processSharedBufferWorkerAsync(i));
      }

      // 큐의 태스크 실행
      setStatus("Running benchmarks...");
      for await (const result of queue.processQueue()) {
        console.log("Run completed:", result);
      }

      // 모든 실행 완료 후 평균 계산
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

  // 평균값 계산 및 비교 결과 생성 함수에 히스토리 업데이트 추가
  const calculateAveragesAndComparisons = () => {
    console.log("Calculating averages:", {
      standardTimes: standardWorkerTimesRef.current,
      sharedTimes: sharedBufferWorkerTimesRef.current,
    });

    // 표준 워커 평균 계산
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

    // 공유 버퍼 워커 평균 계산
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

    // 결과가 있다면 자동으로 히스토리에 추가
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

      // 히스토리에 추가
      setBenchmarkHistory((prev) => [...prev, newHistoryItem]);
      console.log("Result automatically added to history");
    }

    setStatus("벤치마크 완료. 평균값 계산 완료.");
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

          {/* 반복 횟수 설정 UI 추가 */}
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
            더 많은 반복 횟수는 더 정확한 평균값을 제공하지만, 벤치마크 시간이
            길어집니다.
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
              벤치마크 결과 차트
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

        {/* 히스토리 관리 UI - 히스토리 테이블 및 초기화 버튼 유지 */}
        {benchmarkHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">벤치마크 히스토리</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      날짜/시간
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      오디오 지속 시간
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      반복 횟수
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      표준 Worker
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      SharedArrayBuffer
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      성능 향상
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
                        {item.audioDuration / 60}분
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.iterations}회
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
                          삭제
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
              히스토리 초기화
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
