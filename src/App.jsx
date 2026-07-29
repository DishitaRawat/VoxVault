import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ProfileDetails from './components/ProfileDetails';
import MediaDetail from './components/MediaDetail';
import LandingPage from './components/LandingPage';
import IngestionModal from './components/IngestionModal';
import { API_BASE_URL } from './config';

function App() {
  const [currentScreen, setCurrentScreen] = useState('landing');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  // Media state (moved here from ChatInterface)
  const [mediaList, setMediaList] = useState([]);
  const [loadingMediaList, setLoadingMediaList] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState(null);
  const [proceededMediaIds, setProceededMediaIds] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Fetch media list from backend
  const fetchMediaList = async () => {
    const token = localStorage.getItem('voxvault_token');
    if (!token) {
      setMediaList([]);
      setLoadingMediaList(false);
      return;
    }
    setLoadingMediaList(true);
    try {
      const response = await fetch(`${API_BASE_URL}/media`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMediaList(data);
      } else {
        console.error('Failed to fetch media list');
      }
    } catch (e) {
      console.error('Network error fetching media', e);
    } finally {
      setLoadingMediaList(false);
    }
  };

  const handleIngestSuccess = (newMedia) => {
    setMediaList((prev) => {
      const exists = prev.some((m) => m.media_id === newMedia.media_id);
      if (exists) return prev;
      return [newMedia, ...prev];
    });
    setSelectedMediaId(newMedia.media_id);
  };

  const handleProceed = (mediaId) => {
    setProceededMediaIds((prev) => [...prev, mediaId]);
  };

  const handleLogout = () => {
    localStorage.removeItem('voxvault_token');
    localStorage.removeItem('voxvault_user');
    setIsLoggedIn(false);
    setUser(null);
    setMediaList([]);
    setSelectedMediaId(null);
    setCurrentScreen('landing');
  };

  // On mount: check token, load user, fetch media
  useEffect(() => {
    const token = localStorage.getItem('voxvault_token');
    if (token) {
      setIsLoggedIn(true);
      const storedUser = localStorage.getItem('voxvault_user');
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)); } catch (_) { }
      }
      fetchMediaList();
    }

    // Sync theme
    const theme = localStorage.getItem('voxvault_theme') || 'Dark';
    if (theme === 'Dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }

    // Google OAuth callback hash or query code
    const hash = window.location.hash;
    const search = window.location.search;
    const hashParams = new URLSearchParams(hash ? hash.substring(1) : '');
    const searchParams = new URLSearchParams(search);

    const accessToken = hashParams.get('access_token');
    const authCode = searchParams.get('code');

    if (accessToken || authCode) {
      setIsVerifying(true);
      fetch(`${API_BASE_URL}/auth/oauth-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          access_token: accessToken || undefined,
          code: authCode || undefined
        })
      })
        .then(async res => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Google authentication failed');
          return data;
        })
        .then(data => {
          localStorage.setItem('voxvault_token', data.access_token);
          localStorage.setItem('voxvault_user', JSON.stringify(data.user));
          setUser(data.user);
          setIsLoggedIn(true);
          window.history.replaceState(null, null, window.location.pathname);
          fetchMediaList();
        })
        .catch(err => {
          setVerifyError(err.message);
          setCurrentScreen('login');
        })
        .finally(() => setIsVerifying(false));
    }
  }, []);

  // Reload user from localStorage when login completes
  useEffect(() => {
    if (isLoggedIn) {
      const storedUser = localStorage.getItem('voxvault_user');
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)); } catch (_) { }
      }
      fetchMediaList();
    }
  }, [isLoggedIn]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        <div className="glow-sphere top-[-200px] left-[-200px]"></div>
        <div className="glow-sphere bottom-[-200px] right-[-200px]"></div>
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin z-10"></div>
        <p className="text-on-surface font-semibold text-lg animate-pulse z-10">Connecting with Google...</p>
      </div>
    );
  }

  // If a media item is selected, show MediaDetail as full-page overlay
  if (selectedMediaId) {
    return (
      <div className="min-h-screen bg-surface text-on-surface">
        <MediaDetail
          mediaId={selectedMediaId}
          onBack={() => {
            setSelectedMediaId(null);
            fetchMediaList();
          }}
          isProcessingStarted={proceededMediaIds.includes(selectedMediaId)}
          onProceed={handleProceed}
        />
      </div>
    );
  }

  // Route non-landing screens
  if (currentScreen === 'login') {
    return <Login onNavigate={(s) => { setCurrentScreen(s); }} setIsLoggedIn={setIsLoggedIn} />;
  }
  if (currentScreen === 'register') {
    return <Register onNavigate={setCurrentScreen} setIsLoggedIn={setIsLoggedIn} />;
  }
  if (currentScreen === 'forgotPassword') {
    return <ForgotPassword onNavigate={setCurrentScreen} />;
  }
  if (currentScreen === 'profileDetails') {
    return <ProfileDetails onNavigate={setCurrentScreen} setIsLoggedIn={setIsLoggedIn} />;
  }

  // Default: always show Landing Page (the unified home)
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {verifyError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 text-sm rounded-xl px-6 py-3 shadow-2xl z-50 text-center flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{verifyError}</span>
          <button onClick={() => setVerifyError('')} className="ml-2 hover:opacity-80 cursor-pointer">
            <span className="material-symbols-outlined text-[16px] block">close</span>
          </button>
        </div>
      )}
      <LandingPage
        onNavigate={setCurrentScreen}
        isLoggedIn={isLoggedIn}
        user={user}
        mediaList={mediaList}
        loadingMedia={loadingMediaList}
        onCardClick={setSelectedMediaId}
        onIngestSuccess={handleIngestSuccess}
        proceededMediaIds={proceededMediaIds}
        onLogout={handleLogout}
        showUploadModal={showUploadModal}
        setShowUploadModal={setShowUploadModal}
      />
      {/* Ingestion Modal lives here so it can be triggered from nav Upload button */}
      <IngestionModal
        show={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onIngestSuccess={handleIngestSuccess}
      />
    </div>
  );
}

export default App;
