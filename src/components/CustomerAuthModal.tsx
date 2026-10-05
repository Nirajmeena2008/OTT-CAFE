import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lock,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const CustomerAuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authReason, sendOtp, verifyOtp, customer } = useAuth();

  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill existing customer info if any
  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setEmail(customer.email || '');
      setPhone(customer.phone || '');
    }
  }, [customer]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus OTP input when switching to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 150);
    }
  }, [step]);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await sendOtp(cleanEmail, cleanPhone, name.trim());
      setPreviewOtp(res.otpPreview || '123456');
      setStep('otp');
      setResendCooldown(30);
      setSuccessMessage(`OTP sent to +91 ${cleanPhone.slice(-10)}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setIsLoading(true);
      const cleanEmail = email.trim();
      const cleanPhone = phone.replace(/\D/g, '');
      await verifyOtp(cleanEmail, cleanPhone, cleanOtp, name.trim());
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoFillOtp = () => {
    if (previewOtp) {
      setOtp(previewOtp);
      setErrorMessage(null);
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
      // Above every other z-50/z-60 modal: sign-in opens from *inside* them (reservation,
      // cart, custom cake). At z-50 it rendered underneath the reservation form, so a guest
      // pressing "Confirm Table Booking" saw nothing happen and couldn't book at all.
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
        <div className="p-6">
          {/* Status Messages */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && !errorMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {step === 'input' ? (
            /* STEP 1: Enter Name, Email & Phone */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Full Name <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    id="customer-auth-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Satyam Sharma"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    id="customer-auth-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Invoices, order receipts & booking vouchers will be sent here.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center gap-1 pointer-events-none text-stone-500 dark:text-stone-400 text-xs font-bold">
                    <Phone className="w-3.5 h-3.5 text-stone-400" />
                    <span>+91</span>
                  </div>
                  <input
                    id="customer-auth-phone-input"
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9828919626"
                    className="w-full pl-16 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  We'll send a 6-digit OTP code to verify your phone number.
                </p>
              </div>

              {/* Data Security Guarantee */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Strict Privacy:</strong> Your data is protected. Other customers cannot view your orders or personal details.
                </span>
              </div>

              <button
                id="send-otp-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-sm shadow-md shadow-amber-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Enter OTP */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 mx-auto flex items-center justify-center mb-2">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Enter 6-Digit Code
                </h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Sent to <strong className="text-stone-800 dark:text-stone-200">+91 {phone.slice(-10)}</strong> and{' '}
                  <strong className="text-stone-800 dark:text-stone-200">{email}</strong>
                </p>
              </div>

              {/* Simulated SMS Notification Banner */}
              {previewOtp && (
                <div className="p-3.5 rounded-2xl bg-stone-900 text-stone-100 border border-stone-700 shadow-md flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                      <span>📱 Simulated SMS Alert</span>
                    </div>
                    <div className="text-xs font-medium text-stone-200 mt-0.5 truncate">
                      Your OTT verification code is <strong className="font-mono text-amber-300 text-sm tracking-widest">{previewOtp}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillOtp}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-transform active:scale-95"
                  >
                    ⚡ Auto-Fill
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 text-center">
                  Verification Code (OTP)
                </label>
                <input
                  id="customer-auth-otp-input"
                  ref={otpInputRef}
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full py-3 px-4 text-center text-2xl font-mono font-bold tracking-[0.5em] rounded-2xl border-2 border-amber-500/50 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-600 transition-all shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
                >
                  ← Change Number
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isLoading}
                  onClick={handleSendOtp}
                  className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer disabled:opacity-40 disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                id="verify-otp-submit-btn"
                type="submit"
                disabled={isLoading || otp.length < 6}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-sm shadow-md shadow-amber-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify &amp; Continue</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
