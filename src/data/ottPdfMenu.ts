import type { MenuItem, Category } from '../types';

export const OTT_CATEGORIES: Category[] = [
  {
    id: 'cat-all',
    name: 'All Dishes',
    slug: 'all',
    icon: 'Sparkles',
    description: 'Explore our full Out of the Town (OTT) menu',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-thali',
    name: 'De Thali & Combos',
    slug: 'thali',
    icon: 'UtensilsCrossed',
    description: 'Executive, Special & Royal OTT Thalis with authentic North Indian combos',
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-mains',
    name: 'Mains & Curries',
    slug: 'mains',
    icon: 'Soup',
    description: 'Dal Makhni, Paneer Butter Masala, Butter Chicken, Lal Maas & curries',
    image: 'https://images.unsplash.com/photo-1596560314766-08c0c6890024?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-breads-rice',
    name: 'Breads & Rice',
    slug: 'breads-rice',
    icon: 'Wheat',
    description: 'Tandoori Roti, Garlic Naan, Lachha Paratha, Biryanis & Pulao',
    image: 'https://images.unsplash.com/photo-1583057341912-a0df64b8da4d?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-breakfast',
    name: 'Breakfast Anytime',
    slug: 'breakfast',
    icon: 'Sun',
    description: 'Poha, Pav Bhaji, Chole Bhature, Aloo Paratha, Omelettes & Pancakes',
    image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-bites',
    name: 'Bite Up & Snacks',
    slug: 'bites',
    icon: 'Flame',
    description: 'Crispy Fries, Cheese Corn Balls, Momos, Maggi & Chinese starters',
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-tandoor',
    name: 'Tandoor & Kebabs',
    slug: 'tandoor',
    icon: 'Flame',
    description: 'Tandoori Chicken, Paneer Tikka, Seekh Kebabs & Sizzling Platters',
    image: 'https://images.unsplash.com/photo-1626323109252-0adb3b46692b?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-burgers-wraps',
    name: 'Sandwiches & Burgers',
    slug: 'burgers-wraps',
    icon: 'Sandwich',
    description: 'Falafel Wraps with Hummus, Grilled Sandwiches, Veg & Chicken Burgers',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-pizza-pasta',
    name: 'Pizza & Pasta',
    slug: 'pizza-pasta',
    icon: 'Pizza',
    description: '9" Thin Crust Pizzas & Pasta Lavista (Arrabiata, Pink & Cream Cheese)',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-soups-salads',
    name: 'Soups & Salads',
    slug: 'soups-salads',
    icon: 'Salad',
    description: 'Tomato, Manchow & Chicken Soups, Fresh Salads & Raitas',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-desserts-bakery',
    name: 'Desserts & Cakes',
    slug: 'desserts-bakery',
    icon: 'Cake',
    description: 'Artisan Cheesecakes, Pastries, Brownie with Ice Cream & 1-Pound Cakes',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-shakes-coolers',
    name: 'Shakes & Coolers',
    slug: 'shakes-coolers',
    icon: 'GlassWater',
    description: 'Thick Freakshakes, Mojitos, Coolers, Lemonade, Lassi & Buttermilk',
    image: 'https://images.unsplash.com/photo-1590373927063-cb2d69209a8b?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'cat-coffee-tea',
    name: 'Chai, Coffee & Hot Choc',
    slug: 'coffee-tea',
    icon: 'Coffee',
    description: 'OTT Special Tea, Kulhad Chai, Cappuccino, Cold Coffee & Hot Chocolate',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=300&q=80',
  },
];

import { MENU_BEVERAGES } from './menuBeverages';
import { MENU_BREAKFAST_SOUPS } from './menuBreakfastSoups';
import { MENU_BITES_TANDOOR } from './menuBitesTandoor';
import { MENU_MAINS_COMBOS } from './menuMainsCombos';
import { MENU_BREADS_BAKERY } from './menuBreadsBakery';

export const OTT_MENU_ITEMS: MenuItem[] = [
  ...MENU_BEVERAGES,
  ...MENU_BREAKFAST_SOUPS,
  ...MENU_BITES_TANDOOR,
  ...MENU_MAINS_COMBOS,
  ...MENU_BREADS_BAKERY,
];

