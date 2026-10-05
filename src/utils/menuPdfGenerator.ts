import { jsPDF } from 'jspdf';
import type { MenuItem, Category, CafeInfo } from '../types.js';

export interface GeneratePdfOptions {
  fileName?: string;
  openInNewTab?: boolean;
}

/**
 * Loads an image URL via an off-screen canvas and returns a clean base64 data URL.
 * Includes graceful timeout and error handling so PDF generation never fails.
 */
async function loadItemImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      resolve(null);
    }, 2500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const targetW = 160;
        const targetH = 120;
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Fill warm neutral backdrop
        ctx.fillStyle = '#f5f5f4';
        ctx.fillRect(0, 0, targetW, targetH);

        // Aspect fill / cover
        const hRatio = targetW / img.width;
        const vRatio = targetH / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const shiftX = (targetW - img.width * ratio) / 2;
        const shiftY = (targetH - img.height * ratio) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height, shiftX, shiftY, img.width * ratio, img.height * ratio);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Generates an elegant printable PDF menu for Out of the Town (OTT)
 * complete with item photos, dietary marks, descriptions, prices, and contact numbers.
 */
export async function generateMenuPdf(
  menuItems: MenuItem[],
  categories: Category[],
  cafeInfo?: CafeInfo | null,
  options: GeneratePdfOptions = {}
): Promise<{ doc: jsPDF; blobUrl?: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const cafeName = cafeInfo?.name || 'OUT OF THE TOWN';
  const cafeTagline = cafeInfo?.tagline || 'Restro & Artisan Bakery • Kukas, Jaipur';
  const cafeAddress = cafeInfo?.address || 'SP 41 B, Kukas, Delhi-Jaipur Road (NH-48), Jaipur, Rajasthan 302038';
  const cafePhone = cafeInfo?.phone || '+91 98289 19626';
  const cafeEmail = cafeInfo?.email || 'care@outofthetownjaipur.com';

  // Preload food item photos in parallel
  const imageMap = new Map<string, string | null>();
  const itemsWithImages = menuItems.filter((it) => Boolean(it.image));
  await Promise.all(
    itemsWithImages.map(async (item) => {
      const dataUrl = await loadItemImageAsDataUrl(item.image);
      imageMap.set(item.id, dataUrl);
    })
  );

  // Helper for adding a new page and resetting cursor
  const addNewPage = () => {
    doc.addPage();
    currentY = margin + 8;
    drawPageDecorations();
  };

  // Helper to check vertical space
  const ensureSpace = (requiredHeight: number) => {
    if (currentY + requiredHeight > pageHeight - margin - 14) {
      addNewPage();
    }
  };

  // Border & subtle watermark decorations
  const drawPageDecorations = () => {
    // Outer elegant amber border
    doc.setDrawColor(217, 119, 6); // Amber-600
    doc.setLineWidth(0.5);
    doc.rect(margin - 3, margin - 3, contentWidth + 6, pageHeight - (margin - 3) * 2);

    // Inner thin border
    doc.setDrawColor(245, 158, 11); // Amber-500
    doc.setLineWidth(0.2);
    doc.rect(margin - 1.5, margin - 1.5, contentWidth + 3, pageHeight - (margin - 1.5) * 2);
  };

  // Setup Page 1
  drawPageDecorations();

  // Top header banner background
  doc.setFillColor(28, 25, 23); // Stone-900
  doc.roundedRect(margin, currentY, contentWidth, 34, 3, 3, 'F');

  // Restaurant Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(cafeName.toUpperCase(), pageWidth / 2, currentY + 11, { align: 'center' });

  // Tagline
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11); // Amber-400
  doc.text(cafeTagline, pageWidth / 2, currentY + 17.5, { align: 'center' });

  // Address & Direct Helpline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(220, 220, 220);
  doc.text(
    `${cafeAddress}   |   Orders & Helpline: ${cafePhone}`,
    pageWidth / 2,
    currentY + 23.5,
    { align: 'center' }
  );

  // Services banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(253, 230, 138); // Amber-200
  doc.text(
    'DINE-IN  •  ONLINE ORDERING  •  TAKEAWAY  •  CUSTOM CAKES  •  GARDEN LAWN DINING',
    pageWidth / 2,
    currentY + 29,
    { align: 'center' }
  );

  currentY += 40;

  // Group items by category
  const categoryMap = new Map<string, MenuItem[]>();
  const activeCategories = categories.filter((c) => c.slug !== 'all');
  activeCategories.forEach((cat) => {
    categoryMap.set(cat.slug, []);
  });

  menuItems.forEach((item) => {
    const slug = (item.category || '').toLowerCase();
    let target = categoryMap.get(slug);
    if (!target) {
      const foundCat = activeCategories.find(
        (c) => c.name.toLowerCase() === slug || c.slug.toLowerCase() === slug
      );
      if (foundCat) target = categoryMap.get(foundCat.slug);
    }
    if (target) {
      target.push(item);
    } else {
      const fallback = activeCategories[0]?.slug || 'general';
      if (!categoryMap.has(fallback)) categoryMap.set(fallback, []);
      categoryMap.get(fallback)!.push(item);
    }
  });

  // Render each category section
  activeCategories.forEach((cat) => {
    const items = categoryMap.get(cat.slug) || [];
    if (items.length === 0) return;

    ensureSpace(28);

    // Category Header Banner
    doc.setFillColor(254, 243, 199); // Amber-100
    doc.roundedRect(margin, currentY, contentWidth, 7, 1.5, 1.5, 'F');

    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.4);
    doc.line(margin, currentY + 7, margin + contentWidth, currentY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text(cat.name.toUpperCase(), margin + 4, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);
    doc.text(`${items.length} Dishes`, margin + contentWidth - 4, currentY + 5, { align: 'right' });

    currentY += 10;

    // Render items in 2 parallel columns with photos, descriptions and prices
    const colWidth = (contentWidth - 4) / 2;
    const colLefts = [margin, margin + colWidth + 4];

    for (let i = 0; i < items.length; i += 2) {
      const itemLeft = items[i];
      const itemRight = items[i + 1];

      // Item Card Height: 20mm with photo
      const cardHeight = 20;
      ensureSpace(cardHeight + 2);

      renderMenuItemWithPhoto(doc, itemLeft, colLefts[0], currentY, colWidth, cardHeight, imageMap.get(itemLeft.id));

      if (itemRight) {
        renderMenuItemWithPhoto(doc, itemRight, colLefts[1], currentY, colWidth, cardHeight, imageMap.get(itemRight.id));
      }

      currentY += cardHeight + 2.5;
    }

    currentY += 4;
  });

  // Ensure space for the closing Contact & Pre-Order Reservation Banner on the final page
  ensureSpace(28);
  doc.setFillColor(254, 243, 199); // Light amber
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(180, 83, 9);
  doc.text('OUT OF THE TOWN (OTT) — CUSTOM CAKES, PARTY ORDERS & TABLE RESERVATIONS', pageWidth / 2, currentY + 6, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(28, 25, 23);
  doc.text(
    `Direct Call & WhatsApp Helpline: ${cafePhone}    •    Email: ${cafeEmail}`,
    pageWidth / 2,
    currentY + 12,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(87, 83, 78);
  doc.text(
    `Timing: 11:00 AM – 12:00 AM Midnight (Daily)  |  Location: SP 41 B, Kukas, NH-48, Jaipur`,
    pageWidth / 2,
    currentY + 17,
    { align: 'center' }
  );
  doc.text(
    `Live Kitchen  •  Stone Oven Pizzas  •  Fresh Cream Cheesecakes  •  Custom Celebration Cakes On Order`,
    pageWidth / 2,
    currentY + 21,
    { align: 'center' }
  );

  // Add Footers and Contact Number on the bottom of EVERY page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Footer contact bar
    doc.setFillColor(28, 25, 23); // Stone-900 dark
    doc.roundedRect(margin, pageHeight - margin - 7.5, contentWidth, 6.5, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(253, 230, 138); // Amber-200
    doc.text(
      `CONTACT & ORDERS: ${cafePhone}   |   WHATSAPP: ${cafePhone}   |   KUKAS, JAIPUR (NH-48)`,
      margin + 3,
      pageHeight - margin - 3.2
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(220, 220, 220);
    doc.text(
      `Page ${p} of ${totalPages}`,
      margin + contentWidth - 3,
      pageHeight - margin - 3.2,
      { align: 'right' }
    );
  }

  const outputFileName = options.fileName || 'Out_of_the_Town_Restro_Bakery_Menu.pdf';

  if (options.openInNewTab) {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    return { doc, blobUrl };
  } else {
    doc.save(outputFileName);
    return { doc };
  }
}

/**
 * Renders an individual menu item with photo, dietary icon, name, description, and price.
 */
function renderMenuItemWithPhoto(
  doc: jsPDF,
  item: MenuItem,
  x: number,
  y: number,
  width: number,
  height: number,
  photoDataUrl?: string | null
) {
  // Card Container Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(231, 229, 228); // Stone-200
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  const photoWidth = 19;
  const photoHeight = 16;
  const photoX = x + 2;
  const photoY = y + 2;

  // Render Item Photo
  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'JPEG', photoX, photoY, photoWidth, photoHeight);
      doc.setDrawColor(217, 119, 6);
      doc.setLineWidth(0.2);
      doc.rect(photoX, photoY, photoWidth, photoHeight, 'D');
    } catch {
      renderPhotoPlaceholder(doc, item, photoX, photoY, photoWidth, photoHeight);
    }
  } else {
    renderPhotoPlaceholder(doc, item, photoX, photoY, photoWidth, photoHeight);
  }

  // Text content starts to the right of the photo
  const textX = photoX + photoWidth + 2.5;
  const textWidth = width - (photoWidth + 6.5);

  // Dietary Dot Indicator
  if (item.isVeg) {
    doc.setFillColor(22, 163, 74); // Green
    doc.circle(textX + 1.2, y + 3.2, 1.1, 'F');
  } else {
    doc.setFillColor(220, 38, 38); // Red
    doc.circle(textX + 1.2, y + 3.2, 1.1, 'F');
  }

  // Dish Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(28, 25, 23); // Stone-900

  let displayName = item.name;
  if (displayName.length > 22) {
    displayName = displayName.substring(0, 21) + '…';
  }
  doc.text(displayName, textX + 3.5, y + 3.8);

  // Price (Right Aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9); // Amber-700
  const priceString = `Rs. ${item.price}`;
  doc.text(priceString, x + width - 2, y + 3.8, { align: 'right' });

  // Bestseller / Chef's Pick Badge
  let descOffsetY = y + 7.5;
  if (item.isBestseller) {
    doc.setFillColor(254, 243, 199); // Amber-100
    doc.roundedRect(textX + 3.5, y + 4.8, 14, 2.5, 0.5, 0.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.setTextColor(180, 83, 9);
    doc.text('BESTSELLER', textX + 10.5, y + 6.6, { align: 'center' });
    descOffsetY = y + 9.5;
  }

  // Description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  const descLines = doc.splitTextToSize(item.description || '', textWidth);
  const maxLines = item.isBestseller ? 2 : 3;
  const linesToRender = descLines.slice(0, maxLines);
  doc.text(linesToRender, textX + 0.5, descOffsetY);
}

/**
 * Fallback stylish photo placeholder if image is missing or cannot be loaded over CORS.
 */
function renderPhotoPlaceholder(
  doc: jsPDF,
  item: MenuItem,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setFillColor(245, 245, 244); // Stone-100
  doc.setDrawColor(214, 211, 209);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 83, 9);
  const initials = item.name.substring(0, 3).toUpperCase();
  doc.text(initials, x + w / 2, y + h / 2 + 1, { align: 'center' });
}
