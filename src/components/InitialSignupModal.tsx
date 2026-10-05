import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


interface InitialSignupModalProps {
  onClose: () => void;
}

export function InitialSignupModal({ onClose }: InitialSignupModalProps) {
  const { openAuthModal } = useAuth();
  // Prevent scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="w-full max-w-sm sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden relative shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white cursor-pointer transition-colors backdrop-blur-md"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Photo Area */}
        <div className="relative h-[240px] w-full shrink-0 flex items-end">
          <img 
            src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80" 
            alt="OTT Cafe Ambiance" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Gradient overlays for close button contrast at top and text readability at bottom */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-transparent to-transparent pointer-events-none"></div>

          <div className="relative z-10 p-6 w-full pb-8 flex items-end">
            <div className="text-white drop-shadow-2xl flex flex-col items-start">
              <span 
                className="text-3xl sm:text-4xl text-amber-100 font-bold -mb-1"
                style={{ fontFamily: "'Parisienne', cursive", WebkitTextStroke: "0.5px currentColor" }}
              >
                Welcome to
              </span>
              <span 
                className="text-3xl sm:text-4xl font-black leading-tight tracking-tight text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Out of the Town
              </span>
              <span 
                className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-white/90 font-sans mt-1.5 ml-0.5"
              >
                Cafe & Resturant
              </span>
            </div>
          </div>
        </div>

        {/* Bottom White Action Area */}
        <div className="bg-white rounded-t-3xl sm:rounded-t-none sm:rounded-b-3xl px-6 pt-8 pb-8 relative z-10 -mt-4">
          <h3 className="text-center text-stone-900 font-bold text-xl mb-6">
            Get Started
          </h3>
          
          <div className="flex flex-col gap-4">
            {/* Sign Up Button (Primary) */}
            <button 
              onClick={() => {
                onClose();
                openAuthModal('account');
              }}
              className="w-full bg-candy-cherry-500 hover:bg-candy-cherry-600 text-white font-bold text-base py-3.5 rounded-xl shadow-md transition-colors active:scale-[0.98] cursor-pointer"
            >
              Sign up
            </button>
            
            {/* Small 'or' text separator */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-stone-200"></div>
              <span className="text-sm font-medium text-stone-400 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-stone-200"></div>
            </div>

            {/* Log In Button (Secondary) */}
            <button 
              onClick={() => {
                onClose();
                openAuthModal('account');
              }}
              className="w-full bg-white hover:bg-stone-50 text-stone-800 font-bold text-base py-3.5 rounded-xl border-2 border-stone-200 shadow-sm transition-colors active:scale-[0.98] cursor-pointer"
            >
              Log in
            </button>
          </div>

          {/* Footer Text */}
          <p className="text-center text-[11px] text-stone-500 leading-relaxed mt-8 px-4">
            By continuing, you agree to our<br />
            <a href="#" className="border-b border-stone-400 hover:text-stone-800 transition-colors">Terms of Service</a>{' '}
            <a href="#" className="border-b border-stone-400 hover:text-stone-800 transition-colors">Privacy Policy</a>{' '}
            <a href="#" className="border-b border-stone-400 hover:text-stone-800 transition-colors">Content Policy</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
