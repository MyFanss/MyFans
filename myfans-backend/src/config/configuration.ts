export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'myfans',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  cache: {
    creators_ttl: parseInt(process.env.CACHE_TTL_CREATORS ?? '300', 10),
    posts_ttl: parseInt(process.env.CACHE_TTL_POSTS ?? '120', 10),
  },
});
