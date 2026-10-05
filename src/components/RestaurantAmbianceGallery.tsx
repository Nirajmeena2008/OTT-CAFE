import React, { useState } from 'react';
import {
  Sparkles,
  Camera,
  Users,
  ChevronRight,
  Maximize2,
  X,
  Calendar,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { RESTAURANT_IMAGES, type RestaurantAmbianceImage } from '../data/restaurantImages';

interface RestaurantAmbianceGalleryProps {
  onOpenReservation?: () => void;
}

export const RestaurantAmbianceGallery: React.FC<RestaurantAmbianceGalleryProps> = ({
  onOpenReservation,
}) => {
  const [activeImage, setActiveImage] = useState<RestaurantAmbianceImage | null>(null);

  return (
    <section id="restaurant-ambiance-gallery" className="py-12 bg-stone-50 dark:bg-stone-900/60 border-y border-stone-200/80 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider mb-2 border border-amber-500/30">
              <Camera className="w-3.5 h-3.5" />
              <span>Real Restaurant Ambiance &amp; Interior Tour</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-black text-stone-900 dark:text-white tracking-tight">
              Inside Out of the Town (Kukas)
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-1 max-w-2xl">
              Our three spaces along NH-48 Jaipur: AC Family Lounge, Lush Garden Lawn, and a private Banquet Hall.
            </p>
          </div>
        </div>

        {/* 3-Space Grid Showcase -- one card per real bookable area (see SeatingArea in types.ts) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {RESTAURANT_IMAGES.map((img) => (
            <div
              key={img.id}
              onClick={() => setActiveImage(img)}
              className="group relative rounded-2xl bg-white dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col"
            >
              {/* Image Preview Container */}
              <div className="relative aspect-4/3 overflow-hidden bg-stone-100 dark:bg-stone-800">
                <img
                  src={img.imageUrl}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                {/* Zone Badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-amber-400 font-mono text-[10px] font-bold uppercase tracking-wider border border-white/10">
                    {img.zone}
                  </span>
                </div>

                {/* Expand Icon */}
                <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/50 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>

                {/* Bottom title on image */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                  <h4 className="font-serif font-bold text-sm leading-tight text-white drop-shadow-sm">
                    {img.title}
                  </h4>
                  <p className="text-[11px] text-amber-200 line-clamp-1 mt-0.5 font-medium">
                    {img.tagline}
                  </p>
                </div>
              </div>

              {/* Bottom Card Content */}
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2">
                  {img.description}
                </p>

                {/* Feature Chips */}
                <div className="flex flex-wrap gap-1">
                  {img.features.slice(0, 2).map((feat, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[10px] text-stone-600 dark:text-stone-400 font-medium"
                    >
                      {feat}
                    </span>
                  ))}
                  {img.features.length > 2 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[10px] text-stone-500 font-medium">
                      +{img.features.length - 2} more
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px]">
                  <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <Users className="w-3 h-3 text-amber-600" />
                    <span>{img.capacity}</span>
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    <span>View Space</span>
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>


      </div>

      {/* LIGHTBOX MODAL FULLSCREEN VIEWER */}
      {activeImage && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden shadow-2xl">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* High-Res Image View */}
            <div className="relative aspect-16/9 w-full bg-black overflow-hidden">
              <img
                src={activeImage.imageUrl}
                alt={activeImage.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-4">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950 font-mono text-xs font-black uppercase">
                  {activeImage.zone}
                </span>
              </div>
            </div>

            {/* Modal Detail Content */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-serif font-black text-stone-900 dark:text-stone-100">
                  {activeImage.title}
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 mt-1">
                  {activeImage.tagline}
                </p>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-2">
                  {activeImage.description}
                </p>
              </div>

              {/* Key Features Grid */}
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Key Space Features
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activeImage.features.map((feat, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer info & CTA */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 text-stone-600 dark:text-stone-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-amber-600" />
                    <strong>Capacity:</strong> {activeImage.capacity}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    <span>SP 41 B, Kukas (NH-48)</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveImage(null)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold"
                  >
                    Close
                  </button>
                  {onOpenReservation && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveImage(null);
                        onOpenReservation();
                      }}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold flex items-center justify-center gap-1.5"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Book this Table</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
