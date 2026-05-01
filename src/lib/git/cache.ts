import type { Result as ResultType } from "better-result";
import { Result } from "better-result";

type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  inflight?: Promise<ResultType<T, unknown>>;
};

type CacheOptions = {
  ttlMs?: number;
};

const DEFAULT_CACHE_TTL_MS = 5000;

export class GitCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly defaultTtlMs = DEFAULT_CACHE_TTL_MS) {}

  get<T>(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry || !("value" in entry) || entry.expiresAt <= Date.now()) {
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    this.entries.set(key, {
      value,
      expiresAt: this.expiresAt(options.ttlMs),
    });
  }

  async getOrLoad<T, E>(
    key: string,
    load: () => Promise<ResultType<T, E>>,
    options: CacheOptions = {},
  ): Promise<ResultType<T, E>> {
    const cached = this.entries.get(key);
    if (cached && "value" in cached && cached.expiresAt > Date.now()) {
      return Result.ok(cached.value as T);
    }

    const existing = this.entries.get(key)?.inflight as Promise<ResultType<T, E>> | undefined;
    if (existing) return existing;

    const inflight = load().then((result) => {
      if (Result.isOk(result)) {
        this.set(key, result.value, options);
        return result;
      }

      this.entries.delete(key);
      return result;
    });

    this.entries.set(key, {
      inflight: inflight as Promise<ResultType<unknown, unknown>>,
      expiresAt: this.expiresAt(options.ttlMs),
    });

    return inflight;
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.entries.clear();
      return;
    }

    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  private expiresAt(ttlMs?: number): number {
    const ttl = ttlMs ?? this.defaultTtlMs;
    return ttl === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Date.now() + ttl;
  }
}
