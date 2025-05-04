# Performance Comparison: SharedArrayBuffer vs. Standard Worker

This project is a demo application designed to verify the performance difference between using SharedArrayBuffer and the standard method (postMessage) when communicating with Web Workers.

## Overview

Web Workers enable multithreaded processing in browsers, but communication between the main thread and Workers typically involves data copying. SharedArrayBuffer can reduce this copying cost by sharing memory.

This project compares two approaches:

1. **Standard Web Worker**: Uses `postMessage` to send audio data to the Worker, resulting in data copying when returning results
2. **SharedArrayBuffer Worker**: Main thread and Worker share the same memory area, allowing direct access without data transfer

## Key Features

- **Various Data Size Testing**: Process audio data from 1 to 120 minutes in length (up to approx. 1.2GB)
- **Performance Measurement**: Compare total processing time, pure processing time, and data transfer time
- **Result Verification**: Verify the accuracy of processed data
- **UI Blocking Test**: Check UI responsiveness through animations

## Test Method

Both approaches perform the same processing:

1. Generate sample audio data of a specified length
2. Change all sample values to 1
3. Verify the processing results

## Interpreting Results

- **Transfer Time**: Time taken to send data to the Worker and receive results
  - SharedArrayBuffer shows significant advantage here due to the absence of data copying
  
- **Processing Time**: Time spent on actual data processing
  - Both methods use similar processing logic, but performance may differ due to memory access patterns

- **Total Time**: Time required to complete the entire task
  - The advantage of SharedArrayBuffer becomes more apparent as data size increases

## Considerations

1. **Security Requirements**: Using SharedArrayBuffer requires specific HTTP headers:
   - `Cross-Origin-Embedder-Policy: require-corp`
   - `Cross-Origin-Opener-Policy: same-origin`

2. **Browser Support**: Supported in all modern browsers, but security restrictions may apply

3. **Use Cases**: SharedArrayBuffer is particularly useful in the following scenarios:
   - Large data processing (video, audio, images, etc.)
   - Real-time data processing and visualization
   - Applications requiring complex calculations

## Running the Project

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

## Technology Stack

- Next.js 15
- TypeScript
- Web Workers API
- SharedArrayBuffer
- Tailwind CSS
