import React, { useState } from 'react';
import { Shield, KeyRound, X, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Admin access always needs the passcode. The old "Verified Owner Account" one-click unlock
  // trusted the signed-in customer's email (which is never verified) and then fell back to
  // logging in with the hard-coded passcode '123'.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsSubmitting(true);
      const token = await api.adminLogin(password);
      sessionStorage.setItem('aura_cafe_admin_token', token);
      try {
        const userCheck = await api.checkAdminAccess(token);
        if (userCheck.user) {
          sessionStorage.setItem('aura_cafe_admin_user', JSON.stringify(userCheck.user));
        }
      } catch {}
      onLoginSuccess(token);
    } catch (err: any) {
      setError(err.message || 'Access Denied: Only the restaurant owner and authorized staff have access.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 sm:p-7">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
            Restaurant Admin Suite
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Access strictly restricted to the restaurant owner and authorized staff.
          </p>
        </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-1.5">
                Staff / Owner Passcode
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="admin-passcode-input"
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter passcode..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-400 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="admin-login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Unlock Admin Suite</span>
              )}
            </button>

          </form>
      </div>
    </div>
  );
};
