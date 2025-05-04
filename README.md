# Performance Comparison: SharedArrayBuffer vs. Standard Worker

This project is a demo application designed to verify the performance difference between using SharedArrayBuffer and the standard method (postMessage) when communicating with Web Workers.

[Demo](https://nextjs-webworker-sharedarraybuffer.vercel.app/)
[Blog](https://all-dev-kang.tistory.com/entry/Web-Worker%EC%97%90%EC%84%9C-SharedArrayBuffer%EB%8A%94-%EC%A0%95%EB%A7%90-%EC%84%B1%EB%8A%A5%EC%9D%84-%EA%B0%9C%EC%84%A0%ED%95%A0%EA%B9%8C)

## Overview

Web Workers enable multithreaded processing in browsers, but communication between the main thread and Workers typically involves data copying. SharedArrayBuffer can reduce this copying cost by sharing memory between threads.

This project compares two approaches:

1. **Standard Web Worker**: Uses `postMessage` to send audio data to the Worker, resulting in data copying when transferring results
2. **SharedArrayBuffer Worker**: Main thread and Worker share the same memory area, allowing direct access without data transfer

![다운로드](https://github.com/user-attachments/assets/ceed63bd-86e1-44d9-a3c2-a40c62b57e99)
<img width="640" alt="다운로드 (1)" src="https://github.com/user-attachments/assets/13039bbd-5568-42d8-822b-875125410438" />

## Key Features

- **Various Data Size Testing**: Process audio data from 1 to 120 minutes in length (up to approx. 1.2GB)
- **Iteration Control**: Adjust the number of repetitions for more reliable measurements
- **Performance Measurement**: Compare total processing time, pure processing time, and data transfer time
- **Result Verification**: Verify the accuracy of processed data
- **UI Blocking Test**: Check UI responsiveness through animations

## Test Method

Both approaches perform the same processing:

1. Generate sample audio data of a specified length
2. Change all sample values to 1
3. Measure processing time using `performance.now()`
4. Verify the processing results

## Test Results

After conducting multiple tests, we found:

- **Transfer Time**: SharedArrayBuffer shows significant and consistent improvements
  - Eliminates memory copying operations between threads
  
- **Processing Time**: Surprisingly, SharedArrayBuffer sometimes shows slightly increased processing time
  - This may be due to additional wrapper objects (like `Float32Array`) needed to access SharedArrayBuffer
  - Possible internal locks or memory barriers implemented for thread safety
  
- **Total Time**: The overall improvement is less dramatic than expected
  - For smaller data sizes, the benefit may be negligible or even negative
  - Benefits become more apparent with larger data sizes, but not as significant as anticipated

## When to Use SharedArrayBuffer

Based on our findings, SharedArrayBuffer is most beneficial for:

1. **Very large datasets** where transfer time dominates the total processing time
2. **Applications requiring frequent data exchange** between main thread and workers
3. **Real-time processing** where minimizing latency is critical
4. **Specific use cases** like audio/video processing, WebAssembly applications, or games

For simpler applications or smaller data sizes, the added complexity of implementing SharedArrayBuffer may not justify the performance gains.

## Security Requirements

Using SharedArrayBuffer requires specific HTTP headers for security reasons:
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

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

## References

This README is based on experiments and findings detailed in our [blog post analysis](https://all-dev-kang.tistory.com/entry/Web-Worker%EC%97%90%EC%84%9C-SharedArrayBuffer%EB%8A%94-%EC%A0%95%EB%A7%90-%EC%84%B1%EB%8A%A5%EC%9D%84-%EA%B0%9C%EC%84%A0%ED%95%A0%EA%B9%8C).
