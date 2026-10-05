import React, { createContext, useContext, useState, useEffect } from 'react';
import type { MenuItem, CartItem, OrderType } from '../types.js';
import { useAuth } from './AuthContext';

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  appliedPromo: string | null;
  applyPromo: (code: string) => { success: boolean; message: string };
  removePromo: () => void;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  totalItemsCount: number;
  getItemQuantity: (itemId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { requireAuth } = useAuth();

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('aura_cafe_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('aura_cafe_cart', JSON.stringify(items));
  }, [items]);

  // Signing in (with OTP verification) is required before anything can be added to the
  // cart. requireAuth() adds the item immediately if already signed in; otherwise it opens
  // the sign-in modal and adds the item automatically once OTP verification succeeds.
  const addItem = (item: MenuItem) => {
    requireAuth(() => {
      setItems((prev) => {
        const existing = prev.find((i) => i.item.id === item.id);
        if (existing) {
          return prev.map((i) =>
            i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, { item, quantity: 1 }];
      });
    }, 'cart');
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setItems((prev) => {
      return prev
        .map((i) => {
          if (i.item.id === itemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    setItems([]);
    setAppliedPromo(null);
    setPromoCode('');
  };

  const getItemQuantity = (itemId: string) => {
    const found = items.find((i) => i.item.id === itemId);
    return found ? found.quantity : 0;
  };

  const totalItemsCount = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const subtotal = items.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);

  // Promo code calculation
  let discount = 0;
  if (appliedPromo === 'WELCOME100') {
    discount = Math.min(subtotal, 100);
  } else if (appliedPromo === 'OTTTHALI') {
    discount = subtotal >= 400 ? 100 : 50;
  } else if (appliedPromo === 'BAKERY25') {
    discount = Math.min(150, Math.round(subtotal * 0.25 * 100) / 100);
  } else if (appliedPromo === 'CAMPUS30' || appliedPromo === 'COMBO30' || appliedPromo === 'AURA30') {
    discount = Math.min(150, Math.round(subtotal * 0.3 * 100) / 100);
  } else if (appliedPromo === 'WELCOME50' || appliedPromo === 'AURA10') {
    discount = subtotal >= 200 ? 50 : 25;
  } else if (appliedPromo === 'BREW25') {
    discount = Math.round(subtotal * 0.25 * 100) / 100;
  }

  const deliveryFee =
    appliedPromo === 'WELCOME100'
      ? 0
      : orderType === 'delivery' && items.length > 0
      ? subtotal >= 499
        ? 0
        : 40
      : 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableAmount * 0.05 * 100) / 100; // 5% Restaurant GST
  const total = Math.round((taxableAmount + deliveryFee + tax) * 100) / 100;

  const applyPromo = (code: string) => {
    const clean = code.toUpperCase().trim();
    if (clean === 'WELCOME100') {
      if (subtotal < 199) {
        return { success: false, message: 'Code WELCOME100 requires a minimum order of ₹199' };
      }
      setAppliedPromo(clean);
      return { success: true, message: '₹100 Welcome Discount + FREE Delivery applied!' };
    }
    if (clean === 'OTTTHALI') {
      if (subtotal < 300) {
        return { success: false, message: 'Code OTTTHALI requires a minimum order of ₹300' };
      }
      setAppliedPromo(clean);
      return { success: true, message: 'Flat ₹100 Thali Fest discount applied!' };
    }
    if (clean === 'BAKERY25') {
      setAppliedPromo(clean);
      return { success: true, message: '25% Bakery Bonanza discount applied!' };
    }
    if (clean === 'CAMPUS30' || clean === 'COMBO30' || clean === 'AURA30') {
      setAppliedPromo(clean);
      return { success: true, message: '30% Student & Quick-Bite discount applied!' };
    }
    if (clean === 'WELCOME50' || clean === 'AURA10') {
      if (subtotal < 200) {
        return { success: false, message: 'Code WELCOME50 requires a minimum order of ₹200' };
      }
      setAppliedPromo(clean);
      return { success: true, message: '₹50.00 welcome discount applied!' };
    }
    if (clean === 'BREW25') {
      setAppliedPromo(clean);
      return { success: true, message: '25% cafe discount applied!' };
    }
    return { success: false, message: 'Invalid promo code. Try OTTTHALI, BAKERY25 or CAMPUS30.' };
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        orderType,
        setOrderType,
        promoCode,
        setPromoCode,
        appliedPromo,
        applyPromo,
        removePromo,
        subtotal,
        discount,
        deliveryFee,
        tax,
        total,
        totalItemsCount,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
