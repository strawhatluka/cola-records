/**
 * Scanner Pool — Worker Thread lifecycle manager
 *
 * Spawns a worker thread to run contribution scanning off the main thread.
 * Handles communication, timeout, and graceful shutdown.
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import type { WorkerMessage, WorkerResponse } from './contribution-scanner.worker';

interface ScannedContribution {
  localPath: string;
  repositoryUrl: string;
  branchName: string;
  remotes: {
    origin?: string;
    upstream?: string;
  };
  isFork: boolean;
  remotesValid: boolean;
  upstreamUrl?: string;
  issueNumber?: number;
  issueTitle?: string;
  prUrl?: string;
  prNumber?: number;
  prStatus?: 'open' | 'closed' | 'merged';
  createdAt?: Date;
}

const WORKER_TIMEOUT_MS = 30_000;

function getWorkerPath(): string {
  // In dev, the worker is compiled alongside main process code by Vite
  // In production (packaged), it's in the same output directory
  // Electron Forge + Vite places compiled main process files in .vite/build/
  return path.join(__dirname, 'contribution-scanner.worker.js');
}

class ScannerPool {
  private worker: Worker | null = null;

  async scan(directoryPath: string, githubToken: string | null): Promise<ScannedContribution[]> {
    return new Promise((resolve, reject) => {
      const workerPath = getWorkerPath();
      let worker: Worker;

      try {
        worker = new Worker(workerPath);
      } catch (err) {
        reject(new Error(`Failed to spawn scanner worker: ${err}`));
        return;
      }

      this.worker = worker;
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          worker.terminate();
          this.worker = null;
          reject(new Error('Scanner worker timed out after 30s'));
        }
      }, WORKER_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timeout);
        this.worker = null;
      };

      worker.on('message', (msg: WorkerResponse) => {
        if (settled) return;
        settled = true;
        cleanup();

        if (msg.type === 'result') {
          resolve(msg.data);
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        }
        worker.terminate();
      });

      worker.on('error', (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      });

      worker.on('exit', (code) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (code !== 0) {
          reject(new Error(`Scanner worker exited with code ${code}`));
        }
      });

      const message: WorkerMessage = { type: 'scan', directoryPath, githubToken };
      worker.postMessage(message);
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const scannerPool = new ScannerPool();
