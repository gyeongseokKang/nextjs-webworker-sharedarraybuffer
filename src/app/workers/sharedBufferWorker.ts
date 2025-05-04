// Worker code
self.onmessage = (event) => {
  const {
    type,
    outputBuffer, // SharedArrayBuffer for output audio
    length, // Length of the audio data
  } = event.data;

  if (type === "PROCESS_SHARED_AUDIO") {
    try {
      const startTime = performance.now();

      const outputView = new Float32Array(outputBuffer);

      console.log(
        `SharedBuffer Worker: Processing audio data with length ${length}`
      );

      // Set all values to 1 in the output buffer
      for (let i = 0; i < length; i++) {
        outputView[i] = 1;
      }

      // Calculate processing time
      const processingTime = performance.now() - startTime;

      // Send completion message - no data is sent back
      self.postMessage({
        type: "PROCESSING_COMPLETE",
        processingTime,
      });
    } catch (error) {
      self.postMessage({
        type: "ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
