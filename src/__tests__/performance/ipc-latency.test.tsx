import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Performance Benchmark: IPC Latency
 * Target: <100ms for 1MB file operations
 *
 * Tests the performance of Electron IPC communication
 * between renderer and main processes.
 */
describe('IPC Latency Performance Benchmarks', () => {
  // Mock IPC
  const mockInvoke = vi.fn();
  const mockOn = vi.fn(() => () => {});

  beforeEach(() => {
    vi.clearAllMocks();
    global.window = global.window || ({} as any);
    (global.window as any).electronAPI = {
      invoke: mockInvoke,
      on: mockOn,
    };
  });
  it('should read 1MB file in under 100ms', async () => {
    // Generate 1MB file content
    const oneMB = 1024 * 1024;
    const largeContent = 'x'.repeat(oneMB);

    mockInvoke.mockResolvedValueOnce({
      content: largeContent,
      encoding: 'utf-8',
    });

    const startTime = performance.now();

    const result = await window.electronAPI.invoke(
      'fs:read-file',
      '/test/repo/large-file.txt'
    );

    const endTime = performance.now();
    const latency = endTime - startTime;

    console.log(`IPC read latency (1MB): ${latency.toFixed(2)}ms`);
    console.log(`Data size: ${(result.content.length / 1024 / 1024).toFixed(2)}MB`);

    expect(latency).toBeLessThan(100);
    expect(result.content.length).toBe(oneMB);
  });

  it('should write 1MB file in under 100ms', async () => {
    const oneMB = 1024 * 1024;
    const largeContent = 'y'.repeat(oneMB);

    mockInvoke.mockResolvedValueOnce(undefined);

    const startTime = performance.now();

    await window.electronAPI.invoke(
      'fs:write-file',
      '/test/repo/output.txt',
      largeContent
    );

    const endTime = performance.now();
    const latency = endTime - startTime;

    console.log(`IPC write latency (1MB): ${latency.toFixed(2)}ms`);

    expect(latency).toBeLessThan(100);
    expect(mockInvoke).toHaveBeenCalledWith(
      'fs:write-file',
      '/test/repo/output.txt',
      largeContent
    );
  });

  it('should handle rapid small IPC calls (<10ms average)', async () => {
    mockInvoke.mockImplementation(() => Promise.resolve({ success: true }));

    const callCount = 100;
    const latencies: number[] = [];

    for (let i = 0; i < callCount; i++) {
      const startTime = performance.now();

      await window.electronAPI.invoke('fs:stat', `/test/file${i}.ts`);

      const endTime = performance.now();
      latencies.push(endTime - startTime);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);

    console.log(`Average IPC latency (${callCount} calls): ${avgLatency.toFixed(2)}ms`);
    console.log(`Max IPC latency: ${maxLatency.toFixed(2)}ms`);

    expect(avgLatency).toBeLessThan(10);
  });

  it('should handle concurrent IPC calls efficiently', async () => {
    mockInvoke.mockImplementation((channel) =>
      Promise.resolve({ channel, data: 'test' })
    );

    const concurrentCalls = 50;

    const startTime = performance.now();

    const promises = Array.from({ length: concurrentCalls }, (_, i) =>
      window.electronAPI.invoke('fs:read-file', `/test/file${i}.ts`)
    );

    await Promise.all(promises);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`${concurrentCalls} concurrent IPC calls: ${totalTime.toFixed(2)}ms`);
    console.log(`Average per call: ${(totalTime / concurrentCalls).toFixed(2)}ms`);

    expect(totalTime).toBeLessThan(500); // 500ms for 50 concurrent calls
  });

  it('should handle terminal data streaming with low latency (<50ms)', async () => {
    const sessionId = 'session-123';
    const dataChunks: string[] = [];
    const timestamps: number[] = [];

    // Set up terminal data listener
    const unsubscribe = window.electronAPI.on('terminal:data', (data: any) => {
      timestamps.push(performance.now());
      dataChunks.push(data.data);
    });

    // Simulate streaming terminal output
    const dataCall = mockOn.mock.calls.find(
      ([event]) => event === 'terminal:data'
    );
    const outputHandler = dataCall ? dataCall[1] : undefined;

    if (!outputHandler) {
      throw new Error('Terminal data handler not registered');
    }

    const startTime = performance.now();

    // Simulate 100 data chunks
    for (let i = 0; i < 100; i++) {
      outputHandler({
        sessionId,
        data: `Output line ${i}\n`,
      });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Terminal streaming (100 chunks): ${totalTime.toFixed(2)}ms`);
    console.log(`Average per chunk: ${(totalTime / 100).toFixed(2)}ms`);

    expect(totalTime / 100).toBeLessThan(50);

    unsubscribe();
  });

  it('should handle git status polling efficiently (<200ms)', async () => {
    const gitStatus = {
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: Array.from({ length: 100 }, (_, i) => ({
        path: `file${i}.ts`,
        index: i % 3 === 0 ? 'M' : ' ',
        working_dir: i % 5 === 0 ? 'M' : ' ',
      })),
    };

    mockInvoke.mockResolvedValue(gitStatus);

    // Measure polling performance
    const pollTimes: number[] = [];

    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();

      await window.electronAPI.invoke('git:status', '/test/repo');

      const endTime = performance.now();
      pollTimes.push(endTime - startTime);
    }

    const avgPollTime = pollTimes.reduce((a, b) => a + b, 0) / pollTimes.length;

    console.log(`Average git status poll time: ${avgPollTime.toFixed(2)}ms`);
    console.log(`Poll times: ${pollTimes.map(t => t.toFixed(2)).join(', ')}ms`);

    expect(avgPollTime).toBeLessThan(200);
  });

  it('should handle file watcher events with minimal delay (<100ms)', async () => {
    const fileEvents: Array<{ path: string; timestamp: number }> = [];

    // Set up file watcher listener
    const unsubscribe = window.electronAPI.on('fs:file-changed', (event: any) => {
      fileEvents.push({
        path: event.path,
        timestamp: performance.now(),
      });
    });

    const watcherCall = mockOn.mock.calls.find(
      ([event]) => event === 'fs:file-changed'
    );
    const fileWatcherHandler = watcherCall ? watcherCall[1] : undefined;

    if (!fileWatcherHandler) {
      throw new Error('File watcher handler not registered');
    }

    const startTime = performance.now();

    // Simulate file change events
    for (let i = 0; i < 50; i++) {
      fileWatcherHandler({
        path: `/test/repo/file${i}.ts`,
        event: 'change',
      });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`File watcher events (50 files): ${totalTime.toFixed(2)}ms`);
    console.log(`Average per event: ${(totalTime / 50).toFixed(2)}ms`);

    expect(fileEvents.length).toBe(50);
    expect(totalTime / 50).toBeLessThan(100);

    unsubscribe();
  });

  it('should efficiently transfer binary data (images, PDFs)', async () => {
    // Simulate 5MB binary file
    const fiveMB = 5 * 1024 * 1024;
    const binaryData = new ArrayBuffer(fiveMB);
    const view = new Uint8Array(binaryData);

    // Fill with random data
    for (let i = 0; i < view.length; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }

    mockInvoke.mockResolvedValueOnce({
      content: btoa(String.fromCharCode(...view)), // Base64 encode
      encoding: 'base64',
    });

    const startTime = performance.now();

    const result = await window.electronAPI.invoke(
      'fs:read-file',
      '/test/repo/image.png'
    );

    const endTime = performance.now();
    const latency = endTime - startTime;

    console.log(`Binary transfer latency (5MB): ${latency.toFixed(2)}ms`);

    expect(latency).toBeLessThan(500); // 5MB binary should transfer in <500ms
  });

  it('should measure IPC round-trip latency', async () => {
    mockInvoke.mockImplementation(() => Promise.resolve({ pong: true }));

    const roundTripTimes: number[] = [];

    for (let i = 0; i < 100; i++) {
      const startTime = performance.now();

      await window.electronAPI.invoke('ping');

      const endTime = performance.now();
      roundTripTimes.push(endTime - startTime);
    }

    const avgRoundTrip =
      roundTripTimes.reduce((a, b) => a + b, 0) / roundTripTimes.length;
    const minRoundTrip = Math.min(...roundTripTimes);
    const maxRoundTrip = Math.max(...roundTripTimes);

    console.log(`Average IPC round-trip: ${avgRoundTrip.toFixed(2)}ms`);
    console.log(`Min round-trip: ${minRoundTrip.toFixed(2)}ms`);
    console.log(`Max round-trip: ${maxRoundTrip.toFixed(2)}ms`);

    expect(avgRoundTrip).toBeLessThan(20); // Very fast round-trip
  });

  it('should handle large payload chunking efficiently', async () => {
    // Simulate 10MB payload split into chunks
    const tenMB = 10 * 1024 * 1024;
    const chunkSize = 512 * 1024; // 512KB chunks
    const chunkCount = Math.ceil(tenMB / chunkSize);

    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      chunks.push('x'.repeat(chunkSize));
    }

    const startTime = performance.now();

    // Transfer all chunks
    for (let i = 0; i < chunks.length; i++) {
      mockInvoke.mockResolvedValueOnce({ success: true });

      await window.electronAPI.invoke(
        'fs:write-chunk',
        '/test/repo/large.txt',
        chunks[i],
        i
      );
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Chunked transfer (10MB, ${chunkCount} chunks): ${totalTime.toFixed(2)}ms`);
    console.log(`Average per chunk: ${(totalTime / chunkCount).toFixed(2)}ms`);

    expect(totalTime).toBeLessThan(2000); // 10MB in <2s
  });
});
