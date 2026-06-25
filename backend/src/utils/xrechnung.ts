/**
 * XRechnung 3.0 (UBL 2.1) Generator — EN 16931 konform.
 *
 * Pragmatisch: ein einziges <Invoice> Root für alle Belegtypen, Differenzierung
 * über InvoiceTypeCode (380 = Rechnung, 384 = Korrekturrechnung/Storno).
 * Für Storno wird zusätzlich BillingReference auf das Original gesetzt.
 *
 * KEINE externe XML-Lib — bewusst, um zero-deps zu bleiben (siehe CLAUDE.md).
 * String-Builder mit strikter Escaping-Funktion.
 *
 * Nicht abgedeckt (Phase 2):
 *   - PEPPOL Endpoint-IDs (BT-34, BT-49) — optional, nur wenn PEPPOL-Versand
 *   - Anhänge (PDF embedding für ZUGFeRD-Hybrid)
 *   - Reverse-Charge / EU-Inland-Lieferung (BT-118 codes außer S/E)
 *   - Skonto-Felder (PaymentTerms BT-20) — aktuell nur als Note
 */

import type { Tenant } from '../db/schema/tenants';

type ItemForXml = {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxRate: number | string;
  unit?: string | null;
  serviceDate?: string | null;
  discountAmount?: number | string | null;
  discountPercent?: number | string | null;
  sortOrder: number;
};

type CustomerForXml = {
  type: 'private' | 'business' | string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  taxId?: string | null;
};

export type InvoiceForXml = {
  invoiceNumber: string;
  type: 'invoice' | 'quote' | 'credit_note' | string;
  issueDate: string | null;
  serviceDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  buyerReference?: string | null;     // Leitweg-ID bei B2G; sonst Pflicht-Default
  customer: CustomerForXml | null;
  items: ItemForXml[];
  cancelsInvoice?: { invoiceNumber: string; issueDate: string | null } | null;
};

// ─── Escaping ──────────────────────────────────────────────────────────────
const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
function xml(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);
}

function money(n: number): string {
  // EN 16931: Beträge auf 2 Dezimalstellen, Punkt als Trenner.
  return n.toFixed(2);
}

function qty(n: number): string {
  // Mengen mit bis zu 4 Dezimalstellen, trimmt trailing zeros.
  return Number(n.toFixed(4)).toString();
}

// ─── Unit-Code Mapping (UN/ECE Rec. 20) ────────────────────────────────────
const UNIT_CODE_MAP: Record<string, string> = {
  'h': 'HUR', 'std': 'HUR', 'stunde': 'HUR', 'stunden': 'HUR', 'aw': 'HUR',
  'kg': 'KGM',
  'l': 'LTR', 'liter': 'LTR',
  'm': 'MTR', 'meter': 'MTR',
  'km': 'KMT',
  't': 'TNE', 'tonne': 'TNE',
  'tag': 'DAY', 'tage': 'DAY',
  'pauschal': 'LS', 'pauschale': 'LS',
  'stk': 'C62', 'st': 'C62', 'x': 'C62', 'stück': 'C62',
};
function unitCode(unit: string | null | undefined): string {
  if (!unit) return 'C62';
  return UNIT_CODE_MAP[unit.trim().toLowerCase()] ?? 'C62';
}

// ─── Berechnung pro Zeile ──────────────────────────────────────────────────
// (Duplikat zur PDF-Logik — bewusst lokal gehalten für Klarheit. Refactor in
// utils/invoice-totals.ts wenn dritter Konsument auftaucht.)
function lineTotals(item: ItemForXml, allowNegative: boolean) {
  const q = Number(item.quantity);
  const p = Number(item.unitPrice);
  const gross = q * p;
  const dPct = Number(item.discountPercent ?? 0);
  const dAbs = Number(item.discountAmount ?? 0);
  const discount = gross * (dPct / 100) + dAbs;
  const raw = gross - discount;
  return {
    gross,
    net: allowNegative ? raw : Math.max(0, raw),
    discount,
  };
}

// ─── Validierung ───────────────────────────────────────────────────────────
export class XRechnungError extends Error {}

