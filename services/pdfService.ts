import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, Invoice, CompanyDetails, Payslip, Employee, Receipt, Payment, Vehicle, Expense, Asset, LandedCostSummary, OperatingFund, AppUser } from '../types';
import affinityLogoUrl from '../assets/affinity-logo.svg';
import { buildDriverFundsReportData } from '../utils/driverFunds';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  PRIMARY_DARK: [15, 23, 42] as [number, number, number],
  SECONDARY_GRAY: [71, 85, 105] as [number, number, number],
  LIGHT_GRAY: [100, 116, 139] as [number, number, number],
  BORDER_GRAY: [200, 200, 200] as [number, number, number],
  FILL_LIGHT: [240, 240, 240] as [number, number, number],
  FILL_ALTERNATE: [250, 250, 250] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
};

const FONTS = {
  HELVETICA: 'helvetica',
  BOLD: 'bold',
  NORMAL: 'normal',
};

const FONT_SIZES = {
  XXLARGE: 22,   // Document titles (INVOICE, RECEIPT, etc.) — refined, not blocky
  XLARGE: 11,    // Company name — present but not dominant
  LARGE: 16,     // Hero numbers (totals, key amounts) — the star of the page
  MEDIUM: 12,    // Section labels, "TOTAL DUE:" text
  REGULAR: 10,   // Client name, body text
  SMALL: 9,      // Metadata values, table cell content
  XSMALL: 8,     // Metadata labels, footer text, table headers
  XXSMALL: 7,    // Disclaimer, fine print
};

const LAYOUT = {
  MARGIN_LEFT: 15,
  MARGIN_RIGHT: 195,
  PAGE_WIDTH: 210,
  PAGE_HEIGHT: 297,
  HEADER_Y: 20,
  SEPARATOR_Y: 55,
  FOOTER_Y: 275,
  LINE_WIDTH_THIN: 0.3,
  LINE_WIDTH_REGULAR: 0.5,
  LINE_WIDTH_THICK: 0.8,
  CONTENT_TOP_ON_NEW_PAGE: 24,
};

const TABLE_STYLES = {
  HEAD_FILL: [235, 237, 242] as [number, number, number],  // slightly cooler fill for financial crispness
  CELL_PADDING: 3.5,
  HEAD_PADDING: 4,
  LINE_WIDTH: 0.25,
};

const COLUMN_WIDTHS = {
  DESCRIPTION: 82,
  QUANTITY: 16,
  UNIT_PRICE: 28,
  DISCOUNT: 22,
  AMOUNT: 32,
  EARNINGS_DESC: 70,
  EARNINGS_AMT: 25,
  DEDUCTIONS_DESC: 55,
  DEDUCTIONS_AMT: 30,
};

const MAX_TEXT_LENGTH = 5000;
const MAX_NOTES_LENGTH = 2000;
const FOOTER_BOTTOM_MARGIN = 12;
const FOOTER_CONTENT_MAX_WIDTH = 176;
const FOOTER_DISCLAIMER_MAX_WIDTH = 180;
const TITLE_BLOCK_MAX_WIDTH = 78;
const CENTERED_TITLE_MAX_WIDTH = 120;
const HARDCODED_PDF_LOGO_URL = affinityLogoUrl;
const LIABILITY_DISCLAIMER =
  'Liability Disclaimer: Affinity Logistics acts as a logistics and facilitation service provider for the transportation of vehicles, goods, and cargo. While we take all reasonable care in handling and coordinating shipments, Affinity Logistics shall not be held liable for any loss, damage, or deterioration of goods or vehicles during transit, shipping, handling, storage, or customs processes. Clients are strongly encouraged to obtain appropriate transit or marine insurance for their cargo or vehicles where possible. Any claims relating to damage, loss, or delays must be directed to the relevant shipping line or insurance provider where coverage exists.';

const formatCurrencyAmount = (amount: number, currency: string = 'USD'): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const normalizeDocumentCurrency = (currency?: unknown): 'USD' | 'GBP' =>
  String(currency || '')
    .trim()
    .toUpperCase() === 'GBP'
    ? 'GBP'
    : 'USD';

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class PDFGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PDFGenerationError';
  }
}

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

