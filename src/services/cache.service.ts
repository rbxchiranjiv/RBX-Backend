interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();

  // Cache wrapper with TTL
  async wrap<T>(
    key: string,
    ttl: number,
    producerFn: () => Promise<T> | T,
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Generate fresh data
    const data = await producerFn();
    
    // Set in cache
    this.set(key, data, ttl);
    
    return data;
  }

  // Get value from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    
    // Check if expired
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Set value in cache with TTL
  set<T>(key: string, data: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    
    this.cache.set(key, entry);
  }

  // Delete specific key
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }

  // Delete entries matching pattern
  invalidate(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats(): {
    size: number;
    keys: string[];
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(key);
      }
    }
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  // Get multiple keys
  mget<T>(keys: string[]): (T | null)[] {
    return keys.map(key => this.get<T>(key));
  }

  // Set multiple keys
  mset<T>(entries: Array<{ key: string; data: T; ttl: number }>): void {
    for (const { key, data, ttl } of entries) {
      this.set(key, data, ttl);
    }
  }

  // Get TTL for a key
  getTTL(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const remaining = entry.ttl * 1000 - (now - entry.timestamp);
    
    return remaining > 0 ? Math.ceil(remaining / 1000) : null;
  }
}

// Global cache instance
export const cache = new CacheService();

// Cache helper functions
export const cacheWrap = <T>(
  key: string,
  ttl: number,
  producerFn: () => Promise<T> | T,
): Promise<T> => cache.wrap(key, ttl, producerFn);

export const cacheGet = <T>(key: string): T | null => cache.get<T>(key);

export const cacheSet = <T>(key: string, data: T, ttl: number): void => cache.set(key, data, ttl);

export const cacheDelete = (key: string): boolean => cache.delete(key);

export const cacheInvalidate = (pattern: string): void => cache.invalidate(pattern);

export const cacheClear = (): void => cache.clear();
