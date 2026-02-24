/** biome-ignore-all lint/suspicious/noExplicitAny: intentional any */

/**
 * BunRedisCache — Redis cache adapter for Drizzle ORM using Bun's native RedisClient.
 *
 * Table→key tracking is stored in Redis Sets for distributed-safe invalidation.
 */

import { RedisClient } from "bun";
import { getTableName, is, Table } from "drizzle-orm";
import { Cache } from "drizzle-orm/cache/core";
import type { CacheConfig } from "drizzle-orm/cache/core/types";

export interface BunRedisCacheOptions {
  /** Redis connection URL. Falls back to REDIS_URL env var. */
  url?: string;
  /** Default TTL in seconds. Default: 300 (5 minutes). */
  defaultTtl?: number;
  /** Key prefix for table tracking Sets. Default: "drizzle:tbl". */
  prefix?: string;
  /** Caching strategy. "all" caches every query, "explicit" requires opt-in. Default: "all". */
  strategy?: "explicit" | "all";
}

export class BunRedisCache extends Cache {
  private readonly defaultTtl: number;
  private readonly prefix: string;
  private readonly _strategy: "explicit" | "all";
  private readonly redis: RedisClient;

  constructor(options: BunRedisCacheOptions = {}) {
    super();

    this.defaultTtl = options.defaultTtl ?? 300;
    this.prefix = options.prefix ?? "drizzle:tbl";
    this._strategy = options.strategy ?? "all";
    this.redis = new RedisClient(options.url || process.env.REDIS_URL);
  }

  override strategy(): "explicit" | "all" {
    return this._strategy;
  }

  override async get(
    key: string,
    _tables: string[],
    _isTag: boolean,
    _isAutoInvalidate?: boolean,
  ): Promise<any[] | undefined> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : undefined;
    } catch {
      return undefined;
    }
  }

  override async put(
    key: string,
    response: any,
    tables: string[],
    _isTag: boolean,
    config?: CacheConfig,
  ): Promise<void> {
    try {
      const ttl = this.calculateTtl(config);
      await this.redis.send("SETEX", [key, ttl.toString(), JSON.stringify(response)]);

      for (const table of tables) {
        await this.redis.send("SADD", [`${this.prefix}:${table}`, key]);
      }
    } catch (error) {
      console.error("[drizzle-redis-cache] put failed:", error);
    }
  }

  override async onMutate(params: {
    tags: string | string[];
    tables: string | string[] | Table<any> | Table<any>[];
  }): Promise<void> {
    try {
      const tags = this.normalizeToArray(params.tags);
      const tables = this.normalizeToArray(params.tables);

      const keysToDelete = new Set<string>(tags);

      for (const table of tables) {
        const tableName = is(table, Table) ? getTableName(table) : table;
        const setKey = `${this.prefix}:${tableName}`;
        const keys = (await this.redis.send("SMEMBERS", [setKey])) as string[];

        for (const key of keys) {
          keysToDelete.add(key);
        }
        if (keys.length > 0) keysToDelete.add(setKey);
      }

      if (keysToDelete.size > 0) {
        await this.redis.del(...Array.from(keysToDelete));
      }
    } catch (error) {
      console.error("[drizzle-redis-cache] invalidation failed:", error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.send("QUIT", []);
    } catch (error) {
      console.error("[drizzle-redis-cache] disconnect failed:", error);
    }
  }

  private normalizeToArray(input: string | string[] | Table<any> | Table<any>[]): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.map((item) => (is(item, Table) ? getTableName(item) : (item as string)));
    }
    return [is(input, Table) ? getTableName(input) : (input as string)];
  }

  private calculateTtl(config?: CacheConfig): number {
    if (config?.ex !== undefined) return config.ex;
    if (config?.px !== undefined) return Math.floor(config.px / 1000);
    if (config?.exat !== undefined) {
      return Math.max(0, config.exat - Math.floor(Date.now() / 1000));
    }
    if (config?.pxat !== undefined) {
      return Math.max(0, Math.floor(config.pxat / 1000) - Math.floor(Date.now() / 1000));
    }
    return this.defaultTtl;
  }
}
