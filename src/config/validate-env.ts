const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'] as const;

export function validateRequiredEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => {
    const value = process.env[key];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
