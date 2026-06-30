// A small pool of thumbnail workers. Spreads decode + WASM work across cores
// and bounds concurrency so we never thrash memory on huge folders.

import type { ThumbRequest, ThumbResponse } from "./types";

type Resolver = (res: ThumbResponse) => void;

interface Job extends ThumbRequest {
  resolve: Resolver;
}

export class ThumbPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private pending = new Map<Worker, Resolver>();

  constructor(size = ThumbPool.defaultSize()) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(
        new URL("../workers/thumbnailer.worker.ts", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = (e: MessageEvent<ThumbResponse>) => this.onDone(worker, e.data);
      this.workers.push(worker);
      this.idle.push(worker);
    }
  }

  static defaultSize(): number {
    const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
    return Math.max(2, Math.min(cores - 1, 8));
  }

  get size(): number {
    return this.workers.length;
  }

  process(req: ThumbRequest): Promise<ThumbResponse> {
    return new Promise((resolve) => {
      this.queue.push({ ...req, resolve });
      this.pump();
    });
  }

  private pump(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.pending.set(worker, job.resolve);
      const msg: ThumbRequest = {
        id: job.id,
        file: job.file,
        persistOriginal: job.persistOriginal,
      };
      worker.postMessage(msg);
    }
  }

  private onDone(worker: Worker, res: ThumbResponse): void {
    const resolve = this.pending.get(worker);
    this.pending.delete(worker);
    this.idle.push(worker);
    resolve?.(res);
    this.pump();
  }

  terminate(): void {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.pending.clear();
  }
}
