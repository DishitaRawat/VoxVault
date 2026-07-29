import React, { useState } from 'react';
import { SUPABASE_URL, API_BASE_URL } from '../config';

export default function Register({ onNavigate, setIsLoggedIn }) {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Call Signup
      const registerRes = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(registerData.detail || 'Registration failed');
      }

      // 2. Auto-login immediately
      const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error('Created account successfully, but auto-login failed. Please sign in manually.');
      }

      localStorage.setItem('voxvault_token', loginData.access_token);
      localStorage.setItem('voxvault_user', JSON.stringify(loginData.user));
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
    <div className="flex flex-col min-h-screen bg-surface-container-lowest text-on-surface font-sans antialiased relative">
      {/* Close Button */}
      <button
        type="button"
        onClick={() => onNavigate('chat')}
        className="absolute top-md right-md text-outline hover:text-on-surface transition-colors cursor-pointer z-50"
        aria-label="Close"
      >
        <span className="material-symbols-outlined text-[24px]">close</span>
      </button>
      {/* Global Layout Container */}
      <main className="flex-grow flex items-center justify-center p-md relative overflow-hidden">
        {/* Background Atmospheric Element */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-40"></div>
        {/* Decorative Subtle Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Registration Card Container */}
        <div className="relative z-10 w-full max-w-[420px]">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-xl">
            <div className="w-12 h-12 bg-on-surface rounded-xl flex items-center justify-center mb-md group transition-transform duration-300 hover:rotate-12 cursor-pointer">
              <span className="material-symbols-outlined text-surface-container-lowest !text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Create your account</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Sign up to get started</p>
          </div>

          {/* Form Container */}
          <div className="glass-card rounded-xl p-lg shadow-2xl bg-[#141414]/60 backdrop-blur-md border border-surface-variant">
            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 text-xs rounded-xl p-3 text-center mb-4">
                {errorMsg}
              </div>
            )}
            <form className="space-y-md" onSubmit={handleRegister}>
              {/* Full Name Field */}
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant px-xs" htmlFor="name">Full Name</label>
                <div className="focused-input flex items-center bg-surface-container-low border border-outline-variant rounded-lg px-md h-12 transition-all duration-200">
                  <span className="material-symbols-outlined text-outline text-[20px] mr-sm">person</span>
                  <input
                    className="bg-transparent border-none focus:ring-0 w-full text-on-surface font-body-md placeholder:text-outline/50"
                    id="name"
                    placeholder="Alan Turing"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant px-xs" htmlFor="email">Email Address</label>
                <div className="focused-input flex items-center bg-surface-container-low border border-outline-variant rounded-lg px-md h-12 transition-all duration-200">
                  <span className="material-symbols-outlined text-outline text-[20px] mr-sm">alternate_email</span>
                  <input
                    className="bg-transparent border-none focus:ring-0 w-full text-on-surface font-body-md placeholder:text-outline/50"
                    id="email"
                    placeholder="name@engine.ai"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant px-xs" htmlFor="password">Password</label>
                <div className="focused-input flex items-center bg-surface-container-low border border-outline-variant rounded-lg px-md h-12 transition-all duration-200">
                  <span className="material-symbols-outlined text-outline text-[20px] mr-sm">lock</span>
                  <input
                    className="bg-transparent border-none focus:ring-0 w-full text-on-surface font-body-md placeholder:text-outline/50"
                    id="password"
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="text-outline hover:text-on-surface transition-colors cursor-pointer"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                className="w-full btn-shiny-gradient text-white font-label-md text-label-md h-12 rounded-lg transition-all duration-300 active:scale-[0.98] mt-sm flex items-center justify-center gap-xs cursor-pointer border-none"
                type="submit"
                disabled={loading}
              >
                <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-lg">
              <div className="flex-grow border-t border-outline-variant/30"></div>
              <span className="px-md font-label-sm text-label-sm text-outline uppercase tracking-widest">or continue with</span>
              <div className="flex-grow border-t border-outline-variant/30"></div>
            </div>

            {/* Social Actions */}
            <div className="flex flex-col gap-sm">
              <button
                type="button"
                className="w-full flex items-center justify-center h-11 rounded-lg border border-outline-variant bg-transparent hover:bg-surface-container-high transition-all duration-200 active:scale-95 group"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-sm" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                </svg>
                <span className="font-label-md text-label-md text-on-surface">Continue with Google</span>
              </button>
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-xl text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Already have an account?{' '}
              <button
                type="button"
                className="text-primary hover:text-primary-container font-medium underline underline-offset-4 decoration-primary/30 bg-transparent border-none p-0 cursor-pointer"
                onClick={() => onNavigate('login')}
              >
                Sign in
              </button>
            </p>
            <div className="mt-lg flex justify-center gap-md">
              <a className="font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors" href="#privacy">Privacy Policy</a>
              <a className="font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors" href="#terms">Terms of Service</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