function sanitizeText(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  // Remove control characters and normalize whitespace
  return str
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function sanitizeNumber(input: unknown): number {
  const num = Number(input);
  return isNaN(num) ? 0 : Math.max(0, num);
}

function sanitizeEmail(input: unknown): string {
  const email = sanitizeText(input);
  // Basic email sanitization
  return email.replace(/[<>"']/g, '').slice(0, 254);
}

function sanitizeUrl(input: unknown): string {
  const value = sanitizeText(input);

  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    return ['http:', 'https:', 'data:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function sanitizeCompany(company: CompanyDetails): CompanyDetails {
  return {
    ...company,
    name: sanitizeText(company.name) || 'Unknown Company',
    address: sanitizeText(company.address),
    contact_email: sanitizeEmail(company.contact_email),
    logo_url: sanitizeUrl(company.logo_url),
    phone: sanitizeText(company.phone),
    website: sanitizeText(company.website),
    tax_id: sanitizeText(company.tax_id),
  };
}

function sanitizeQuote(quote: Quote): Quote {
  return {
    ...quote,
    quote_number: sanitizeText(quote.quote_number) || 'UNKNOWN',
    client_name: sanitizeText(quote.client_name) || 'Unknown Client',
    client_email: sanitizeEmail(quote.client_email),
    client_address: sanitizeText(quote.client_address),
    currency: normalizeDocumentCurrency(quote.currency),
    description: sanitizeText(quote.description),
    status: (sanitizeText(quote.status) || 'draft') as Quote['status'],
    amount_usd: sanitizeNumber(quote.amount_usd),
    items: quote.items?.map(item => ({
      ...item,
      description: sanitizeText(item.description) || 'Item',
      quantity: Math.max(1, sanitizeNumber(item.quantity)),
      unit_price: sanitizeNumber(item.unit_price),
      amount: sanitizeNumber(item.amount),
      discount_percentage: sanitizeNumber(item.discount_percentage),
      discount_amount: sanitizeNumber(item.discount_amount),
      tax_amount: sanitizeNumber(item.tax_amount),
      notes: sanitizeText(item.notes),
    })),
  };
}

function sanitizeInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    invoice_number: sanitizeText(invoice.invoice_number) || 'UNKNOWN',
    client_name: sanitizeText(invoice.client_name) || 'Unknown Client',
    client_email: sanitizeEmail(invoice.client_email),
    client_address: sanitizeText(invoice.client_address),
    currency: normalizeDocumentCurrency(invoice.currency),
    description: sanitizeText(invoice.description),
    notes: sanitizeText(invoice.notes)?.slice(0, MAX_NOTES_LENGTH),
    terms_and_conditions: sanitizeText(invoice.terms_and_conditions)?.slice(0, MAX_NOTES_LENGTH),
    invoice_kind: (sanitizeText(invoice.invoice_kind) || 'Standard') as Invoice['invoice_kind'],
    status: (sanitizeText(invoice.status) || 'draft') as Invoice['status'],
    amount_usd: sanitizeNumber(invoice.amount_usd),
    items: invoice.items?.map(item => ({
      ...item,
      description: sanitizeText(item.description) || 'Item',
      quantity: Math.max(1, sanitizeNumber(item.quantity)),
      unit_price: sanitizeNumber(item.unit_price),
      amount: sanitizeNumber(item.amount),
      discount_percentage: sanitizeNumber(item.discount_percentage),
      discount_amount: sanitizeNumber(item.discount_amount),
      tax_amount: sanitizeNumber(item.tax_amount),
      notes: sanitizeText(item.notes),
    })),
  };
}

function sanitizeReceipt(receipt: Receipt): Receipt {
  return {
    ...receipt,
    receipt_number: sanitizeText(receipt.receipt_number) || 'UNKNOWN',
    client_name: sanitizeText(receipt.client_name) || 'Unknown Client',
    client_email: sanitizeEmail(receipt.client_email),
    client_address: sanitizeText(receipt.client_address),
    currency: normalizeDocumentCurrency(receipt.currency),
    payment_method: sanitizeText(receipt.payment_method) || 'Unspecified',
    reference_number: sanitizeText(receipt.reference_number),
    notes: sanitizeText(receipt.notes)?.slice(0, MAX_NOTES_LENGTH),
    amount_received: sanitizeNumber(receipt.amount_received),
    items: receipt.items?.map(item => ({
      ...item,
      description: sanitizeText(item.description) || 'Payment line',
      quantity: Math.max(1, sanitizeNumber(item.quantity)),
      unit_price: sanitizeNumber(item.unit_price),
      amount: sanitizeNumber(item.amount),
      discount_percentage: sanitizeNumber(item.discount_percentage),
      discount_amount: sanitizeNumber(item.discount_amount),
      tax_amount: sanitizeNumber(item.tax_amount),
      notes: sanitizeText(item.notes),
      invoice_number: sanitizeText(item.invoice_number),
    })),
  };
}

function formatLineDescription(description?: string, notes?: string, invoiceNumber?: string): string {
  const parts = [sanitizeText(description), sanitizeText(notes), invoiceNumber ? `Ref: ${sanitizeText(invoiceNumber)}` : '']
    .filter(Boolean);
  return parts.join('\n');
}

function sanitizePayslip(payslip: Payslip): Payslip {
  const sanitized: Payslip = {
    ...payslip,
    payslip_number: sanitizeText(payslip.payslip_number) || 'UNKNOWN',
    status: (sanitizeText(payslip.status) || 'draft') as Payslip['status'],
    month: Math.max(1, Math.min(12, sanitizeNumber(payslip.month))),
    year: sanitizeNumber(payslip.year) || new Date().getFullYear(),
    base_pay: sanitizeNumber(payslip.base_pay),
    gross_pay: sanitizeNumber(payslip.gross_pay),
    net_pay: sanitizeNumber(payslip.net_pay),
    total_deductions: sanitizeNumber(payslip.total_deductions),
    overtime_pay: sanitizeNumber(payslip.overtime_pay),
    bonus: sanitizeNumber(payslip.bonus),
    allowances: sanitizeNumber(payslip.allowances),
    commission: sanitizeNumber(payslip.commission),
    tax_deduction: sanitizeNumber(payslip.tax_deduction),
    pension_deduction: sanitizeNumber(payslip.pension_deduction),
    health_insurance: sanitizeNumber(payslip.health_insurance),
    other_deductions: sanitizeNumber(payslip.other_deductions),
    payment_method: (sanitizeText(payslip.payment_method) || 'Bank Transfer') as Payslip['payment_method'],
    notes: sanitizeText(payslip.notes)?.slice(0, MAX_NOTES_LENGTH),
  };

  if (payslip.employee) {
    sanitized.employee = {
      ...payslip.employee,
      name: sanitizeText(payslip.employee.name) || 'Unknown Employee',
      position: sanitizeText(payslip.employee.position),
      department: sanitizeText(payslip.employee.department),
      national_id: sanitizeText(payslip.employee.national_id),
      bank_name: sanitizeText(payslip.employee.bank_name),
      bank_account: sanitizeText(payslip.employee.bank_account),
    };
  }

  return sanitized;
}

// ============================================================================
// PDF BUILDER CLASS
// ============================================================================

class PDFBuilder {
  private doc: jsPDF;
  private company: CompanyDetails;
  private filename: string;
  private logoDataPromise?: Promise<{ dataUrl: string; width: number; height: number } | null>;
  private headerBottomY: number = LAYOUT.SEPARATOR_Y;
  private sectionTopY: number = 65;
  private metadataBottomY: number = 65;
  private clientBottomY: number = 80;

  private getFooterLines(options?: { additionalText?: string }): string[][] {
    const { doc, company } = this;
    const disclaimerLines = doc.splitTextToSize(LIABILITY_DISCLAIMER, FOOTER_DISCLAIMER_MAX_WIDTH);
    const taglineLines = doc.splitTextToSize('Delivery is our DNA - Titumei Tinosvitsa', 150);
    const companyNameLines = doc.splitTextToSize(company.name, 150);
    const contactInfo = `${company.contact_email}${company.phone ? ` | ${company.phone}` : ''} | Generated: ${new Date().toLocaleDateString()}`;
    const contactLines = doc.splitTextToSize(contactInfo, FOOTER_CONTENT_MAX_WIDTH);
    const additionalLines = options?.additionalText
      ? doc.splitTextToSize(options.additionalText, FOOTER_CONTENT_MAX_WIDTH)
      : [];

    return [disclaimerLines, taglineLines, companyNameLines, contactLines, additionalLines];
  }

  getFooterStartY(options?: { additionalText?: string }): number {
    const [disclaimerLines, taglineLines, companyNameLines, contactLines, additionalLines] = this.getFooterLines(options);
    const footerHeight =
      4 +
      disclaimerLines.length * 3.3 +
      3 +
      taglineLines.length * 4.5 +
      companyNameLines.length * 4.5 +
      contactLines.length * 3.8 +
      (additionalLines.length > 0 ? additionalLines.length * 3.8 + 2 : 0);

    return Math.max(220, LAYOUT.PAGE_HEIGHT - FOOTER_BOTTOM_MARGIN - footerHeight);
  }

  ensureContentSpace(requiredHeight: number, preferredY: number): number {
    const footerStartY = this.getFooterStartY();

    if (preferredY + requiredHeight <= footerStartY) {
      return preferredY;
    }

    this.doc.addPage();
    return LAYOUT.CONTENT_TOP_ON_NEW_PAGE;
  }

  constructor(company: CompanyDetails, filename: string) {
    this.doc = new jsPDF();
    this.company = company;
    this.filename = filename;
    this.doc.setFont('helvetica', 'normal');
  }

  // -------------------------------------------------------------------------
  // Header & Footer
  // -------------------------------------------------------------------------

  private async loadLogoData(logoUrl?: string, opacity: number = 1): Promise<{ dataUrl: string; width: number; height: number } | null> {
    if (!logoUrl) {
      return null;
    }

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();

        if (/^https?:/i.test(logoUrl)) {
          img.crossOrigin = 'anonymous';
        }

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load logo image'));
        img.src = logoUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width || 1;
      canvas.height = image.naturalHeight || image.height || 1;

      const context = canvas.getContext('2d');
      if (!context) {
        return null;
      }

      context.globalAlpha = opacity;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      };
    } catch {
      return null;
    }
  }

  private async getLogoData(): Promise<{ dataUrl: string; width: number; height: number } | null> {
    if (!this.logoDataPromise) {
      this.logoDataPromise = this.loadLogoData(HARDCODED_PDF_LOGO_URL);
    }

    return this.logoDataPromise;
  }

  async addLogoWatermark(): Promise<this> {
    const watermarkLogo = await this.loadLogoData(HARDCODED_PDF_LOGO_URL, 0.07);

    if (!watermarkLogo) {
      return this;
    }

    const { doc } = this;
    const maxWidth = 115;
    const maxHeight = 115;
    const widthScale = maxWidth / Math.max(watermarkLogo.width, 1);
    const heightScale = maxHeight / Math.max(watermarkLogo.height, 1);
    const scale = Math.min(widthScale, heightScale, 1);
    const watermarkWidth = watermarkLogo.width * scale;
    const watermarkHeight = watermarkLogo.height * scale;
    const x = (LAYOUT.PAGE_WIDTH - watermarkWidth) / 2;
    const y = (LAYOUT.PAGE_HEIGHT - watermarkHeight) / 2 - 8;

    doc.addImage(watermarkLogo.dataUrl, 'PNG', x, y, watermarkWidth, watermarkHeight);

    return this;
  }

  async addHeader(): Promise<this> {
    const { doc, company } = this;
    const logo = await this.getLogoData();
    const hasLogo = Boolean(logo);
    const maxLogoWidth = 30;
    const maxLogoHeight = 18;
    const logoWidth = logo ? Math.min(maxLogoWidth, (logo.width / Math.max(logo.height, 1)) * maxLogoHeight) : 0;
    const logoHeight = logo ? Math.min(maxLogoHeight, (logo.height / Math.max(logo.width, 1)) * maxLogoWidth) : 0;
    const textStartX = hasLogo ? LAYOUT.MARGIN_LEFT + logoWidth + 8 : LAYOUT.MARGIN_LEFT;
    const contentWidth = hasLogo ? 78 : 95;
    const lineHeight = 4.2;
    const nameLineHeight = 5.2;

    if (logo) {
      doc.addImage(logo.dataUrl, 'PNG', LAYOUT.MARGIN_LEFT, 12, logoWidth, logoHeight);
    }

    // Company Name — restrained size so the document title commands attention
    doc.setFontSize(FONT_SIZES.XLARGE);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.setCharSpace(0.4);
    const companyNameLines = doc.splitTextToSize(company.name.toUpperCase(), contentWidth);
    doc.text(companyNameLines, textStartX, LAYOUT.HEADER_Y);
    doc.setCharSpace(0);

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    const logoBottomY = hasLogo ? 12 + logoHeight : 0;
    const nameBottomY = LAYOUT.HEADER_Y + companyNameLines.length * nameLineHeight;
    let yPos = Math.max(logoBottomY, nameBottomY) + 3;

    const writeWrappedLine = (value?: string) => {
      const trimmedValue = value?.trim();

      if (!trimmedValue) {
        return;
      }

      const wrappedLines = doc.splitTextToSize(trimmedValue, contentWidth);
      doc.text(wrappedLines, textStartX, yPos);
      yPos += wrappedLines.length * lineHeight + 0.8;
    };

    company.address
      .split(',')
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(writeWrappedLine);

    if (company.phone) {
      writeWrappedLine(`Tel: ${company.phone}`);
    }

    writeWrappedLine(`Email: ${company.contact_email}`);

    if (company.website) {
      writeWrappedLine(company.website);
    }

    if (company.tax_id) {
      writeWrappedLine(`Tax ID: ${company.tax_id}`);
    }

    this.headerBottomY = yPos;

    return this;
  }

  addFooter(options?: { additionalText?: string; fontSize?: number }): this {
    const { doc, company } = this;
    const [disclaimerLines, taglineLines, companyNameLines, contactLines, additionalLines] = this.getFooterLines(options);
    const disclaimerStartY = this.getFooterStartY(options);
    const disclaimerLineHeight = 3.3;
    const centerX = LAYOUT.PAGE_WIDTH / 2;

    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_THIN);
    doc.line(LAYOUT.MARGIN_LEFT, disclaimerStartY - 4, LAYOUT.MARGIN_RIGHT, disclaimerStartY - 4);

    doc.setFontSize(FONT_SIZES.XXSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.text(disclaimerLines, centerX, disclaimerStartY, {
      align: 'center',
      maxWidth: FOOTER_DISCLAIMER_MAX_WIDTH,
    });

    let yPos = disclaimerStartY + disclaimerLines.length * disclaimerLineHeight + 3;

    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text(taglineLines, centerX, yPos, { align: 'center' });
    yPos += taglineLines.length * 4.5;

    const fontSize = options?.fontSize || FONT_SIZES.XSMALL;
    doc.setFontSize(fontSize);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(companyNameLines, centerX, yPos, { align: 'center' });
    yPos += companyNameLines.length * 4.5;

    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.text(contactLines, centerX, yPos, { align: 'center' });
    yPos += contactLines.length * 3.8;

    if (additionalLines.length > 0) {
      yPos += 2;
      doc.text(additionalLines, centerX, yPos, { align: 'center' });
    }

    return this;
  }

  // -------------------------------------------------------------------------
  // Title & Separator
  // -------------------------------------------------------------------------

  addTitle(
    text: string,
    options?: {
      align?: 'center' | 'right';
      maxWidth?: number;
      fontSize?: number;
      charSpace?: number;
      lineHeight?: number;
      topY?: number;
      headerGap?: number;
    }
  ): this {
    const { doc } = this;
    const align = options?.align || 'center';
    const maxWidth = options?.maxWidth || (align === 'center' ? CENTERED_TITLE_MAX_WIDTH : TITLE_BLOCK_MAX_WIDTH);
    const isCompactTitle = text.length > 16;
    const defaultFontSize = align === 'center'
      ? (isCompactTitle ? 16 : 18)
      : (isCompactTitle ? 19 : FONT_SIZES.XXLARGE);
    const titleFontSize = options?.fontSize || defaultFontSize;
    const titleCharSpace = options?.charSpace ?? (align === 'center' ? (isCompactTitle ? 0.2 : 0.6) : (isCompactTitle ? 0.8 : 2.0));
    const titleLineHeight = options?.lineHeight || (align === 'center' ? (isCompactTitle ? 6.3 : 6.9) : (isCompactTitle ? 7.4 : 8.2));
    const titleTopY = options?.topY || (align === 'center' ? Math.max(this.headerBottomY + (options?.headerGap ?? 6), 30) : 24);
    const titleLines = doc.splitTextToSize(text, maxWidth);
    const titleBottomY = titleTopY + (titleLines.length - 1) * titleLineHeight;
    const separatorY = Math.max(this.headerBottomY + 4, titleBottomY + 7, LAYOUT.SEPARATOR_Y);
    const titleX = align === 'center' ? LAYOUT.PAGE_WIDTH / 2 : LAYOUT.MARGIN_RIGHT;

    doc.setFontSize(titleFontSize);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.setCharSpace(titleCharSpace);
    doc.text(titleLines, titleX, titleTopY, { align, maxWidth });
    doc.setCharSpace(0);

    // Separator line
    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_REGULAR);
    doc.line(LAYOUT.MARGIN_LEFT, separatorY, LAYOUT.MARGIN_RIGHT, separatorY);

    this.sectionTopY = separatorY + 12;
    this.metadataBottomY = this.sectionTopY;
    this.clientBottomY = this.sectionTopY + 15;

    return this;
  }

  addInvoiceBanner(invoice: Invoice): this {
    const { doc } = this;
    const statusColor =
      invoice.status === 'Paid' ? [22, 163, 74] as [number, number, number] :
      invoice.status === 'Overdue' ? [220, 38, 38] as [number, number, number] :
      invoice.status === 'Sent' ? [37, 99, 235] as [number, number, number] :
      COLORS.PRIMARY_DARK;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(125, 33, 70, 16, 3, 3, 'F');

    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.setCharSpace(0.8);
    doc.text('STATUS', 132, 39);
    doc.text('TOTAL DUE', 132, 46);
    doc.setCharSpace(0);

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...statusColor);
    doc.text(invoice.status.toUpperCase(), 192, 39, { align: 'right' });

    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(formatCurrencyAmount(invoice.amount_usd, invoice.currency || 'USD'), 192, 46, { align: 'right' });

    return this;
  }

  // -------------------------------------------------------------------------
  // Metadata Sections
  // -------------------------------------------------------------------------

  addMetadataSection(
    labels: string[],
    values: string[],
    x: number,
    startY: number = this.sectionTopY
  ): this {
    const { doc } = this;
    let currentY = Math.max(startY, this.sectionTopY);
    const valueWidth = 52;

    labels.forEach((label, index) => {
      const valueLines = doc.splitTextToSize(values[index] || '', valueWidth);

      // Label: small, light, recedes — value is the star
      doc.setFontSize(FONT_SIZES.XSMALL);
      doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
      doc.setTextColor(...COLORS.LIGHT_GRAY);
      doc.text(label, x, currentY);

      // Value: slightly larger, bold, dark — commands attention
      doc.setFontSize(FONT_SIZES.SMALL);
      doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
      doc.setTextColor(...COLORS.PRIMARY_DARK);
      doc.text(valueLines, LAYOUT.MARGIN_RIGHT, currentY, { align: 'right' });

      currentY += Math.max(6.5, valueLines.length * 4.2 + 1.5);
    });

    this.metadataBottomY = currentY - 1.5;

    return this;
  }

  addClientSection(
    title: string,
    name: string,
    email?: string,
    address?: string,
    additionalInfo?: { label: string; value: string }[],
    startY: number = this.sectionTopY
  ): this {
    const { doc } = this;
    const safeStartY = Math.max(startY, this.sectionTopY);

    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.text(title, LAYOUT.MARGIN_LEFT, safeStartY);

    doc.setFontSize(FONT_SIZES.REGULAR);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    const nameLines = doc.splitTextToSize(name, 78);
    doc.text(nameLines, LAYOUT.MARGIN_LEFT, safeStartY + 8);

    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);

    let yPos = safeStartY + 8 + nameLines.length * 4.8 + 2;
    const contentWidth = 78;
    const lineHeight = 4.5;

    const writeWrappedLine = (value?: string) => {
      const trimmedValue = value?.trim();

      if (!trimmedValue) {
        return;
      }

      const wrappedLines = doc.splitTextToSize(trimmedValue, contentWidth);
      doc.text(wrappedLines, LAYOUT.MARGIN_LEFT, yPos);
      yPos += wrappedLines.length * lineHeight + 1;
    };

    if (email) {
      writeWrappedLine(email);
    }

    if (address) {
      const addressLines = address
        .split(',')
        .map(line => line.trim())
        .filter(Boolean);

      addressLines.forEach(line => {
        writeWrappedLine(line);
      });
    }

    if (additionalInfo) {
      additionalInfo.forEach(info => {
        writeWrappedLine(`${info.label}: ${info.value}`);
      });
    }

    this.clientBottomY = yPos;

    return this;
  }

  // -------------------------------------------------------------------------
  // Tables
  // -------------------------------------------------------------------------

  addItemsTable(
    data: (string | number)[][],
    startY: number = Math.max(this.metadataBottomY, this.clientBottomY) + 10
  ): { finalY: number } {
    const { doc } = this;

    autoTable(doc, {
      startY,
      head: [['DESCRIPTION', 'QTY', 'UNIT PRICE', 'DISC %', 'AMOUNT']],
      body: data.map(row => row.map(cell => String(cell))),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - this.getFooterStartY() + 6 },
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.SMALL,
        cellPadding: TABLE_STYLES.HEAD_PADDING,
      },
      styles: {
        fontSize: FONT_SIZES.SMALL,
        cellPadding: TABLE_STYLES.CELL_PADDING,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        0: { cellWidth: COLUMN_WIDTHS.DESCRIPTION },
        1: { cellWidth: COLUMN_WIDTHS.QUANTITY, halign: 'center' },
        2: { cellWidth: COLUMN_WIDTHS.UNIT_PRICE, halign: 'right' },
        3: { cellWidth: COLUMN_WIDTHS.DISCOUNT, halign: 'right' },
        4: { cellWidth: COLUMN_WIDTHS.AMOUNT, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: COLORS.FILL_ALTERNATE,
      },
    });

    return { finalY: (doc as any).lastAutoTable?.finalY || startY + 30 };
  }

  addEarningsTable(
    data: [string, string][],
    startY: number
  ): { finalY: number } {
    const { doc } = this;

    autoTable(doc, {
      startY,
      head: [['EARNINGS', 'AMOUNT']],
      body: data,
      theme: 'plain',
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.SMALL,
        cellPadding: TABLE_STYLES.CELL_PADDING,
      },
      styles: {
        fontSize: FONT_SIZES.SMALL,
        cellPadding: 3,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        0: { cellWidth: COLUMN_WIDTHS.EARNINGS_DESC },
        1: { cellWidth: COLUMN_WIDTHS.EARNINGS_AMT, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: LAYOUT.MARGIN_LEFT, right: 115, bottom: LAYOUT.PAGE_HEIGHT - this.getFooterStartY() + 6 },
      alternateRowStyles: {
        fillColor: COLORS.FILL_ALTERNATE,
      },
    });

    return { finalY: (doc as any).lastAutoTable?.finalY || startY + 40 };
  }

  addDeductionsTable(
    data: [string, string][],
    startY: number
  ): { finalY: number } {
    const { doc } = this;

    autoTable(doc, {
      startY,
      head: [['DEDUCTIONS', 'AMOUNT']],
      body: data,
      theme: 'plain',
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.SMALL,
        cellPadding: TABLE_STYLES.CELL_PADDING,
      },
      styles: {
        fontSize: FONT_SIZES.SMALL,
        cellPadding: 3,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        0: { cellWidth: COLUMN_WIDTHS.DEDUCTIONS_DESC },
        1: { cellWidth: COLUMN_WIDTHS.DEDUCTIONS_AMT, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 115, right: LAYOUT.MARGIN_LEFT, bottom: LAYOUT.PAGE_HEIGHT - this.getFooterStartY() + 6 },
      alternateRowStyles: {
        fillColor: COLORS.FILL_ALTERNATE,
      },
    });

    return { finalY: (doc as any).lastAutoTable?.finalY || startY + 40 };
  }

  // -------------------------------------------------------------------------
  // Total Sections
  // -------------------------------------------------------------------------

  addTotalSection(amount: number, label: string = 'TOTAL', currency: 'USD' | 'GBP' = 'USD'): this {
    const { doc } = this;
    const finalY = this.ensureContentSpace(36, (doc as any).lastAutoTable?.finalY || 140);
    const labelText = `${label}:`;
    const amountText = formatCurrencyAmount(amount, currency);

    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_REGULAR);
    doc.line(130, finalY + 8, LAYOUT.MARGIN_RIGHT, finalY + 8);

    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.setFontSize(FONT_SIZES.LARGE);
    const amountWidth = doc.getTextWidth(amountText);

    doc.setFontSize(FONT_SIZES.MEDIUM);
    const labelWidth = doc.getTextWidth(labelText);
    const availableLabelWidth = 192 - 133 - amountWidth - 8;
    const shouldStack = labelWidth > availableLabelWidth;

    if (shouldStack) {
      doc.text(labelText, 133, finalY + 17);
      doc.setFontSize(FONT_SIZES.LARGE);
      doc.text(amountText, 192, finalY + 25, { align: 'right' });
      doc.setLineWidth(LAYOUT.LINE_WIDTH_THICK);
      doc.line(130, finalY + 29, LAYOUT.MARGIN_RIGHT, finalY + 29);
      return this;
    }

    doc.text(labelText, 133, finalY + 18);
    doc.setFontSize(FONT_SIZES.LARGE);
    doc.text(amountText, 192, finalY + 18, { align: 'right' });

    doc.setLineWidth(LAYOUT.LINE_WIDTH_THICK);
    doc.line(130, finalY + 22, LAYOUT.MARGIN_RIGHT, finalY + 22);

    return this;
  }

  addInvoiceTotalSection(invoice: Invoice): this {
    const { doc } = this;
    const finalY = this.ensureContentSpace(38, (doc as any).lastAutoTable?.finalY || 140);

    // Subtotal line
    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_THIN);
    doc.line(130, finalY + 8, LAYOUT.MARGIN_RIGHT, finalY + 8);

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('Subtotal:', 133, finalY + 15);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(formatCurrencyAmount(invoice.amount_usd, invoice.currency || 'USD'), 192, finalY + 15, { align: 'right' });

    // Total Due
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_REGULAR);
    doc.line(130, finalY + 19, LAYOUT.MARGIN_RIGHT, finalY + 19);

    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('TOTAL DUE:', 133, finalY + 28);

    doc.setFontSize(FONT_SIZES.LARGE);
    doc.text(formatCurrencyAmount(invoice.amount_usd, invoice.currency || 'USD'), 192, finalY + 28, { align: 'right' });

    doc.setLineWidth(LAYOUT.LINE_WIDTH_THICK);
    doc.line(130, finalY + 32, LAYOUT.MARGIN_RIGHT, finalY + 32);

    return this;
  }

  addPayslipSummary(payslip: Payslip): this {
    const { doc } = this;
    const earningsEndY = (doc as any).lastAutoTable?.finalY || 165;
    const summaryY = this.ensureContentSpace(42, earningsEndY + 15);

    // Summary border box
    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_REGULAR);
    doc.rect(LAYOUT.MARGIN_LEFT, summaryY, 180, 35);

    // Gross Pay
    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.setCharSpace(0.6);
    doc.text('GROSS PAY', 35, summaryY + 12);
    doc.setCharSpace(0);
    doc.setFontSize(FONT_SIZES.LARGE);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(`$${payslip.gross_pay.toLocaleString()}`, 35, summaryY + 25);

    // Deductions
    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.setCharSpace(0.6);
    doc.text('DEDUCTIONS', 100, summaryY + 12);
    doc.setCharSpace(0);
    doc.setFontSize(FONT_SIZES.LARGE);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(`-$${payslip.total_deductions.toLocaleString()}`, 100, summaryY + 25);

    // Net Pay (highlighted)
    doc.setFillColor(...COLORS.FILL_LIGHT);
    doc.rect(145, summaryY, 50, 35, 'F');
    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.setCharSpace(0.6);
    doc.text('NET PAY', 170, summaryY + 12, { align: 'center' });
    doc.setCharSpace(0);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(`$${payslip.net_pay.toLocaleString()}`, 170, summaryY + 26, { align: 'center' });

    return this;
  }

  // -------------------------------------------------------------------------
  // Notes Section
  // -------------------------------------------------------------------------

  addNotes(notes: string | undefined, yPos: number): this {
    if (!notes) return this;

    const { doc } = this;
    const noteLines = doc.splitTextToSize(notes, 170);
    const boxHeight = Math.max(18, 10 + noteLines.length * 5);
    const safeY = this.ensureContentSpace(boxHeight + 6, yPos - 5) + 5;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(LAYOUT.MARGIN_LEFT, safeY - 5, 180, boxHeight, 3, 3, 'F');

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('Notes:', LAYOUT.MARGIN_LEFT, safeY);

    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text(noteLines, LAYOUT.MARGIN_LEFT, safeY + 6);

    return this;
  }

  // -------------------------------------------------------------------------
  // Terms Section
  // -------------------------------------------------------------------------

  addTerms(type: 'quote' | 'invoice', finalY: number, showPaymentTerms: boolean = true, customTerms?: string): this {
    const { doc } = this;
    const baseY = finalY + 38;

    const termBlocks =
      type === 'quote'
        ? [
            '1. Quote is valid for the period specified above',
            '2. Prices are shown in the selected currency and exclude applicable taxes unless stated',
            '3. Payment terms apply as agreed upon acceptance',
          ]
        : customTerms
          ? doc.splitTextToSize(customTerms, 180)
          : showPaymentTerms
            ? [
                '1. Payment is due by the date specified above',
                '2. Please include invoice number with your payment',
              ]
            : [];
    const requiredHeight = 14 + termBlocks.length * 6;
    const safeTitleY = this.ensureContentSpace(requiredHeight, baseY);

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(type === 'quote' ? 'Terms & Conditions' : 'Payment Terms', LAYOUT.MARGIN_LEFT, safeTitleY);

    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);

    if (termBlocks.length > 0) {
      doc.text(termBlocks, LAYOUT.MARGIN_LEFT, safeTitleY + 8);
    }

    return this;
  }

  // -------------------------------------------------------------------------
  // Payment Method Section
  // -------------------------------------------------------------------------

  addPaymentMethod(payslip: Payslip): this {
    const { doc } = this;

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('PAYMENT METHOD', 125, 95);

    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.text(payslip.payment_method, 125, 102);

    if (payslip.employee?.bank_name) {
      doc.text(payslip.employee.bank_name, 125, 108);
    }
    if (payslip.employee?.bank_account) {
      const maskedAccount = `Account: ****${payslip.employee.bank_account.slice(-4)}`;
      doc.text(maskedAccount, 125, 114);
    }

    return this;
  }

  // -------------------------------------------------------------------------
  // Raw Document Access
  // -------------------------------------------------------------------------

  getDocument(): jsPDF {
    return this.doc;
  }

  getContentStartY(): number {
    return Math.max(this.metadataBottomY, this.clientBottomY) + 15;
  }

  // -------------------------------------------------------------------------
  // Generate Output
  // -------------------------------------------------------------------------

  async generate(): Promise<Blob> {
    return this.doc.output('blob');
  }

  generateAndDownload(): void {
    this.doc.save(this.filename);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const generateQuotePDF = async (
  quote: Quote,
  company: CompanyDetails
): Promise<Blob> => {
  try {
    // Input validation
    if (!quote || !company) {
      throw new PDFGenerationError(
        'Quote and company details are required',
        'MISSING_REQUIRED_DATA'
      );
    }

    // Sanitize inputs
    const sanitizedQuote = sanitizeQuote(quote);
    const sanitizedCompany = sanitizeCompany(company);

    const filename = `Quote_${sanitizedQuote.quote_number}.pdf`;
    const builder = new PDFBuilder(sanitizedCompany, filename);

    // Build PDF
    await builder.addLogoWatermark();
    (await builder.addHeader())
      .addTitle('QUOTATION', { align: 'right' })
      .addMetadataSection(
        ['Quote Number:', 'Issue Date:', 'Valid Until:', 'Currency:', 'Status:'],
        [
          sanitizedQuote.quote_number,
          new Date(sanitizedQuote.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          sanitizedQuote.valid_until
            ? new Date(sanitizedQuote.valid_until).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A',
          sanitizedQuote.currency || 'USD',
          sanitizedQuote.status.toUpperCase(),
        ],
        125,
        65
      )
      .addClientSection(
        'BILL TO:',
        sanitizedQuote.client_name,
        sanitizedQuote.client_email,
        sanitizedQuote.client_address
      );

    // Items table
    const tableData =
      sanitizedQuote.items && sanitizedQuote.items.length > 0
        ? sanitizedQuote.items.map(item => [
            formatLineDescription(item.description, item.notes),
            item.quantity.toString(),
            formatCurrencyAmount(item.unit_price, sanitizedQuote.currency || 'USD'),
            `${(item.discount_percentage || 0).toFixed(2)}%`,
            formatCurrencyAmount(item.amount + (item.tax_amount || 0), sanitizedQuote.currency || 'USD'),
          ])
        : [
            [
              sanitizedQuote.description || 'Professional Services',
              '1',
              formatCurrencyAmount(sanitizedQuote.amount_usd, sanitizedQuote.currency || 'USD'),
              '0.00%',
              formatCurrencyAmount(sanitizedQuote.amount_usd, sanitizedQuote.currency || 'USD'),
            ],
          ];

    builder.addItemsTable(tableData);
    builder.addTotalSection(sanitizedQuote.amount_usd, 'TOTAL', sanitizedQuote.currency || 'USD');
    builder.addTerms('quote', (builder.getDocument() as any).lastAutoTable?.finalY || 140);
    builder.addFooter();

    return await builder.generate();
  } catch (error) {
    if (error instanceof PDFGenerationError) {
      throw error;
    }
    throw new PDFGenerationError(
      'Failed to generate quote PDF',
      'GENERATION_FAILED',
      error as Error
    );
  }
};

export const generateInvoicePDF = async (
  invoice: Invoice,
  company: CompanyDetails
): Promise<Blob> => {
  try {
    // Input validation
    if (!invoice || !company) {
      throw new PDFGenerationError(
        'Invoice and company details are required',
        'MISSING_REQUIRED_DATA'
      );
    }

    // Sanitize inputs
    const sanitizedInvoice = sanitizeInvoice(invoice);
    const sanitizedCompany = sanitizeCompany(company);

    const filename = `Invoice_${sanitizedInvoice.invoice_number}.pdf`;
    const builder = new PDFBuilder(sanitizedCompany, filename);

    // Build PDF
    await builder.addLogoWatermark();
    (await builder.addHeader())
      .addTitle('INVOICE', { align: 'right' })
      .addInvoiceBanner(sanitizedInvoice)
      .addMetadataSection(
        ['Invoice Number:', 'Invoice Type:', 'Issue Date:', 'Due Date:', 'Currency:', 'Status:', ...(sanitizedInvoice.batch ? ['Batch:'] : [])],
        [
          sanitizedInvoice.invoice_number,
          sanitizedInvoice.invoice_kind || 'Standard',
          new Date(sanitizedInvoice.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          new Date(sanitizedInvoice.due_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          sanitizedInvoice.currency || 'USD',
          sanitizedInvoice.status.toUpperCase(),
          ...(sanitizedInvoice.batch ? [sanitizedInvoice.batch] : []),
        ],
        125,
        65
      )
      .addClientSection(
        'BILL TO:',
        sanitizedInvoice.client_name,
        sanitizedInvoice.client_email,
        sanitizedInvoice.client_address
      );

    // Items table
    const tableData =
      sanitizedInvoice.items && sanitizedInvoice.items.length > 0
        ? sanitizedInvoice.items.map(item => [
            formatLineDescription(item.description, item.notes),
            item.quantity.toString(),
            formatCurrencyAmount(item.unit_price, sanitizedInvoice.currency || 'USD'),
            `${(item.discount_percentage || 0).toFixed(2)}%`,
            formatCurrencyAmount(item.amount + (item.tax_amount || 0), sanitizedInvoice.currency || 'USD'),
          ])
        : [
            [
              sanitizedInvoice.description || 'Professional Services',
              '1',
              formatCurrencyAmount(sanitizedInvoice.amount_usd, sanitizedInvoice.currency || 'USD'),
              '0.00%',
              formatCurrencyAmount(sanitizedInvoice.amount_usd, sanitizedInvoice.currency || 'USD'),
            ],
          ];

    builder.addItemsTable(tableData);
    builder.addInvoiceTotalSection(sanitizedInvoice);
    const notesY = ((builder.getDocument() as any).lastAutoTable?.finalY || 140) + 42;
    builder.addNotes(sanitizedInvoice.notes, notesY);

    const showPaymentTerms = sanitizedInvoice.status !== 'Paid';
    builder.addTerms(
      'invoice',
      sanitizedInvoice.notes ? notesY + 18 : ((builder.getDocument() as any).lastAutoTable?.finalY || 140),
      showPaymentTerms,
      sanitizedInvoice.terms_and_conditions
    );
    builder.addFooter();

    return await builder.generate();
  } catch (error) {
    if (error instanceof PDFGenerationError) {
      throw error;
    }
    throw new PDFGenerationError(
      'Failed to generate invoice PDF',
      'GENERATION_FAILED',
      error as Error
    );
  }
};

export const generatePayslipPDF = async (
  payslip: Payslip,
  company: CompanyDetails
): Promise<Blob> => {
  try {
    // Input validation
    if (!payslip || !company) {
      throw new PDFGenerationError(
        'Payslip and company details are required',
        'MISSING_REQUIRED_DATA'
      );
    }

    // Sanitize inputs
    const sanitizedPayslip = sanitizePayslip(payslip);
    const sanitizedCompany = sanitizeCompany(company);

    const filename = `Payslip_${sanitizedPayslip.payslip_number}.pdf`;
    const builder = new PDFBuilder(sanitizedCompany, filename);

    // Build PDF
    await builder.addLogoWatermark();
    (await builder.addHeader()).addTitle('PAYSLIP');

    // Metadata section
    builder.addMetadataSection(
      ['Payslip #:', 'Pay Period:', 'Payment Date:', 'Status:'],
      [
        sanitizedPayslip.payslip_number,
        new Date(sanitizedPayslip.year, sanitizedPayslip.month - 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
        sanitizedPayslip.payment_date
          ? new Date(sanitizedPayslip.payment_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Pending',
        sanitizedPayslip.status.toUpperCase(),
      ],
      125,
      65
    );

    // Employee details
    const additionalInfo: { label: string; value: string }[] = [];
    if (sanitizedPayslip.employee?.position) {
      additionalInfo.push({ label: 'Position', value: sanitizedPayslip.employee.position });
    }
    if (sanitizedPayslip.employee?.department) {
      additionalInfo.push({ label: 'Department', value: sanitizedPayslip.employee.department });
    }
    if (sanitizedPayslip.employee?.national_id) {
      additionalInfo.push({ label: 'ID', value: sanitizedPayslip.employee.national_id });
    }

    builder.addClientSection(
      'EMPLOYEE DETAILS',
      sanitizedPayslip.employee?.name || 'Unknown Employee',
      undefined,
      undefined,
      additionalInfo
    );

    // Payment method
    builder.addPaymentMethod(sanitizedPayslip);

    // Earnings table
    const earningsData: [string, string][] = [['Base Pay', `$${sanitizedPayslip.base_pay.toLocaleString()}`]];

    if (sanitizedPayslip.overtime_pay > 0) {
      earningsData.push(['Overtime Pay', `$${sanitizedPayslip.overtime_pay.toLocaleString()}`]);
    }
    if (sanitizedPayslip.bonus > 0) {
      earningsData.push(['Bonus', `$${sanitizedPayslip.bonus.toLocaleString()}`]);
    }
    if (sanitizedPayslip.allowances > 0) {
      earningsData.push(['Allowances', `$${sanitizedPayslip.allowances.toLocaleString()}`]);
    }
    if (sanitizedPayslip.commission > 0) {
      earningsData.push(['Commission', `$${sanitizedPayslip.commission.toLocaleString()}`]);
    }

    const { finalY: earningsEndY } = builder.addEarningsTable(earningsData, 125);

    // Deductions table
    const deductionsData: [string, string][] = [];

    if (sanitizedPayslip.tax_deduction > 0) {
      deductionsData.push(['Tax Deduction', `-$${sanitizedPayslip.tax_deduction.toLocaleString()}`]);
    }
    if (sanitizedPayslip.pension_deduction > 0) {
      deductionsData.push(['Pension', `-$${sanitizedPayslip.pension_deduction.toLocaleString()}`]);
    }
    if (sanitizedPayslip.health_insurance > 0) {
      deductionsData.push(['Health Insurance', `-$${sanitizedPayslip.health_insurance.toLocaleString()}`]);
    }
    if (sanitizedPayslip.other_deductions > 0) {
      deductionsData.push(['Other Deductions', `-$${sanitizedPayslip.other_deductions.toLocaleString()}`]);
    }

    if (deductionsData.length > 0) {
      builder.addDeductionsTable(deductionsData, 125);
    }

    // Summary
    builder.addPayslipSummary(sanitizedPayslip);

    // Notes
    const summaryY = Math.max(earningsEndY, (builder.getDocument() as any).lastAutoTable?.finalY || earningsEndY);
    if (sanitizedPayslip.notes) {
      builder.addNotes(sanitizedPayslip.notes, summaryY + 50);
    }

    // Footer with additional text
    builder.addFooter({
      additionalText: 'This is a computer-generated payslip and does not require a signature.',
      fontSize: FONT_SIZES.XXSMALL,
    });

    return await builder.generate();
  } catch (error) {
    if (error instanceof PDFGenerationError) {
      throw error;
    }
    throw new PDFGenerationError(
      'Failed to generate payslip PDF',
      'GENERATION_FAILED',
      error as Error
    );
  }
};

// ============================================================================
// BACKWARD COMPATIBILITY (for code that expects immediate download)
// ============================================================================

export const generateQuotePDFAndDownload = async (
  quote: Quote,
  company: CompanyDetails
): Promise<void> => {
  const blob = await generateQuotePDF(quote, company);
  downloadBlob(blob, `Quote_${quote.quote_number}.pdf`);
};

export const generateInvoicePDFAndDownload = async (
  invoice: Invoice,
  company: CompanyDetails
): Promise<void> => {
  const blob = await generateInvoicePDF(invoice, company);
  downloadBlob(blob, `Invoice_${invoice.invoice_number}.pdf`);
};

export const generatePayslipPDFAndDownload = async (
  payslip: Payslip,
  company: CompanyDetails
): Promise<void> => {
  const blob = await generatePayslipPDF(payslip, company);
  downloadBlob(blob, `Payslip_${payslip.payslip_number}.pdf`);
};

export const generateVehicleStatementPDF = async (
  vehicle: Vehicle,
  expenses: Expense[],
  company: CompanyDetails
): Promise<Blob> => {
  const sanitizedCompany = sanitizeCompany(company);
  const builder = new PDFBuilder(
    sanitizedCompany,
    `Statement_${sanitizeText(vehicle.make_model).replace(/\s+/g, '_') || 'Vehicle'}.pdf`
  );
  const doc = builder.getDocument();
  const safeVehicleName = sanitizeText(vehicle.make_model) || 'Unknown Vehicle';
  const safeVin = sanitizeText(vehicle.vin_number) || 'N/A';
  const safeStatus = sanitizeText(vehicle.status) || 'Unknown';
  const purchasePriceGbp = sanitizeNumber(vehicle.purchase_price_gbp);
  const purchasePriceUsd = purchasePriceGbp * 1.27;
  const sanitizedExpenses = [...expenses]
    .map((expense) => ({
      ...expense,
      description: sanitizeText(expense.description) || 'Expense',
      category: sanitizeText(expense.category) || 'Other',
      location: sanitizeText(expense.location) || 'N/A',
      currency: sanitizeText(expense.currency) || 'USD',
      amount: sanitizeNumber(expense.amount),
      exchange_rate_to_usd: sanitizeNumber(expense.exchange_rate_to_usd) || 1,
      created_at: sanitizeText(expense.created_at) || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const totalExpensesUsd = sanitizedExpenses.reduce(
    (sum, expense) => sum + expense.amount * (expense.exchange_rate_to_usd || 1),
    0
  );
  const totalLandedCostUsd = purchasePriceUsd + totalExpensesUsd;

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('VEHICLE STATEMENT', {
      fontSize: 15,
      charSpace: 0.15,
      lineHeight: 6.1,
      headerGap: 8,
    })
    .addMetadataSection(
      ['Statement Date:', 'Expense Count:', 'Purchase Price:', 'Total Expenses:', 'Total Landed Cost:'],
      [
        new Date().toLocaleDateString(),
        String(sanitizedExpenses.length),
        `GBP ${purchasePriceGbp.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        formatCurrencyAmount(totalExpensesUsd, 'USD'),
        formatCurrencyAmount(totalLandedCostUsd, 'USD'),
      ],
      125,
      65
    )
    .addClientSection(
      'VEHICLE:',
      safeVehicleName,
      undefined,
      undefined,
      [
        { label: 'VIN', value: safeVin },
        { label: 'Status', value: safeStatus },
      ],
      65
    );

  const tableStartY = Math.max(120, ((doc as any).lastAutoTable?.finalY || 0) + 10);

  if (sanitizedExpenses.length > 0) {
    autoTable(doc, {
      startY: tableStartY,
      head: [['DATE', 'CATEGORY', 'DESCRIPTION', 'LOCATION', 'AMOUNT', 'USD EQUIV.']],
      body: sanitizedExpenses.map((expense) => [
        new Date(expense.created_at).toLocaleDateString(),
        expense.category,
        expense.description,
        expense.location,
        `${expense.currency} ${expense.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        formatCurrencyAmount(expense.amount * (expense.exchange_rate_to_usd || 1), 'USD'),
      ]),
      theme: 'plain',
      margin: {
        left: LAYOUT.MARGIN_LEFT,
        right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT,
        bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6,
      },
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.SMALL,
      },
      styles: {
        fontSize: FONT_SIZES.SMALL,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 24 },
        2: { cellWidth: 56 },
        3: { cellWidth: 22 },
        4: { cellWidth: 34, halign: 'right' },
        5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: COLORS.FILL_ALTERNATE,
      },
    });
  } else {
    const emptyStateY = builder.ensureContentSpace(16, tableStartY);
    doc.setFontSize(FONT_SIZES.REGULAR);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('No expenses recorded for this vehicle yet.', LAYOUT.MARGIN_LEFT, emptyStateY);
  }

  let currentY = ((doc as any).lastAutoTable?.finalY || tableStartY) + 14;
  currentY = builder.ensureContentSpace(34, currentY);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 28, 3, 3, 'F');
  doc.setFontSize(FONT_SIZES.SMALL);
  doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
  doc.setTextColor(...COLORS.SECONDARY_GRAY);
  doc.text('PURCHASE PRICE (USD)', LAYOUT.MARGIN_LEFT + 5, currentY + 9);
  doc.text('TOTAL EXPENSES (USD)', LAYOUT.MARGIN_LEFT + 65, currentY + 9);
  doc.text('LANDED COST (USD)', LAYOUT.MARGIN_LEFT + 132, currentY + 9);

  doc.setFontSize(FONT_SIZES.MEDIUM);
  doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
  doc.setTextColor(...COLORS.PRIMARY_DARK);
  doc.text(formatCurrencyAmount(purchasePriceUsd, 'USD'), LAYOUT.MARGIN_LEFT + 5, currentY + 20);
  doc.text(formatCurrencyAmount(totalExpensesUsd, 'USD'), LAYOUT.MARGIN_LEFT + 65, currentY + 20);
  doc.text(formatCurrencyAmount(totalLandedCostUsd, 'USD'), LAYOUT.MARGIN_LEFT + 132, currentY + 20);

  const categoryTotals = sanitizedExpenses.reduce((acc, expense) => {
    const usdAmount = expense.amount * (expense.exchange_rate_to_usd || 1);
    acc[expense.category] = (acc[expense.category] || 0) + usdAmount;
    return acc;
  }, {} as Record<string, number>);

  const categoryRows = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([category, total]) => [category, formatCurrencyAmount(total, 'USD')]);

  if (categoryRows.length > 0) {
    currentY = builder.ensureContentSpace(18, currentY + 40);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('EXPENSE BREAKDOWN', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['CATEGORY', 'USD TOTAL']],
      body: categoryRows,
      theme: 'plain',
      margin: {
        left: LAYOUT.MARGIN_LEFT,
        right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT,
        bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6,
      },
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.SMALL,
      },
      styles: {
        fontSize: FONT_SIZES.SMALL,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: COLORS.FILL_ALTERNATE,
      },
    });
  }

  builder.addFooter({
    additionalText: `Vehicle statement for ${safeVehicleName}`,
    fontSize: FONT_SIZES.XXSMALL,
  });

  return builder.generate();
};

