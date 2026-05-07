import PDFDocument from 'pdfkit';
import type { Tenant } from '../db/schema/tenants';

type ItemForPdf = {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxRate: number | string;
  unitCost?: number | string | null;
  unit?: string | null;
  serviceDate?: string | null;
  discountAmount?: number | string | null;
  discountPercent?: number | string | null;
  sortOrder: number;
};

type InvoiceForPdf = {
  invoiceNumber: string;
  type: string;
  issueDate: string | null;
  serviceDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  skontoPercent?: number | string | null;
  skontoDays?: number | null;
  customer: {
    salutation?: 'herr' | 'frau' | 'divers' | null;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    city?: string | null;
    postalCode?: string | null;
  } | null;
  items: ItemForPdf[];
  cancelsInvoice?: { invoiceNumber: string; issueDate: string | null } | null;
};

const salutationLabel: Record<string, string> = {
  herr: 'Herr',
  frau: 'Frau',
  // divers: in DE-Briefkonventionen meist ohne Anrede oder mit Vor-/Nachname.
  divers: '',
};

const typeLabel: Record<string, string> = {
  invoice: 'RECHNUNG',
  quote: 'ANGEBOT',
  credit_note: 'STORNORECHNUNG',
};

// Page geometry
const PAGE = {
  marginX: 50,
  rightEdge: 545,
  totalsLabelX: 350,
  totalsValueX: 480,
};

