import { lt, or, and, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { refreshTokens } from '../db/schema';

// Täglich. Kein Bedarf an Sub-Stunden-Frequenz: abgelaufene Tokens schaden niemandem,
// sie validieren ohnehin nicht mehr — wir sparen nur Plattenplatz.
const INTERVAL_MS = 24 * 60 * 60 * 1000;

// Revocation-Records 30 Tage aufheben für Forensik (Token-Reuse-Detection),
// dann wegräumen. Abgelaufene Tokens fliegen sofort.
const REVOKED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

async function runCleanup(): Promise<number> {
  const now = new Date();
  const revokedCutoff = new Date(now.getTime() - REVOKED_RETENTION_MS);

  const deleted = await db
    .delete(refreshTokens)
    .where(or(
      lt(refreshTokens.expiresAt, now),
      and(isNotNull(refreshTokens.revokedAt), lt(refreshTokens.revokedAt, revokedCutoff)),
    ))
    .returning({ id: refreshTokens.id });

  return deleted.length;
}

export function startRefreshTokenCleanupJob() {
  // Sofort einmal beim Start, danach alle 24h.
  runCleanup()
    .then((n) => n > 0 && console.log(`[refresh-token-cleanup] removed ${n} stale tokens`))
    .catch((err) => console.error('[refresh-token-cleanup] initial run failed:', err));

  setInterval(() => {
    runCleanup()
      .then((n) => n > 0 && console.log(`[refresh-token-cleanup] removed ${n} stale tokens`))
      .catch((err) => console.error('[refresh-token-cleanup] failed:', err));
  }, INTERVAL_MS);
}
