import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ShoppingBag,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  Heart,
  ChevronRight,
  Coffee,
  CheckCircle2,
  AlertCircle,
  X,
  Star,
  Flame,
  Cake,
  Bike,
  ChevronUp,
} from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { TopPromotionalHero } from './components/TopPromotionalHero';
import { FlipkartPromoBanner } from './components/FlipkartPromoBanner';
import { CategoryPills } from './components/CategoryPills';
import { FilterBar } from './components/FilterBar';
import { MenuItemCard } from './components/MenuItemCard';
import { ConnectionErrorState } from './components/ConnectionErrorState';
import { SeasonalDecor } from './components/SeasonalDecor';
import { OfferComboView } from './components/OfferComboView';
import { CartDrawer } from './components/CartDrawer';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { InitialSignupModal } from './components/InitialSignupModal';
import { ReservationModal } from './components/ReservationModal';
import { CustomerProfileModal } from './components/CustomerProfileModal';
import { OrderStatusModal } from './components/OrderStatusModal';
import { CustomCakeModal } from './components/CustomCakeModal';
import { ServiceCommandSection } from './components/ServiceCommandSection';
import { RecommendedDishesSection } from './components/RecommendedDishesSection';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { DeliveryPartnerPortal } from './components/delivery/DeliveryPartnerPortal';
import { ActiveDeliveryFloatingBar } from './components/delivery/ActiveDeliveryFloatingBar';
import { LocationSection } from './components/LocationSection';
import { MenuPdfDownloadSection } from './components/MenuPdfDownloadSection';
import { RestaurantAmbianceGallery } from './components/RestaurantAmbianceGallery';
import { api } from './services/api';
import type { MenuItem, Category, PromoBanner, Order, CafeInfo } from './types';

