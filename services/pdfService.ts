import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, Invoice, CompanyDetails, Payslip, Employee } from '../types';

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
  XXLARGE: 28,
  XLARGE: 16,
  LARGE: 14,
  MEDIUM: 12,
  REGULAR: 10,
  SMALL: 9,
  XSMALL: 8,
  XXSMALL: 7,
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
};

const TABLE_STYLES = {
  HEAD_FILL: [240, 240, 240] as [number, number, number],
  CELL_PADDING: 4,
  HEAD_PADDING: 5,
  LINE_WIDTH: 0.3,
};

const COLUMN_WIDTHS = {
  DESCRIPTION: 100,
  QUANTITY: 20,
  UNIT_PRICE: 35,
  AMOUNT: 35,
  EARNINGS_DESC: 70,
  EARNINGS_AMT: 25,
  DEDUCTIONS_DESC: 55,
  DEDUCTIONS_AMT: 30,
};

const MAX_TEXT_LENGTH = 5000;
const MAX_NOTES_LENGTH = 2000;

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
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
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
  return email.replace(/[<>\"']/g, '').slice(0, 254);
}

function sanitizeCompany(company: CompanyDetails): CompanyDetails {
  return {
    ...company,
    name: sanitizeText(company.name) || 'Unknown Company',
    address: sanitizeText(company.address),
    contact_email: sanitizeEmail(company.contact_email),
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
    description: sanitizeText(quote.description),
    status: (sanitizeText(quote.status) || 'draft') as Quote['status'],
    amount_usd: sanitizeNumber(quote.amount_usd),
    items: quote.items?.map(item => ({
      ...item,
      description: sanitizeText(item.description) || 'Item',
      quantity: Math.max(1, sanitizeNumber(item.quantity)),
      unit_price: sanitizeNumber(item.unit_price),
      amount: sanitizeNumber(item.amount),
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
    description: sanitizeText(invoice.description),
    notes: sanitizeText(invoice.notes)?.slice(0, MAX_NOTES_LENGTH),
    terms_and_conditions: sanitizeText(invoice.terms_and_conditions)?.slice(0, MAX_NOTES_LENGTH),
    status: (sanitizeText(invoice.status) || 'draft') as Invoice['status'],
    amount_usd: sanitizeNumber(invoice.amount_usd),
    items: invoice.items?.map(item => ({
      ...item,
      description: sanitizeText(item.description) || 'Item',
      quantity: Math.max(1, sanitizeNumber(item.quantity)),
      unit_price: sanitizeNumber(item.unit_price),
      amount: sanitizeNumber(item.amount),
    })),
  };
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

  constructor(company: CompanyDetails, filename: string) {
    this.doc = new jsPDF();
    this.company = company;
    this.filename = filename;
  }

  // -------------------------------------------------------------------------
  // Header & Footer
  // -------------------------------------------------------------------------

  addHeader(): this {
    const { doc, company } = this;

    // Company Name
    doc.setFontSize(FONT_SIZES.XLARGE);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(company.name.toUpperCase(), LAYOUT.MARGIN_LEFT, LAYOUT.HEADER_Y);

    // Company Address
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    const addressLines = company.address.split(',').map(line => line.trim());
    let yPos = 26;
    addressLines.forEach(line => {
      doc.text(line, LAYOUT.MARGIN_LEFT, yPos);
      yPos += 4;
    });

    // Contact details
    yPos += 1;
    if (company.phone) {
      doc.text(`Tel: ${company.phone}`, LAYOUT.MARGIN_LEFT, yPos);
      yPos += 4;
    }
    doc.text(`Email: ${company.contact_email}`, LAYOUT.MARGIN_LEFT, yPos);
    yPos += 4;
    if (company.website) {
      doc.text(company.website, LAYOUT.MARGIN_LEFT, yPos);
      yPos += 4;
    }
    if (company.tax_id) {
      doc.text(`Tax ID: ${company.tax_id}`, LAYOUT.MARGIN_LEFT, yPos);
    }

    return this;
  }

  addFooter(options?: { additionalText?: string; fontSize?: number }): this {
    const { doc, company } = this;

    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_THIN);
    doc.line(LAYOUT.MARGIN_LEFT, LAYOUT.FOOTER_Y, LAYOUT.MARGIN_RIGHT, LAYOUT.FOOTER_Y);

    const fontSize = options?.fontSize || FONT_SIZES.XSMALL;
    doc.setFontSize(fontSize);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.LIGHT_GRAY);

    const centerX = LAYOUT.PAGE_WIDTH / 2;
    let yPos = 282;

    doc.text(company.name, centerX, yPos, { align: 'center' });
    yPos += 6;

    const contactInfo = `${company.contact_email}${company.phone ? ` | ${company.phone}` : ''} | Generated: ${new Date().toLocaleDateString()}`;
    doc.text(contactInfo, centerX, yPos, { align: 'center' });

    if (options?.additionalText) {
      yPos += 6;
      doc.text(options.additionalText, centerX, yPos, { align: 'center' });
    }

    return this;
  }

  // -------------------------------------------------------------------------
  // Title & Separator
  // -------------------------------------------------------------------------

  addTitle(text: string): this {
    const { doc } = this;

    doc.setFontSize(FONT_SIZES.XXLARGE);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(text, LAYOUT.MARGIN_RIGHT, 25, { align: 'right' });

    // Separator line
    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_REGULAR);
    doc.line(LAYOUT.MARGIN_LEFT, LAYOUT.SEPARATOR_Y, LAYOUT.MARGIN_RIGHT, LAYOUT.SEPARATOR_Y);

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
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('STATUS', 132, 39);
    doc.text('TOTAL DUE', 132, 46);

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...statusColor);
    doc.text(invoice.status.toUpperCase(), 192, 39, { align: 'right' });

    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(`$${invoice.amount_usd.toLocaleString()}`, 192, 46, { align: 'right' });

    return this;
  }

  // -------------------------------------------------------------------------
  // Metadata Sections
  // -------------------------------------------------------------------------

  addMetadataSection(
    labels: string[],
    values: string[],
    x: number,
    startY: number
  ): this {
    const { doc } = this;

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);

    labels.forEach((label, index) => {
      doc.text(label, x, startY + index * 7);
    });

    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.PRIMARY_DARK);

    values.forEach((value, index) => {
      doc.text(value, LAYOUT.MARGIN_RIGHT, startY + index * 7, { align: 'right' });
    });

    return this;
  }

  addClientSection(
    title: string,
    name: string,
    email?: string,
    address?: string,
    additionalInfo?: { label: string; value: string }[]
  ): this {
    const { doc } = this;

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text(title, LAYOUT.MARGIN_LEFT, 65);

    doc.setFontSize(FONT_SIZES.REGULAR);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(name, LAYOUT.MARGIN_LEFT, 73);

    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);

    let yPos = 80;
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

    return this;
  }

  // -------------------------------------------------------------------------
  // Tables
  // -------------------------------------------------------------------------

  addItemsTable(
    data: (string | number)[][],
    startY: number = 105
  ): { finalY: number } {
    const { doc } = this;

    autoTable(doc, {
      startY,
      head: [['Description', 'Qty', 'Unit Price', 'Amount']],
      body: data.map(row => row.map(cell => String(cell))),
      theme: 'plain',
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
        3: { cellWidth: COLUMN_WIDTHS.AMOUNT, halign: 'right', fontStyle: 'bold' },
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
      head: [['Earnings', 'Amount']],
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
      margin: { left: LAYOUT.MARGIN_LEFT, right: 115 },
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
      head: [['Deductions', 'Amount']],
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
      margin: { left: 115, right: LAYOUT.MARGIN_LEFT },
      alternateRowStyles: {
        fillColor: COLORS.FILL_ALTERNATE,
      },
    });

    return { finalY: (doc as any).lastAutoTable?.finalY || startY + 40 };
  }

  // -------------------------------------------------------------------------
  // Total Sections
  // -------------------------------------------------------------------------

  addTotalSection(amount: number, label: string = 'TOTAL'): this {
    const { doc } = this;
    const finalY = (doc as any).lastAutoTable?.finalY || 140;

    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_REGULAR);
    doc.line(130, finalY + 8, LAYOUT.MARGIN_RIGHT, finalY + 8);

    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(`${label}:`, 133, finalY + 18);

    doc.setFontSize(FONT_SIZES.LARGE);
    doc.text(`$${amount.toLocaleString()}`, 192, finalY + 18, { align: 'right' });

    doc.setLineWidth(LAYOUT.LINE_WIDTH_THICK);
    doc.line(130, finalY + 22, LAYOUT.MARGIN_RIGHT, finalY + 22);

    return this;
  }

  addInvoiceTotalSection(invoice: Invoice): this {
    const { doc } = this;
    const finalY = (doc as any).lastAutoTable?.finalY || 140;

    // Subtotal line
    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_THIN);
    doc.line(130, finalY + 8, LAYOUT.MARGIN_RIGHT, finalY + 8);

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('Subtotal:', 133, finalY + 15);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(`$${invoice.amount_usd.toLocaleString()}`, 192, finalY + 15, { align: 'right' });

    // Total Due
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_REGULAR);
    doc.line(130, finalY + 19, LAYOUT.MARGIN_RIGHT, finalY + 19);

    doc.setFontSize(FONT_SIZES.MEDIUM);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('TOTAL DUE:', 133, finalY + 28);

    doc.setFontSize(FONT_SIZES.LARGE);
    doc.text(`$${invoice.amount_usd.toLocaleString()}`, 192, finalY + 28, { align: 'right' });

    doc.setLineWidth(LAYOUT.LINE_WIDTH_THICK);
    doc.line(130, finalY + 32, LAYOUT.MARGIN_RIGHT, finalY + 32);

    return this;
  }

  addPayslipSummary(payslip: Payslip): this {
    const { doc } = this;
    const earningsEndY = (doc as any).lastAutoTable?.finalY || 165;
    const summaryY = earningsEndY + 15;

    // Summary border box
    doc.setDrawColor(...COLORS.BORDER_GRAY);
    doc.setLineWidth(LAYOUT.LINE_WIDTH_REGULAR);
    doc.rect(LAYOUT.MARGIN_LEFT, summaryY, 180, 35);

    // Gross Pay
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('GROSS PAY', 35, summaryY + 12);
    doc.setFontSize(FONT_SIZES.LARGE);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(`$${payslip.gross_pay.toLocaleString()}`, 35, summaryY + 25);

    // Deductions
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('DEDUCTIONS', 100, summaryY + 12);
    doc.setFontSize(FONT_SIZES.LARGE);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(`-$${payslip.total_deductions.toLocaleString()}`, 100, summaryY + 25);

    // Net Pay (highlighted)
    doc.setFillColor(...COLORS.FILL_LIGHT);
    doc.rect(145, summaryY, 50, 35, 'F');
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text('NET PAY', 170, summaryY + 12, { align: 'center' });
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

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(LAYOUT.MARGIN_LEFT, yPos - 5, 180, boxHeight, 3, 3, 'F');

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text('Notes:', LAYOUT.MARGIN_LEFT, yPos);

    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);
    doc.text(noteLines, LAYOUT.MARGIN_LEFT, yPos + 6);

    return this;
  }

  // -------------------------------------------------------------------------
  // Terms Section
  // -------------------------------------------------------------------------

  addTerms(type: 'quote' | 'invoice', finalY: number, showPaymentTerms: boolean = true, customTerms?: string): this {
    const { doc } = this;

    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.BOLD);
    doc.setTextColor(...COLORS.PRIMARY_DARK);
    doc.text(type === 'quote' ? 'Terms & Conditions' : 'Payment Terms', LAYOUT.MARGIN_LEFT, finalY + 38);

    doc.setFontSize(FONT_SIZES.XSMALL);
    doc.setFont(FONTS.HELVETICA, FONTS.NORMAL);
    doc.setTextColor(...COLORS.SECONDARY_GRAY);

    if (type === 'quote') {
      doc.text('1. Quote is valid for the period specified above', LAYOUT.MARGIN_LEFT, finalY + 46);
      doc.text('2. Prices are in USD and exclude applicable taxes unless stated', LAYOUT.MARGIN_LEFT, finalY + 52);
      doc.text('3. Payment terms as agreed upon acceptance', LAYOUT.MARGIN_LEFT, finalY + 58);
    } else if (customTerms) {
      const termLines = doc.splitTextToSize(customTerms, 180);
      doc.text(termLines, LAYOUT.MARGIN_LEFT, finalY + 46);
    } else if (showPaymentTerms) {
      doc.text('1. Payment is due by the date specified above', LAYOUT.MARGIN_LEFT, finalY + 46);
      doc.text('2. Please include invoice number with your payment', LAYOUT.MARGIN_LEFT, finalY + 52);
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
    builder
      .addHeader()
      .addTitle('QUOTATION')
      .addMetadataSection(
        ['Quote Number:', 'Issue Date:', 'Valid Until:', 'Status:'],
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
            item.description,
            item.quantity.toString(),
            `$${item.unit_price.toLocaleString()}`,
            `$${item.amount.toLocaleString()}`,
          ])
        : [
            [
              sanitizedQuote.description || 'Professional Services',
              '1',
              `$${sanitizedQuote.amount_usd.toLocaleString()}`,
              `$${sanitizedQuote.amount_usd.toLocaleString()}`,
            ],
          ];

    builder.addItemsTable(tableData);
    builder.addTotalSection(sanitizedQuote.amount_usd);
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
    builder
      .addHeader()
      .addTitle('INVOICE')
      .addInvoiceBanner(sanitizedInvoice)
      .addMetadataSection(
        ['Invoice Number:', 'Issue Date:', 'Due Date:', 'Status:'],
        [
          sanitizedInvoice.invoice_number,
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
          sanitizedInvoice.status.toUpperCase(),
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
            item.description,
            item.quantity.toString(),
            `$${item.unit_price.toLocaleString()}`,
            `$${item.amount.toLocaleString()}`,
          ])
        : [
            [
              sanitizedInvoice.description || 'Professional Services',
              '1',
              `$${sanitizedInvoice.amount_usd.toLocaleString()}`,
              `$${sanitizedInvoice.amount_usd.toLocaleString()}`,
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
    builder.addHeader().addTitle('PAYSLIP');

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

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
