export interface RestaurantAmbianceImage {
  id: string;
  title: string;
  zone: string;
  // Matches the SeatingArea type (src/types.ts) exactly -- Out of the Town has three
  // real bookable areas, and every photo in this gallery maps to exactly one of them.
  category: 'indoor_lounge' | 'garden_patio' | 'banquet_hall';
  tagline: string;
  description: string;
  features: string[];
  capacity: string;
  imageUrl: string;
}

// Exactly three entries -- the restaurant's three real physical spaces. Do not add
// more "zones" here: there is no fourth space, and inventing sub-areas (e.g. splitting
// the lounge into a "bistro corner" and an "executive lounge") previously misrepresented
// one room as several, which is what this dataset was trimmed down from.
export const RESTAURANT_IMAGES: RestaurantAmbianceImage[] = [
  {
    id: 'ott-zone-lounge',
    title: 'AC Family Lounge',
    zone: 'AC Family Lounge',
    category: 'indoor_lounge',
    tagline: 'Climate-controlled indoor dining with a warm, modern glow',
    description:
      'Our air-conditioned indoor lounge with plush seating, warm arch lighting, and marble-top tables -- comfortable dining for families and groups any time of day.',
    features: ['Fully Air-Conditioned', 'Plush Comfortable Seating', 'Warm Ambient Lighting', 'Marble-Top Tables'],
    capacity: '2 - 20 Guests',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'ott-zone-garden',
    title: 'Lush Garden Lawn',
    zone: 'Lush Garden Lawn',
    category: 'garden_patio',
    tagline: 'Open-air green lawn seating under the evening sky',
    description:
      'Our open-air lawn along NH-48 offers serene green seating under warm fairy lights and the Kukas night sky -- a relaxed outdoor setting for couples and families.',
    features: ['Open-Air Lawn Seating', 'Fairy-Lit Evening Ambiance', 'Lush Potted Greenery', 'Pet-Friendly Outdoors'],
    capacity: 'Couples & Families',
    imageUrl: 'https://images.pexels.com/photos/38575719/pexels-photo-38575719.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  {
    id: 'ott-zone-banquet',
    title: 'Banquet Hall',
    zone: 'Banquet Hall',
    category: 'banquet_hall',
    tagline: 'Private hall for birthdays, anniversaries & celebrations',
    description:
      'A dedicated private hall for birthdays, anniversaries and group celebrations, with festive decor, dedicated sound setup, and full-menu catering for larger parties.',
    features: ['Private Party Space', 'Dedicated Sound Setup', 'Custom Decor on Request', 'Full-Menu Catering'],
    capacity: '15 - 35 Guests',
    imageUrl: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80',
  },
];