function CafeHome() {
  const { totalItemsCount, total, setIsCartOpen } = useCart();
  const { customer, customerToken } = useAuth();

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [cafeInfo, setCafeInfo] = useState<CafeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Set when the initial menu/category fetch fails (network drop, request timeout, server
  // down) -- previously this only logged to console and silently left the page looking like
  // an empty restaurant with 0 dishes, no indication anything had gone wrong.
  const [loadError, setLoadError] = useState(false);
  const [selectedOfferBanner, setSelectedOfferBanner] = useState<PromoBanner | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [eggOnly, setEggOnly] = useState(false);
  const [bestsellerOnly, setBestsellerOnly] = useState(false);
  const [ratingOnly, setRatingOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [quickPrepOnly, setQuickPrepOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState('popular');

  const handleClearAllFilters = () => {
    setVegOnly(false);
    setNonVegOnly(false);
    setEggOnly(false);
    setBestsellerOnly(false);
    setRatingOnly(false);
    setOffersOnly(false);
    setQuickPrepOnly(false);
    setMaxPrice(null);
    setSortBy('popular');
  };

  // Modals
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false);
  const [isCustomCakeOpen, setIsCustomCakeOpen] = useState(false);
  const [customCakeInitialImage, setCustomCakeInitialImage] = useState<string | undefined>(undefined);
  const [customCakeInitialFlavor, setCustomCakeInitialFlavor] = useState<string | undefined>(undefined);

  const handleOpenCustomCake = (initialImage?: string, initialFlavor?: string) => {
    setCustomCakeInitialImage(initialImage);
    setCustomCakeInitialFlavor(initialFlavor);
    setIsCustomCakeOpen(true);
  };
  
  const [showInitialSignup, setShowInitialSignup] = useState(false);

  useEffect(() => {
    // Only show if the customer isn't logged in and hasn't dismissed it this session
    const hasDismissed = sessionStorage.getItem('has_dismissed_initial_signup_v2');
    if (!hasDismissed) {
      const timer = setTimeout(() => {
        setShowInitialSignup(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [customerToken]);

  const handleCloseInitialSignup = () => {
    sessionStorage.setItem('has_dismissed_initial_signup_v2', 'true');
    setShowInitialSignup(false);
  };

  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isDeliveryPartnerOpen, setIsDeliveryPartnerOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [dismissedFloatingOrderId, setDismissedFloatingOrderId] = useState<string | null>(null);

  // Active delivery order tracking for customer (anytime tracking & call partner)
  const activeDeliveryOrder = useMemo(() => {
    return (
      customerOrders.find(
        (o) =>
          (o.orderType === 'delivery' || Boolean(o.deliveryAddress)) &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      ) || null
    );
  }, [customerOrders]);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('aura_cafe_admin_token');
  });
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<MenuItem | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  // "Back to top" floating button + near-bottom detection, for a bit of scroll-position
  // feedback beyond the sticky header -- appears once you've scrolled well past the hero, and
  // gets a little extra bounce once you're near the very end of the page.
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(false);
  // Menu grid pagination -- rendering all 190 items in one flat grid made the page enormous
  // and hard to scroll through. Reset back to the initial page whenever the result set itself
  // changes (category, search, filters); untouched by unrelated re-renders since filteredItems
  // keeps a stable reference until its own deps change.
  const MENU_PAGE_SIZE = 12;
  const [visibleMenuCount, setVisibleMenuCount] = useState(MENU_PAGE_SIZE);

  useEffect(() => {
    // Scroll fires far more often than the browser can paint, especially on touch devices
    // doing momentum scrolling -- updating three bits of state directly on every event forced
    // extra renders in between frames, which is exactly what made the sticky header's entrance
    // look like a jerky "pop" on a slow scroll instead of a smooth transition. Coalescing to
    // one state update per animation frame keeps it in step with the browser's own paint timing
    // on every device, not just fast desktops.
    let rafId: number | null = null;
    let lastIsScrolled = false;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const y = window.scrollY;
        // Dock the sticky header once the in-page category/filter row has scrolled up out of
        // view, so its copy in the header takes over exactly where the original disappears.
        // (Docking at a fixed 150px used to collapse that row while it was still on screen,
        // shifting the whole menu up ~160px mid-scroll.) A small dead zone stops flicker on the
        // scroll jitter trackpads and some phones produce right at the threshold. Pages
        // without the row (combo offer view) fall back to the old scroll-distance rule.
        const inlineBar = document.getElementById('inline-category-filter-bar');
        const nextIsScrolled = inlineBar
          ? lastIsScrolled
            ? inlineBar.getBoundingClientRect().bottom < 40
            : inlineBar.getBoundingClientRect().bottom < 0
          : lastIsScrolled
          ? y > 110
          : y > 150;
        lastIsScrolled = nextIsScrolled;
        setIsScrolled(nextIsScrolled);
        setShowBackToTop(y > 300);
        const distanceFromBottom = document.documentElement.scrollHeight - y - window.innerHeight;
        setIsNearBottom(distanceFromBottom < 240);
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setLoadError(false);
      const [cats, banners, items, info] = await Promise.all([
        api.getCategories(),
        api.getPromoBanners(),
        api.getMenuItems(),
        api.getCafeInfo(),
      ]);
      setCategories(cats);
      setPromoBanners(banners);
      setMenuItems(items);
      setCafeInfo(info);
    } catch (err) {
      console.error('Failed to load cafe data:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedItemDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedItemDetail(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedItemDetail]);

  // Load customer's past orders for personalized menu recommendations
  useEffect(() => {
    let isMounted = true;
    const loadUserOrders = async () => {
      try {
        const orders = await api.getMyOrders(customerToken || undefined);
        if (isMounted) {
          setCustomerOrders(orders);
        }
      } catch {
        if (isMounted) {
          setCustomerOrders([]);
        }
      }
    };

    loadUserOrders();
    return () => {
      isMounted = false;
    };
  }, [customerToken, customer?.id]);

  // Filter & Sort computation
  const filteredItems = useMemo(() => {
    let result = [...menuItems];

    // Category filter
    if (activeCategory !== 'all') {
      result = result.filter((item) => item.category === activeCategory);
    }

    // Pure veg filter
    if (vegOnly) {
      result = result.filter((item) => item.isVeg);
    }

    // Non-veg filter
    if (nonVegOnly) {
      result = result.filter((item) => !item.isVeg);
    }

    // Contains egg filter
    if (eggOnly) {
      result = result.filter((item) => item.isEgg);
    }

    // Bestseller filter
    if (bestsellerOnly) {
      result = result.filter((item) => item.isBestseller);
    }

    // High rating filter (4.5+)
    if (ratingOnly) {
      result = result.filter((item) => item.rating >= 4.5);
    }

    // Great Offers / Discount filter
    if (offersOnly) {
      result = result.filter((item) => item.originalPrice && item.originalPrice > item.price);
    }

    // Fast Prep (< 20 mins) filter
    if (quickPrepOnly) {
      result = result.filter((item) => (item.preparationTimeMinutes || 15) <= 20);
    }

    // Max Price filter
    if (maxPrice !== null) {
      result = result.filter((item) => item.price <= maxPrice);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sorting
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'time':
        result.sort(
          (a, b) => (a.preparationTimeMinutes || 10) - (b.preparationTimeMinutes || 10)
        );
        break;
      default:
        // popularity default (bestsellers first)
        result.sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0));
        break;
    }

    return result;
  }, [
    menuItems,
    activeCategory,
    vegOnly,
    nonVegOnly,
    eggOnly,
    bestsellerOnly,
    ratingOnly,
    offersOnly,
    quickPrepOnly,
    maxPrice,
    searchQuery,
    sortBy,
  ]);

  // Live search suggestions -- matched against the FULL menu, independent of whatever
  // category tab or filter toggles (veg mode, bestseller, etc.) happen to be active.
  // filteredItems above intentionally combines search with those filters for the main grid,
  // but reusing it for the suggestion dropdown meant typing "chicken" while Veg Mode was on,
  // or while browsing the Desserts category, silently showed "no dishes match" even though
  // the dish exists -- the dropdown was filtering out real matches for unrelated reasons.
  // Ranked so a dish named after the query beats one that only mentions it in its
  // description (typing "paneer" used to list "Assorted Veg Platter" above "Paneer Chaat").
  // Array.prototype.sort is stable, so menu order still breaks ties within a rank.
  const searchSuggestionMatches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    const rank = (item: MenuItem): number => {
      const name = item.name.toLowerCase();
      if (name.startsWith(q)) return 0;
      if (name.split(/[\s&(),/-]+/).some((word) => word.startsWith(q))) return 1;
      if (name.includes(q)) return 2;
      if (item.category.toLowerCase().includes(q) || item.tags?.some((t) => t.toLowerCase().includes(q))) return 3;
      if (item.description.toLowerCase().includes(q)) return 4;
      return -1;
    };
    return menuItems
      .map((item) => ({ item, r: rank(item) }))
      .filter(({ r }) => r >= 0)
      .sort((a, b) => a.r - b.r)
      .map(({ item }) => item);
  }, [menuItems, searchQuery]);

  // Reset menu pagination whenever the result set itself changes (new category, search,
  // filter or sort) -- filteredItems keeps a stable reference otherwise, so this never fires
  // from an unrelated re-render and never undoes a user's "Load More" clicks mid-browse.
  useEffect(() => {
    setVisibleMenuCount(MENU_PAGE_SIZE);
  }, [filteredItems]);

  // When a search/filter narrows the results down to zero, the tall item grid collapses to
  // one short "no dishes match" message in the same render. If you'd scrolled deep into a
  // "Load More"-expanded grid (or just deep into the menu generally) when that happened, the
  // browser had nowhere to put that scroll position on the now much-shorter page and snapped
  // it upward instantly -- reported as the page/cursor "jumping" while deleting a search term
  // down to something with no matches. Smooth-scrolling to the result section ourselves as
  // soon as we know it emptied out turns that into one intentional motion instead.
  // Only when you're scrolled *past* the heading (it's above the screen) -- never pull the page
  // down to it. Doing that while typing in the hero search at the top of the page slid the
  // page down on the first no-match letter, and the browser then yanked it back up to keep the
  // (now off-screen) search box in view on the next letter: the down-then-up lurch.
  useEffect(() => {
    if (filteredItems.length !== 0) return;
    const heading = document.getElementById('menu-heading');
    if (!heading) return;
    if (heading.getBoundingClientRect().top < -40) {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [filteredItems]);

  // Counts by category
  const itemsCountByCategory = useMemo(() => {
    const counts: Record<string, number> = { all: menuItems.length };
    menuItems.forEach((it) => {
      counts[it.category] = (counts[it.category] || 0) + 1;
    });
    return counts;
  }, [menuItems]);

  // Verification state for Owner & Authorized Admin Access
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState<boolean>(() => {
    return customer?.email?.toLowerCase().trim() === 'kumarsatyam5868@gmail.com';
  });

  // Verify admin authorization whenever customer email or token changes
  useEffect(() => {
    let isCancelled = false;
    const checkAccess = async () => {
      const email = customer?.email?.toLowerCase().trim();
      if (!email) {
        setIsAuthorizedAdmin(false);
        return;
      }

      if (email === 'kumarsatyam5868@gmail.com') {
        setIsAuthorizedAdmin(true);
        if (!adminToken) {
          try {
            const res = await api.checkAdminAccess(customerToken || email);
            if (!isCancelled && res.adminToken) {
              setAdminToken(res.adminToken);
              sessionStorage.setItem('aura_cafe_admin_token', res.adminToken);
            }
          } catch {
            // Keep default
          }
        }
        return;
      }

      try {
        const res = await api.checkAdminAccess(customerToken || email);
        if (!isCancelled) {
          setIsAuthorizedAdmin(Boolean(res.hasAccess));
          if (res.hasAccess && res.adminToken && !adminToken) {
            setAdminToken(res.adminToken);
            sessionStorage.setItem('aura_cafe_admin_token', res.adminToken);
          }
        }
      } catch {
        if (!isCancelled) setIsAuthorizedAdmin(false);
      }
    };

    checkAccess();
    return () => {
      isCancelled = true;
    };
  }, [customer?.email, customerToken, adminToken]);

  const handleOpenAdmin = async () => {
    const email = customer?.email?.toLowerCase().trim();
    const isOwner = email === 'kumarsatyam5868@gmail.com';

    if (adminToken && (isOwner || isAuthorizedAdmin)) {
      setIsAdminDashboardOpen(true);
      return;
    }

    if (isOwner || isAuthorizedAdmin) {
      try {
        const res = await api.checkAdminAccess(customerToken || email);
        if (res.adminToken) {
          setAdminToken(res.adminToken);
          sessionStorage.setItem('aura_cafe_admin_token', res.adminToken);
          setIsAdminDashboardOpen(true);
          return;
        }
      } catch {
        // Fallback to modal
      }
    }

    setIsAdminLoginOpen(true);
  };

  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    setIsAdminLoginOpen(false);
    setIsAdminDashboardOpen(true);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('aura_cafe_admin_token');
    setAdminToken(null);
    setIsAdminDashboardOpen(false);
  };

  // Show a friendly retry screen instead of the customer site when the initial fetch failed
  // and left us with nothing to show -- but never for the admin/delivery portals, which load
  // their own data independently of this fetch.
  if (loadError && !isLoading && menuItems.length === 0 && !adminToken && !isDeliveryPartnerOpen) {
    return (
      <div className="min-h-screen w-full bg-cream dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex items-center justify-center px-4">
        <ConnectionErrorState onRetry={fetchData} isRetrying={isLoading} />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-clip bg-cream dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors duration-200 selection:bg-amber-500 selection:text-white font-sans antialiased ${
        selectedOfferBanner ? 'pt-14 sm:pt-16' : ''
      }`}
    >
      {/* Site-wide ambient festive decor (Diwali/Christmas/Holi, whichever is in season --
          renders nothing the rest of the year). Purely decorative and click-through. */}
      <SeasonalDecor />

      {/* Sticky Navigation Bar: appears smoothly on scroll or when inspecting combo offer */}
      <AnimatePresence>
        {(isScrolled || selectedOfferBanner) && (
          <motion.div
            initial={{ y: -90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -90, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="fixed top-0 left-0 right-0 z-40"
          >
            <Navbar
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                if (q && selectedOfferBanner) {
                  setSelectedOfferBanner(null);
                }
              }}
              vegOnly={vegOnly}
              onToggleVegOnly={() => {
                const nextVeg = !vegOnly;
                setVegOnly(nextVeg);
                if (nextVeg) setNonVegOnly(false);
              }}
              nonVegOnly={nonVegOnly}
              onToggleNonVegOnly={() => {
                setNonVegOnly(!nonVegOnly);
                if (!nonVegOnly) setVegOnly(false);
              }}
              eggOnly={eggOnly}
              onToggleEggOnly={() => {
                const next = !eggOnly;
                setEggOnly(next);
                if (next) setVegOnly(false);
              }}
              bestsellerOnly={bestsellerOnly}
              onToggleBestseller={() => setBestsellerOnly(!bestsellerOnly)}
              ratingOnly={ratingOnly}
              onToggleRating={() => setRatingOnly(!ratingOnly)}
              offersOnly={offersOnly}
              onToggleOffers={() => setOffersOnly(!offersOnly)}
              quickPrepOnly={quickPrepOnly}
              onToggleQuickPrep={() => setQuickPrepOnly(!quickPrepOnly)}
              maxPrice={maxPrice}
              onSelectMaxPrice={setMaxPrice}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onClearAllFilters={handleClearAllFilters}
              totalFiltered={filteredItems.length}
              onOpenProfileMenu={() => setIsCustomerMenuOpen(true)}
              onOpenCustomCake={() => setIsCustomCakeOpen(true)}
              onNavigateHome={() => {
                setSelectedOfferBanner(null);
                setActiveCategory('all');
                setSearchQuery('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              isOfferDetailView={Boolean(selectedOfferBanner)}
              isScrolled={isScrolled}
              categories={categories}
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              itemsCountByCategory={itemsCountByCategory}
              searchResults={searchSuggestionMatches.slice(0, 6)}
              totalSearchMatches={searchSuggestionMatches.length}
              onSelectSearchResult={(item) => setSelectedItemDetail(item)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promotional Banner Extending to the Top and Fading to White at Bottom */}
      {!selectedOfferBanner && (
        <div className="relative bg-cream dark:bg-stone-950">
          <TopPromotionalHero
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              if (q && selectedOfferBanner) {
                setSelectedOfferBanner(null);
              }
            }}
            vegOnly={vegOnly}
            onToggleVegOnly={() => {
              const nextVeg = !vegOnly;
              setVegOnly(nextVeg);
              if (nextVeg) setNonVegOnly(false);
            }}
            onOpenReservation={() => setIsReservationOpen(true)}
            onOpenProfileMenu={() => setIsCustomerMenuOpen(true)}
            onOpenCustomCake={() => setIsCustomCakeOpen(true)}
            banners={promoBanners}
            onSelectBanner={(banner) => {
              setSelectedOfferBanner(banner);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectCategory={(cat) => {
              setActiveCategory(cat);
              const el = document.getElementById('menu-heading');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            showOverlayHeader={true}
            searchResults={searchSuggestionMatches.slice(0, 6)}
            totalSearchMatches={searchSuggestionMatches.length}
            onSelectSearchResult={(item) => setSelectedItemDetail(item)}
            isScrolled={isScrolled}
          />

          {/* Food categories + filters. Always stays in the page: the sticky Navbar (which has
              its own copy) only docks once this row has scrolled out of view -- see the scroll
              handler. It used to collapse to zero height at a fixed 150px scroll, which yanked
              the whole menu ("All Dishes" panel) up ~160px while you were scrolling, then pushed
              it back down on the way up. */}
          <div id="inline-category-filter-bar" className="relative z-10">
          <div className="relative z-20 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-7 sm:mt-9 mb-2 sm:mb-4 space-y-2.5">
            <CategoryPills
              categories={categories}
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              itemsCountByCategory={itemsCountByCategory}
            />

            {/* Filter Bar directly overlapping the background, smoothly scrollable without enclosing box or side indicators */}
            <div className="w-full pt-0.5">
              <FilterBar
                vegOnly={vegOnly}
                onToggleVegOnly={() => {
                  const nextVeg = !vegOnly;
                  setVegOnly(nextVeg);
                  if (nextVeg) setNonVegOnly(false);
                }}
                nonVegOnly={nonVegOnly}
                onToggleNonVegOnly={() => {
                  setNonVegOnly(!nonVegOnly);
                  if (!nonVegOnly) setVegOnly(false);
                }}
                eggOnly={eggOnly}
                onToggleEggOnly={() => {
                  const next = !eggOnly;
                  setEggOnly(next);
                  if (next) setVegOnly(false);
                }}
                bestsellerOnly={bestsellerOnly}
                onToggleBestseller={() => setBestsellerOnly(!bestsellerOnly)}
                ratingOnly={ratingOnly}
                onToggleRating={() => setRatingOnly(!ratingOnly)}
                offersOnly={offersOnly}
                onToggleOffers={() => setOffersOnly(!offersOnly)}
                quickPrepOnly={quickPrepOnly}
                onToggleQuickPrep={() => setQuickPrepOnly(!quickPrepOnly)}
                maxPrice={maxPrice}
                onSelectMaxPrice={setMaxPrice}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onClearAllFilters={handleClearAllFilters}
                totalFiltered={filteredItems.length}
                isSticky={false}
                idPrefix="main"
                className="my-0 py-0"
                showIndicatorButtons={true}
              />
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Main Homepage Container */}
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-4">
        {selectedOfferBanner ? (
          /* Dedicated Pre-Selected Combo & Offer Details Page */
          <OfferComboView
            banner={selectedOfferBanner}
            allMenuItems={menuItems}
            onBack={() => {
              setSelectedOfferBanner(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenReservation={() => setIsReservationOpen(true)}
            onSelectDishDetail={(it) => setSelectedItemDetail(it)}
          />
        ) : (
          <>
            {/* SELECT YOUR SERVICE: Made-to-Order Bakery & Dining Services Carousel */}
            {(activeCategory === 'bakery' || activeCategory === 'all') && (
              <ServiceCommandSection
                onOpenCustomCake={handleOpenCustomCake}
                onOpenReservation={() => setIsReservationOpen(true)}
                onSelectFoodService={() => {
                  const menuEl = document.getElementById('menu-heading');
                  menuEl?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            )}

            {/* Section Heading with scroll margin offset for sticky header - Shifted below the Service Selection Option */}
            <div id="menu-heading" className="flex items-center justify-between gap-3 mb-5 mt-4 scroll-mt-48">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  {activeCategory === 'all'
                    ? 'Menu'
                    : categories.find((c) => c.slug === activeCategory)?.name || 'Menu'}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                  Freshly prepared with single-origin beans, organic produce, and stone ovens.
                </p>
              </div>

              {/* Actions on the side: Small Download Menu button & Custom Cake trigger */}
              <div className="flex items-center gap-2 shrink-0">
                <MenuPdfDownloadSection
                  menuItems={menuItems}
                  categories={categories}
                  cafeInfo={cafeInfo}
                />

                <button
                  id="btn-quick-custom-cake"
                  onClick={() => setIsCustomCakeOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 text-xs font-bold transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-2xs"
                >
                  <Cake className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Request Custom Cake</span>
                </button>
              </div>
            </div>

            {/* Recommended Dishes Section (Suggests dishes according to customer's previous orders) */}
            <RecommendedDishesSection
              menuItems={menuItems}
              previousOrders={customerOrders}
              categories={categories}
              customerName={customer?.name}
              vegOnly={vegOnly}
              nonVegOnly={nonVegOnly}
              eggOnly={eggOnly}
              activeCategory={activeCategory}
              onSelectItemDetail={(it) => setSelectedItemDetail(it)}
            />

            {/* Food Item Grids (Zomato-Inspired High Converting Layout) */}
            {isLoading ? (
              /* Loading Skeletons */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="h-44 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 animate-pulse flex gap-4"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-12 bg-stone-200 dark:bg-stone-800 rounded-sm" />
                      <div className="h-5 w-3/4 bg-stone-200 dark:bg-stone-800 rounded-sm" />
                      <div className="h-4 w-16 bg-stone-200 dark:bg-stone-800 rounded-sm" />
                      <div className="h-3 w-full bg-stone-200 dark:bg-stone-800 rounded-sm" />
                    </div>
                    <div className="w-28 h-28 bg-stone-200 dark:bg-stone-800 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              /* Empty Search / Filter Results */
              <div className="min-h-[60vh] flex flex-col items-center justify-center text-center rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-8 my-4">
                {/* min-h keeps this close to the height of a full result grid -- without it,
                    deleting search characters down to a query with zero matches collapsed the
                    page from a tall grid to this short block in one render. If you were
                    scrolled down into the grid at that moment, the browser had no choice but to
                    clamp the scroll position to the new (much shorter) page height, which felt
                    like the page suddenly snapping upward mid-keystroke. */}
                <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 mx-auto mb-3">
                  <Coffee className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-1">
                  No dishes match your selection
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto mb-5">
                  Try adjusting your dietary filters or clearing the search query to explore other items.
                </p>
                <button
                  onClick={() => {
                    setActiveCategory('all');
                    setSearchQuery('');
                    setVegOnly(false);
                    setNonVegOnly(false);
                    setEggOnly(false);
                    setBestsellerOnly(false);
                    setRatingOnly(false);
                  }}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <>
                {/* Grid of Food Items with Framer Motion entry -- paginated so browsing
                    "All Dishes" (190 items) doesn't render one enormous, hard-to-scroll page */}
                <motion.div
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredItems.slice(0, visibleMenuCount).map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2 }}
                        className="h-full flex flex-col"
                      >
                        <MenuItemCard
                          item={item}
                          onOpenDetails={(it) => setSelectedItemDetail(it)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {visibleMenuCount < filteredItems.length && (
                  <div className="flex flex-col items-center gap-2 mt-6">
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Showing {Math.min(visibleMenuCount, filteredItems.length)} of {filteredItems.length} dishes
                    </p>
                    <button
                      id="btn-load-more-menu-items"
                      onClick={() => setVisibleMenuCount((n) => n + MENU_PAGE_SIZE)}
                      className="px-6 py-2.5 rounded-xl bg-white dark:bg-stone-900 border-2 border-candy-cherry-500 text-candy-cherry-600 dark:text-candy-cherry-400 hover:bg-gradient-to-r hover:from-candy-cherry-500 hover:to-amber-500 hover:text-white hover:border-transparent font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                    >
                      Load More Dishes
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Real Restaurant Ambiance & Interior Gallery Tour */}
            <div className="mt-12">
              <RestaurantAmbianceGallery
                onOpenReservation={() => setIsReservationOpen(true)}
              />
            </div>


          </>
        )}
      </main>

      {/* Floating Bottom Sticky Cart Bar (Zomato Style) */}
      <AnimatePresence>
        {totalItemsCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-xl z-30"
          >
            <div
              onClick={() => setIsCartOpen(true)}
              className="p-3.5 sm:p-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-2xl shadow-amber-600/40 flex items-center justify-between cursor-pointer border border-amber-500 transition-all hover:scale-[1.01]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs uppercase font-bold tracking-wider text-amber-200">
                    {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'} in cart
                  </p>
                  <p className="text-sm font-bold font-mono">
                    Total: ₹{total.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider bg-white text-amber-800 px-4 py-2 rounded-xl shadow-xs">
                <span>View Cart</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location & Google Map Section */}
      <LocationSection onOpenReservation={() => setIsReservationOpen(true)} />

      {/* Footer */}
      <footer className="mt-8 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/ott-logo.svg"
                alt="Out of the Town OTT Logo"
                referrerPolicy="no-referrer"
                onClick={handleOpenAdmin}
                className="w-10 h-10 rounded-full border border-amber-500/30 object-contain shadow-xs shrink-0 cursor-pointer hover:scale-105 transition-transform"
              />
              <div>
                <span className="font-serif text-xl font-bold">
                  {cafeInfo?.name || 'Out of the Town - Restro and Bakery'}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                    4.5 on Google (550+ reviews)
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">
                    Restro & Bakery
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm leading-relaxed">
              {cafeInfo?.tagline || 'Gourmet Restro, Artisan Bakery in Kukas, Jaipur.'}
            </p>
            <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400 pt-2">
              <p className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  {cafeInfo?.address || 'SP 41 B, Near RIICO Industrial Area & Arya College of Industrial Training, Kukas, Delhi-Jaipur Road (NH-48), Jaipur, Rajasthan 302038 (Near Umaid Haveli)'}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <a
                  href="tel:+919828919626"
                  className="font-bold text-stone-800 dark:text-stone-200 hover:text-amber-600 transition-colors"
                >
                  Customer Care & Hotline: +91 98289 19626
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <a
                  href="mailto:care@outofthetownjaipur.com"
                  className="hover:text-amber-600 transition-colors"
                >
                  {cafeInfo?.email || 'care@outofthetownjaipur.com'}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{cafeInfo?.openingHours || 'Mon - Sun: 11:00 AM – 12:00 AM (Midnight)'}</span>
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-serif font-bold text-sm mb-3">Quick Navigation</h4>
            <ul className="space-y-2 text-xs text-stone-500 dark:text-stone-400">
              <li>
                <button
                  onClick={() => {
                    setActiveCategory('all');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-amber-600 cursor-pointer"
                >
                  Digital Food Menu
                </button>
              </li>
              <li>
                <button
                  onClick={() => setIsReservationOpen(true)}
                  className="hover:text-amber-600 cursor-pointer"
                >
                  Table Reservations
                </button>
              </li>
              <li>
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="hover:text-amber-600 cursor-pointer"
                >
                  Online Order Cart
                </button>
              </li>
              <li>
                <button
                  onClick={handleOpenAdmin}
                  className="hover:text-amber-600 cursor-pointer"
                >
                  Restaurant Owner Admin
                </button>
              </li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-400">
          <p>© {new Date().getFullYear()} Out of the Town - Restro and Bakery. All rights reserved.</p>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer
        onOrderSuccess={(order) => {
          setActiveOrder(order);
          setCustomerOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
        }}
      />

      
      {/* Initial Registration Intercept Modal */}
      <AnimatePresence>
        {showInitialSignup && (
          <InitialSignupModal onClose={handleCloseInitialSignup} />
        )}
      </AnimatePresence>

      {/* Customer OTP / Login Authentication Modal */}
      <CustomerAuthModal />

      {/* Table Reservation Modal */}
      <ReservationModal
        isOpen={isReservationOpen}
        onClose={() => setIsReservationOpen(false)}
      />

      {/* Customer Profile & Settings Menu Modal */}
      <CustomerProfileModal
        isOpen={isCustomerMenuOpen}
        onClose={() => setIsCustomerMenuOpen(false)}
        onOpenReservation={() => setIsReservationOpen(true)}
        onOpenCustomCake={() => setIsCustomCakeOpen(true)}
        onSelectOrder={(order) => setActiveOrder(order)}
        vegOnly={vegOnly}
        onToggleVegOnly={() => {
          const nextVeg = !vegOnly;
          setVegOnly(nextVeg);
          if (nextVeg) setNonVegOnly(false);
        }}
        isAuthorizedAdmin={isAuthorizedAdmin}
        onOpenAdmin={handleOpenAdmin}
      />

      {/* Made-to-Order Custom Cake & Celebration Bakery Modal */}
      <CustomCakeModal
        isOpen={isCustomCakeOpen}
        onClose={() => {
          setIsCustomCakeOpen(false);
          setCustomCakeInitialImage(undefined);
          setCustomCakeInitialFlavor(undefined);
        }}
        initialReferenceImage={customCakeInitialImage}
        initialFlavor={customCakeInitialFlavor}
        onOrderPlaced={(newOrder) => {
          setActiveOrder(newOrder);
          setCustomerOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
        }}
      />

      {/* Order Status Modal (Active Tracking & Full Order Details) */}
      {activeOrder && (
        <OrderStatusModal
          order={activeOrder}
          onClose={() => setActiveOrder(null)}
          onOrderUpdated={(fresh) => {
            setActiveOrder(fresh);
            setCustomerOrders((prev) => prev.map((o) => (o.id === fresh.id ? fresh : o)));
          }}
        />
      )}

      {/* Floating Live Delivery Tracker (Track Package Anytime & Call Partner) */}
      {activeDeliveryOrder && !activeOrder && dismissedFloatingOrderId !== activeDeliveryOrder.id && (
        <ActiveDeliveryFloatingBar
          activeOrder={activeDeliveryOrder}
          onOpenTracking={(order) => setActiveOrder(order)}
          onDismiss={() => setDismissedFloatingOrderId(activeDeliveryOrder.id)}
        />
      )}

      {/* Delivery Partner Portal (Rider Runs, Live GPS & NH-48 Route to Customer) */}
      {isDeliveryPartnerOpen && (
        <DeliveryPartnerPortal
          onClose={() => setIsDeliveryPartnerOpen(false)}
          onOpenOrderDetails={(order) => setActiveOrder(order)}
        />
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Admin Full Management Suite */}
      {isAdminDashboardOpen && adminToken && (
        <AdminDashboard
          token={adminToken}
          onLogout={handleAdminLogout}
          onClose={() => setIsAdminDashboardOpen(false)}
          menuItems={menuItems}
          promoBanners={promoBanners}
          cafeInfo={cafeInfo}
          categories={categories}
          onUpdateMenuItems={(newItems) => setMenuItems(newItems)}
          onUpdatePromoBanners={(newBanners) => setPromoBanners(newBanners)}
          onUpdateCategories={(newCats) => setCategories(newCats)}
          onMenuUpdated={fetchData}
          onOpenDeliveryPartnerPortal={() => setIsDeliveryPartnerOpen(true)}
        />
      )}

      {/* Dish Detailed View Modal */}
      {selectedItemDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItemDetail(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selectedItemDetail.name}
            className="relative w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden shadow-2xl"
          >
            <div className="relative h-52 bg-stone-800">
              <img
                src={selectedItemDetail.image}
                alt={selectedItemDetail.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedItemDetail(null)}
                aria-label="Close dish details"
                className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-4 h-4 rounded-xs border flex items-center justify-center p-0.5 ${
                      selectedItemDetail.isVeg ? 'border-emerald-600' : 'border-rose-600'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedItemDetail.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    />
                  </span>
                  <span className="text-xs font-bold uppercase text-stone-400">
                    {selectedItemDetail.category}
                  </span>
                </div>

                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  {selectedItemDetail.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-amber-600 font-mono">
                    ₹{selectedItemDetail.price}
                  </span>
                  <span className="text-xs text-stone-500">
                    ★ {selectedItemDetail.rating.toFixed(1)} ({selectedItemDetail.reviewsCount} reviews)
                  </span>
                </div>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {selectedItemDetail.description}
              </p>

              {selectedItemDetail.tags && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedItemDetail.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => {
                    const el = document.getElementById(`add-btn-${selectedItemDetail.id}`);
                    el?.click();
                    setSelectedItemDetail(null);
                  }}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Order • ₹{selectedItemDetail.price}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating "Back to Top" -- appears once you've scrolled well past the hero, with a
          little extra bounce near the very bottom of the page as a soft "you've arrived" cue. */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            id="btn-back-to-top"
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: isNearBottom ? [0, -8, 0] : 0,
            }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={
              isNearBottom
                ? { y: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }
                : { duration: 0.25, ease: 'easeOut' }
            }
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="fixed bottom-5 right-4 sm:bottom-8 sm:right-8 z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-candy-cherry-500 to-amber-500 text-white shadow-lg shadow-candy-cherry-500/40 flex items-center justify-center cursor-pointer border-2 border-white/40 dark:border-stone-900/40"
          >
            <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <CafeHome />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
