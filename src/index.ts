/**
 * drizzle-redis-cache — Redis cache adapters for Drizzle ORM.
 *
 * Import the adapter matching your runtime:
 *   import { IoRedisCache } from "drizzle-redis-cache/ioredis";
 *   import { BunRedisCache } from "drizzle-redis-cache/bun";
 *
 * Or import both from the root (only if both runtimes are available):
 *   import { IoRedisCache, BunRedisCache } from "drizzle-redis-cache";
 */

export type { BunRedisCacheOptions } from "./bun.js";
export { BunRedisCache } from "./bun.js";
export type { IoRedisCacheOptions } from "./ioredis.js";
export { IoRedisCache } from "./ioredis.js";