export const generateVehicleStatementPDFAndDownload = async (
  vehicle: Vehicle,
  expenses: Expense[],
  company: CompanyDetails
): Promise<void> => {
  const blob = await generateVehicleStatementPDF(vehicle, expenses, company);
  downloadBlob(
    blob,
    `Statement_${sanitizeText(vehicle.make_model).replace(/\s+/g, '_') || 'Vehicle'}_${new Date().toISOString().split('T')[0]}.pdf`
  );
};

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Delay revocation so the browser has time to start the download
  // before the object URL is invalidated (required for Firefox/Safari).
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

// Receipt PDF Generation
export const generateReceiptPDF = async (
  receipt: Receipt,
  company: CompanyDetails
): Promise<Blob> => {
  const sanitizedReceipt = sanitizeReceipt(receipt);
  const sanitizedCompany = sanitizeCompany(company);
  const builder = new PDFBuilder(sanitizedCompany, `Receipt_${sanitizedReceipt.receipt_number}.pdf`);

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('RECEIPT')
    .addMetadataSection(
      ['Receipt #:', 'Payment Date:', 'Payment Method:', 'Reference:', 'Currency:', ...(sanitizedReceipt.batch ? ['Batch:'] : [])],
      [
        sanitizedReceipt.receipt_number,
        new Date(sanitizedReceipt.payment_date).toLocaleDateString(),
        sanitizedReceipt.payment_method,
        sanitizedReceipt.reference_number || 'N/A',
        sanitizedReceipt.currency,
        ...(sanitizedReceipt.batch ? [sanitizedReceipt.batch] : []),
      ],
      125,
      65
    )
    .addClientSection(
      'RECEIVED FROM:',
      sanitizedReceipt.client_name,
      sanitizedReceipt.client_email,
      sanitizedReceipt.client_address
    );

  const receiptItems =
    sanitizedReceipt.items && sanitizedReceipt.items.length > 0
      ? sanitizedReceipt.items.map(item => [
          formatLineDescription(item.description, item.notes, item.invoice_number),
          item.quantity.toString(),
          formatCurrencyAmount(item.unit_price, sanitizedReceipt.currency),
          `${(item.discount_percentage || 0).toFixed(2)}%`,
          formatCurrencyAmount(item.amount + (item.tax_amount || 0), sanitizedReceipt.currency),
        ])
      : [
          [
            sanitizedReceipt.notes || 'Payment received',
            '1',
            formatCurrencyAmount(sanitizedReceipt.amount_received, sanitizedReceipt.currency),
            '0.00%',
            formatCurrencyAmount(sanitizedReceipt.amount_received, sanitizedReceipt.currency),
          ],
        ];

  builder.addItemsTable(receiptItems);
  builder.addTotalSection(sanitizedReceipt.amount_received, 'AMOUNT RECEIVED', sanitizedReceipt.currency);

  if (sanitizedReceipt.notes) {
    const notesY = ((builder.getDocument() as any).lastAutoTable?.finalY || 140) + 24;
    builder.addNotes(sanitizedReceipt.notes, notesY);
  }

  builder.addFooter({
    additionalText: 'Official receipt for recorded client payment.',
    fontSize: FONT_SIZES.XXSMALL,
  });

  return builder.generate();
};

