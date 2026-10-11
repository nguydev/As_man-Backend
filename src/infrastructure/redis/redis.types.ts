export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  take<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  addToSet(key: string, member: string, ttlSeconds?: number): Promise<void>;
  removeFromSet(key: string, member: string): Promise<void>;
  getSet(key: string): Promise<string[]>;
}
