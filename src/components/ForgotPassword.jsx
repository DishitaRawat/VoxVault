import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function ForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Parallax effect on mouse move
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (window.innerWidth - e.pageX) / 40;
      const y = (window.innerHeight - e.pageY) / 40;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Password reset request failed');
      }
      setSent(true);
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 4000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest min-h-screen flex items-center justify-center relative overflow-hidden font-sans antialiased">
      {/* Close Button */}
      <button
        type="button"
        onClick={() => onNavigate('chat')}
        className="absolute top-md right-md text-outline hover:text-on-surface transition-colors cursor-pointer z-50"
        aria-label="Close"
      >
        <span className="material-symbols-outlined text-[24px]">close</span>
      </button>
      {/* Decorative Elements with Parallax */}
      <div
        className="glow-sphere -top-1/4 -left-1/4"
        style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
      ></div>
      <div
        className="glow-sphere -bottom-1/4 -right-1/4"
        style={{ transform: `translate(${-mousePos.x}px, ${-mousePos.y}px)` }}
      ></div>

      {/* Main Content Shell */}
      <main className="relative z-10 w-full max-w-[440px] px-lg">
        <div className="flex flex-col items-center text-center space-y-xl">
          {/* Brand Anchor */}
          <header className="w-full flex justify-center mb-lg">
            <div className="flex flex-col items-center gap-xs">
              <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">VoxVault</h1>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest opacity-80">Reset your password</p>
            </div>
          </header>

          {/* Card Container */}
          <div className="w-full canvas-bg border border-outline-variant rounded-xl p-xl shadow-2xl backdrop-blur-sm bg-[#131313]/90">
            <header className="mb-xl text-left">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs">
                Reset Password
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-[280px]">
                Enter your email to receive a recovery link.
              </p>
            </header>

            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 text-xs rounded-xl p-3 text-center mb-4">
                {errorMsg}
              </div>
            )}
            <form className="space-y-lg text-left" onSubmit={handleResetSubmit}>
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="email">
                  Email address
                </label>
                <div className="input-container flex items-center px-md py-sm rounded-lg">
                  <span className="material-symbols-outlined text-outline mr-sm text-[20px]">mail</span>
                  <input
                    className="bg-transparent border-none focus:ring-0 text-on-surface font-body-md w-full placeholder:text-outline/50"
                    id="email"
                    name="email"
                    placeholder="name@company.com"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {sent ? (
                <button
                  type="button"
                  className="w-full bg-surface-container-high text-primary font-label-md text-label-md py-md rounded-full flex items-center justify-center"
                  disabled
                >
                  Email Sent
                </button>
              ) : (
                <button
                  className="w-full bg-primary-container hover:bg-primary text-on-primary-container font-label-md text-label-md py-md rounded-full transition-all duration-300 active:scale-95 flex items-center justify-center group"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <span className="material-symbols-outlined ml-xs text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                    </>
                  )}
                </button>
              )}
            </form>

            <footer className="mt-xl pt-lg border-t border-outline-variant/30 flex justify-center">
              <button
                type="button"
                className="inline-flex items-center font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200 bg-transparent border-none p-0 cursor-pointer"
                onClick={() => onNavigate('login')}
              >
                <span className="material-symbols-outlined mr-xs text-[18px]">arrow_back</span>
                Back to login
              </button>
            </footer>
          </div>


        </div>
      </main>

      {/* Success State Toast */}
      <div
        className={`fixed bottom-xl left-1/2 -translate-x-1/2 canvas-bg border border-primary/30 rounded-lg px-xl py-md shadow-2xl z-50 flex items-center space-x-md transform transition-all duration-500 pointer-events-none bg-[#131313] ${
          showToast ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
        </div>
        <div className="text-left">
          <p className="font-label-md text-label-md text-on-surface">Reset link sent successfully</p>
          <p className="font-body-md text-[12px] text-on-surface-variant">Check your inbox for further instructions.</p>
        </div>
      </div>
    </div>
  );
}
