import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './Dashboard';
import MediaDetail from './MediaDetail';

export default function ChatInterface({ onNavigate, isLoggedIn }) {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [previousWidth, setPreviousWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [user, setUser] = useState(null);

  // Media Library Catalog State
  const [mediaList, setMediaList] = useState([]);
  const [loadingMediaList, setLoadingMediaList] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState(null);
  const [proceededMediaIds, setProceededMediaIds] = useState([]);

  // Fetch all media owned by current user from backend MongoDB database
  const fetchMediaList = async () => {
    if (!isLoggedIn) {
      setMediaList([]);
      setLoadingMediaList(false);
      return;
    }

    setLoadingMediaList(true);
    const token = localStorage.getItem('voxvault_token');
    try {
      const response = await fetch('http://localhost:8000/media', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMediaList(data);
      } else {
        console.error("Failed to fetch media list from database");
      }
    } catch (e) {
      console.error("Network error fetching user media", e);
    } finally {
      setLoadingMediaList(false);
    }
  };

  useEffect(() => {
    fetchMediaList();
  }, [isLoggedIn]);

  const handleIngestSuccess = (newMedia) => {
    // Append the newly created media object at the top of the list if it doesn't already exist
    setMediaList((prev) => {
      const exists = prev.some((m) => m.media_id === newMedia.media_id);
      if (exists) return prev; // Do not add duplicates to the UI list
      return [newMedia, ...prev];
    });
    setSelectedMediaId(newMedia.media_id); // Redirect to detailed view immediately
  };

  const handleProceed = (mediaId) => {
    setProceededMediaIds((prev) => [...prev, mediaId]);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('voxvault_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Error parsing user from localStorage", e);
      }
    }
  }, [isLoggedIn]);

  const handleSaveRename = (index) => {
    if (editingName.trim()) {
      const updated = [...projects];
      updated[index] = editingName.trim();
      setProjects(updated);
    }
    setEditingIndex(null);
  };

  const handleDeleteProject = (index) => {
    const updated = projects.filter((_, idx) => idx !== index);
    setProjects(updated);
  };

  useEffect(() => {
    const closeDropdowns = () => {
      setActiveDropdown(null);
    };
    window.addEventListener('click', closeDropdowns);
    return () => window.removeEventListener('click', closeDropdowns);
  }, []);
  
  const minWidth = 0;
  const maxWidth = 450;

  const startResize = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Sync sidebarWidth state to the CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  }, [sidebarWidth]);

  const handleCreateProject = () => {
    if (projectName.trim()) {
      setProjects([...projects, projectName.trim()]);
      setProjectName('');
      setShowModal(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-sans antialiased overflow-hidden h-screen flex relative">
      {/* BEGIN: Sidebar */}
      <aside
        style={{ width: `${sidebarWidth < 50 ? 0 : sidebarWidth}px` }}
        className="relative bg-surface-container-lowest border-r-2 border-outline-variant flex flex-col h-full shrink-0 overflow-hidden"
        id="main-sidebar"
      >
        {/* Top Action Area */}
        <div className="p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-2 font-semibold">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-on-surface" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
                </svg>
              </div>
              <span className="text-on-surface truncate">VoxVault</span>
            </div>
            <button
              type="button"
              onClick={() => {
                console.log("Collapsing sidebar. Current width:", sidebarWidth);
                if (sidebarWidth >= 100) {
                  setPreviousWidth(sidebarWidth);
                } else {
                  setPreviousWidth(260);
                }
                setSidebarWidth(0);
              }}
              className="p-1.5 hover:bg-surface-variant/50 rounded transition-colors text-outline hover:text-on-surface cursor-pointer flex items-center justify-center shrink-0 z-50 relative"
              title="Hide sidebar"
            >
              <svg className="w-5 h-5 text-outline hover:text-on-surface" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </div>
          <button 
            onClick={() => setSelectedMediaId(null)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors group border-none text-left bg-transparent cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-outline group-hover:text-on-surface shrink-0">dashboard</span>
            <span className="text-sm font-medium truncate">Library Grid</span>
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar space-y-6">
          {/* Projects Section */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline truncate">Projects</h3>
              <button
                type="button"
                className="p-1 hover:bg-surface-variant/50 rounded transition-colors text-outline hover:text-on-surface border-none cursor-pointer"
                onClick={() => setShowModal(true)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </button>
            </div>
            <ul className="space-y-0.5 list-none p-0 m-0">
              {projects.map((proj, idx) => (
                <li key={idx} className="relative group px-3 py-2 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-variant/50 cursor-pointer flex items-center justify-between gap-2">
                  {editingIndex === idx ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(idx);
                        if (e.key === 'Escape') setEditingIndex(null);
                      }}
                      onBlur={() => handleSaveRename(idx)}
                      className="bg-surface-container-lowest border border-primary/30 rounded px-2 py-0.5 w-full text-sm text-on-surface focus:outline-none focus:border-primary"
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="truncate flex-1">{proj}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === idx ? null : idx);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-surface-container-high rounded transition-all text-outline hover:text-on-surface shrink-0 flex items-center justify-center border-none cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">more_vert</span>
                      </button>
                    </>
                  )}

                  {/* Dropdown Menu */}
                  {activeDropdown === idx && (
                    <div className="absolute right-3 top-9 bg-surface-container-high border border-outline-variant/30 rounded-lg p-1 shadow-2xl z-50 w-32 flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingIndex(idx);
                          setEditingName(proj);
                          setActiveDropdown(null);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-variant/50 text-xs font-medium text-left w-full text-on-surface cursor-pointer border-none"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(idx);
                          setActiveDropdown(null);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-error-container/20 text-xs font-medium text-left w-full text-error cursor-pointer border-none"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* User Profile Area */}
        <div className="p-3 border-t border-outline-variant">
          {isLoggedIn ? (
            <div className="flex items-center justify-between px-2 cursor-pointer" onClick={() => onNavigate('profileDetails')}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary-container/20 border border-primary-container/30 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
                  {getInitials(user?.full_name || user?.email || 'User')}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-on-surface truncate">{user?.full_name || 'User'}</span>
                  <span className="text-[11px] text-outline truncate">{user?.email || 'Free'}</span>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all cursor-pointer border-none"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              <span>Get started</span>
            </button>
          )}
        </div>

        {/* Resize Handle */}
        <div
          aria-label="Resize sidebar"
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          role="separator"
          onMouseDown={startResize}
        ></div>
      </aside>
      {/* END: Sidebar */}

      {/* BEGIN: Main Dashboard Content Area */}
      <main className="flex-1 flex flex-col relative bg-surface overflow-hidden h-full">
        {/* Toggle expansion trigger button when sidebar is hidden */}
        {sidebarWidth < 50 && (
          <button
            type="button"
            onClick={() => {
              const target = previousWidth >= 100 ? previousWidth : 260;
              setSidebarWidth(target);
            }}
            className="absolute top-4 left-4 p-2 bg-surface-container-high border border-outline-variant/30 hover:bg-surface-variant rounded-xl transition-all text-outline hover:text-on-surface cursor-pointer z-40 flex items-center justify-center shadow-lg border-none"
            title="Show sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        )}

        {selectedMediaId ? (
          <MediaDetail 
            mediaId={selectedMediaId} 
            onBack={() => setSelectedMediaId(null)} 
            isProcessingStarted={proceededMediaIds.includes(selectedMediaId)}
            onProceed={handleProceed}
          />
        ) : (
          <Dashboard 
            mediaList={mediaList} 
            loading={loadingMediaList} 
            onCardClick={setSelectedMediaId} 
            onIngestSuccess={handleIngestSuccess} 
            userName={user?.full_name}
            proceededMediaIds={proceededMediaIds}
          />
        )}
      </main>

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-high border border-outline-variant w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-on-surface mb-4">Create New Project</h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Project Name</label>
                <input
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container/50 transition-all outline-none"
                  placeholder="Enter project name..."
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  className="px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-variant/50 rounded-xl transition-colors border-none cursor-pointer"
                  type="button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-2 text-sm font-semibold bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-all border-none cursor-pointer"
                  type="button"
                  onClick={handleCreateProject}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
