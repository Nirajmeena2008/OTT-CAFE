import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const CustomerAuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authReason, signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

    const handleGoogleAuth = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      // Calls the simulated Google authentication method
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google Auth failed. Please try again.');
      setIsLoading(false);
    }
  };

  const getReasonLabel = () => {
    switch (authReason) {
      case 'cart':
        return 'Sign in to add items to your cart and start your order';
      case 'order':
        return 'Sign in to complete your delicious order & track live delivery';
      case 'reservation':
        return 'Sign in to reserve your royal dining table under Jaipur skies';
      case 'profile':
      case 'account':
        return 'Sign in to view your orders, invoices & dining history';
      default:
        return 'Sign in to Out of the Town Restro & Bakery';
    }
  };

  return (
    <div
      id="customer-auth-modal-overlay"
      className="fixed inset-0 z-[70] overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden transition-all my-8">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 p-6 text-white relative">
          <button
            id="close-auth-modal-btn"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3 text-amber-200" />
                Customer Verification
              </div>
              <h3 className="font-serif text-xl font-bold tracking-tight">Out of the Town</h3>
            </div>
          </div>

          <p className="text-xs text-amber-100 mt-2.5 font-medium leading-relaxed">
            {getReasonLabel()}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-8 text-center">
          {errorMessage && (
            <div className="mb-6 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 text-left">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          <div className="flex flex-col gap-5">
                        <button
              onClick={handleGoogleAuth}
              type="button"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-sm shadow-xs flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-stone-400" />
                  <span>Redirecting...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 bg-white rounded-full" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                    <path fill="none" d="M1 1h22v22H1z" />
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
            
            <p className="text-[10px] text-stone-400 mt-2">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