// DE-Konvention: 1.234,56 € (Postfix, Tausenderpunkt, Dezimalkomma).
function eur(n: number | string): string {
  return `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function num(n: number | string, decimals = 2): string {
  return Number(n).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('de-DE');
}

/** §14 (4) Nr. 2 UStG: USt-IdNr. wenn vorhanden, sonst Steuernummer. */
function taxIdLabel(taxId: string | null | undefined): string {
  if (!taxId) return '';
  return taxId.toUpperCase().replace(/\s/g, '').startsWith('DE') ? 'USt-IdNr.' : 'Steuernummer';
}

function lineNet(item: ItemForPdf, allowNegative: boolean): { gross: number; net: number; discount: number } {
  const qty = Number(item.quantity);
  const unit = Number(item.unitPrice);
  const gross = qty * unit;
  const dPct = Number(item.discountPercent ?? 0);
  const dAbs = Number(item.discountAmount ?? 0);
  // Bei Stornorechnung können Mengen negativ sein → kein Floor auf 0.
  const discount = gross * (dPct / 100) + dAbs;
  const raw = gross - discount;
  return { gross, net: allowNegative ? raw : Math.max(0, raw), discount };
}

export async function generateInvoicePdf(invoice: InvoiceForPdf, tenant: Tenant): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE.marginX, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const isSmallBusiness = !!tenant.isSmallBusiness;
    const isStorno = invoice.type === 'credit_note';

    // === Sender block (top left) ===
    doc.fontSize(10).font('Helvetica-Bold').text(tenant.name, PAGE.marginX, 60);
    doc.font('Helvetica');
    if (tenant.address) doc.text(tenant.address);
    const senderCity = [tenant.postalCode, tenant.city].filter(Boolean).join(' ');
    if (senderCity) doc.text(senderCity);
    if (tenant.email) doc.text(tenant.email);
    if (tenant.phone) doc.text(tenant.phone);
    if (tenant.taxId) doc.text(`${taxIdLabel(tenant.taxId)}: ${tenant.taxId}`);

    // === Recipient block (top right) ===
    const customer = invoice.customer;
    if (customer) {
      doc.fontSize(10).font('Helvetica');
      // Anrede in eigener Zeile (DIN 5008): "Herr" / "Frau" über dem Namen.
      const salutation = customer.salutation ? salutationLabel[customer.salutation] : '';
      if (salutation) doc.text(salutation, 350, 60, { width: 200 });

      const customerName = customer.companyName ||
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      if (customerName) {
        if (salutation) doc.text(customerName, 350, undefined!, { width: 200 });
        else doc.text(customerName, 350, 60, { width: 200 });
      }

      const streetLine = [customer.street, customer.houseNumber].filter(Boolean).join(' ');
      if (streetLine) doc.text(streetLine, 350, undefined!, { width: 200 });
      const cityLine = [customer.postalCode, customer.city].filter(Boolean).join(' ');
      if (cityLine) doc.text(cityLine, 350, undefined!, { width: 200 });
    }

    // === Document header ===
    doc.moveDown(3);
    const docLabel = typeLabel[invoice.type] || 'RECHNUNG';
    doc.fontSize(18).font('Helvetica-Bold').text(docLabel, PAGE.marginX);
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nr.: ${invoice.invoiceNumber}`);
    doc.text(`Ausstellungsdatum: ${formatDate(invoice.issueDate)}`);
    // §14 (4) Nr. 6 UStG: Leistungsdatum verpflichtend.
    const serviceDate = invoice.serviceDate || invoice.issueDate;
    doc.text(`Leistungsdatum: ${formatDate(serviceDate)}`);
    if (invoice.dueDate && !isStorno) doc.text(`Fällig: ${formatDate(invoice.dueDate)}`);

    // Storno-Vermerk auf Original-Rechnung
    if (isStorno && invoice.cancelsInvoice) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#444444');
      doc.text(
        `Storno zu Rechnung ${invoice.cancelsInvoice.invoiceNumber}` +
        (invoice.cancelsInvoice.issueDate ? ` vom ${formatDate(invoice.cancelsInvoice.issueDate)}` : '') + '.',
        PAGE.marginX,
        doc.y,
        { width: PAGE.rightEdge - PAGE.marginX },
      );
      doc.fillColor('#000000').font('Helvetica');
    }

    // === Items table ===
    doc.moveDown(1.5);
    const showServiceDateCol = invoice.items.some(i => i.serviceDate && i.serviceDate !== invoice.serviceDate);
    const showDiscountCol = invoice.items.some(i => Number(i.discountPercent ?? 0) > 0 || Number(i.discountAmount ?? 0) > 0);

    // Spalten dynamisch anordnen.
    type Col = { x: number; w: number; align?: 'left' | 'right' };
    let x = PAGE.marginX;
    const cols: Record<string, Col> = {
      nr: { x, w: 22 }, };
    x += 22;
    const descWidth = showServiceDateCol && showDiscountCol ? 175 : showServiceDateCol || showDiscountCol ? 200 : 235;
    cols.desc = { x, w: descWidth };
    x += descWidth;
    if (showServiceDateCol) {
      cols.svc = { x, w: 50, align: 'left' };
      x += 50;
    }
    cols.qty = { x, w: 45, align: 'right' };
    x += 45;
    cols.unit = { x, w: 60, align: 'right' };
    x += 60;
    if (showDiscountCol) {
      cols.disc = { x, w: 45, align: 'right' };
      x += 45;
    }
    if (!isSmallBusiness) {
      cols.tax = { x, w: 40, align: 'right' };
      x += 40;
    }
    cols.total = { x, w: PAGE.rightEdge - x, align: 'right' };

    // Header row
    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Nr.', cols.nr.x, headerY, { width: cols.nr.w });
    doc.text('Beschreibung', cols.desc.x, headerY, { width: cols.desc.w });
    if (cols.svc) doc.text('Datum', cols.svc.x, headerY, { width: cols.svc.w });
    doc.text('Menge', cols.qty.x, headerY, { width: cols.qty.w, align: 'right' });
    doc.text('Einzelpr.', cols.unit.x, headerY, { width: cols.unit.w, align: 'right' });
    if (cols.disc) doc.text('Rabatt', cols.disc.x, headerY, { width: cols.disc.w, align: 'right' });
    if (cols.tax) doc.text('MwSt%', cols.tax.x, headerY, { width: cols.tax.w, align: 'right' });
    doc.text('Netto', cols.total.x, headerY, { width: cols.total.w, align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(PAGE.marginX, doc.y).lineTo(PAGE.rightEdge, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.moveDown(0.3);

    // === Items ===
    doc.font('Helvetica').fontSize(9);
    const sortedItems = [...invoice.items].sort((a, b) => a.sortOrder - b.sortOrder);
    let netTotal = 0;
    // Netto pro Steuersatz aufgeschlüsselt (§14 (4) Nr. 8 UStG).
    const netByTax: Record<string, number> = {};
    const taxByTax: Record<string, number> = {};

    for (let idx = 0; idx < sortedItems.length; idx++) {
      const item = sortedItems[idx];
      const { net } = lineNet(item, isStorno);
      const effectiveTax = isSmallBusiness ? 0 : Number(item.taxRate);
      netTotal += net;
      const taxKey = String(effectiveTax);
      netByTax[taxKey] = (netByTax[taxKey] ?? 0) + net;
      taxByTax[taxKey] = (taxByTax[taxKey] ?? 0) + net * (effectiveTax / 100);

      const rowY = doc.y;
      const descHeight = doc.heightOfString(item.description, { width: cols.desc.w });
      const rowHeight = Math.max(descHeight, doc.currentLineHeight()) + 4;

      doc.text(String(idx + 1), cols.nr.x, rowY, { width: cols.nr.w, lineBreak: false });
      doc.text(item.description, cols.desc.x, rowY, { width: cols.desc.w });
      if (cols.svc) doc.text(formatDate(item.serviceDate), cols.svc.x, rowY, { width: cols.svc.w, lineBreak: false });
      const qtyText = item.unit ? `${num(item.quantity)} ${item.unit}` : num(item.quantity);
      doc.text(qtyText, cols.qty.x, rowY, { width: cols.qty.w, align: 'right', lineBreak: false });
      doc.text(eur(item.unitPrice), cols.unit.x, rowY, { width: cols.unit.w, align: 'right', lineBreak: false });
      if (cols.disc) {
        const dPct = Number(item.discountPercent ?? 0);
        const dAbs = Number(item.discountAmount ?? 0);
        const discText = dPct > 0
          ? `${num(dPct)} %`
          : dAbs > 0
            ? eur(dAbs)
            : '–';
        doc.text(discText, cols.disc.x, rowY, { width: cols.disc.w, align: 'right', lineBreak: false });
      }
      if (cols.tax) doc.text(`${num(effectiveTax)} %`, cols.tax.x, rowY, { width: cols.tax.w, align: 'right', lineBreak: false });
      doc.text(eur(net), cols.total.x, rowY, { width: cols.total.w, align: 'right', lineBreak: false });

      doc.y = rowY + rowHeight;
    }

    // === Totals block ===
    doc.moveDown(0.5);
    doc.moveTo(PAGE.marginX, doc.y).lineTo(PAGE.rightEdge, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(10);

    if (isSmallBusiness) {
      // Kleinunternehmer: nur Gesamtbetrag, keine MwSt-Aufschlüsselung.
      doc.font('Helvetica-Bold').fontSize(11);
      writeRow(doc, 'Gesamtbetrag:', eur(netTotal));
    } else {
      // Netto pro Steuersatz, dann Steuer pro Satz, dann Brutto.
      const sortedRates = Object.keys(netByTax).sort((a, b) => Number(a) - Number(b));
      let taxTotal = 0;
      for (const rate of sortedRates) {
        writeRow(doc, `Netto ${num(rate)} %:`, eur(netByTax[rate]));
        doc.moveDown(0.2);
      }
      for (const rate of sortedRates) {
        const tax = taxByTax[rate];
        taxTotal += tax;
        writeRow(doc, `MwSt. ${num(rate)} %:`, eur(tax));
        doc.moveDown(0.2);
      }
      doc.moveDown(0.3);
      doc.moveTo(PAGE.totalsLabelX, doc.y).lineTo(PAGE.rightEdge, doc.y).strokeColor('#cccccc').stroke();
      doc.strokeColor('#000000');
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(11);
      writeRow(doc, 'Bruttobetrag:', eur(netTotal + taxTotal));
    }

    // === Skonto ===
    const skontoPct = Number(invoice.skontoPercent ?? 0);
    const skontoDays = Number(invoice.skontoDays ?? 0);
    if (skontoPct > 0 && skontoDays > 0) {
      const gross = isSmallBusiness ? netTotal : netTotal + Object.values(taxByTax).reduce((s, v) => s + v, 0);
      const skontoAmount = gross * (skontoPct / 100);
      const afterSkonto = gross - skontoAmount;
      doc.moveDown(0.6);
      doc.font('Helvetica').fontSize(9).fillColor('#444444');
      doc.text(
        `Bei Zahlung innerhalb von ${skontoDays} Tagen gewähren wir ${num(skontoPct)} % Skonto (${eur(skontoAmount)}). Zahlbetrag dann: ${eur(afterSkonto)}.`,
        PAGE.marginX,
        doc.y,
        { width: PAGE.rightEdge - PAGE.marginX },
      );
      doc.fillColor('#000000');
    }

    // === Kleinunternehmer-Hinweis (§19 UStG) ===
    if (isSmallBusiness) {
      doc.moveDown(0.6);
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#444444');
      doc.text(
        'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
        PAGE.marginX,
        doc.y,
        { width: PAGE.rightEdge - PAGE.marginX },
      );
      doc.fillColor('#000000');
    }

    // === Notes ===
    if (invoice.notes) {
      doc.moveDown(1.2);
      doc.font('Helvetica').fontSize(9).fillColor('#333333');
      doc.text(invoice.notes, PAGE.marginX, doc.y, { width: PAGE.rightEdge - PAGE.marginX });
      doc.fillColor('#000000');
    }

    // === Bank details ===
    if (tenant.iban || tenant.bic || tenant.bankName) {
      doc.moveDown(1.2);
      doc.font('Helvetica-Bold').fontSize(9).text('Bankverbindung', PAGE.marginX, doc.y);
      doc.font('Helvetica').fontSize(9);
      if (tenant.bankName) doc.text(`Bank: ${tenant.bankName}`);
      if (tenant.iban) doc.text(`IBAN: ${formatIban(tenant.iban)}`);
      if (tenant.bic) doc.text(`BIC: ${tenant.bic}`);
    }

    // === Footer ===
    doc.fontSize(8).font('Helvetica').fillColor('#aaaaaa');
    doc.text(`${invoice.invoiceNumber} — Erstellt mit WerkstattClone`, PAGE.marginX, 800, {
      width: PAGE.rightEdge - PAGE.marginX,
      align: 'center',
    });

    doc.end();
  });
}

function writeRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  const y = doc.y;
  doc.text(label, PAGE.totalsLabelX, y, { width: 130, lineBreak: false });
  doc.text(value, PAGE.totalsValueX, y, { width: PAGE.rightEdge - PAGE.totalsValueX, align: 'right', lineBreak: false });
  doc.y = y + doc.currentLineHeight() + 2;
}

/** IBAN in 4er-Blöcken zur Lesbarkeit. */
function formatIban(iban: string): string {
  return iban.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}
