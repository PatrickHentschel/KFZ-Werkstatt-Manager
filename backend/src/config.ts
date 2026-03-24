import fs from 'fs';

/**
 * Reads a required secret: env var first, then Docker secrets file at
 * /run/secrets/<secretName>. Throws at startup if neither is present.
 */
function secret(envVar: string, secretName: string): string {
  if (process.env[envVar]) return process.env[envVar]!;
  const file = `/run/secrets/${secretName}`;
  try {
    return fs.readFileSync(file, 'utf-8').trim();
  } catch {
    // file not present — fall through to error
  }
  throw new Error(
    `Missing required config "${envVar}". ` +
      `Set the env var or create ${file} (Docker secret).`,
  );
}

/**
 * Reads an optional secret: env var first, then Docker secrets file.
 * Returns undefined if neither is present.
 */
function optionalSecret(envVar: string, secretName: string): string | undefined {
  if (process.env[envVar]) return process.env[envVar];
  const file = `/run/secrets/${secretName}`;
  try {
    return fs.readFileSync(file, 'utf-8').trim();
  } catch {
    return undefined;
  }
}

export const config = {
  databaseUrl:      secret('DATABASE_URL', 'database_url'),
  jwtAccessSecret:  secret('JWT_ACCESS_SECRET', 'jwt_access_secret'),
  jwtRefreshSecret: secret('JWT_REFRESH_SECRET', 'jwt_refresh_secret'),
  smtpPass:         optionalSecret('SMTP_PASS', 'smtp_pass'),
};
