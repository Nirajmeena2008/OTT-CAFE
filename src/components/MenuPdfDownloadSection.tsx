import React, { useState } from 'react';
import { FileDown, Check, Loader2 } from 'lucide-react';
import type { MenuItem, Category, CafeInfo } from '../types';
import { generateMenuPdf } from '../utils/menuPdfGenerator';

interface MenuPdfDownloadSectionProps {
  menuItems: MenuItem[];
  categories: Category[];
  cafeInfo?: CafeInfo | null;
  className?: string;
}

/**
 * Small inline button saying "Download Menu" on the side.
 */
export const MenuPdfDownloadSection: React.FC<MenuPdfDownloadSectionProps> = ({
  menuItems,
  categories,
  cafeInfo,
  className = '',
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      await generateMenuPdf(menuItems, categories, cafeInfo, {
        fileName: 'Out_of_the_Town_Menu.pdf',
      });
      setHasDownloaded(true);
      setTimeout(() => setHasDownloaded(false), 3500);
    } catch (err) {
      console.error('Failed to generate menu PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`flex items-center justify-end ${className}`}>
      <button
        id="btn-download-menu-inline"
        type="button"
        onClick={handleDownload}
        disabled={isGenerating}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/80 text-xs font-bold transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-2xs disabled:opacity-70"
        title="Download complete food & bakery menu with photos, descriptions & prices (PDF)"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
            <span>Preparing PDF...</span>
          </>
        ) : hasDownloaded ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Menu Downloaded!</span>
          </>
        ) : (
          <>
            <FileDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Download Menu</span>
          </>
        )}
      </button>
    </div>
  );
};

/**
 * Small button at the end of the food menu.
 * Replaces the previously large tab card with a compact button at the end of the menu.
 */
export const BelowMenuPdfDownloadSection: React.FC<MenuPdfDownloadSectionProps> = ({
  menuItems,
  categories,
  cafeInfo,
  className = '',
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      await generateMenuPdf(menuItems, categories, cafeInfo, {
        fileName: 'Out_of_the_Town_Menu.pdf',
      });
      setHasDownloaded(true);
      setTimeout(() => setHasDownloaded(false), 3500);
    } catch (err) {
      console.error('Failed to generate menu PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`mt-8 mb-2 flex items-center justify-center ${className}`}>
      <button
        id="btn-download-menu-bottom"
        type="button"
        onClick={handleDownload}
        disabled={isGenerating}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 border border-stone-200/90 dark:border-stone-700 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all hover:scale-102 active:scale-98 cursor-pointer disabled:opacity-70"
        title="Download complete menu as PDF"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            <span>Preparing PDF...</span>
          </>
        ) : hasDownloaded ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>Menu Downloaded!</span>
          </>
        ) : (
          <>
            <FileDown className="w-3.5 h-3.5 text-amber-500" />
            <span>Download Menu (PDF)</span>
          </>
        )}
      </button>
    </div>
  );
};
