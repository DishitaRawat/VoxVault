import React, { useEffect, useState } from 'react';
import { SUPABASE_URL, API_BASE_URL } from '../config';

export default function Login({ onNavigate, setIsLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Micro-interactions/transition on mount
    const element = document.getElementById('login-main');
    if (element) {
      element.style.opacity = '0';
      element.style.transform = 'translateY(10px)';
      const timeout = setTimeout(() => {
        element.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Sign in failed');
      }
      localStorage.setItem('voxvault_token', data.access_token);
      localStorage.setItem('voxvault_user', JSON.stringify(data.user));
      setIsLoggedIn(true);
      onNavigate('chat');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setLoading(true);
    setErrorMsg('');
    const redirectTo = encodeURIComponent(window.location.origin + "/");
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface font-sans antialiased relative">
      {/* Close Button */}
      <button
        type="button"
        onClick={() => onNavigate('chat')}
        className="absolute top-md right-md text-outline hover:text-on-surface transition-colors cursor-pointer z-50"
        aria-label="Close"
      >
        <span className="material-symbols-outlined text-[24px]">close</span>
      </button>
      {/* Top Navigation */}
      <header className="w-full flex justify-center py-xl">
        <div className="flex flex-col items-center gap-xs">
          <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">VoxVault</h1>
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest opacity-80">Sign in to continue</p>
        </div>
      </header>

      <main id="login-main" className="flex-grow flex items-start justify-center px-gutter pt-md">
        <div className="w-full max-w-[400px] flex flex-col gap-lg">
          {/* Login Form Container */}
          <section className="flex flex-col gap-lg">
            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 text-xs rounded-xl p-3 text-center">
                {errorMsg}
              </div>
            )}
            <form className="flex flex-col gap-md" onSubmit={handleSignIn}>
              {/* Email Field */}
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="email">Email address</label>
                <input
                  className="custom-input w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface placeholder:text-outline transition-all"
                  id="email"
                  placeholder="name@company.com"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {/* Password Field */}
              <div className="flex flex-col gap-xs">
                <div className="flex justify-between items-center">
                  <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">Password</label>
                  <button
                    type="button"
                    className="font-label-sm text-label-sm text-primary hover:underline transition-all"
                    onClick={() => onNavigate('forgotPassword')}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  className="custom-input w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface placeholder:text-outline transition-all"
                  id="password"
                  placeholder="••••••••"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {/* Submit Button */}
              <button
                className="w-full btn-shiny-gradient font-label-md text-label-md py-sm rounded-full font-bold active:scale-[0.98] transition-all duration-200 mt-xs flex items-center justify-center gap-xs cursor-pointer border-none"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            {/* Divider */}
            <div className="flex items-center gap-md py-xs">
              <div className="h-[1px] flex-grow bg-outline-variant"></div>
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">or</span>
              <div className="h-[1px] flex-grow bg-outline-variant"></div>
            </div>
            {/* Social Logins */}
            <div className="flex flex-col gap-sm">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-sm border border-outline-variant bg-transparent hover:bg-surface-container-low py-sm rounded-lg transition-all group"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                </svg>
                <span className="font-label-md text-label-md text-on-surface">Continue with Google</span>
              </button>
            </div>
          </section>

          {/* Bottom Link */}
          <footer className="flex flex-col items-center gap-md pt-md">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Don't have an account?{' '}
              <button
                type="button"
                className="text-primary font-bold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                onClick={() => onNavigate('register')}
              >
                Sign up for free
              </button>
            </p>
            <div className="flex gap-lg opacity-40 hover:opacity-100 transition-opacity">
              <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface" href="#privacy">Privacy</a>
              <a className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface" href="#terms">Terms</a>
            </div>
          </footer>
        </div>
      </main>

      {/* Visual Atmosphere: Subtle background texture/animation */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-primary opacity-[0.03] blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[10%] -left-[10%] w-[30%] h-[30%] bg-primary opacity-[0.02] blur-[100px] rounded-full"></div>
      </div>
    </div>
  );
}
