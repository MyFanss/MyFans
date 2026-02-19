const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
] as const;

export function validate(config: Record<string, unknown>): Record<string, unknown> {
  const missing = requiredEnvVars.filter(
    (key) => !config[key] || String(config[key]).trim() === '',
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. See .env.example for reference.`,
    );
  }

  return config;
}
