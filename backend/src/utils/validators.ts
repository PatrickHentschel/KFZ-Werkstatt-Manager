import { z } from 'zod';

/**
 * DE-Markt Validators (P0).
 * Reusable Zod refinements for tenant + customer data.
 */

// ---------- Tax IDs ----------

const USTIDNR_RE = /^DE[0-9]{9}$/;
// Steuernummer: 10-13 digits, optionally separated by '/' or ' '
const STEUERNR_RE = /^[0-9]{2,3}[ /]?[0-9]{3}[ /]?[0-9]{4,5}$/;

export function isUstIdNr(v: string): boolean {
  return USTIDNR_RE.test(v.trim().toUpperCase().replace(/\s/g, ''));
}

export function isSteuernummer(v: string): boolean {
  const compact = v.trim();
  if (!STEUERNR_RE.test(compact)) return false;
  const digits = compact.replace(/[^0-9]/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

export const taxIdSchema = z.string().trim().refine(
  v => v === '' || isUstIdNr(v) || isSteuernummer(v),
  { message: 'Ungültige USt-IdNr. (DE + 9 Ziffern) oder Steuernummer (10-13 Ziffern)' },
);

// ---------- IBAN (SEPA) ----------

// SEPA country → IBAN length. Source: ECB SEPA reach + ISO 13616 registry.
const SEPA_IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31,
  NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27,
  VA: 22,
};

function ibanMod97(iban: string): number {
  // Move first 4 chars to end, convert letters (A=10..Z=35), compute mod 97 in chunks.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let numeric = '';
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') numeric += ch;
    else if (ch >= 'A' && ch <= 'Z') numeric += String(ch.charCodeAt(0) - 55);
    else return -1;
  }
  // Chunked mod-97 to avoid BigInt or overflow
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder;
}

export function isSepaIban(v: string): boolean {
  const iban = v.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
  const country = iban.slice(0, 2);
  const expectedLength = SEPA_IBAN_LENGTHS[country];
  if (!expectedLength || iban.length !== expectedLength) return false;
  return ibanMod97(iban) === 1;
}

export const ibanSchema = z.string().trim().refine(
  v => v === '' || isSepaIban(v),
  { message: 'Ungültige SEPA-IBAN' },
);

// ---------- BIC ----------

const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export const bicSchema = z.string().trim().refine(
  v => v === '' || BIC_RE.test(v.toUpperCase()),
  { message: 'Ungültige BIC' },
);

// ---------- Postal Code (DE) ----------

const PLZ_DE_RE = /^[0-9]{5}$/;

export function isDePostalCode(v: string): boolean {
  return PLZ_DE_RE.test(v.trim());
}

export const postalCodeDeSchema = z.string().trim().refine(
  v => v === '' || isDePostalCode(v),
  { message: 'PLZ muss 5 Ziffern enthalten' },
);

// ---------- Phone (DE, lenient) ----------

const PHONE_DE_RE = /^(\+49|0)[0-9 \-/()]{6,20}$/;

export const phoneDeSchema = z.string().trim().refine(
  v => v === '' || PHONE_DE_RE.test(v),
  { message: 'Ungültige Telefonnummer (Format: +49 ... oder 0...)' },
);
