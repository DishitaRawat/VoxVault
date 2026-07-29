import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function ProfileDetails({ onNavigate, setIsLoggedIn }) {
  const [fullName, setFullName] = useState(() => {
    const stored = localStorage.getItem('voxvault_user');
    if (stored) {
      try {
        return JSON.parse(stored).full_name || '';
      } catch (e) { }
    }
    return '';
  });
  const [email, setEmail] = useState(() => {
    const stored = localStorage.getItem('voxvault_user');
    if (stored) {
      try {
        return JSON.parse(stored).email || '';
      } catch (e) { }
    }
    return '';
  });
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('voxvault_theme') || 'Dark';
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (themeMode === 'Dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('voxvault_theme', themeMode);
  }, [themeMode]);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('voxvault_token');
        if (!token) {
          onNavigate('login');
          return;
        }
        const res = await fetch(`${API_BASE_URL}/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to fetch profile');
        }
        setFullName(data.full_name || '');
        setEmail(data.email || '');
      } catch (err) {
        setErrorMsg(err.message);
      }
    };
    fetchProfile();
  }, [onNavigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('voxvault_token');
      const res = await fetch(`${API_BASE_URL}/user/profile/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ full_name: fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update profile');
      }

      // Update local storage user metadata if exists
      const storedUser = localStorage.getItem('voxvault_user');
      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        userObj.full_name = fullName;
        localStorage.setItem('voxvault_user', JSON.stringify(userObj));
      }

      onNavigate('chat');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('voxvault_token');
    localStorage.removeItem('voxvault_user');
    setIsLoggedIn(false);
    onNavigate('login');
  };

  return (
    <div className="min-h-screen flex flex-col text-on-surface bg-surface font-sans antialiased relative overflow-hidden select-none">
      {/* Background image matching the landing page */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none opacity-20 dark:opacity-[0.12]">
        <img 
          src="/hero_background.png" 
          alt="" 
          className="w-full h-full object-cover" 
        />
        {/* Soft overlay gradient to blend nicely with the theme */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface"></div>
      </div>

      {/* Background ambient glow spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] md:w-[600px] h-[350px] md:h-[600px] bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-[80px] pointer-events-none opacity-30"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[350px] md:w-[600px] h-[350px] md:h-[600px] bg-gradient-to-br from-[#10b981]/10 to-transparent rounded-full blur-[80px] pointer-events-none opacity-30"></div>

      {/* Top Navigation Bar */}
      <header className="flex justify-between items-center h-16 px-6 w-full bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant z-40">
        <button
          type="button"
          onClick={() => onNavigate('chat')}
          className="flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer border-none bg-primary/10 text-primary hover:bg-primary/20 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Library</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm hidden sm:inline text-on-surface-variant">Logged in as</span>
          <div className="w-8 h-8 rounded-full bg-primary-container/20 border border-primary-container/30 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
            {getInitials(fullName || email)}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center px-4 py-8 relative z-10 w-full">
        <div className="w-full max-w-[750px] flex flex-col gap-6">
          {/* Card */}
          <div className="bg-surface-container-lowest/60 border border-outline-variant rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md flex flex-col gap-6 relative">
            
            {/* Inner Header / Identity */}
            <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-outline-variant pb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl uppercase shadow-md select-none shrink-0 relative overflow-hidden">
                <span className="z-10">{getInitials(fullName || email)}</span>
                <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
              </div>
              <div className="text-center sm:text-left min-w-0">
                <h1 className="text-lg font-bold text-on-surface truncate">{fullName || 'User'}</h1>
                <p className="text-sm text-on-surface-variant truncate">{email}</p>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 text-xs rounded-xl p-3 text-center flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <form className="flex flex-col gap-6" onSubmit={handleSave}>
              {/* Section: Personal Information */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary font-semibold border-b border-outline-variant/30 pb-2">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  <span className="text-xs uppercase tracking-wider">Personal Information</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant">Full Name</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-outline text-[18px] pointer-events-none">badge</span>
                    <input
                      className="custom-input w-full bg-surface-container-low border border-outline-variant rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-on-surface focus:outline-none focus:border-primary transition-all placeholder:text-outline"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant">Email Address</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-outline text-[18px] pointer-events-none">mail</span>
                    <input
                      className="w-full bg-surface-container-low/40 border border-outline-variant/30 rounded-xl pl-11 pr-4 py-2.5 text-sm text-outline cursor-not-allowed"
                      type="email"
                      value={email}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Section: Preferences */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary font-semibold border-b border-outline-variant/30 pb-2">
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  <span className="text-xs uppercase tracking-wider">System Preferences</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-on-surface">Interface Mode</span>
                    <span className="text-xs text-on-surface-variant truncate">Switch between Light and Dark themes.</span>
                  </div>
                  <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant shrink-0">
                    {['Dark', 'Light'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border-none ${
                          themeMode === mode
                            ? 'bg-primary text-on-primary shadow-sm shadow-primary/20'
                            : 'bg-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                        onClick={() => setThemeMode(mode)}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {mode === 'Dark' ? 'dark_mode' : 'light_mode'}
                        </span>
                        <span>{mode}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-5 py-2.5 text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low hover:text-on-surface rounded-xl transition-all cursor-pointer border-none bg-transparent"
                  onClick={() => onNavigate('chat')}
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  <span>Discard</span>
                </button>
                
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-on-primary font-semibold rounded-xl text-sm hover:bg-primary/95 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/10 border-none"
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">save</span>
                  )}
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>

            {/* Logout button at the bottom of card */}
            <div className="pt-2 border-t border-outline-variant/20 flex justify-center">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer border-none bg-red-500/10 text-red-500 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Log out of Account</span>
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
