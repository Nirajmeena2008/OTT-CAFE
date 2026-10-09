import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import type { Customer } from '../types.js';
import { api } from '../services/api.js';

interface AuthContextType {
  customer: Customer | null;
  customerToken: string | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authReason: string;
  openAuthModal: (reason?: string, onSuccessCallback?: () => void) => void;
  closeAuthModal: () => void;
  sendOtp: (email: string, phone: string, name?: string) => Promise<{ message: string; otpPreview?: string }>;
  verifyOtp: (email: string, phone: string, otp: string, name?: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  logout: () => void;
  requireAuth: (onSuccessAction: () => void, reason?: string) => void;
  updateCustomerProfile: (updated: Partial<Customer>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_CUSTOMER_KEY = 'ott_customer_session';
const STORAGE_TOKEN_KEY = 'ott_customer_token';
const SIGNED_OUT_FLAG_KEY = 'ott_signed_out_flag';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<Customer | null>(() => {
    try {
      const isSignedOut = localStorage.getItem(SIGNED_OUT_FLAG_KEY);
      if (isSignedOut === 'true') return null;
      const saved = localStorage.getItem(STORAGE_CUSTOMER_KEY);
      if (saved) return JSON.parse(saved);
      return null;
    } catch {
      return null;
    }
  });

  const [customerToken, setCustomerToken] = useState<string | null>(() => {
    try {
      const isSignedOut = localStorage.getItem(SIGNED_OUT_FLAG_KEY);
      if (isSignedOut === 'true') return null;
      const saved = localStorage.getItem(STORAGE_TOKEN_KEY);
      if (saved) return saved;
      return null;
    } catch {
      return null;
    }
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string>("order");
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  const googleCallbackHandledRef = useRef(false);

  // Add this
  const pendingCallbackRef = useRef<(() => void) | null>(null);

  // Keep ref updated whenever pendingCallback changes
  useEffect(() => {
    pendingCallbackRef.current = pendingCallback;
  }, [pendingCallback]);

  const isProcessingGoogleCallback = useRef(false);

  // Handle returning from Google Auth redirect (Authorization Code Flow)
  useEffect(() => {
    const handleGoogleCallback = async () => {
      // Check if this is a Google OAuth callback
      if (!window.location.pathname.includes('/auth/google/callback')) {
        return;
      }

      // Prevent double execution in React 18 Strict Mode
      if (isProcessingGoogleCallback.current) {
        return;
      }
      isProcessingGoogleCallback.current = true;

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const storedState = sessionStorage.getItem('google_oauth_state');
      const error = urlParams.get('error');

      // Handle OAuth errors
      if (error) {
        console.error('Google OAuth error:', error);
        window.location.replace('/?error=oauth_denied');
        return;
      }

      // Validate state parameter (CSRF protection)
      if (!state || state !== storedState) {
        console.error('Invalid OAuth state parameter');
        window.location.replace('/?error=oauth_invalid_state');
        return;
      }

      // Clear the state only after validating
      sessionStorage.removeItem('google_oauth_state');

      if (!code) {
        console.error('No authorization code received from Google');
        window.location.replace('/?error=oauth_no_code');
        return;
      }

      try {
        // Exchange authorization code for tokens via backend
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/customer/google/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri: `${window.location.origin}/auth/google/callback` }),
        });

        let json;
        try {
          json = await res.json();
        } catch (e) {
          throw new Error('Invalid JSON response from server');
        }

        if (!res.ok || !json.success || !json.customer || !json.token) {
          throw new Error(json.error || 'Failed to authenticate via Google');
        }

        setCustomer(json.customer);
        setCustomerToken(json.token);

        // Immediately persist to localStorage before any navigation
        localStorage.setItem(STORAGE_CUSTOMER_KEY, JSON.stringify(json.customer));
        localStorage.setItem(STORAGE_TOKEN_KEY, json.token);
        localStorage.removeItem(SIGNED_OUT_FLAG_KEY);

        // Fully reload to the home page to cleanly remount the application state
        // and remove all OAuth query parameters (like code, state, etc) from the URL bar.
        window.location.replace('/');
      } catch (err) {
        console.error("Google OAuth callback failed:", err);
        window.location.replace('/?error=oauth_failed');
      }
    };

    handleGoogleCallback();
  }, []);


  // Sync token & customer to localStorage
  useEffect(() => {
    if (customer && customerToken) {
      localStorage.setItem(STORAGE_CUSTOMER_KEY, JSON.stringify(customer));
      localStorage.setItem(STORAGE_TOKEN_KEY, customerToken);
      localStorage.removeItem(SIGNED_OUT_FLAG_KEY);
    } else {
      localStorage.removeItem(STORAGE_CUSTOMER_KEY);
      localStorage.removeItem(STORAGE_TOKEN_KEY);
    }
  }, [customer, customerToken]);

  const openAuthModal = (reason: string = 'order', onSuccessCallback?: () => void) => {
    setAuthReason(reason);
    if (onSuccessCallback) {
      setPendingCallback(() => onSuccessCallback);
    }
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setPendingCallback(null);
  };

  const requireAuth = (onSuccessAction: () => void, reason: string = 'order') => {
    if (customer && customerToken) {
      onSuccessAction();
      return;
    }
    openAuthModal(reason, onSuccessAction);
  };

  const sendOtp = async (email: string, phone: string, name?: string) => {
    return await api.sendCustomerOtp({ email, phone, name });
  };

  const verifyOtp = async (email: string, phone: string, otp: string, name?: string): Promise<boolean> => {
    try {
      const result = await api.verifyCustomerOtp({ email, phone, otp, name });
      setCustomer(result.customer);
      setCustomerToken(result.token);
      localStorage.removeItem(SIGNED_OUT_FLAG_KEY);
      setIsAuthModalOpen(false);

      // Execute pending action
      const cb = pendingCallbackRef.current;

      if (cb) {
        pendingCallbackRef.current = null;
        setPendingCallback(null);

        setTimeout(() => {
          cb();
        }, 100);
      }

      return true;
    } catch (err) {
      throw err;
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      throw new Error('Google Client ID is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file.');
    }

    // Redirect URI must exactly match one of the "Authorized redirect URIs" registered
    // in Google Cloud Console for this OAuth 2.0 client.
    const redirectUri = `${window.location.origin}/auth/google/callback`;

    const scope = 'openid email profile';

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem('google_oauth_state', state);

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}` +
      `&prompt=select_account` +
      `&access_type=offline`;

    window.location.href = authUrl;

    // Returns a never-resolving promise because the browser navigates away
    return new Promise(() => { });
  };


  const logout = () => {
    setCustomer(null);
    setCustomerToken(null);
    localStorage.removeItem(STORAGE_CUSTOMER_KEY);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.setItem(SIGNED_OUT_FLAG_KEY, 'true');
    sessionStorage.removeItem('aura_cafe_admin_token');
  };

  const updateCustomerProfile = (updated: Partial<Customer>) => {
    if (customer) {
      const merged = { ...customer, ...updated };
      setCustomer(merged);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        customer,
        customerToken,
        isAuthenticated: Boolean(customer && customerToken),
        isAuthModalOpen,
        authReason,
        openAuthModal,
        closeAuthModal,
        sendOtp,
        verifyOtp,
        signInWithGoogle,
        logout,
        requireAuth,
        updateCustomerProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
