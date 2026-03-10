// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Worker class
const mockWorkerOn = vi.fn();
const mockWorkerPostMessage = vi.fn();
const mockWorkerTerminate = vi.fn();

let workerMessageHandler: ((msg: any) => void) | null = null;
let workerErrorHandler: ((err: Error) => void) | null = null;
let workerExitHandler: ((code: number) => void) | null = null;

// Use a class for proper constructor behavior
class MockWorker {
  constructor() {
    MockWorker.instances.push(this);
  }
  on(event: string, handler: any) {
    mockWorkerOn(event, handler);
    if (event === 'message') workerMessageHandler = handler;
    if (event === 'error') workerErrorHandler = handler;
    if (event === 'exit') workerExitHandler = handler;
  }
  postMessage = mockWorkerPostMessage;
  terminate = mockWorkerTerminate;
  static instances: MockWorker[] = [];
  static mockClear() {
    MockWorker.instances = [];
  }
}

vi.mock('worker_threads', () => ({
  Worker: MockWorker,
}));

vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

describe('Scanner Pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    workerMessageHandler = null;
    workerErrorHandler = null;
    workerExitHandler = null;
    MockWorker.mockClear();

    // Reset module to get fresh scannerPool instance
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const importScannerPool = async () => {
    const module = await import('../../../src/main/workers/scanner-pool');
    return module.scannerPool;
  };

  describe('scan()', () => {
    it('creates a Worker and sends scan message', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test/path', 'token123');

      expect(MockWorker.instances.length).toBeGreaterThan(0);
      expect(mockWorkerPostMessage).toHaveBeenCalledWith({
        type: 'scan',
        directoryPath: '/test/path',
        githubToken: 'token123',
      });

      // Resolve the promise
      workerMessageHandler!({ type: 'result', data: [] });
      await scanPromise;
    });

    it('resolves with data when worker sends result message', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      const mockData = [{ localPath: '/test/repo', branchName: 'main' }];
      workerMessageHandler!({ type: 'result', data: mockData });

      const result = await scanPromise;
      expect(result).toEqual(mockData);
    });

    it('rejects when worker sends error message', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      workerMessageHandler!({ type: 'error', message: 'Scan failed' });

      await expect(scanPromise).rejects.toThrow('Scan failed');
    });

    it('rejects when worker exits with non-zero code', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      workerExitHandler!(1);

      await expect(scanPromise).rejects.toThrow('Scanner worker exited with code 1');
    });

    it('rejects when worker emits error event', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      workerErrorHandler!(new Error('Worker crashed'));

      await expect(scanPromise).rejects.toThrow('Worker crashed');
    });

    it('terminates worker after result is received', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      workerMessageHandler!({ type: 'result', data: [] });
      await scanPromise;

      expect(mockWorkerTerminate).toHaveBeenCalled();
    });
  });

  describe('Timeout handling', () => {
    it('rejects after 30 second timeout if worker is unresponsive', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      await expect(scanPromise).rejects.toThrow('Scanner worker timed out after 30s');
    });

    it('terminates timed-out worker', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      vi.advanceTimersByTime(30000);

      try {
        await scanPromise;
      } catch {
        // Expected to throw
      }

      expect(mockWorkerTerminate).toHaveBeenCalled();
    });

    it('does not reject if result arrives before timeout', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      // Advance time by 15 seconds (half the timeout)
      vi.advanceTimersByTime(15000);

      // Send result before timeout
      workerMessageHandler!({ type: 'result', data: [{ test: true }] });

      const result = await scanPromise;
      expect(result).toEqual([{ test: true }]);
    });
  });

  describe('terminate()', () => {
    it('kills the active worker', async () => {
      const scannerPool = await importScannerPool();

      // Start a scan to create a worker
      const scanPromise = scannerPool.scan('/test', null);

      // Terminate the pool
      scannerPool.terminate();

      expect(mockWorkerTerminate).toHaveBeenCalled();

      // Clean up the promise
      try {
        workerMessageHandler!({ type: 'result', data: [] });
        await scanPromise;
      } catch {
        // May throw due to termination
      }
    });

    it('does nothing if no worker is active', async () => {
      const scannerPool = await importScannerPool();

      // Terminate without starting a scan
      scannerPool.terminate();

      // Should not throw
      expect(mockWorkerTerminate).not.toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('can start new scan after previous error', async () => {
      const scannerPool = await importScannerPool();

      // First scan that errors
      const scan1Promise = scannerPool.scan('/test1', null);
      workerErrorHandler!(new Error('First scan failed'));

      try {
        await scan1Promise;
      } catch {
        // Expected
      }

      // Reset mock to track new worker creation
      MockWorker.mockClear();
      mockWorkerPostMessage.mockClear();

      // Second scan should work
      const scan2Promise = scannerPool.scan('/test2', null);

      expect(MockWorker.instances.length).toBeGreaterThan(0);
      expect(mockWorkerPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          directoryPath: '/test2',
        })
      );

      workerMessageHandler!({ type: 'result', data: [] });
      await scan2Promise;
    });

    it('can start new scan after timeout', async () => {
      const scannerPool = await importScannerPool();

      // First scan that times out
      const scan1Promise = scannerPool.scan('/test1', null);
      vi.advanceTimersByTime(30000);

      try {
        await scan1Promise;
      } catch {
        // Expected timeout
      }

      // Reset mocks
      MockWorker.mockClear();
      mockWorkerPostMessage.mockClear();

      // Second scan should work
      const scan2Promise = scannerPool.scan('/test2', null);

      expect(MockWorker.instances.length).toBeGreaterThan(0);

      workerMessageHandler!({ type: 'result', data: [] });
      await scan2Promise;
    });
  });

  describe('getWorkerPath() - packaged mode', () => {
    it('uses production path when app.isPackaged is true', async () => {
      // Reset modules and update the mock
      vi.resetModules();
      vi.doMock('electron', () => ({
        app: {
          isPackaged: true,
        },
      }));

      // Import path mock to verify the join call
      const pathMock = await import('path');
      const pathJoinSpy = vi.spyOn(pathMock, 'join');

      const scannerPool = await importScannerPool();

      // Start a scan to trigger getWorkerPath()
      const scanPromise = scannerPool.scan('/test', null);

      // Verify path.join was called with __dirname (production path)
      expect(pathJoinSpy).toHaveBeenCalled();
      const joinCalls = pathJoinSpy.mock.calls;
      const hasProductionPath = joinCalls.some(
        (call) => call.includes('contribution-scanner.worker.js') && !call.includes('.vite/build/')
      );
      expect(hasProductionPath).toBe(true);

      // Clean up promise
      workerMessageHandler!({ type: 'result', data: [] });
      await scanPromise;
    });
  });

  describe('Worker constructor failure', () => {
    it('rejects when Worker constructor throws', async () => {
      // Reset modules to use a new Worker mock that throws
      vi.resetModules();

      class FailingMockWorker {
        constructor() {
          throw new Error('Worker spawn failed');
        }
      }

      vi.doMock('worker_threads', () => ({
        Worker: FailingMockWorker,
      }));

      const scannerPool = await importScannerPool();

      // Attempt to scan should reject with constructor error
      await expect(scannerPool.scan('/test', null)).rejects.toThrow(
        'Failed to spawn scanner worker: Error: Worker spawn failed'
      );
    });
  });

  describe('Race condition handling - settled flag', () => {
    beforeEach(async () => {
      // Reset modules and re-establish mocks for these tests
      vi.resetModules();
      vi.doMock('worker_threads', () => ({
        Worker: MockWorker,
      }));
      vi.doMock('electron', () => ({
        app: {
          isPackaged: false,
        },
      }));
      MockWorker.mockClear();
      workerMessageHandler = null;
      workerErrorHandler = null;
      workerExitHandler = null;
    });

    it('ignores message events after promise is already settled', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      // First message settles the promise
      workerMessageHandler!({ type: 'result', data: [{ test: 'data' }] });
      await scanPromise;

      // Second message should be ignored (settled = true)
      // This tests the "if (settled) return;" branch on line 76
      workerMessageHandler!({ type: 'result', data: [{ should: 'be ignored' }] });

      // No assertion needed - we're testing that no error is thrown
      expect(mockWorkerTerminate).toHaveBeenCalledTimes(1); // Only called once
    });

    it('ignores error events after promise is already settled', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      // Settle with result first
      workerMessageHandler!({ type: 'result', data: [] });
      await scanPromise;

      // Error event after settlement should be ignored
      // This tests the "if (settled) return;" branch on line 89
      workerErrorHandler!(new Error('Late error'));

      // No additional termination or rejection
      expect(mockWorkerTerminate).toHaveBeenCalledTimes(1);
    });

    it('ignores exit events after promise is already settled', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      // Settle with result first
      workerMessageHandler!({ type: 'result', data: [] });
      await scanPromise;

      // Exit event after settlement should be ignored
      // This tests the "if (settled) return;" branch on line 96
      workerExitHandler!(1);

      // No additional termination or rejection
      expect(mockWorkerTerminate).toHaveBeenCalledTimes(1);
    });

    it('ignores timeout when promise was already settled by result', async () => {
      const scannerPool = await importScannerPool();

      const scanPromise = scannerPool.scan('/test', null);

      // Settle with result first
      workerMessageHandler!({ type: 'result', data: [] });
      await scanPromise;

      // Advance time to trigger timeout - should be ignored due to settled flag
      // This tests the "if (!settled)" branch on line 62
      vi.advanceTimersByTime(30000);

      // Still only one termination (from the result handler, not from timeout)
      expect(mockWorkerTerminate).toHaveBeenCalledTimes(1);
    });
  });
});
