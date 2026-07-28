import React, { useState, useEffect, useRef } from 'react';
import MediaStatusStepper from './MediaStatusStepper';

// ─── Helpers (mirrors MediaCard logic) ───────────────────────────────────────
const PodcastSVGThumbnail = ({ title, imageUrl, size = '100%' }) => {
  const hash = [...(title || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const angle = hash % 360;
  const initials = (title || 'Pod')
    .split(/[\s\-_]+/)
    .map(w => w[0])
    .filter(c => /[a-zA-Z0-9]/.test(c))
    .slice(0, 2)
    .join('')
    .toUpperCase() || '🎙️';

  return (
    <svg 
      viewBox="0 0 100 100" 
      style={{ width: size, height: size }}
      className="rounded-xl shadow-sm border border-black/10 select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`grad-${hash}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <clipPath id={`clip-${hash}`}>
          <rect width="100" height="100" rx="12" />
        </clipPath>
      </defs>
      
      {imageUrl ? (
        <image 
          href={imageUrl} 
          width="100" 
          height="100" 
          clipPath={`url(#clip-${hash})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <>
          {/* Background Cover */}
          <rect width="100" height="100" fill={`url(#grad-${hash})`} rx="12" />
          
          {/* Dynamic graphic lines mimicking a soundwave disc */}
          <circle cx="50" cy="50" r="38" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
          <circle cx="50" cy="50" r="28" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" fill="none" />
          <circle cx="50" cy="50" r="18" stroke="rgba(255,255,255,0.16)" strokeWidth="0.6" fill="none" />
          
          {/* Glowing sound wave lines at the bottom */}
          <path d="M 30 72 Q 40 68 50 72 T 70 72" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 35 77 Q 45 74 55 77 T 65 77" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeLinecap="round" />

          {/* Main text / initials */}
          <text 
            x="50%" 
            y="46%" 
            dominantBaseline="middle" 
            textAnchor="middle" 
            fill="#ffffff" 
            fontSize={initials.length > 1 ? "22" : "28"} 
            fontWeight="900"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            letterSpacing="-0.03em"
          >
            {initials}
          </text>

          {/* Branded text badge */}
          <rect x="22" y="58" width="56" height="10" rx="3" fill="rgba(0, 0, 0, 0.25)" />
          <text 
            x="50%" 
            y="63%" 
            dominantBaseline="middle" 
            textAnchor="middle" 
            fill="rgba(255,255,255,0.9)" 
            fontSize="5.5" 
            fontWeight="bold"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            letterSpacing="0.05em"
          >
            VOXVAULT
          </text>
        </>
      )}
    </svg>
  );
};


const getSourceLabel = (sourceType) => {
  const s = (sourceType || '').toLowerCase();
  if (s === 'local_mp3') return 'MP3';
  if (s === 'local_mp4') return 'MP4';
  if (s === 'local_wav') return 'WAV';
  if (s === 'podcast_website' || s === 'podcast') return 'Podcast';
  if (s === 'rss_feed') return 'RSS';
  if (s === 'direct_media_url') return 'URL';
  return sourceType || 'Media';
};

const getSourceEmoji = (sourceType) => {
  const s = (sourceType || '').toLowerCase();
  if (s.includes('mp4') || s.includes('video')) return '🎬';
  if (s.includes('wav')) return '🎵';
  if (s.includes('podcast')) return '🎙️';
  if (s.includes('rss')) return '📡';
  return '🎧';
};

const getStatusColor = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'completed': return { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)' };
    case 'transcribed': return { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' };
    case 'processing': return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' };
    case 'uploaded': return { bg: 'rgba(168,85,247,0.12)', color: '#c084fc', border: 'rgba(168,85,247,0.3)' };
    case 'cleaned': return { bg: 'rgba(20,184,166,0.12)', color: '#2dd4bf', border: 'rgba(20,184,166,0.3)' };
    case 'failed': return { bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.3)' };
    default: return { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' };
  }
};

const formatDate = (str) => {
  if (!str) return '';
  try {
    return new Date(str).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) { return str; }
};

const getInitials = (name) => {
  if (!name) return 'U';
  const p = name.trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0][0].toUpperCase();
};

// ─── Rectangular Media Card ───────────────────────────────────────────────────
const MediaCard = ({ media, onClick, isProcessingStarted }) => {
  const statusStyle = getStatusColor(media.status);
  const sourceType = (media.source_type || '').toLowerCase();
  const filename = (media.original_filename || '').toLowerCase();
  const isPodcast = 
    sourceType.includes('podcast') || 
    sourceType.includes('rss') || 
    sourceType.includes('direct') || 
    filename.includes('podcast') || 
    filename.includes('ep-') || 
    filename.includes('episode');

  return (
    <div
      className="lp-media-card"
      onClick={() => onClick(media.media_id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(media.media_id)}
    >
      {/* Left: icon */}
      <div className="lp-media-card-icon" style={isPodcast ? { background: 'none', border: 'none' } : {}}>
        {isPodcast ? (
          <PodcastSVGThumbnail title={media.original_filename} imageUrl={media.image_url} size="48px" />
        ) : (
          <span className="lp-media-card-emoji">{getSourceEmoji(media.source_type)}</span>
        )}
      </div>



      {/* Center: info */}
      <div className="lp-media-card-info">
        <div className="lp-media-card-name">{media.original_filename || 'Untitled'}</div>
        <div className="lp-media-card-meta">
          <span className="lp-media-card-source">{getSourceLabel(media.source_type)}</span>
          <span className="lp-media-card-dot">·</span>
          <span>{formatDate(media.upload_time)}</span>
        </div>
        {/* Stepper */}
        <div className="lp-media-card-stepper">
          <MediaStatusStepper
            status={media.status}
            explicitStages={media.explicit_stages}
            isProcessingStarted={isProcessingStarted}
            size="compact"
          />
        </div>
      </div>

      {/* Right: status + arrow */}
      <div className="lp-media-card-right">
        <span
          className="lp-media-card-status"
          style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}
        >
          {media.status || 'Unknown'}
        </span>
        <svg className="lp-media-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
};

// ─── Waveform SVG ─────────────────────────────────────────────────────────────
const WaveformSVG = () => (
  <svg viewBox="0 0 120 40" className="w-32 h-10 opacity-60" xmlns="http://www.w3.org/2000/svg">
    {[0,8,16,24,32,40,48,56,64,72,80,88,96,104,112].map((x, i) => {
      const heights = [12,24,36,20,30,12,40,20,28,12,24,36,16,28,12];
      const h = heights[i];
      return <rect key={x} x={x} y={(40-h)/2} width="4" height={h} rx="2" fill="currentColor"/>;
    })}
  </svg>
);

// ─── Stat Badge ───────────────────────────────────────────────────────────────
const StatBadge = ({ value, label }) => (
  <div className="landing-stat-badge">
    <span className="landing-stat-value">{value}</span>
    <span className="landing-stat-label">{label}</span>
  </div>
);

// ─── Feature Card ─────────────────────────────────────────────────────────────
const FeatureCard = ({ icon, title, description, delay }) => (
  <div className="landing-feature-card" style={{ animationDelay: `${delay}ms` }}>
    <div className="landing-feature-icon">{icon}</div>
    <h3 className="landing-feature-title">{title}</h3>
    <p className="landing-feature-desc">{description}</p>
  </div>
);

// ─── MAIN LANDING PAGE ────────────────────────────────────────────────────────
export default function LandingPage({
  onNavigate,
  isLoggedIn,
  user,
  mediaList = [],
  loadingMedia,
  onCardClick,
  onIngestSuccess,
  proceededMediaIds = [],
  onLogout,
  setShowUploadModal,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const libraryRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredMedia = mediaList.filter(m =>
    (m.original_filename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scrollToLibrary = () => {
    libraryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!isLoggedIn) { onNavigate('login'); return; }
    scrollToLibrary();
  };

  return (
    <div className="landing-root">

      {/* ══ FLOATING NAV ═════════════════════════════════════════════════ */}
      <nav className={`landing-nav ${scrolled ? 'landing-nav--scrolled' : ''}`}>
        <div className="landing-nav-inner">
          {/* Logo */}
          <div className="landing-logo">
            <div className="landing-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width: 25, height: 25}}>
                <rect x="9.25" y="3.25" width="5.5" height="9.5" rx="2.75" fill="none" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M6.5 9.5a5.5 5.5 0 0 0 11 0" />
                <path d="M12 15v4.5" />
                <path d="M8.5 19.5h7" />
                <path d="M3.8 7.5a6.5 6.5 0 0 0 0 5" />
                <path d="M1.2 5a10.5 10.5 0 0 0 0 10" />
                <path d="M20.2 7.5a6.5 6.5 0 0 1 0 5" />
                <path d="M22.8 5a10.5 10.5 0 0 1 0 10" />
              </svg>
            </div>
            <span className="landing-logo-text">VoxVault</span>
          </div>

          {/* Nav Links */}
          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            {isLoggedIn && (
              <button onClick={scrollToLibrary} className="landing-nav-link" style={{border:'none',cursor:'pointer'}}>
                My Library
              </button>
            )}
            <a href="#how-it-works" className="landing-nav-link">How it works</a>
          </div>

          {/* Right side: logged in vs. not */}
          <div className="landing-nav-actions">
            {isLoggedIn ? (
              <>
                {/* Upload button */}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="landing-btn-primary"
                  style={{display:'flex',alignItems:'center',gap:'6px'}}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round"/>
                    <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
                  </svg>
                  Upload
                </button>

                {/* Profile avatar dropdown */}
                <div className="lp-profile-wrapper" ref={profileMenuRef}>
                  <button
                    className="lp-profile-avatar"
                    onClick={() => setShowProfileMenu(v => !v)}
                    title={user?.full_name || 'Profile'}
                  >
                    {getInitials(user?.full_name || user?.email || 'U')}
                  </button>
                  {showProfileMenu && (
                    <div className="lp-profile-dropdown">
                      <div className="lp-profile-dropdown-header">
                        <div className="lp-profile-dropdown-name">{user?.full_name || 'User'}</div>
                        <div className="lp-profile-dropdown-email">{user?.email || ''}</div>
                      </div>
                      <button className="lp-profile-dropdown-item" onClick={() => { setShowProfileMenu(false); onNavigate('profileDetails'); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        My Profile
                      </button>
                      <button className="lp-profile-dropdown-item" onClick={scrollToLibrary}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                          <rect x="3" y="3" width="7" height="7" rx="1"/>
                          <rect x="14" y="3" width="7" height="7" rx="1"/>
                          <rect x="14" y="14" width="7" height="7" rx="1"/>
                          <rect x="3" y="14" width="7" height="7" rx="1"/>
                        </svg>
                        My Library
                      </button>
                      <div className="lp-profile-dropdown-divider"/>
                      <button className="lp-profile-dropdown-item lp-logout-item" onClick={() => { setShowProfileMenu(false); onLogout(); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round"/>
                          <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round"/>
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button onClick={() => onNavigate('login')} className="landing-btn-ghost">Sign in</button>
                <button onClick={() => onNavigate('register')} className="landing-btn-primary">Get Started Free</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ══ HERO SECTION ═════════════════════════════════════════════════ */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <img src="/hero_background.png" alt="" className="landing-hero-bg-img" />
          <div className="landing-hero-overlay" />
          <div className="landing-hero-bottom-fade" />
        </div>

        <div className={`landing-hero-content ${heroVisible ? 'landing-hero-content--visible' : ''}`}>
          <div className="landing-hero-badge">
            <span className="landing-badge-dot" />
            <span>AI-Powered Media Intelligence Platform</span>
          </div>

          {/* KNOCKOUT TEXT */}
          <div className="landing-knockout-wrapper">
            <div className="landing-knockout-text">VOXVAULT</div>
          </div>

          <h2 className="landing-hero-tagline">
            Transform Media into Searchable Knowledge.
          </h2>

          <p className="landing-hero-description">
            Upload podcasts, lectures, meetings and videos. Instantly transcribe,
            summarize and chat with your media using AI.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="landing-search-form">
            <div className="landing-search-bar">
              <svg className="landing-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search your media or ask anything..."
                className="landing-search-input"
              />
              <button type="submit" className="landing-search-submit">Search</button>
            </div>
          </form>

          {/* CTA buttons */}
          <div className="landing-cta-group">
            <button
              onClick={() => isLoggedIn ? setShowUploadModal(true) : onNavigate('login')}
              className="landing-cta-primary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round"/>
                <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
              </svg>
              Upload Media
            </button>
            <button
              onClick={() => isLoggedIn ? scrollToLibrary() : onNavigate('login')}
              className="landing-cta-secondary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
              </svg>
              {isLoggedIn ? 'My Library' : 'Explore Library'}
            </button>
          </div>

          {/* Stats */}
          <div className="landing-stats-row">
            <StatBadge value="10K+" label="Media files processed" />
            <div className="landing-stat-divider" />
            <StatBadge value="99.2%" label="Transcription accuracy" />
            <div className="landing-stat-divider" />
            <StatBadge value="5s" label="Average processing start" />
          </div>
        </div>

        <div className="landing-hero-waveform"><WaveformSVG /></div>
      </section>

      {/* ══ MEDIA LIBRARY (logged in only) ══════════════════════════════ */}
      {isLoggedIn && (
        <section ref={libraryRef} id="my-library" className="lp-library-section">
          <div className="landing-section-inner">
            {/* Header row */}
            <div className="lp-library-header">
              <div>
                <h2 className="lp-library-heading">
                  Welcome back, <span className="landing-gradient-text">{user?.full_name || 'there'}</span>
                </h2>
                <p className="lp-library-subheading">Your media library — click any card to open, transcribe & chat.</p>
              </div>
              <div className="lp-library-header-actions">
                {/* Search inside library */}
                <div className="lp-library-search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,color:'#94a3b8',flexShrink:0}}>
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="lp-library-search-input"
                  />
                </div>
                <button onClick={() => setShowUploadModal(true)} className="landing-btn-primary" style={{display:'flex',alignItems:'center',gap:'6px',whiteSpace:'nowrap'}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round"/>
                    <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
                  </svg>
                  Upload New Media
                </button>
              </div>
            </div>

            {/* Media cards grid */}
            {loadingMedia ? (
              <div className="lp-loading-grid">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="lp-skeleton-card">
                    <div className="lp-skeleton-icon" />
                    <div className="lp-skeleton-lines">
                      <div className="lp-skeleton-line lp-skeleton-line--wide" />
                      <div className="lp-skeleton-line lp-skeleton-line--narrow" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="lp-empty-state">
                <div className="lp-empty-icon">🎙️</div>
                <h3 className="lp-empty-title">{searchQuery ? 'No results found' : 'Your library is empty'}</h3>
                <p className="lp-empty-desc">
                  {searchQuery
                    ? `No media matches "${searchQuery}"`
                    : 'Upload your first podcast, lecture, or video to get started.'}
                </p>
                {!searchQuery && (
                  <button onClick={() => setShowUploadModal(true)} className="landing-cta-primary" style={{marginTop:'16px'}}>
                    Upload your first file
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="lp-media-count">{filteredMedia.length} file{filteredMedia.length !== 1 ? 's' : ''}</div>
                <div className="lp-media-grid">
                  {filteredMedia.map((media, i) => (
                    <MediaCard
                      key={media.media_id}
                      media={media}
                      onClick={onCardClick}
                      isProcessingStarted={proceededMediaIds.includes(media.media_id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* ══ FEATURES (always visible, or only for logged-out) ═══════════ */}
      <section id="features" className="landing-features-section">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-badge">Why VoxVault</span>
            <h2 className="landing-section-title">Everything you need to unlock your media</h2>
            <p className="landing-section-subtitle">From raw audio to searchable knowledge — in seconds.</p>
          </div>
          <div className="landing-features-grid">
            {[
              { icon: '🎙️', title: 'AI Transcription', desc: 'Whisper AI transcribes audio and video with industry-leading accuracy across 50+ languages.' },
              { icon: '💬', title: 'Chat with Media', desc: 'Ask any question about your uploads. AI retrieves exact moments and generates precise answers.' },
              { icon: '📋', title: 'Smart Summaries', desc: 'Instant AI-generated summaries, key takeaways, and chapter breakdowns for any media file.' },
              { icon: '🔍', title: 'Semantic Search', desc: 'Search across all your media in natural language. Find any moment, quote, or concept instantly.' },
              { icon: '⚡', title: 'Live Processing', desc: 'Real-time progress tracking as your media is ingested, transcribed, embedded and indexed.' },
              { icon: '🔒', title: 'Private & Secure', desc: 'Your media stays yours. Encrypted storage, isolated processing, and full data control.' },
            ].map((f, i) => (
              <div key={f.title} className="landing-feature-card" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="landing-feature-icon" style={{fontSize:'1.5rem'}}>{f.icon}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section id="how-it-works" className="landing-how-section">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-badge">Simple Process</span>
            <h2 className="landing-section-title">From upload to insight in minutes</h2>
          </div>
          <div className="landing-steps-row">
            {[
              { step: '01', title: 'UPLOAD', desc: 'Drag and drop any podcast, lecture, meeting, or video file. MP3, MP4, WAV, M4A and more.' },
              { step: '02', title: 'PROCESS', desc: 'AI pipeline transcribes, cleans, chunks and embeds your content into a searchable knowledge graph.' },
              { step: '03', title: 'DISCOVER', desc: 'Chat, search, and summarize your library. Ask questions in plain English and get instant answers.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="landing-step-card">
                <div className="landing-step-number">{step}</div>
                <h3 className="landing-step-title">{title}</h3>
                <p className="landing-step-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER (not logged in only) ══════════════════════════════ */}
      {!isLoggedIn && (
        <section className="landing-cta-banner">
          <div className="landing-cta-banner-inner">
            <div className="landing-cta-banner-glow" />
            <h2 className="landing-cta-banner-title">Ready to transform your media?</h2>
            <p className="landing-cta-banner-sub">
              Join researchers, students, and professionals who use VoxVault to unlock the knowledge inside their media.
            </p>
            <div className="landing-cta-group">
              <button onClick={() => onNavigate('register')} className="landing-cta-primary landing-cta-large">
                Get Started Free — No credit card required
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="landing-footer" style={{padding:'64px 24px'}}>
        <div className="landing-footer-inner" style={{display:'flex', flexDirection:'column', gap:'40px', alignItems:'center'}}>
          
          <div style={{display:'flex', width:'100%', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'20px'}}>
            <div className="landing-footer-brand">
              <div className="landing-logo">
                <div className="landing-logo-icon" style={{width:28,height:28}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width: 20, height: 20}}>
                    <rect x="9.25" y="3.25" width="5.5" height="9.5" rx="2.75" fill="none" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M6.5 9.5a5.5 5.5 0 0 0 11 0" />
                    <path d="M12 15v4.5" />
                    <path d="M8.5 19.5h7" />
                    <path d="M3.8 7.5a6.5 6.5 0 0 0 0 5" />
                    <path d="M1.2 5a10.5 10.5 0 0 0 0 10" />
                    <path d="M20.2 7.5a6.5 6.5 0 0 1 0 5" />
                    <path d="M22.8 5a10.5 10.5 0 0 1 0 10" />
                  </svg>
                </div>
                <span className="landing-logo-text" style={{fontSize:'1.15rem', fontWeight:'800'}}>VoxVault</span>
              </div>
              <p className="landing-footer-tagline">AI-powered media intelligence.</p>
            </div>

            <div className="landing-footer-links">
              <button onClick={() => isLoggedIn ? onNavigate('profileDetails') : onNavigate('login')} className="landing-footer-link">Profile</button>
              <a href="#features" className="landing-footer-link" style={{textDecoration:'none'}}>Features</a>
              <a href="#how-it-works" className="landing-footer-link" style={{textDecoration:'none'}}>How It Works</a>
            </div>
          </div>

          <div className="landing-footer-center" style={{textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'-14px'}}>
            <p className="landing-footer-gradient-text" style={{margin:0, fontSize:'1.65rem', fontWeight:'900', fontStyle:'italic', letterSpacing:'-0.01em'}}>Hallucinations not included*</p>
            <p className="landing-footer-gradient-text" style={{margin:0, fontSize:'1.65rem', fontWeight:'900', fontStyle:'italic', letterSpacing:'-0.01em'}}>No AI was harmed... only our API quota</p>
            <p className="landing-footer-gradient-text" style={{margin:'2px 0 0 0', fontSize:'1.35rem', fontWeight:'800', fontStyle:'italic'}}>Made by a very sleep-deprived hooman ⭐</p>
          </div>

          <p className="landing-footer-copy" style={{marginTop:'8px'}}>© 2026 VoxVault. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
