// API Queue with rate limiting, caching, and retry logic

interface QueuedRequest {
    id: string;
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
    retries: number;
}

interface CacheEntry {
    response: unknown;
    timestamp: number;
}

class ApiQueue {
    private queue: QueuedRequest[] = [];
    private isProcessing = false;
    private lastRequestTime = 0;
    private readonly minGap = 2000; // 2 seconds between requests
    private readonly maxRetries = 3;
    private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
    private cache = new Map<string, CacheEntry>();

    async enqueue<T>(fn: () => Promise<T>, cacheKey?: string): Promise<T> {
        // Check cache first
        if (cacheKey) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.response as T;
            }
        }

        return new Promise((resolve, reject) => {
            const request: QueuedRequest = {
                id: cacheKey || `${Date.now()}-${Math.random()}`,
                fn,
                resolve: (value) => {
                    if (cacheKey) {
                        this.cache.set(cacheKey, {
                            response: value,
                            timestamp: Date.now(),
                        });
                    }
                    resolve(value as T);
                },
                reject,
                retries: 0,
            };

            this.queue.push(request);
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const request = this.queue[0];

            // Enforce minimum gap between requests
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            if (timeSinceLastRequest < this.minGap) {
                await this.sleep(this.minGap - timeSinceLastRequest);
            }

            try {
                this.lastRequestTime = Date.now();
                const result = await request.fn();
                request.resolve(result);
                this.queue.shift();
            } catch (error) {
                request.retries++;

                if (request.retries >= this.maxRetries) {
                    request.reject(error);
                    this.queue.shift();
                } else {
                    // Exponential backoff
                    const backoffTime = Math.pow(2, request.retries) * 1000;
                    // console.log(`Retry ${request.retries}/${this.maxRetries} after ${backoffTime}ms`);
                    await this.sleep(backoffTime);
                }
            }
        }

        this.isProcessing = false;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    clearCache(): void {
        this.cache.clear();
    }

    getQueueLength(): number {
        return this.queue.length;
    }

    isQueueBusy(): boolean {
        return this.isProcessing;
    }
}

// Singleton instance
export const apiQueue = new ApiQueue();

// Helper for AI coach requests
export async function makeAIRequest<T>(
    requestFn: () => Promise<T>,
    cacheKey?: string
): Promise<T> {
    return apiQueue.enqueue(requestFn, cacheKey);
}