export const generateReceiptPDFAndDownload = async (
  receipt: Receipt,
  company: CompanyDetails
): Promise<void> => {
  const blob = await generateReceiptPDF(receipt, company);
  downloadBlob(blob, `Receipt_${receipt.receipt_number}.pdf`);
};

// Statement PDF Generation
export interface StatementData {
  client_name: string;
  client_email?: string;
  client_address?: string;
  invoices: Invoice[];
  payments: Payment[];
  paymentCurrencyMap?: Record<string, 'USD' | 'GBP'>;
  startDate: string;
  endDate: string;
}

const inferPaymentCurrency = (
  payment: Payment,
  invoiceCurrencyMap: Map<string, 'USD' | 'GBP'>,
  paymentCurrencyMap: Record<string, 'USD' | 'GBP'> | undefined,
  fallbackCurrency: 'USD' | 'GBP'
): 'USD' | 'GBP' => {
  return payment.currency || paymentCurrencyMap?.[payment.id] || invoiceCurrencyMap.get(payment.reference_id) || fallbackCurrency;
};

const getAllocatedAmountForInvoice = (
  payment: Payment,
  invoiceId: string,
  invoiceCurrency: 'USD' | 'GBP',
  fallbackCurrency: 'USD' | 'GBP'
): number => {
  return (payment.allocations || [])
    .filter(allocation => allocation.invoice_id === invoiceId)
    .reduce((sum, allocation) => {
      const allocationCurrency = allocation.currency || payment.currency || fallbackCurrency;
      if (allocationCurrency !== invoiceCurrency) {
        return sum;
      }

      return sum + sanitizeNumber(allocation.amount_allocated);
    }, 0);
};