function assertRequired(invoice: InvoiceForXml, tenant: Tenant) {
  if (!invoice.invoiceNumber) throw new XRechnungError('Rechnungsnummer fehlt');
  if (!invoice.issueDate) throw new XRechnungError('Ausstellungsdatum fehlt (Beleg ist noch DRAFT?)');
  if (!invoice.dueDate) throw new XRechnungError('Fälligkeitsdatum fehlt');
  if (invoice.type === 'quote') throw new XRechnungError('Angebote (quote) sind keine XRechnung');

  if (!tenant.name || !tenant.address || !tenant.city || !tenant.postalCode || !tenant.country) {
    throw new XRechnungError('Tenant-Anschrift unvollständig (Name/Adresse/PLZ/Stadt/Land)');
  }
  if (!tenant.taxId) {
    throw new XRechnungError('Tenant USt-IdNr. oder Steuernummer fehlt (BT-31/BT-32)');
  }

  const c = invoice.customer;
  if (!c) throw new XRechnungError('Kunde fehlt');
  const buyerName = c.companyName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  if (!buyerName) throw new XRechnungError('Kundenname fehlt');
  if (!c.street || !c.city || !c.postalCode) {
    throw new XRechnungError('Kundenanschrift unvollständig (Straße/PLZ/Stadt)');
  }

  if (invoice.items.length === 0) throw new XRechnungError('Belegpositionen fehlen');
}

