import PDFDocument from 'pdfkit';
import type { Tenant } from '../db/schema/tenants';

type InvoiceForPdf = {
  invoiceNumber: string;
  type: string;
  issueDate: string;
  dueDate?: string | null;
  notes?: string | null;
  customer: {
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string;
  };
  items: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    sortOrder: number;
  }>;
};

const typeLabel: Record<string, string> = {
  invoice: 'RECHNUNG',
  quote: 'ANGEBOT',
  credit_note: 'GUTSCHRIFT',
};

export async function generateInvoicePdf(invoice: InvoiceForPdf, tenant: Tenant): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Sender block (top left)
    doc.fontSize(10).font('Helvetica-Bold').text(tenant.name, 50, 60);
    doc.font('Helvetica');
    if (tenant.address) doc.text(tenant.address);
    if (tenant.city) doc.text(tenant.city);
    if (tenant.taxId) doc.text(`UID: ${tenant.taxId}`);
    if (tenant.email) doc.text(tenant.email);
    if (tenant.phone) doc.text(tenant.phone);

    // Recipient block (right side, aligned with sender)
    const customerName = invoice.customer.companyName ||
      `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim();
    doc.fontSize(10).font('Helvetica').text(customerName, 350, 60, { width: 200 });
    if (invoice.customer.address) doc.text(invoice.customer.address, 350, undefined!, { width: 200 });
    const cityLine = [invoice.customer.postalCode, invoice.customer.city].filter(Boolean).join(' ');
    if (cityLine) doc.text(cityLine, 350, undefined!, { width: 200 });
    if (invoice.customer.country && invoice.customer.country !== 'AT') {
      doc.text(invoice.customer.country, 350, undefined!, { width: 200 });
    }

    // Invoice header
    doc.moveDown(3);
    const docLabel = typeLabel[invoice.type] || 'RECHNUNG';
    doc.fontSize(18).font('Helvetica-Bold').text(docLabel, 50);
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nr.: ${invoice.invoiceNumber}`);
    doc.text(`Datum: ${formatDate(invoice.issueDate)}`);
    if (invoice.dueDate) doc.text(`Fällig: ${formatDate(invoice.dueDate)}`);

    // Items table
    doc.moveDown(1.5);
    const cols = { nr: 50, desc: 72, qty: 300, unit: 360, tax: 430, total: 490 };

    // Table header
    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Nr.', cols.nr, headerY, { width: 20 });
    doc.text('Beschreibung', cols.desc, headerY, { width: 225 });
    doc.text('Menge', cols.qty, headerY, { width: 55, align: 'right' });
    doc.text('Einzelpr.', cols.unit, headerY, { width: 65, align: 'right' });
    doc.text('MwSt%', cols.tax, headerY, { width: 55, align: 'right' });
    doc.text('Gesamt', cols.total, headerY, { width: 55, align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.moveDown(0.3);

    // Items
    doc.font('Helvetica').fontSize(9);
    const sortedItems = [...invoice.items].sort((a, b) => a.sortOrder - b.sortOrder);
    let netTotal = 0;
    const taxGroups: Record<string, number> = {};

    for (let idx = 0; idx < sortedItems.length; idx++) {
      const item = sortedItems[idx];
      const qty = Number(item.quantity);
      const unit = Number(item.unitPrice);
      const tax = Number(item.taxRate);
      const lineNet = qty * unit;
      netTotal += lineNet;
      const taxKey = String(tax);
      taxGroups[taxKey] = (taxGroups[taxKey] || 0) + lineNet * (tax / 100);

      const rowY = doc.y;
      const descHeight = doc.heightOfString(item.description, { width: 225 });
      const rowHeight = Math.max(descHeight, doc.currentLineHeight()) + 4;

      doc.text(String(idx + 1), cols.nr, rowY, { width: 20, lineBreak: false });
      doc.text(item.description, cols.desc, rowY, { width: 225 });
      doc.text(formatNum(qty), cols.qty, rowY, { width: 55, align: 'right', lineBreak: false });
      doc.text(`€ ${formatMoney(unit)}`, cols.unit, rowY, { width: 65, align: 'right', lineBreak: false });
      doc.text(`${formatNum(tax)} %`, cols.tax, rowY, { width: 55, align: 'right', lineBreak: false });
      doc.text(`€ ${formatMoney(lineNet)}`, cols.total, rowY, { width: 55, align: 'right', lineBreak: false });

      doc.y = rowY + rowHeight;
    }

    // Totals block
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(10);
    writeRow(doc, 'Nettobetrag:', `€ ${formatMoney(netTotal)}`);

    let taxTotal = 0;
    for (const [rate, amount] of Object.entries(taxGroups)) {
      taxTotal += amount;
      doc.moveDown(0.3);
      writeRow(doc, `MwSt. ${rate} %:`, `€ ${formatMoney(amount)}`);
    }

    doc.moveDown(0.5);
    doc.moveTo(350, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11);
    writeRow(doc, 'Bruttobetrag:', `€ ${formatMoney(netTotal + taxTotal)}`);

    // Notes
    if (invoice.notes) {
      doc.moveDown(2);
      doc.font('Helvetica').fontSize(9).fillColor('#333333');
      doc.text(invoice.notes, 50, doc.y, { width: 495 });
    }

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#aaaaaa');
    doc.text(`${invoice.invoiceNumber} — Erstellt mit WerkstattClone`, 50, 780, {
      width: 495,
      align: 'center',
    });

    doc.end();
  });
}

function writeRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  const y = doc.y;
  doc.text(label, 350, y, { width: 130, lineBreak: false });
  doc.text(value, 480, y, { width: 65, align: 'right', lineBreak: false });
  doc.y = y + doc.currentLineHeight() + 2;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-AT');
}

function formatMoney(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function formatNum(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',');
}