export const generateStatementPDF = async (
  statement: StatementData,
  company: CompanyDetails
): Promise<Blob> => {
  const sanitizedCompany = sanitizeCompany(company);
  const sanitizedInvoices = statement.invoices.map(sanitizeInvoice);
  const clientName = sanitizeText(statement.client_name) || 'Unknown Client';
  const clientEmail = sanitizeEmail(statement.client_email);
  const clientAddress = sanitizeText(statement.client_address);
  const builder = new PDFBuilder(sanitizedCompany, `Statement_${clientName.replace(/\s+/g, '_')}.pdf`);
  const doc = builder.getDocument();

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('STATEMENT')
    .addMetadataSection(
      ['Period From:', 'Period To:', 'Invoice Count:', 'Payment Count:'],
      [
        new Date(statement.startDate).toLocaleDateString(),
        new Date(statement.endDate).toLocaleDateString(),
        String(sanitizedInvoices.length),
        String(statement.payments.length),
      ],
      125,
      65
    )
    .addClientSection('CLIENT:', clientName, clientEmail, clientAddress);

  const invoiceCurrencyMap = new Map<string, 'USD' | 'GBP'>();
  sanitizedInvoices.forEach(invoice => {
    invoiceCurrencyMap.set(invoice.invoice_number, invoice.currency || 'USD');
    invoiceCurrencyMap.set(invoice.id, invoice.currency || 'USD');
  });
  const invoicePaymentMap = new Map<string, number>();
  sanitizedInvoices.forEach(invoice => {
    const paidAmount = statement.payments.reduce((sum, payment) => {
      const paymentCurrency = inferPaymentCurrency(
        payment,
        invoiceCurrencyMap,
        statement.paymentCurrencyMap,
        sanitizedInvoices[0]?.currency || 'USD'
      );
      const hasAllocations = (payment.allocations?.length || 0) > 0;
      if (hasAllocations) {
        return sum + getAllocatedAmountForInvoice(payment, invoice.id, invoice.currency || 'USD', sanitizedInvoices[0]?.currency || 'USD');
      }

      const matchesInvoice =
        payment.reference_id === invoice.invoice_number ||
        payment.reference_id === invoice.id;

      if (!matchesInvoice || paymentCurrency !== (invoice.currency || 'USD')) {
        return sum;
      }

      return sum + sanitizeNumber(payment.amount_usd);
    }, 0);

    invoicePaymentMap.set(invoice.id, paidAmount);
  });

  let currentY = Math.max((doc as any).lastAutoTable?.finalY || 0, 120);

  if (sanitizedInvoices.length > 0) {
    currentY = builder.ensureContentSpace(18, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('INVOICES', LAYOUT.MARGIN_LEFT, currentY);
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      head: [['INVOICE #', 'ISSUE DATE', 'DUE DATE', 'STATUS', 'AMOUNT', 'OWING BALANCE']],
      body: sanitizedInvoices.map(invoice => [
        invoice.invoice_number,
        new Date(invoice.created_at).toLocaleDateString(),
        invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A',
        invoice.status,
        formatCurrencyAmount(invoice.amount_usd, invoice.currency || 'USD'),
        formatCurrencyAmount(
          Math.max(0, invoice.amount_usd - (invoicePaymentMap.get(invoice.id) || 0)),
          invoice.currency || 'USD'
        ),
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.SMALL,
      },
      styles: {
        fontSize: FONT_SIZES.SMALL,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: COLORS.FILL_ALTERNATE,
      },
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 12;
  }

  if (statement.payments.length > 0) {
    currentY = builder.ensureContentSpace(18, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('PAYMENTS', LAYOUT.MARGIN_LEFT, currentY);
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      head: [['REFERENCE', 'DATE', 'METHOD', 'AMOUNT']],
      body: statement.payments.map(payment => {
        const paymentCurrency = inferPaymentCurrency(
          payment,
          invoiceCurrencyMap,
          statement.paymentCurrencyMap,
          sanitizedInvoices[0]?.currency || 'USD'
        );
        return [
          sanitizeText(payment.reference_id) || payment.id.slice(0, 8),
          new Date(payment.date).toLocaleDateString(),
          sanitizeText(payment.method) || 'Unspecified',
          formatCurrencyAmount(sanitizeNumber(payment.amount_usd), paymentCurrency),
        ];
      }),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.SMALL,
      },
      styles: {
        fontSize: FONT_SIZES.SMALL,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        3: { halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: COLORS.FILL_ALTERNATE,
      },
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;
  }

  const supportedCurrencies: ('USD' | 'GBP')[] = ['USD', 'GBP'];
  const summaryRows = supportedCurrencies
    .map(currency => {
      const totalInvoiced = sanitizedInvoices
        .filter(invoice => (invoice.currency || 'USD') === currency)
        .reduce((sum, invoice) => sum + invoice.amount_usd, 0);
      const totalPaid = statement.payments.reduce((sum, payment) => {
        const paymentCurrency = inferPaymentCurrency(
          payment,
          invoiceCurrencyMap,
          statement.paymentCurrencyMap,
          sanitizedInvoices[0]?.currency || 'USD'
        );
        return paymentCurrency === currency ? sum + sanitizeNumber(payment.amount_usd) : sum;
      }, 0);

      if (totalInvoiced === 0 && totalPaid === 0) {
        return null;
      }

      return {
        currency,
        totalInvoiced,
        totalPaid,
        balanceDue: totalInvoiced - totalPaid,
      };
    })
    .filter(Boolean) as Array<{ currency: 'USD' | 'GBP'; totalInvoiced: number; totalPaid: number; balanceDue: number }>;

  const summaryHeight = Math.max(34, 12 + summaryRows.length * 16);
  currentY = builder.ensureContentSpace(summaryHeight + 10, currentY);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, summaryHeight, 3, 3, 'F');
  doc.setFontSize(FONT_SIZES.MEDIUM);
  doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
  doc.setTextColor(...COLORS.PRIMARY_DARK);
  doc.text('ACCOUNT SUMMARY', LAYOUT.MARGIN_LEFT + 5, currentY + 8);

  let summaryY = currentY + 16;
  summaryRows.forEach(row => {
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.text(row.currency, LAYOUT.MARGIN_LEFT + 5, summaryY);

    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.text(`Invoiced ${formatCurrencyAmount(row.totalInvoiced, row.currency)}`, LAYOUT.MARGIN_LEFT + 25, summaryY);
    doc.text(`Paid ${formatCurrencyAmount(row.totalPaid, row.currency)}`, 128, summaryY);

    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    const balanceColor: [number, number, number] = row.balanceDue > 0 ? [220, 38, 38] : [16, 185, 129];
    doc.setTextColor(...balanceColor);
    doc.text(`Owing ${formatCurrencyAmount(row.balanceDue, row.currency)}`, LAYOUT.MARGIN_RIGHT - 5, summaryY, {
      align: 'right',
    });
    doc.setTextColor(...COLORS.PRIMARY_DARK);

    summaryY += 12;
  });

  builder.addFooter({
    additionalText: `Statement dated ${new Date().toLocaleDateString()}`,
    fontSize: FONT_SIZES.XXSMALL,
  });

  return builder.generate();
};

export const generateStatementPDFAndDownload = async (
  statement: StatementData,
  company: CompanyDetails
): Promise<void> => {
  const blob = await generateStatementPDF(statement, company);
  downloadBlob(blob, `Statement_${statement.client_name.replace(/\s+/g, '_')}.pdf`);
};

// ============================================================================
// EXPENSES REPORT PDF
// ============================================================================

export const generateExpensesReportPDF = async (
  expenses: Expense[],
  company: CompanyDetails,
  vehicles: Vehicle[],
  options?: { dateFrom?: string; dateTo?: string }
): Promise<Blob> => {
  const sanitizedCompany = sanitizeCompany(company);
  const dateStr = new Date().toISOString().split('T')[0];
  const builder = new PDFBuilder(sanitizedCompany, `Expenses_Report_${dateStr}.pdf`);
  const doc = builder.getDocument();

  const vehicleMap = new Map(vehicles.map(v => [v.id, sanitizeText(v.make_model) || 'Unknown']));

  const sanitizedExpenses = [...expenses]
    .map(e => ({
      ...e,
      description: sanitizeText(e.description) || 'Expense',
      category: sanitizeText(e.category) || 'Other',
      location: sanitizeText(e.location) || 'N/A',
      currency: sanitizeText(e.currency) || 'USD',
      amount: sanitizeNumber(e.amount),
      exchange_rate_to_usd: sanitizeNumber(e.exchange_rate_to_usd) || 1,
      created_at: sanitizeText(e.created_at) || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const totalUsd = sanitizedExpenses.reduce((sum, e) => sum + e.amount * e.exchange_rate_to_usd, 0);

  const periodLabel = options?.dateFrom || options?.dateTo
    ? `${options.dateFrom || 'Beginning'} – ${options.dateTo || 'Present'}`
    : 'All time';

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('EXPENSES REPORT', {
      fontSize: 15,
      charSpace: 0.15,
      lineHeight: 6.1,
      headerGap: 10,
    })
    .addMetadataSection(
      ['Report Date:', 'Period:', 'Total Transactions:', 'Total (USD):'],
      [
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        periodLabel,
        String(sanitizedExpenses.length),
        formatCurrencyAmount(totalUsd, 'USD'),
      ],
      125
    );

  const tableStartY = builder.getContentStartY();

  if (sanitizedExpenses.length > 0) {
    autoTable(doc, {
      startY: tableStartY,
      head: [['DATE', 'CATEGORY', 'DESCRIPTION', 'VEHICLE / SOURCE', 'LOCATION', 'AMOUNT', 'USD EQUIV.']],
      body: sanitizedExpenses.map(e => [
        new Date(e.created_at).toLocaleDateString(),
        e.category,
        e.description,
        e.vehicle_id ? (vehicleMap.get(e.vehicle_id) || 'Unknown Vehicle') : 'General',
        e.location,
        `${e.currency} ${e.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        formatCurrencyAmount(e.amount * e.exchange_rate_to_usd, 'USD'),
      ]),
      theme: 'plain',
      margin: {
        left: LAYOUT.MARGIN_LEFT,
        right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT,
        bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6,
      },
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.XSMALL,
        cellPadding: TABLE_STYLES.HEAD_PADDING,
      },
      styles: {
        fontSize: FONT_SIZES.XSMALL,
        cellPadding: 3,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 24 },
        2: { cellWidth: 46 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18 },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
  } else {
    const emptyY = builder.ensureContentSpace(16, tableStartY);
    doc.setFontSize(FONT_SIZES.REGULAR);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('No expenses recorded for the selected period.', LAYOUT.MARGIN_LEFT, emptyY);
  }

  // Category breakdown
  const EXPENSE_CATEGORIES = ['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Driver Disbursement', 'Other'];
  const categoryTotals = EXPENSE_CATEGORIES
    .map(cat => ({
      category: cat,
      total: sanitizedExpenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + e.amount * e.exchange_rate_to_usd, 0),
      count: sanitizedExpenses.filter(e => e.category === cat).length,
    }))
    .filter(c => c.count > 0);

  const locationTotals = ['UK', 'Namibia', 'Zimbabwe', 'Botswana']
    .map(loc => ({
      location: loc,
      total: sanitizedExpenses
        .filter(e => e.location === loc)
        .reduce((sum, e) => sum + e.amount * e.exchange_rate_to_usd, 0),
      count: sanitizedExpenses.filter(e => e.location === loc).length,
    }))
    .filter(l => l.count > 0);

  if (categoryTotals.length > 0 || locationTotals.length > 0) {
    let currentY = ((doc as any).lastAutoTable?.finalY || tableStartY) + 14;
    currentY = builder.ensureContentSpace(20 + (categoryTotals.length + locationTotals.length) * 7, currentY);

    if (categoryTotals.length > 0) {
      doc.setFontSize(FONT_SIZES.MEDIUM);
      doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
      doc.setTextColor(...COLORS.PRIMARY_DARK);
      doc.text('BREAKDOWN BY CATEGORY', LAYOUT.MARGIN_LEFT, currentY);

      autoTable(doc, {
        startY: currentY + 6,
        head: [['CATEGORY', 'TRANSACTIONS', 'USD TOTAL', '% OF TOTAL']],
        body: categoryTotals.map(c => [
          c.category,
          String(c.count),
          formatCurrencyAmount(c.total, 'USD'),
          totalUsd > 0 ? `${((c.total / totalUsd) * 100).toFixed(1)}%` : '0.0%',
        ]),
        theme: 'plain',
        margin: {
          left: LAYOUT.MARGIN_LEFT,
          right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT,
          bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6,
        },
        headStyles: {
          fillColor: TABLE_STYLES.HEAD_FILL,
          textColor: COLORS.PRIMARY_DARK,
          fontStyle: 'bold',
          fontSize: FONT_SIZES.SMALL,
        },
        styles: {
          fontSize: FONT_SIZES.SMALL,
          lineColor: COLORS.BORDER_GRAY,
          lineWidth: TABLE_STYLES.LINE_WIDTH,
          textColor: COLORS.PRIMARY_DARK,
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 30, halign: 'right' },
        },
        alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
      });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 10;
    }

    if (locationTotals.length > 0) {
      currentY = builder.ensureContentSpace(20 + locationTotals.length * 7, currentY);
      doc.setFontSize(FONT_SIZES.MEDIUM);
      doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
      doc.setTextColor(...COLORS.PRIMARY_DARK);
      doc.text('BREAKDOWN BY LOCATION', LAYOUT.MARGIN_LEFT, currentY);

      autoTable(doc, {
        startY: currentY + 6,
        head: [['LOCATION', 'TRANSACTIONS', 'USD TOTAL', '% OF TOTAL']],
        body: locationTotals.map(l => [
          l.location,
          String(l.count),
          formatCurrencyAmount(l.total, 'USD'),
          totalUsd > 0 ? `${((l.total / totalUsd) * 100).toFixed(1)}%` : '0.0%',
        ]),
        theme: 'plain',
        margin: {
          left: LAYOUT.MARGIN_LEFT,
          right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT,
          bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6,
        },
        headStyles: {
          fillColor: TABLE_STYLES.HEAD_FILL,
          textColor: COLORS.PRIMARY_DARK,
          fontStyle: 'bold',
          fontSize: FONT_SIZES.SMALL,
        },
        styles: {
          fontSize: FONT_SIZES.SMALL,
          lineColor: COLORS.BORDER_GRAY,
          lineWidth: TABLE_STYLES.LINE_WIDTH,
          textColor: COLORS.PRIMARY_DARK,
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 30, halign: 'right' },
        },
        alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
      });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;
    }

    // Grand total box
    currentY = builder.ensureContentSpace(28, currentY);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 22, 3, 3, 'F');
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('TOTAL EXPENSES (USD)', LAYOUT.MARGIN_LEFT + 5, currentY + 9);
    doc.setFontSize(FONT_SIZES.LARGE);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(formatCurrencyAmount(totalUsd, 'USD'), LAYOUT.MARGIN_RIGHT - 5, currentY + 16, { align: 'right' });
  }

  builder.addFooter({ additionalText: `Expenses Report — ${periodLabel}`, fontSize: FONT_SIZES.XXSMALL });
  return builder.generate();
};

export const generateExpensesReportPDFAndDownload = async (
  expenses: Expense[],
  company: CompanyDetails,
  vehicles: Vehicle[],
  options?: { dateFrom?: string; dateTo?: string }
): Promise<void> => {
  const blob = await generateExpensesReportPDF(expenses, company, vehicles, options);
  downloadBlob(blob, `Expenses_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// ASSET REGISTER REPORT PDF
// ============================================================================

export const generateAssetRegisterReportPDF = async (
  assets: Asset[],
  company: CompanyDetails
): Promise<Blob> => {
  const sanitizedCompany = sanitizeCompany(company);
  const dateStr = new Date().toISOString().split('T')[0];
  const builder = new PDFBuilder(sanitizedCompany, `Asset_Register_${dateStr}.pdf`);
  const doc = builder.getDocument();

  const sanitizedAssets = assets.map(a => ({
    ...a,
    name: sanitizeText(a.name) || 'Unnamed Asset',
    category: sanitizeText(a.category) || 'Uncategorised',
    serial_number: sanitizeText(a.serial_number) || '—',
    status: sanitizeText(a.status) || 'Unknown',
    location: sanitizeText(a.location) || '—',
    condition: sanitizeText(a.condition) || '—',
    purchase_date: sanitizeText(a.purchase_date) || '',
    purchase_value: sanitizeNumber(a.purchase_value),
    description: sanitizeText(a.description) || '',
  }));

  const totalValue = sanitizedAssets.reduce((sum, a) => sum + a.purchase_value, 0);
  const statusCounts = ['Available', 'Borrowed', 'Under Maintenance', 'Retired'].map(s => ({
    status: s,
    count: sanitizedAssets.filter(a => a.status === s).length,
  }));

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('ASSET REGISTER')
    .addMetadataSection(
      ['Report Date:', 'Total Assets:', 'Total Value (USD):', 'Available:', 'Borrowed:'],
      [
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        String(sanitizedAssets.length),
        formatCurrencyAmount(totalValue, 'USD'),
        String(statusCounts.find(s => s.status === 'Available')?.count ?? 0),
        String(statusCounts.find(s => s.status === 'Borrowed')?.count ?? 0),
      ],
      125
    );

  const tableStartY = builder.getContentStartY();

  if (sanitizedAssets.length > 0) {
    autoTable(doc, {
      startY: tableStartY,
      head: [['ASSET NAME', 'CATEGORY', 'SERIAL NO.', 'STATUS', 'LOCATION', 'CONDITION', 'PURCHASE DATE', 'VALUE (USD)']],
      body: sanitizedAssets.map(a => [
        a.name,
        a.category,
        a.serial_number,
        a.status,
        a.location,
        a.condition,
        a.purchase_date ? new Date(a.purchase_date).toLocaleDateString() : '—',
        a.purchase_value > 0 ? formatCurrencyAmount(a.purchase_value, 'USD') : '—',
      ]),
      theme: 'plain',
      margin: {
        left: LAYOUT.MARGIN_LEFT,
        right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT,
        bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6,
      },
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.XSMALL,
        cellPadding: TABLE_STYLES.HEAD_PADDING,
      },
      styles: {
        fontSize: FONT_SIZES.XSMALL,
        cellPadding: 3,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 24 },
        2: { cellWidth: 24 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 20 },
        7: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
  } else {
    const emptyY = builder.ensureContentSpace(16, tableStartY);
    doc.setFontSize(FONT_SIZES.REGULAR);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('No assets recorded in the register.', LAYOUT.MARGIN_LEFT, emptyY);
  }

  // Status summary box
  let currentY = ((doc as any).lastAutoTable?.finalY || tableStartY) + 14;
  currentY = builder.ensureContentSpace(34, currentY);
  const activeCounts = statusCounts.filter(s => s.count > 0);
  const boxWidth = 180;
  const colWidth = activeCounts.length > 0 ? boxWidth / Math.max(activeCounts.length, 1) : boxWidth;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, boxWidth, 28, 3, 3, 'F');
  doc.setFontSize(FONT_SIZES.XSMALL);
  doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
  doc.setTextColor(...COLORS.SECONDARY_GRAY);

  statusCounts.forEach((s, i) => {
    const x = LAYOUT.MARGIN_LEFT + 5 + i * colWidth;
    doc.text(s.status.toUpperCase(), x, currentY + 9);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(String(s.count), x, currentY + 20);
    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
  });

  if (totalValue > 0) {
    currentY = currentY + 40;
    currentY = builder.ensureContentSpace(22, currentY);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 22, 3, 3, 'F');
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('TOTAL ASSET VALUE (USD)', LAYOUT.MARGIN_LEFT + 5, currentY + 9);
    doc.setFontSize(FONT_SIZES.LARGE);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(formatCurrencyAmount(totalValue, 'USD'), LAYOUT.MARGIN_RIGHT - 5, currentY + 16, { align: 'right' });
  }

  builder.addFooter({ additionalText: `Asset Register Report — ${new Date().toLocaleDateString()}`, fontSize: FONT_SIZES.XXSMALL });
  return builder.generate();
};

export const generateAssetRegisterReportPDFAndDownload = async (
  assets: Asset[],
  company: CompanyDetails
): Promise<void> => {
  const blob = await generateAssetRegisterReportPDF(assets, company);
  downloadBlob(blob, `Asset_Register_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// FLEET ANALYTICS REPORT PDF
// ============================================================================

export const generateFleetReportPDF = async (
  summaries: LandedCostSummary[],
  expenses: Expense[],
  vehicles: Vehicle[],
  company: CompanyDetails,
  options?: { dateFrom?: string; dateTo?: string; vehicleFilter?: string }
): Promise<Blob> => {
  const sanitizedCompany = sanitizeCompany(company);
  const dateStr = new Date().toISOString().split('T')[0];
  const builder = new PDFBuilder(sanitizedCompany, `Fleet_Analytics_Report_${dateStr}.pdf`);
  const doc = builder.getDocument();

  const periodLabel = options?.dateFrom || options?.dateTo
    ? `${options.dateFrom || 'Beginning'} – ${options.dateTo || 'Present'}`
    : 'All time';

  const totalFleetValue = summaries.reduce((s, v) => s + (v.total_landed_cost_usd || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0) * (e.exchange_rate_to_usd || 1), 0);

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('FLEET ANALYTICS REPORT', {
      fontSize: 15,
      charSpace: 0.15,
      lineHeight: 6.1,
      headerGap: 10,
    })
    .addMetadataSection(
      ['Report Date:', 'Period:', 'Total Vehicles:', 'Total Transactions:'],
      [
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        periodLabel,
        String(summaries.length),
        String(expenses.length),
      ],
      125
    );

  let currentY = builder.getContentStartY();

  // ── Executive Summary Box ────────────────────────────────────────────────
  currentY = builder.ensureContentSpace(38, currentY);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 32, 3, 3, 'F');
  doc.setDrawColor(...COLORS.BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 32, 3, 3, 'S');

  const colW = 45;
  const summaryItems = [
    { label: 'FLEET VALUE', value: formatCurrencyAmount(totalFleetValue, 'USD') },
    { label: 'TOTAL EXPENSES', value: formatCurrencyAmount(totalExpenses, 'USD') },
    { label: 'VEHICLES', value: String(summaries.length) },
    { label: 'AVG COST / VEHICLE', value: summaries.length > 0 ? formatCurrencyAmount(totalFleetValue / summaries.length, 'USD') : '$0' },
  ];
  summaryItems.forEach((item, i) => {
    const x = LAYOUT.MARGIN_LEFT + 5 + i * colW;
    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.text(item.label, x, currentY + 10);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(item.value, x, currentY + 22);
  });
  currentY += 42;

  // ── Top 10 Vehicles Table ────────────────────────────────────────────────
  const top10 = [...summaries]
    .sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0))
    .slice(0, 10);

  if (top10.length > 0) {
    currentY = builder.ensureContentSpace(20 + top10.length * 7, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('TOP VEHICLES BY TOTAL COST', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['RANK', 'MAKE & MODEL', 'VIN', 'STATUS', 'PURCHASE (GBP)', 'TOTAL COST (USD)']],
      body: top10.map((v, i) => [
        String(i + 1),
        sanitizeText(v.make_model) || '—',
        sanitizeText(v.vin_number) || '—',
        sanitizeText(v.status) || '—',
        `£${(v.purchase_price_gbp || 0).toLocaleString()}`,
        formatCurrencyAmount(v.total_landed_cost_usd || 0, 'USD'),
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.XSMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.XSMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 44 },
        2: { cellWidth: 36 },
        3: { cellWidth: 22 },
        4: { cellWidth: 32, halign: 'right' },
        5: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;
  }

  // ── Vehicle Status Distribution ──────────────────────────────────────────
  const statusGroups = ['UK', 'Namibia', 'Zimbabwe', 'Botswana', 'Sold']
    .map(s => ({ status: s, count: summaries.filter(v => v.status === s).length }))
    .filter(s => s.count > 0);

  if (statusGroups.length > 0) {
    currentY = builder.ensureContentSpace(20 + statusGroups.length * 7, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('VEHICLE STATUS DISTRIBUTION', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['STATUS / LOCATION', 'VEHICLES', '% OF FLEET']],
      body: statusGroups.map(s => [
        s.status,
        String(s.count),
        summaries.length > 0 ? `${((s.count / summaries.length) * 100).toFixed(1)}%` : '0.0%',
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.SMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.SMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 30, halign: 'right' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;
  }

  // ── Expenses by Category ─────────────────────────────────────────────────
  const EXPENSE_CATEGORIES = ['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Driver Disbursement', 'Other'];
  const categoryTotals = EXPENSE_CATEGORIES
    .map(cat => ({
      category: cat,
      total: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0) * (e.exchange_rate_to_usd || 1), 0),
      count: expenses.filter(e => e.category === cat).length,
    }))
    .filter(c => c.count > 0);

  if (categoryTotals.length > 0) {
    currentY = builder.ensureContentSpace(20 + categoryTotals.length * 7, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('EXPENSES BY CATEGORY', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['CATEGORY', 'TRANSACTIONS', 'USD TOTAL', '% OF TOTAL']],
      body: categoryTotals.map(c => [
        c.category,
        String(c.count),
        formatCurrencyAmount(c.total, 'USD'),
        totalExpenses > 0 ? `${((c.total / totalExpenses) * 100).toFixed(1)}%` : '0.0%',
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.SMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.SMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 30, halign: 'right' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;
  }

  // ── Expenses by Location ─────────────────────────────────────────────────
  const locationTotals = ['UK', 'Namibia', 'Zimbabwe', 'Botswana']
    .map(loc => ({
      location: loc,
      total: expenses.filter(e => e.location === loc).reduce((s, e) => s + (e.amount || 0) * (e.exchange_rate_to_usd || 1), 0),
      count: expenses.filter(e => e.location === loc).length,
    }))
    .filter(l => l.count > 0);

  if (locationTotals.length > 0) {
    currentY = builder.ensureContentSpace(20 + locationTotals.length * 7, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('EXPENSES BY LOCATION', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['LOCATION', 'TRANSACTIONS', 'USD TOTAL', '% OF TOTAL']],
      body: locationTotals.map(l => [
        l.location,
        String(l.count),
        formatCurrencyAmount(l.total, 'USD'),
        totalExpenses > 0 ? `${((l.total / totalExpenses) * 100).toFixed(1)}%` : '0.0%',
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.SMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.SMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 30, halign: 'right' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
  }

  builder.addFooter({ additionalText: `Fleet Analytics Report — ${new Date().toLocaleDateString()}`, fontSize: FONT_SIZES.XXSMALL });
  return builder.generate();
};

export const generateFleetReportPDFAndDownload = async (
  summaries: LandedCostSummary[],
  expenses: Expense[],
  vehicles: Vehicle[],
  company: CompanyDetails,
  options?: { dateFrom?: string; dateTo?: string; vehicleFilter?: string }
): Promise<void> => {
  const blob = await generateFleetReportPDF(summaries, expenses, vehicles, company, options);
  downloadBlob(blob, `Fleet_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// DRIVER FUNDS REPORT PDF
// ============================================================================

export const generateDriverFundsReportPDF = async (
  expenses: Expense[],
  operatingFunds: OperatingFund[],
  drivers: AppUser[],
  vehicles: Vehicle[],
  company: CompanyDetails,
  options?: { dateFrom?: string; dateTo?: string; vehicleFilter?: string }
): Promise<Blob> => {
  const sanitizedCompany = sanitizeCompany(company);
  const dateStr = new Date().toISOString().split('T')[0];
  const builder = new PDFBuilder(sanitizedCompany, `Driver_Funds_Report_${dateStr}.pdf`);
  const doc = builder.getDocument();
  const report = buildDriverFundsReportData(expenses, operatingFunds, drivers, vehicles);

  const periodLabel = options?.dateFrom || options?.dateTo
    ? `${options.dateFrom || 'Beginning'} – ${options.dateTo || 'Present'}`
    : 'All time';

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('DRIVER FUNDS REPORT', {
      fontSize: 15,
      charSpace: 0.15,
      lineHeight: 6.1,
      headerGap: 10,
    })
    .addMetadataSection(
      ['Report Date:', 'Period:', 'Drivers Funded:', 'Vehicle Filter:'],
      [
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        periodLabel,
        String(report.totals.fundedDrivers),
        options?.vehicleFilter || 'All vehicles',
      ],
      125
    );

  let currentY = builder.getContentStartY();

  currentY = builder.ensureContentSpace(38, currentY);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 32, 3, 3, 'F');
  doc.setDrawColor(...COLORS.BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 32, 3, 3, 'S');

  const allAllocatedCurrencies = new Set(
    report.summaries.flatMap((s) => Object.keys(s.allocatedByCurrency).filter((k) => (s.allocatedByCurrency[k] || 0) > 0))
  );
  const currencyCountLabel = allAllocatedCurrencies.size > 1
    ? `${allAllocatedCurrencies.size} currencies`
    : '';

  const summaryItems = [
    { label: 'ALLOCATED', value: formatCurrencyAmount(report.totals.allocatedUsd, 'USD'), subLabel: currencyCountLabel },
    { label: 'SPENT', value: formatCurrencyAmount(report.totals.spentUsd, 'USD'), subLabel: currencyCountLabel },
    { label: 'BALANCE', value: formatCurrencyAmount(report.totals.balanceUsd, 'USD'), subLabel: '' },
    { label: 'FUNDED DRIVERS', value: String(report.totals.fundedDrivers), subLabel: '' },
  ];

  summaryItems.forEach((item, index) => {
    const x = LAYOUT.MARGIN_LEFT + 5 + index * 45;
    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.text(item.label, x, currentY + 10);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(item.value, x, currentY + 22);
    if (item.subLabel) {
      doc.setFontSize(FONT_SIZES.XSMALL);
      doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
      doc.setTextColor(...COLORS.LIGHT_GRAY);
      doc.text(item.subLabel, x, currentY + 28);
    }
  });
  currentY += 42;

  const formatSummaryCurrencies = (byCurrency: Partial<Record<string, number>>, usdFallback: number): string => {
    const entries = Object.entries(byCurrency).filter(([, amt]) => (amt || 0) > 0);
    if (entries.length === 0) return formatCurrencyAmount(usdFallback, 'USD');
    return entries.map(([cur, amt]) => formatCurrencyAmount(amt || 0, cur)).join('\n');
  };

  if (report.summaries.length > 0) {
    currentY = builder.ensureContentSpace(30, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('DRIVER ALLOCATION SUMMARY', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['DRIVER', 'ALLOCATED', 'SPENT', 'BALANCE (USD)', 'ALLOCATIONS', 'SPENDS']],
      body: report.summaries.map((summary) => [
        summary.driverName,
        formatSummaryCurrencies(summary.allocatedByCurrency, summary.allocatedUsd),
        formatSummaryCurrencies(summary.spentByCurrency, summary.spentUsd),
        formatCurrencyAmount(summary.balanceUsd, 'USD'),
        String(summary.allocationCount),
        String(summary.spendCount),
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.XSMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.XSMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;
  }

  if (report.allocationRows.length > 0) {
    currentY = builder.ensureContentSpace(30, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('ALLOCATION LEDGER', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['DATE', 'DRIVER', 'SOURCE', 'DESCRIPTION', 'VEHICLE', 'NATIVE AMOUNT', 'USD EQ.']],
      body: report.allocationRows.map((row) => [
        new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        row.driverName,
        row.source,
        sanitizeText(row.description) || '—',
        row.vehicleLabel,
        formatCurrencyAmount(row.amount, row.currency),
        formatCurrencyAmount(row.amountUsd, 'USD'),
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.XSMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.XXSMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 26 },
        2: { cellWidth: 22 },
        3: { cellWidth: 46 },
        4: { cellWidth: 24 },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;
  }

  if (report.spendRows.length > 0) {
    currentY = builder.ensureContentSpace(30, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('SPEND LEDGER', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['DATE', 'DRIVER', 'CATEGORY', 'DESCRIPTION', 'VEHICLE', 'USD']],
      body: report.spendRows.map((row) => [
        new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        row.driverName,
        row.source,
        sanitizeText(row.description) || '—',
        row.vehicleLabel,
        formatCurrencyAmount(row.amountUsd, 'USD'),
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.XSMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.XXSMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 28 },
        2: { cellWidth: 24 },
        3: { cellWidth: 56 },
        4: { cellWidth: 28 },
        5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
  }

  builder.addFooter({ additionalText: `Driver Funds Report — ${new Date().toLocaleDateString()}`, fontSize: FONT_SIZES.XXSMALL });
  return builder.generate();
};

export const generateDriverFundsReportPDFAndDownload = async (
  expenses: Expense[],
  operatingFunds: OperatingFund[],
  drivers: AppUser[],
  vehicles: Vehicle[],
  company: CompanyDetails,
  options?: { dateFrom?: string; dateTo?: string; vehicleFilter?: string }
): Promise<void> => {
  const blob = await generateDriverFundsReportPDF(expenses, operatingFunds, drivers, vehicles, company, options);
  downloadBlob(blob, `Driver_Funds_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// AUDIT REPORT PDF
// ============================================================================

export const generateAuditReportPDF = async (
  summaries: LandedCostSummary[],
  expenses: Expense[],
  company: CompanyDetails,
  options?: { dateFrom?: string; dateTo?: string }
): Promise<Blob> => {
  const sanitizedCompany = sanitizeCompany(company);
  const dateStr = new Date().toISOString().split('T')[0];
  const builder = new PDFBuilder(sanitizedCompany, `Audit_Report_${dateStr}.pdf`);
  const doc = builder.getDocument();

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0) * (e.exchange_rate_to_usd || 1), 0);
  const totalValue = summaries.reduce((s, v) => s + (v.total_landed_cost_usd || 0), 0);
  const soldCount = summaries.filter(v => v.status === 'Sold').length;
  const periodLabel = options?.dateFrom || options?.dateTo
    ? `${options.dateFrom || 'Beginning'} – ${options.dateTo || 'Present'}`
    : 'All time';

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('FLEET AUDIT REPORT', {
      fontSize: 15,
      charSpace: 0.15,
      lineHeight: 6.1,
      headerGap: 10,
    })
    .addMetadataSection(
      ['Report Date:', 'Period:', 'Total Vehicles:', 'Expense Transactions:'],
      [
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        periodLabel,
        String(summaries.length),
        String(expenses.length),
      ],
      125
    );

  let currentY = builder.getContentStartY();

  // ── KPI Summary Box ──────────────────────────────────────────────────────
  currentY = builder.ensureContentSpace(38, currentY);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 32, 3, 3, 'F');
  doc.setDrawColor(...COLORS.BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 32, 3, 3, 'S');

  const colW = 45;
  const kpiItems = [
    { label: 'TOTAL ASSET VALUE', value: formatCurrencyAmount(totalValue, 'USD') },
    { label: 'TOTAL EXPENSES', value: formatCurrencyAmount(totalExpenses, 'USD') },
    { label: 'FLEET UTILISATION', value: summaries.length > 0 ? `${(((summaries.length - soldCount) / summaries.length) * 100).toFixed(1)}%` : '0%' },
    { label: 'EXPENSE / VALUE RATIO', value: totalValue > 0 ? `${((totalExpenses / totalValue) * 100).toFixed(2)}%` : '0%' },
  ];
  kpiItems.forEach((item, i) => {
    const x = LAYOUT.MARGIN_LEFT + 5 + i * colW;
    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.text(item.label, x, currentY + 10);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(item.value, x, currentY + 22);
  });
  currentY += 42;

  // ── Detailed Vehicle Breakdown ───────────────────────────────────────────
  if (summaries.length > 0) {
    currentY = builder.ensureContentSpace(20, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('DETAILED VEHICLE BREAKDOWN', LAYOUT.MARGIN_LEFT, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['MAKE & MODEL', 'VIN', 'STATUS', 'PURCHASE (GBP)', 'EXPENSES (USD)', 'TOTAL COST', 'EXP. RATIO']],
      body: summaries.map(v => [
        sanitizeText(v.make_model) || '—',
        sanitizeText(v.vin_number) || '—',
        sanitizeText(v.status) || '—',
        `£${(v.purchase_price_gbp || 0).toLocaleString()}`,
        formatCurrencyAmount(v.total_expenses_usd || 0, 'USD'),
        formatCurrencyAmount(v.total_landed_cost_usd || 0, 'USD'),
        v.total_landed_cost_usd ? `${((v.total_expenses_usd || 0) / v.total_landed_cost_usd * 100).toFixed(1)}%` : '0%',
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.XSMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.XSMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 30 },
        2: { cellWidth: 22 },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 18, halign: 'right' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;
  }

  // ── Expenses by Category ─────────────────────────────────────────────────
  const EXPENSE_CATEGORIES = ['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Driver Disbursement', 'Other'];
  const categoryTotals = EXPENSE_CATEGORIES
    .map(cat => ({
      category: cat,
      total: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0) * (e.exchange_rate_to_usd || 1), 0),
      count: expenses.filter(e => e.category === cat).length,
    }))
    .filter(c => c.count > 0);

  if (categoryTotals.length > 0) {
    currentY = builder.ensureContentSpace(20 + categoryTotals.length * 7, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('EXPENSES BY CATEGORY', LAYOUT.MARGIN_LEFT, currentY);

    const highestCat = [...categoryTotals].sort((a, b) => b.total - a.total)[0];
    autoTable(doc, {
      startY: currentY + 6,
      head: [['CATEGORY', 'TRANSACTIONS', 'USD TOTAL', '% OF TOTAL']],
      body: categoryTotals.map(c => [
        c.category,
        String(c.count),
        formatCurrencyAmount(c.total, 'USD'),
        totalExpenses > 0 ? `${((c.total / totalExpenses) * 100).toFixed(1)}%` : '0.0%',
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: { fillColor: TABLE_STYLES.HEAD_FILL, textColor: COLORS.PRIMARY_DARK, fontStyle: 'bold', fontSize: FONT_SIZES.SMALL, cellPadding: TABLE_STYLES.HEAD_PADDING },
      styles: { fontSize: FONT_SIZES.SMALL, cellPadding: 3, lineColor: COLORS.BORDER_GRAY, lineWidth: TABLE_STYLES.LINE_WIDTH, textColor: COLORS.PRIMARY_DARK },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 30, halign: 'right' },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 14;

    // Highest-cost note
    if (highestCat) {
      currentY = builder.ensureContentSpace(14, currentY);
      doc.setFontSize(FONT_SIZES.SMALL);
      doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
      doc.setTextColor(...COLORS.SECONDARY_GRAY);
      doc.text(`Highest expense category: ${highestCat.category} (${totalExpenses > 0 ? ((highestCat.total / totalExpenses) * 100).toFixed(1) : 0}% of total)`, LAYOUT.MARGIN_LEFT, currentY);
      currentY += 10;
    }
  }

  // ── Grand Total Box ──────────────────────────────────────────────────────
  currentY = builder.ensureContentSpace(28, currentY);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(LAYOUT.MARGIN_LEFT, currentY, 180, 22, 3, 3, 'F');
  doc.setFontSize(FONT_SIZES.SMALL);
  doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
  doc.setTextColor(...COLORS.SECONDARY_GRAY);
  doc.text('TOTAL EXPENSES (USD)', LAYOUT.MARGIN_LEFT + 5, currentY + 9);
  doc.setFontSize(FONT_SIZES.LARGE);
  doc.setTextColor(...COLORS.PRIMARY_DARK);
  doc.text(formatCurrencyAmount(totalExpenses, 'USD'), LAYOUT.MARGIN_RIGHT - 5, currentY + 16, { align: 'right' });

  builder.addFooter({ additionalText: `Fleet Audit Report — ${new Date().toLocaleDateString()}`, fontSize: FONT_SIZES.XXSMALL });
  return builder.generate();
};

export const generateAuditReportPDFAndDownload = async (
  summaries: LandedCostSummary[],
  expenses: Expense[],
  company: CompanyDetails,
  options?: { dateFrom?: string; dateTo?: string }
): Promise<void> => {
  const blob = await generateAuditReportPDF(summaries, expenses, company, options);
  downloadBlob(blob, `Audit_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// DEBTORS REPORT
// ============================================================================

export interface DebtorEntry {
  id: string;
  name: string;
  email: string;
  company?: string;
  currency: 'USD' | 'GBP';
  total_invoiced: number;
  total_paid: number;
  current_balance: number;
  // Aging buckets (outstanding invoice amounts by days overdue)
  current: number;       // not yet due
  overdue_30: number;    // 1–30 days
  overdue_60: number;    // 31–60 days
  overdue_90: number;    // 61–90 days
  overdue_90plus: number; // 91+ days
}

export const generateDebtorsReportPDF = async (
  debtors: DebtorEntry[],
  company: CompanyDetails
): Promise<Blob> => {
  const sanitizedCompany = sanitizeCompany(company);
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const builder = new PDFBuilder(sanitizedCompany, `Debtors_Report_${today.toISOString().split('T')[0]}.pdf`);
  const doc = builder.getDocument();

  await builder.addLogoWatermark();
  (await builder.addHeader())
    .addTitle('DEBTORS REPORT')
    .addMetadataSection(
      ['Report Date:', 'Total Debtors:', 'Currency:'],
      [dateStr, String(debtors.length), debtors.length > 0 ? debtors[0].currency : 'USD'],
      125,
      65
    );

  let currentY = Math.max((doc as any).lastAutoTable?.finalY || 0, 80);

  // ── Summary totals ────────────────────────────────────────────────────────
  const currency = debtors.length > 0 ? debtors[0].currency : 'USD';
  const totals = debtors.reduce(
    (acc, d) => ({
      invoiced: acc.invoiced + d.total_invoiced,
      paid: acc.paid + d.total_paid,
      balance: acc.balance + d.current_balance,
      current: acc.current + d.current,
      d30: acc.d30 + d.overdue_30,
      d60: acc.d60 + d.overdue_60,
      d90: acc.d90 + d.overdue_90,
      d90plus: acc.d90plus + d.overdue_90plus,
    }),
    { invoiced: 0, paid: 0, balance: 0, current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
  );

  // Summary box
  currentY = builder.ensureContentSpace(32, currentY);
  doc.setFillColor(235, 237, 242);
  doc.rect(LAYOUT.MARGIN_LEFT, currentY, LAYOUT.MARGIN_RIGHT - LAYOUT.MARGIN_LEFT, 28, 'F');
  doc.setFontSize(FONT_SIZES.XSMALL);
  doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
  doc.setTextColor(...COLORS.SECONDARY_GRAY);

  const summaryItems = [
    { label: 'TOTAL INVOICED', value: formatCurrencyAmount(totals.invoiced, currency) },
    { label: 'TOTAL PAID', value: formatCurrencyAmount(totals.paid, currency) },
    { label: 'TOTAL OUTSTANDING', value: formatCurrencyAmount(totals.balance, currency) },
  ];
  const colW = (LAYOUT.MARGIN_RIGHT - LAYOUT.MARGIN_LEFT) / summaryItems.length;
  summaryItems.forEach((item, i) => {
    const x = LAYOUT.MARGIN_LEFT + i * colW + colW / 2;
    doc.text(item.label, x, currentY + 9, { align: 'center' });
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(item.value, x, currentY + 20, { align: 'center' });
    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
  });
  currentY += 36;

  // ── Aging summary bar ────────────────────────────────────────────────────
  currentY = builder.ensureContentSpace(16, currentY);
  doc.setFontSize(FONT_SIZES.MEDIUM);
  doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
  doc.setTextColor(...COLORS.PRIMARY_DARK);
  doc.text('AGING SUMMARY', LAYOUT.MARGIN_LEFT, currentY);
  currentY += 5;

  autoTable(doc, {
    startY: currentY,
    head: [['Current (Not Due)', '1–30 Days', '31–60 Days', '61–90 Days', '91+ Days', 'Total Outstanding']],
    body: [[
      formatCurrencyAmount(totals.current, currency),
      formatCurrencyAmount(totals.d30, currency),
      formatCurrencyAmount(totals.d60, currency),
      formatCurrencyAmount(totals.d90, currency),
      formatCurrencyAmount(totals.d90plus, currency),
      formatCurrencyAmount(totals.balance, currency),
    ]],
    theme: 'plain',
    margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
    headStyles: {
      fillColor: TABLE_STYLES.HEAD_FILL,
      textColor: COLORS.PRIMARY_DARK,
      fontStyle: 'bold',
      fontSize: FONT_SIZES.XSMALL,
      halign: 'right',
    },
    styles: {
      fontSize: FONT_SIZES.SMALL,
      lineColor: COLORS.BORDER_GRAY,
      lineWidth: TABLE_STYLES.LINE_WIDTH,
      textColor: COLORS.PRIMARY_DARK,
      halign: 'right',
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'right' },
      5: { textColor: [180, 30, 30] as [number, number, number] },
    },
  });
  currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 12;

  // ── Debtors table ─────────────────────────────────────────────────────────
  if (debtors.length === 0) {
    currentY = builder.ensureContentSpace(12, currentY);
    doc.setFontSize(FONT_SIZES.REGULAR);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('No outstanding debtors at this time.', LAYOUT.MARGIN_LEFT, currentY);
  } else {
    currentY = builder.ensureContentSpace(16, currentY);
    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('DEBTOR DETAILS', LAYOUT.MARGIN_LEFT, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['CLIENT', 'EMAIL', 'INVOICED', 'PAID', 'CURRENT', '1–30d', '31–60d', '61–90d', '91+d', 'BALANCE']],
      body: debtors.map(d => [
        sanitizeText(d.name) + (d.company ? `\n${sanitizeText(d.company)}` : ''),
        sanitizeEmail(d.email),
        formatCurrencyAmount(d.total_invoiced, d.currency),
        formatCurrencyAmount(d.total_paid, d.currency),
        formatCurrencyAmount(d.current, d.currency),
        formatCurrencyAmount(d.overdue_30, d.currency),
        formatCurrencyAmount(d.overdue_60, d.currency),
        formatCurrencyAmount(d.overdue_90, d.currency),
        formatCurrencyAmount(d.overdue_90plus, d.currency),
        formatCurrencyAmount(d.current_balance, d.currency),
      ]),
      theme: 'plain',
      margin: { left: LAYOUT.MARGIN_LEFT, right: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT, bottom: LAYOUT.PAGE_HEIGHT - builder.getFooterStartY() + 6 },
      headStyles: {
        fillColor: TABLE_STYLES.HEAD_FILL,
        textColor: COLORS.PRIMARY_DARK,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.XSMALL,
      },
      styles: {
        fontSize: FONT_SIZES.XSMALL,
        lineColor: COLORS.BORDER_GRAY,
        lineWidth: TABLE_STYLES.LINE_WIDTH,
        textColor: COLORS.PRIMARY_DARK,
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 32 },
        2: { halign: 'right', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 18 },
        4: { halign: 'right', cellWidth: 16 },
        5: { halign: 'right', cellWidth: 14 },
        6: { halign: 'right', cellWidth: 14 },
        7: { halign: 'right', cellWidth: 14 },
        8: { halign: 'right', cellWidth: 14 },
        9: { halign: 'right', fontStyle: 'bold', cellWidth: 20, textColor: [180, 30, 30] as [number, number, number] },
      },
      alternateRowStyles: { fillColor: COLORS.FILL_ALTERNATE },
      didParseCell: (data) => {
        // Highlight high-balance rows
        if (data.section === 'body' && data.column.index === 9) {
          const debtor = debtors[data.row.index];
          if (debtor && debtor.current_balance > 10000) {
            data.cell.styles.fillColor = [255, 245, 245] as [number, number, number];
          }
        }
      },
    });
  }

  builder.addFooter({ additionalText: `Debtors Report — ${dateStr}`, fontSize: FONT_SIZES.XXSMALL });
  return builder.generate();
};

export const generateDebtorsReportPDFAndDownload = async (
  debtors: DebtorEntry[],
  company: CompanyDetails
): Promise<void> => {
  const blob = await generateDebtorsReportPDF(debtors, company);
  downloadBlob(blob, `Debtors_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// PERIOD INCOME & EXPENSE REPORT  (daily / weekly / monthly)
// ============================================================================

export interface PeriodReportData {
  period: 'daily' | 'weekly' | 'monthly';
  from: string;
  to: string;
  label: string;
  summary: { total_income: number; total_expenses: number; net: number };
  income_sources: { source: string; total: number; entries: number }[];
  income_rows: {
    freezit:  any[];
    ice:      any[];
    wifi:     any[];
    car_hire: any[];
    lodgers:  any[];
  };
  expense_rows: { usage_date: string; amount: number; currency: string; description: string; category: string; source: string; staff_name: string; staff_role: string }[];
}

export const generatePeriodReportPDF = async (
  data: PeriodReportData,
  companyName = 'Affinity Logistics'
): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');

  const MARGIN = 14;
  const PAGE_W = 210;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  const accent: [number, number, number] = [217, 119, 6];   // amber-600
  const dark:   [number, number, number] = [24,  24,  27];
  const mid:    [number, number, number] = [82,  82,  91];
  const light:  [number, number, number] = [212, 212, 216];

  const fmt = (n: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);

  const addPage = () => {
    doc.addPage();
    y = MARGIN;
  };

  const checkY = (needed: number) => {
    if (y + needed > 277) addPage();
  };

  // ── Header bar ──────────────────────────────────────────────────────────
  doc.setFillColor(...dark);
  doc.rect(0, 0, PAGE_W, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, MARGIN, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(161, 161, 170);
  doc.text('Income & Expense Report', MARGIN, 18);

  // Period label top-right
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(data.label, PAGE_W - MARGIN, 14, { align: 'right' });
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`, PAGE_W - MARGIN, 21, { align: 'right' });

  y = 36;

  // ── Summary KPI row ──────────────────────────────────────────────────────
  const kpiW = (CONTENT_W - 8) / 3;
  const kpis = [
    { label: 'Total Income',   value: fmt(data.summary.total_income),   color: [16, 185, 129] as [number,number,number] },
    { label: 'Total Expenses', value: fmt(data.summary.total_expenses), color: [239, 68, 68]  as [number,number,number] },
    { label: 'Net',            value: fmt(data.summary.net),            color: data.summary.net >= 0 ? [16, 185, 129] as [number,number,number] : [239, 68, 68] as [number,number,number] },
  ];

  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (kpiW + 4);
    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(...light);
    doc.setLineWidth(0.3);
    doc.rect(x, y, kpiW, 18, 'FD');
    // accent left bar
    doc.setFillColor(...kpi.color);
    doc.rect(x, y, 2.5, 18, 'F');

    doc.setTextColor(...mid);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.label.toUpperCase(), x + 5, y + 6);

    doc.setTextColor(...dark);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, x + 5, y + 14);
  });

  y += 24;

  // ── Income sources table ─────────────────────────────────────────────────
  checkY(20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('INCOME SUMMARY BY SOURCE', MARGIN, y);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 1, MARGIN + 60, y + 1);
  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Source', 'Entries', 'Amount (USD)']],
    body: [
      ...data.income_sources.map(s => [s.source, s.entries, fmt(s.total)]),
      [{ content: 'Total Income', styles: { fontStyle: 'bold' } }, '', { content: fmt(data.summary.total_income), styles: { fontStyle: 'bold' } }],
    ],
    headStyles: { fillColor: dark, textColor: [255, 255, 255], fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 60, halign: 'right' } },
    tableWidth: CONTENT_W,
    didParseCell: (hookData) => {
      if (hookData.row.index === data.income_sources.length) {
        hookData.cell.styles.fillColor = [243, 232, 255];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Expense log ──────────────────────────────────────────────────────────
  checkY(20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('STAFF EXPENSES', MARGIN, y);
  doc.setDrawColor(...[239, 68, 68] as [number,number,number]);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 1, MARGIN + 40, y + 1);
  y += 5;

  if (data.expense_rows.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mid);
    doc.text('No expenses logged in this period.', MARGIN, y + 4);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Date', 'Staff', 'Description', 'Category', 'Source', 'Amount']],
      body: data.expense_rows.map(e => [
        e.usage_date,
        `${e.staff_name}\n${e.staff_role}`,
        e.description,
        e.category,
        e.source,
        fmt(e.amount, e.currency),
      ]),
      foot: [[
        { content: 'Total Expenses', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(data.summary.total_expenses), styles: { fontStyle: 'bold' } },
      ]],
      headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontSize: 7, cellPadding: 2.5 },
      bodyStyles: { fontSize: 7, cellPadding: 2.5 },
      footStyles: { fillColor: [254, 226, 226], textColor: dark, fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 28 },
        2: { cellWidth: 55 },
        3: { cellWidth: 22 },
        4: { cellWidth: 28 },
        5: { cellWidth: 24, halign: 'right' },
      },
      tableWidth: CONTENT_W,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Per-source detail tables (compact) ───────────────────────────────────
  const addSourceDetail = (
    title: string,
    rows: any[],
    columns: string[],
    mapper: (r: any) => (string | number)[]
  ) => {
    if (!rows.length) return;
    checkY(24);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mid);
    doc.text(title, MARGIN, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [columns],
      body: rows.map(mapper),
      headStyles: { fillColor: [63, 63, 70], textColor: [255, 255, 255], fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      tableWidth: CONTENT_W,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  addSourceDetail('Freezit Sales Detail', data.income_rows.freezit,
    ['Date', 'Qty', 'Unit Price', 'Total', 'Payment', 'Notes'],
    r => [r.sale_date, r.qty_sold, fmt(r.unit_selling_price), fmt(r.total_sales_value), r.payment_method || '—', r.notes || '—']
  );

  addSourceDetail('Ice Sales Detail', data.income_rows.ice,
    ['Date', 'Qty', 'Unit Price', 'Total', 'Payment', 'Customer'],
    r => [r.sale_date, r.quantity_sold, fmt(r.unit_price), fmt(r.total_sales), r.payment_method || '—', r.customer_name || '—']
  );

  addSourceDetail('WiFi Token Sales Detail', data.income_rows.wifi,
    ['Date', 'Tokens', 'Package', 'Price', 'Total', 'Payment'],
    r => [r.sale_date, r.tokens_sold, r.package_type || '—', fmt(r.selling_price), fmt(r.total_sales), r.payment_method || '—']
  );

  addSourceDetail('Car Hire Detail', data.income_rows.car_hire,
    ['Start', 'End', 'Hirer', 'Rate/Day', 'Total', 'Paid', 'Status'],
    r => [r.start_date, r.end_date || '—', r.hirer_name || '—', fmt(r.daily_rate, r.currency || 'USD'), fmt(r.total_amount, r.currency || 'USD'), fmt(r.amount_paid, r.currency || 'USD'), r.status || '—']
  );

  addSourceDetail('Lodger Payments Detail', data.income_rows.lodgers,
    ['Date', 'Lodger', 'Room', 'Amount', 'Currency', 'Month', 'Payment'],
    r => [r.payment_date, r.lodger_name || '—', r.room_number || '—', fmt(r.amount, r.currency || 'USD'), r.currency || 'USD', r.month_covered || '—', r.payment_method || '—']
  );

  // ── Footer on every page ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...light);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 285, PAGE_W - MARGIN, 285);
    doc.setFontSize(7);
    doc.setTextColor(...mid);
    doc.text(`${companyName} · Confidential`, MARGIN, 290);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, 290, { align: 'right' });
  }

  return doc.output('blob');
};

export const generatePeriodReportPDFAndDownload = async (
  data: PeriodReportData,
  companyName?: string
): Promise<void> => {
  const blob = await generatePeriodReportPDF(data, companyName);
  const cap = data.period.charAt(0).toUpperCase() + data.period.slice(1);
  downloadBlob(blob, `${cap}_Report_${data.from}${data.to !== data.from ? `_to_${data.to}` : ''}.pdf`);
};