// ─── Hauptgenerator ────────────────────────────────────────────────────────
export function generateXRechnung(invoice: InvoiceForXml, tenant: Tenant): string {
  assertRequired(invoice, tenant);

  const isStorno = invoice.type === 'credit_note';
  const isSmallBusiness = !!tenant.isSmallBusiness;
  // 380 = Rechnung, 384 = Korrekturrechnung (für Storno).
  const typeCode = isStorno ? '384' : '380';

  // BT-10 BuyerReference ist in DE für B2G Pflicht (Leitweg-ID). Für B2B
  // genügt ein Default — wir füllen mit Kundennummer/UUID-Stub falls leer.
  const buyerRef = invoice.buyerReference || invoice.invoiceNumber;

  // ── Items aggregieren ──
  const sortedItems = [...invoice.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const netByTax = new Map<number, number>();
  let totalNet = 0;
  let totalTax = 0;

  for (const item of sortedItems) {
    const { net } = lineTotals(item, isStorno);
    const rate = isSmallBusiness ? 0 : Number(item.taxRate);
    totalNet += net;
    totalTax += net * (rate / 100);
    netByTax.set(rate, (netByTax.get(rate) ?? 0) + net);
  }
  const totalGross = totalNet + totalTax;

  // ── Customer-Aufbereitung ──
  const c = invoice.customer!;
  const isBusiness = c.type === 'business';
  const buyerName = c.companyName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  const buyerStreet = [c.street, c.houseNumber].filter(Boolean).join(' ');

  // ── XML zusammenbauen ──
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"`);
  lines.push(`         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"`);
  lines.push(`         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`);
  lines.push(`  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>`);
  lines.push(`  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>`);
  lines.push(`  <cbc:ID>${xml(invoice.invoiceNumber)}</cbc:ID>`);
  lines.push(`  <cbc:IssueDate>${xml(invoice.issueDate)}</cbc:IssueDate>`);
  lines.push(`  <cbc:DueDate>${xml(invoice.dueDate)}</cbc:DueDate>`);
  lines.push(`  <cbc:InvoiceTypeCode>${typeCode}</cbc:InvoiceTypeCode>`);
  if (invoice.notes) {
    lines.push(`  <cbc:Note>${xml(invoice.notes)}</cbc:Note>`);
  }
  lines.push(`  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>`);
  lines.push(`  <cbc:BuyerReference>${xml(buyerRef)}</cbc:BuyerReference>`);

  // BT-72 Leistungsdatum (als Period mit Start=End wenn nur ein Datum)
  const svc = invoice.serviceDate || invoice.issueDate;
  if (svc) {
    lines.push(`  <cac:InvoicePeriod>`);
    lines.push(`    <cbc:StartDate>${xml(svc)}</cbc:StartDate>`);
    lines.push(`    <cbc:EndDate>${xml(svc)}</cbc:EndDate>`);
    lines.push(`  </cac:InvoicePeriod>`);
  }

  // BillingReference auf Original-Rechnung bei Storno (BG-3)
  if (isStorno && invoice.cancelsInvoice) {
    lines.push(`  <cac:BillingReference>`);
    lines.push(`    <cac:InvoiceDocumentReference>`);
    lines.push(`      <cbc:ID>${xml(invoice.cancelsInvoice.invoiceNumber)}</cbc:ID>`);
    if (invoice.cancelsInvoice.issueDate) {
      lines.push(`      <cbc:IssueDate>${xml(invoice.cancelsInvoice.issueDate)}</cbc:IssueDate>`);
    }
    lines.push(`    </cac:InvoiceDocumentReference>`);
    lines.push(`  </cac:BillingReference>`);
  }

  // ── Verkäufer (Tenant) ──
  lines.push(`  <cac:AccountingSupplierParty>`);
  lines.push(`    <cac:Party>`);
  lines.push(`      <cac:PartyName><cbc:Name>${xml(tenant.name)}</cbc:Name></cac:PartyName>`);
  lines.push(`      <cac:PostalAddress>`);
  lines.push(`        <cbc:StreetName>${xml(tenant.address)}</cbc:StreetName>`);
  lines.push(`        <cbc:CityName>${xml(tenant.city)}</cbc:CityName>`);
  lines.push(`        <cbc:PostalZone>${xml(tenant.postalCode)}</cbc:PostalZone>`);
  lines.push(`        <cac:Country><cbc:IdentificationCode>${xml(tenant.country)}</cbc:IdentificationCode></cac:Country>`);
  lines.push(`      </cac:PostalAddress>`);
  // BT-31 vs BT-32: USt-IdNr (DE…) → VAT, sonst FC (Steuernummer)
  const taxId = tenant.taxId!.replace(/\s/g, '').toUpperCase();
  const isVatId = /^[A-Z]{2}/.test(taxId);
  lines.push(`      <cac:PartyTaxScheme>`);
  lines.push(`        <cbc:CompanyID>${xml(taxId)}</cbc:CompanyID>`);
  lines.push(`        <cac:TaxScheme><cbc:ID>${isVatId ? 'VAT' : 'FC'}</cbc:ID></cac:TaxScheme>`);
  lines.push(`      </cac:PartyTaxScheme>`);
  lines.push(`      <cac:PartyLegalEntity>`);
  lines.push(`        <cbc:RegistrationName>${xml(tenant.name)}</cbc:RegistrationName>`);
  lines.push(`      </cac:PartyLegalEntity>`);
  lines.push(`      <cac:Contact>`);
  if (tenant.phone) lines.push(`        <cbc:Telephone>${xml(tenant.phone)}</cbc:Telephone>`);
  lines.push(`        <cbc:ElectronicMail>${xml(tenant.email)}</cbc:ElectronicMail>`);
  lines.push(`      </cac:Contact>`);
  lines.push(`    </cac:Party>`);
  lines.push(`  </cac:AccountingSupplierParty>`);

  // ── Käufer (Customer) ──
  lines.push(`  <cac:AccountingCustomerParty>`);
  lines.push(`    <cac:Party>`);
  lines.push(`      <cac:PartyName><cbc:Name>${xml(buyerName)}</cbc:Name></cac:PartyName>`);
  lines.push(`      <cac:PostalAddress>`);
  if (buyerStreet) lines.push(`        <cbc:StreetName>${xml(buyerStreet)}</cbc:StreetName>`);
  lines.push(`        <cbc:CityName>${xml(c.city)}</cbc:CityName>`);
  lines.push(`        <cbc:PostalZone>${xml(c.postalCode)}</cbc:PostalZone>`);
  lines.push(`        <cac:Country><cbc:IdentificationCode>${xml(c.country || 'DE')}</cbc:IdentificationCode></cac:Country>`);
  lines.push(`      </cac:PostalAddress>`);
  // USt-IdNr nur bei Geschäftskunden mit hinterlegter ID
  if (isBusiness && c.taxId) {
    const cTaxId = c.taxId.replace(/\s/g, '').toUpperCase();
    lines.push(`      <cac:PartyTaxScheme>`);
    lines.push(`        <cbc:CompanyID>${xml(cTaxId)}</cbc:CompanyID>`);
    lines.push(`        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`);
    lines.push(`      </cac:PartyTaxScheme>`);
  }
  lines.push(`      <cac:PartyLegalEntity>`);
  lines.push(`        <cbc:RegistrationName>${xml(buyerName)}</cbc:RegistrationName>`);
  lines.push(`      </cac:PartyLegalEntity>`);
  if (c.email) {
    lines.push(`      <cac:Contact>`);
    lines.push(`        <cbc:ElectronicMail>${xml(c.email)}</cbc:ElectronicMail>`);
    lines.push(`      </cac:Contact>`);
  }
  lines.push(`    </cac:Party>`);
  lines.push(`  </cac:AccountingCustomerParty>`);

  // ── Zahlungswege (Banküberweisung) ──
  if (tenant.iban) {
    lines.push(`  <cac:PaymentMeans>`);
    // 58 = SEPA Credit Transfer
    lines.push(`    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>`);
    lines.push(`    <cac:PayeeFinancialAccount>`);
    lines.push(`      <cbc:ID>${xml(tenant.iban.replace(/\s/g, ''))}</cbc:ID>`);
    if (tenant.bankName) lines.push(`      <cbc:Name>${xml(tenant.bankName)}</cbc:Name>`);
    if (tenant.bic) {
      lines.push(`      <cac:FinancialInstitutionBranch>`);
      lines.push(`        <cbc:ID>${xml(tenant.bic)}</cbc:ID>`);
      lines.push(`      </cac:FinancialInstitutionBranch>`);
    }
    lines.push(`    </cac:PayeeFinancialAccount>`);
    lines.push(`  </cac:PaymentMeans>`);
  }

  // ── TaxTotal mit Subtotals pro Steuersatz ──
  lines.push(`  <cac:TaxTotal>`);
  lines.push(`    <cbc:TaxAmount currencyID="EUR">${money(totalTax)}</cbc:TaxAmount>`);
  for (const [rate, net] of [...netByTax.entries()].sort(([a], [b]) => a - b)) {
    const tax = net * (rate / 100);
    // Category: E (exempt) für Kleinunternehmer/0%, sonst S (standard)
    const category = (isSmallBusiness || rate === 0) ? 'E' : 'S';
    lines.push(`    <cac:TaxSubtotal>`);
    lines.push(`      <cbc:TaxableAmount currencyID="EUR">${money(net)}</cbc:TaxableAmount>`);
    lines.push(`      <cbc:TaxAmount currencyID="EUR">${money(tax)}</cbc:TaxAmount>`);
    lines.push(`      <cac:TaxCategory>`);
    lines.push(`        <cbc:ID>${category}</cbc:ID>`);
    lines.push(`        <cbc:Percent>${rate}</cbc:Percent>`);
    if (category === 'E') {
      lines.push(`        <cbc:TaxExemptionReasonCode>VATEX-EU-O</cbc:TaxExemptionReasonCode>`);
      lines.push(`        <cbc:TaxExemptionReason>${xml(isSmallBusiness ? 'Kleinunternehmer gemäß § 19 UStG' : 'Steuerfrei')}</cbc:TaxExemptionReason>`);
    }
    lines.push(`        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`);
    lines.push(`      </cac:TaxCategory>`);
    lines.push(`    </cac:TaxSubtotal>`);
  }
  lines.push(`  </cac:TaxTotal>`);

  // ── Summenblock ──
  lines.push(`  <cac:LegalMonetaryTotal>`);
  lines.push(`    <cbc:LineExtensionAmount currencyID="EUR">${money(totalNet)}</cbc:LineExtensionAmount>`);
  lines.push(`    <cbc:TaxExclusiveAmount currencyID="EUR">${money(totalNet)}</cbc:TaxExclusiveAmount>`);
  lines.push(`    <cbc:TaxInclusiveAmount currencyID="EUR">${money(totalGross)}</cbc:TaxInclusiveAmount>`);
  lines.push(`    <cbc:PayableAmount currencyID="EUR">${money(totalGross)}</cbc:PayableAmount>`);
  lines.push(`  </cac:LegalMonetaryTotal>`);

  // ── Positionen ──
  for (let idx = 0; idx < sortedItems.length; idx++) {
    const item = sortedItems[idx];
    const { net } = lineTotals(item, isStorno);
    const rate = isSmallBusiness ? 0 : Number(item.taxRate);
    const category = (isSmallBusiness || rate === 0) ? 'E' : 'S';
    const code = unitCode(item.unit);

    lines.push(`  <cac:InvoiceLine>`);
    lines.push(`    <cbc:ID>${idx + 1}</cbc:ID>`);
    lines.push(`    <cbc:InvoicedQuantity unitCode="${code}">${qty(Number(item.quantity))}</cbc:InvoicedQuantity>`);
    lines.push(`    <cbc:LineExtensionAmount currencyID="EUR">${money(net)}</cbc:LineExtensionAmount>`);
    if (item.serviceDate) {
      lines.push(`    <cac:InvoicePeriod>`);
      lines.push(`      <cbc:StartDate>${xml(item.serviceDate)}</cbc:StartDate>`);
      lines.push(`      <cbc:EndDate>${xml(item.serviceDate)}</cbc:EndDate>`);
      lines.push(`    </cac:InvoicePeriod>`);
    }
    lines.push(`    <cac:Item>`);
    lines.push(`      <cbc:Name>${xml(item.description.slice(0, 100))}</cbc:Name>`);
    if (item.description.length > 100) {
      lines.push(`      <cbc:Description>${xml(item.description)}</cbc:Description>`);
    }
    lines.push(`      <cac:ClassifiedTaxCategory>`);
    lines.push(`        <cbc:ID>${category}</cbc:ID>`);
    lines.push(`        <cbc:Percent>${rate}</cbc:Percent>`);
    lines.push(`        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`);
    lines.push(`      </cac:ClassifiedTaxCategory>`);
    lines.push(`    </cac:Item>`);
    lines.push(`    <cac:Price>`);
    lines.push(`      <cbc:PriceAmount currencyID="EUR">${money(Number(item.unitPrice))}</cbc:PriceAmount>`);
    lines.push(`    </cac:Price>`);
    lines.push(`  </cac:InvoiceLine>`);
  }

  lines.push(`</Invoice>`);
  return lines.join('\n');
}
