import { jsPDF } from 'jspdf';
import type { Order, CafeInfo } from '../types.js';

export function generateOrderInvoicePdf(order: Order, cafeInfo?: CafeInfo): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const cafeName = cafeInfo?.name || 'Out of the Town - Restro and Bakery';
  const cafeAddress =
    cafeInfo?.address ||
    'SP 41 B, Near RIICO Industrial Area & Arya College, Kukas, Delhi-Jaipur Road (NH-48), Jaipur - 302038';
  const cafePhone = cafeInfo?.phone || '+91 98289 19626';
  const cafeEmail = cafeInfo?.email || 'care@outofthetownjaipur.com';

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  // Header Banner Background
  doc.setFillColor(28, 25, 23); // dark stone (#1c1917)
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Cafe Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(cafeName, 14, y);

  // Tagline / Subtitle
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(214, 211, 209);
  doc.text('Gourmet Restro, Artisan Bakery | Kukas, Jaipur', 14, y);

  // Address & Contacts
  y += 5;
  doc.setFontSize(7.5);
  doc.setTextColor(168, 162, 158);
  doc.text(`NH-48, Kukas | Tel: ${cafePhone} | Email: ${cafeEmail}`, 14, y);

  // TAX INVOICE BADGE on top right
  doc.setFillColor(217, 119, 6); // amber-600
  doc.roundedRect(pageWidth - 60, 10, 46, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TAX INVOICE / BILL', pageWidth - 37, 16.5, { align: 'center' });
  doc.setFontSize(7);
  doc.text('ORIGINAL FOR RECIPIENT', pageWidth - 37, 21, { align: 'center' });

  // Body content starts at y = 46
  y = 46;

  // Order & Invoice Details Box
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, y, pageWidth - 28, 28, 2, 2, 'FD');

  // Left column: Invoice No & Date
  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Invoice No: INV-${order.id.replace(/[^a-zA-Z0-9]/g, '')}`, 18, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Order ID: #${order.id}`, 18, y + 13);
  doc.text(`Date & Time: ${new Date(order.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 18, y + 19);
  doc.text(`Order Type: ${order.orderType.toUpperCase()} ${order.tableNumber ? `(Table: ${order.tableNumber})` : ''}`, 18, y + 24);

  // Right column: Customer Information
  const rightColX = pageWidth / 2 + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Billed To (Customer):', rightColX, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Name: ${order.customerName}`, rightColX, y + 13);
  doc.text(`Phone: ${order.customerPhone}`, rightColX, y + 19);
  if (order.deliveryAddress) {
    const splitAddr = doc.splitTextToSize(`Address: ${order.deliveryAddress}`, pageWidth - rightColX - 18);
    doc.text(splitAddr, rightColX, y + 24);
  } else {
    doc.text(`Payment: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus.toUpperCase()})`, rightColX, y + 24);
  }

  y += 34;

  // Table Header
  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(209, 213, 219);
  doc.rect(14, y, pageWidth - 28, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text('#', 18, y + 5.5);
  doc.text('Item Description', 28, y + 5.5);
  doc.text('Type', 110, y + 5.5);
  doc.text('Qty', 130, y + 5.5, { align: 'right' });
  doc.text('Rate', 155, y + 5.5, { align: 'right' });
  doc.text('Amount (INR)', pageWidth - 18, y + 5.5, { align: 'right' });

  y += 8;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(31, 41, 55);

  order.items.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    const isEven = index % 2 === 0;

    if (isEven) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(250, 250, 250);
    }
    doc.rect(14, y, pageWidth - 28, 7.5, 'F');
    doc.setDrawColor(243, 244, 246);
    doc.line(14, y + 7.5, pageWidth - 14, y + 7.5);

    doc.text(`${index + 1}`, 18, y + 5);
    doc.text(item.name.slice(0, 45), 28, y + 5);
    doc.text(item.isVeg ? 'Veg' : 'Non-Veg', 110, y + 5);
    doc.text(`${item.quantity}`, 130, y + 5, { align: 'right' });
    doc.text(`Rs. ${item.price.toFixed(2)}`, 155, y + 5, { align: 'right' });
    doc.text(`Rs. ${lineTotal.toFixed(2)}`, pageWidth - 18, y + 5, { align: 'right' });

    y += 7.5;
  });

  y += 4;

  // Financial Breakdown Box (Right aligned)
  const breakdownWidth = 85;
  const breakdownX = pageWidth - 14 - breakdownWidth;

  doc.setDrawColor(229, 231, 235);
  doc.line(breakdownX, y, pageWidth - 14, y);
  y += 4;

  const addLine = (label: string, value: string, isBold: boolean = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 9.5 : 8.5);
    doc.setTextColor(isBold ? 17 : 75, isBold ? 24 : 85, isBold ? 39 : 99);
    doc.text(label, breakdownX, y);
    doc.text(value, pageWidth - 18, y, { align: 'right' });
    y += 5.5;
  };

  addLine('Subtotal:', `Rs. ${order.subtotal.toFixed(2)}`);
  if (order.discount > 0) {
    addLine(`Discount ${order.promoCode ? `(${order.promoCode})` : ''}:`, `-Rs. ${order.discount.toFixed(2)}`);
  }
  if (order.deliveryFee > 0) {
    addLine('Delivery Fee:', `Rs. ${order.deliveryFee.toFixed(2)}`);
  }
  addLine('GST & Food Taxes (5%):', `Rs. ${order.tax.toFixed(2)}`);

  // Total Divider & Grand Total
  doc.setDrawColor(209, 213, 219);
  doc.line(breakdownX, y, pageWidth - 14, y);
  y += 2;

  doc.setFillColor(254, 243, 199); // amber-100
  doc.roundedRect(breakdownX - 2, y, breakdownWidth + 2, 8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('Grand Total (Payable):', breakdownX + 2, y + 5.5);
  doc.text(`Rs. ${order.total.toFixed(2)}`, pageWidth - 18, y + 5.5, { align: 'right' });

  y += 14;

  // Left Note / Payment Status badge
  const noteY = y - 24;
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(14, noteY, breakdownX - 20, 22, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text('Payment Information:', 18, noteY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text(`Mode: ${order.paymentMethod.toUpperCase()}`, 18, noteY + 10.5);
  doc.text(`Status: ${order.paymentStatus.toUpperCase()} (Recorded in MySQL)`, 18, noteY + 15);
  doc.text(`FSSAI Reg: 22223074000184 | GSTIN: 08AAECO4521P1ZT`, 18, noteY + 19.5);

  // Footer & Disclaimer
  const footerY = doc.internal.pageSize.getHeight() - 18;
  doc.setDrawColor(229, 231, 235);
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  doc.text('Thank you for dining with Out of the Town - Restro and Bakery!', pageWidth / 2, footerY, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    'This is a computer-generated tax invoice backed by MySQL Relational Database. No physical signature required.',
    pageWidth / 2,
    footerY + 4,
    { align: 'center' }
  );

  // Trigger browser download
  doc.save(`Invoice_${order.id}.pdf`);
}
