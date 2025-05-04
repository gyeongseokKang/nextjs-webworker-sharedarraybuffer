// Fix for TypeScript in a worker context
declare const self: DedicatedWorkerGlobalScope;

// Worker code
self.onmessage = (event) => {
  const { type, audioData } = event.data;

  if (type === "PROCESS_AUDIO") {
    try {
      const startTime = performance.now();

      console.log(
        `Standard Worker: Processing audio data with length ${audioData.length}`
      );

      // Create a new array for processed data
      const processedData = new Float32Array(audioData.length);

      // Set all values to 1
      for (let i = 0; i < audioData.length; i++) {
        processedData[i] = 1;
      }

      // Calculate processing time
      const processingTime = performance.now() - startTime;

      // Send the processed data back
      self.postMessage(
        {
          type: "PROCESSING_COMPLETE",
          processedData,
          processingTime,
        },
        [processedData.buffer]
      );
    } catch (error) {
      self.postMessage({
        type: "ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

// Export empty object to satisfy TypeScript module requirements
export {};
