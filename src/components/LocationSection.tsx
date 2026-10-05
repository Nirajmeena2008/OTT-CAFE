import React from 'react';
import {
  MapPin,
  Navigation,
  Clock,
  Phone,
  Star,
  Car,
  Compass,
  CalendarCheck,
} from 'lucide-react';
import { OttLogo } from './OttLogo';

interface LocationSectionProps {
  onOpenReservation?: () => void;
}

export const LocationSection: React.FC<LocationSectionProps> = ({ onOpenReservation }) => {
  const address =
    'SP 41 B, Near RIICO Industrial Area & Arya College, Kukas, Delhi-Jaipur Expressway (NH-48), Jaipur, Rajasthan 302038';
  const landmark = 'Near Umaid Haveli & Arya 1st Old Campus';
  const directionsUrl =
    'https://www.google.com/maps/dir/?api=1&destination=Out+of+the+Town+-+Restro+and+Bakery+Kukas+Jaipur';
  const embedUrl =
    'https://maps.google.com/maps?q=Out+of+the+Town+-+Restro+and+Bakery,+Kukas,+Jaipur,+Rajasthan&t=&z=15&ie=UTF8&iwloc=&output=embed';

  return (
    <section
      id="location-and-map-section"
      className="my-16 sm:my-20 scroll-mt-24 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      aria-label="Restaurant Location and Google Map"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-300/40">
            <MapPin className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>Visit Us on NH-48</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100">
            Find Us &amp; Directions
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 max-w-2xl">
            Located right on NH-48 in Kukas, Out of the Town offers ample
            car parking, lush outdoor seating, and express dine-in &amp; takeaway for travelers and campus residents.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            id="btn-get-directions-external"
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-600/20 transition-all cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>Get Directions</span>
          </a>
        </div>
      </div>

      {/* Main Location Content Box: Google Map + Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-stone-900 rounded-3xl p-4 sm:p-6 border border-stone-200/90 dark:border-stone-800 shadow-xl">
        {/* Left Column (5 cols): Location Details & Actions */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Cafe Badge with Logo */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
              <OttLogo size="lg" showText lightText={false} />
              <div className="text-right">
                <div className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                  <span>4.5 Google</span>
                </div>
                <div className="text-[10.5px] text-stone-500 dark:text-stone-400 mt-0.5">
                  550+ verified reviews
                </div>
              </div>
            </div>

            {/* Address & Landmark */}
            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-stone-900 dark:text-stone-100">
                    Restro &amp; Bakery Address
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 mt-0.5 text-xs leading-relaxed">
                    {address}
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                    <Compass className="w-3 h-3" />
                    <span>Landmark: {landmark}</span>
                  </div>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                    Opening Hours
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 text-xs mt-0.5">
                    Monday – Sunday: <span className="font-semibold text-emerald-600 dark:text-emerald-400">11:00 AM – 12:00 AM (Midnight)</span>
                  </p>
                </div>
              </div>

              {/* Contact / Phone Hotline */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                    Hotline &amp; Takeaway Orders
                  </div>
                  <a
                    href="tel:+919828919626"
                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    +91 98289 19626
                  </a>
                </div>
              </div>
            </div>

            {/* Travel & Amenities Tags */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                <Car className="w-3.5 h-3.5 text-amber-600" /> Free Parking
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                Family Seating
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                Drive-Thru / Takeaway
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                High-Speed WiFi
              </span>
            </div>
          </div>

          {/* Table Booking CTA */}
          {onOpenReservation && (
            <button
              id="location-book-table-btn"
              onClick={onOpenReservation}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <CalendarCheck className="w-4.5 h-4.5" />
              <span>Book a Table at Out of the Town</span>
            </button>
          )}
        </div>

        {/* Right Column (7 cols): Interactive Google Map Embed */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="relative w-full h-80 sm:h-96 lg:h-full min-h-[320px] rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-inner bg-stone-100 dark:bg-stone-800">
            <iframe
              title="Out of the Town Restro and Bakery Google Map"
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full"
            />
            {/* Floating Quick Action over Map */}
            <div className="absolute top-3 right-3 z-10">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-xs text-stone-900 dark:text-stone-100 text-xs font-bold shadow-lg border border-stone-200 dark:border-stone-700 hover:bg-white transition-all"
              >
                <Navigation className="w-3.5 h-3.5 text-rose-500" />
                <span>Navigate (NH-48)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
