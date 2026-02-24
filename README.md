# drizzle-redis-cache

Self-hosted Redis cache adapters for [Drizzle ORM](https://orm.drizzle.team/docs/cache) — no Upstash required.

| Adapter | Runtime | Redis Client |
|---|---|---|
| `IoRedisCache` | Node.js | [ioredis](https://github.com/redis/ioredis) |
| `BunRedisCache` | Bun | Bun native `RedisClient` |

## Install

```bash
# Node.js (ioredis)
npm install drizzle-redis-cache ioredis

# Bun (native)
bun add drizzle-redis-cache
```

## Usage

### ioredis (Node.js)

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { IoRedisCache } from "drizzle-redis-cache/ioredis";

const cache = new IoRedisCache({
  url: process.env.REDIS_URL,
  defaultTtl: 300, // 5 minutes
});

const db = drizzle({ client: pool, schema, cache });

// Graceful shutdown
process.on("SIGTERM", () => cache.disconnect());
```

### Bun native

```ts
import { drizzle } from "drizzle-orm/bun-sql";
import { BunRedisCache } from "drizzle-redis-cache/bun";

const cache = new BunRedisCache({
  url: process.env.REDIS_URL,
  defaultTtl: 300,
});

const db = drizzle({ client, schema, cache });
```

## Options

| Option | Default | Description |
|---|---|---|
| `url` | `REDIS_URL` env | Redis connection URL |
| `defaultTtl` | `300` | Default cache TTL in seconds |
| `prefix` | `"drizzle:tbl"` | Key prefix for table tracking Sets |
| `strategy` | `"all"` | `"all"` caches every query, `"explicit"` requires opt-in |

## How It Works

- **Caching**: Query results are stored in Redis with `SETEX` (atomic set + expire)
- **Table tracking**: Each cached key is tracked in a Redis Set (`drizzle:tbl:<table>`) for distributed-safe invalidation across multiple server instances
- **Invalidation**: On mutation, `SMEMBERS` retrieves all keys for affected tables, then `DEL` removes them in a single batch
- **TTL formats**: Supports `ex` (seconds), `px` (milliseconds), `exat`/`pxat` (Unix timestamps)

## Explicit Caching

```ts
const cache = new IoRedisCache({ strategy: "explicit" });
const db = drizzle({ client, schema, cache });

// Only this query is cached
const users = await db.select().from(users).$withCache();

// This query is NOT cached
const posts = await db.select().from(posts);
```
