import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { invoiceDocuments, type InvoiceDocumentKind } from '../db/schema/invoice_documents';
import { config } from '../config';

/**
 * §147 AO: Belegarchiv. Eine Datei pro (invoiceId, kind), write-once.
 *
 * Pfadschema: <storage>/<tenantId>/<invoiceId>.<ext>
 *   - tenantId-Subdir: nie cross-tenant File-Listings durch fs-Bugs
 *   - invoiceId statt invoiceNumber: UUID immutable, Promote DRAFT → echte
 *     Nummer ändert den Pfad nicht
 *
 * Hash-Verify im Read-Pfad: erkennt Manipulation des persistenten Volumes.
 */

const EXT: Record<InvoiceDocumentKind, string> = {
  pdf: 'pdf',
  xrechnung: 'xml',
};

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function docPath(tenantId: string, invoiceId: string, kind: InvoiceDocumentKind): string {
  return path.join(config.invoiceStoragePath, tenantId, `${invoiceId}.${EXT[kind]}`);
}

export class DocumentTamperError extends Error {}

/**
 * Lesen-oder-Persistieren. Beim ersten Aufruf wird `render` ausgeführt und
 * das Ergebnis in DB + Filesystem write-once abgelegt. Spätere Aufrufe
 * liefern die ursprünglich gespeicherten Bytes — entscheidend für §147 AO,
 * weil Re-Render nach Storno o. ä. abweichen kann.
 */
export async function getOrPersistDocument(
  tenantId: string,
  invoiceId: string,
  kind: InvoiceDocumentKind,
  render: () => Promise<Buffer | string> | Buffer | string,
): Promise<Buffer> {
  const existing = await db.query.invoiceDocuments.findFirst({
    where: and(eq(invoiceDocuments.invoiceId, invoiceId), eq(invoiceDocuments.kind, kind)),
  });
  if (existing) {
    const buf = await fs.readFile(existing.filePath);
    if (sha256(buf) !== existing.contentHash) {
      throw new DocumentTamperError(
        `Hash-Mismatch für ${kind} ${invoiceId}: archivierte Datei wurde manipuliert`,
      );
    }
    return buf;
  }

  // Slow-Path: rendern + persistieren.
  const rendered = await render();
  const buf = Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered, 'utf-8');
  const hash = sha256(buf);
  const filePath = docPath(tenantId, invoiceId, kind);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buf);

  // UNIQUE(invoice_id, kind) serialisiert parallele Persists. Bei Conflict
  // hat eine andere TX bereits geschrieben — wir nehmen deren Version.
  const inserted = await db.insert(invoiceDocuments).values({
    tenantId,
    invoiceId,
    kind,
    filePath,
    contentHash: hash,
    byteSize: buf.length,
  }).onConflictDoNothing().returning();

  if (inserted.length === 0) {
    const winner = await db.query.invoiceDocuments.findFirst({
      where: and(eq(invoiceDocuments.invoiceId, invoiceId), eq(invoiceDocuments.kind, kind)),
    });
    if (!winner) {
      // Sollte unmöglich sein — Conflict ohne winning row.
      throw new Error(`persist race for ${kind} ${invoiceId}: no winner found`);
    }
    return fs.readFile(winner.filePath);
  }

  return buf;
}

/**
 * Read-only Lookup ohne Render-Fallback. Liefert null wenn nicht persistiert.
 * Verifiziert Hash bei Treffer.
 */
export async function readDocument(
  tenantId: string,
  invoiceId: string,
  kind: InvoiceDocumentKind,
): Promise<Buffer | null> {
  const row = await db.query.invoiceDocuments.findFirst({
    where: and(eq(invoiceDocuments.invoiceId, invoiceId), eq(invoiceDocuments.kind, kind)),
  });
  if (!row) return null;
  // Defensive: tenant_id check (RLS sollte das schon abdecken, aber explicit ist billig)
  if (row.tenantId !== tenantId) return null;

  const buf = await fs.readFile(row.filePath);
  if (sha256(buf) !== row.contentHash) {
    throw new DocumentTamperError(
      `Hash-Mismatch für ${kind} ${invoiceId}: archivierte Datei wurde manipuliert`,
    );
  }
  return buf;
}
