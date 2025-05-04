/**
 * Generate synthetic sample audio data with memoization
 * @param duration Duration in seconds
 * @param sampleRate Sample rate in Hz
 * @returns Float32Array with audio data
 */
const audioCache: Record<string, Float32Array> = {};

export function generateSampleAudio(
  duration: number,
  sampleRate: number = 44100
): Float32Array {
  const numSamples = duration * sampleRate;
  const audioData = new Float32Array(numSamples);

  // Generate a simple sine wave
  const frequency = 440; // A4 note
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Use a sine wave plus some harmonics for a more complex sound
    audioData[i] =
      0.5 * Math.sin(2 * Math.PI * frequency * t) +
      0.25 * Math.sin(2 * Math.PI * frequency * 2 * t) +
      0.125 * Math.sin(2 * Math.PI * frequency * 3 * t);
  }

  return audioData;
}
