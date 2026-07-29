import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

export default function IngestionModal({ show, onClose, onIngestSuccess }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'link', 'podcast'
  const [inputUrl, setInputUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [ingestingEpisodeUrl, setIngestingEpisodeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingUrl, setPlayingUrl] = useState(null);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');

  if (!show) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setInputUrl('');
    setSelectedFile(null);
    setEpisodes([]);
    setEpisodeSearchQuery('');
    setError('');
  };

  const filteredEpisodes = episodes.filter((ep) => {
    if (!episodeSearchQuery.trim()) return true;
    const query = episodeSearchQuery.toLowerCase();
    const titleMatch = (ep.title || '').toLowerCase().includes(query);
    const descMatch = (ep.description || '').toLowerCase().includes(query);
    return titleMatch || descMatch;
  });

  const handleModalClose = () => {
    handleClear();
    onClose();
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    
    const token = localStorage.getItem('voxvault_token');

    if (activeTab === 'upload') {
      if (!selectedFile) return;
      setLoading(true);

      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const res = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'File upload failed');

        onIngestSuccess(data);
        handleModalClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } 
    
    else if (activeTab === 'link') {
      if (!inputUrl.trim()) return;
      setLoading(true);

      const formData = new FormData();
      formData.append('url', inputUrl.trim());

      try {
        const res = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Direct link upload failed');

        onIngestSuccess(data);
        handleModalClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } 
    
    else if (activeTab === 'podcast') {
      if (!inputUrl.trim()) return;
      setLoading(true);
      setEpisodes([]);

      try {
        const res = await fetch(`${API_BASE_URL}/podcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ url: inputUrl.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Podcast search failed');

        setEpisodes(data.episodes || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleIngestEpisode = async (episodeUrl, episodeTitle, imageUrl) => {
    setIngestingEpisodeUrl(episodeUrl);
    setError('');
    const token = localStorage.getItem('voxvault_token');
 
    const formData = new FormData();
    formData.append('url', episodeUrl);
    if (imageUrl) {
      formData.append('image_url', imageUrl);
    }
 
    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Episode ingestion failed');
 
      onIngestSuccess(data);
      handleModalClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIngestingEpisodeUrl(null);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-high border border-outline-variant/30 w-full max-w-2xl rounded-3xl p-6 shadow-2xl flex flex-col gap-6 relative max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/10">
          <h2 className="text-xl font-bold text-on-surface">Upload & Ingest Media</h2>
          <button 
            onClick={handleModalClose}
            className="p-1.5 hover:bg-surface-variant/50 rounded-full transition-colors text-outline hover:text-on-surface cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Custom Tabs */}
        <div className="flex bg-surface-container-lowest/60 p-1.5 rounded-2xl border border-outline-variant/10">
          {[
            { id: 'upload', label: 'Local File', icon: 'upload_file' },
            { id: 'link', label: 'Direct URL', icon: 'link' },
            { id: 'podcast', label: 'Podcast Discovery', icon: 'podcast' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                handleClear();
              }}
              style={activeTab === tab.id ? {
                background: 'linear-gradient(135deg, #0057cf 0%, #0284c7 45%, #10b981 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 18px rgba(0, 87, 207, 0.35), 0 0 12px rgba(16, 185, 129, 0.25)'
              } : {}}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border-none ${
                activeTab === tab.id 
                  ? 'text-white' 
                  : 'bg-transparent text-outline hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[50vh]">
          {activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/30 rounded-3xl py-10 px-6 bg-surface-container-lowest/20 hover:border-[#10b981]/50 transition-colors relative cursor-pointer"
                 onClick={() => document.getElementById('modal-file-picker').click()}>
              <input 
                type="file" 
                id="modal-file-picker" 
                accept=".mp3,.mp4,.wav" 
                className="hidden" 
                onChange={handleFileChange} 
              />
              <span className="material-symbols-outlined text-[48px] text-outline mb-3 animate-pulse">cloud_upload</span>
              <p className="text-sm text-on-surface font-semibold">
                {selectedFile ? `Selected: ${selectedFile.name}` : "Click to select a file"}
              </p>
              <p className="text-xs text-outline mt-1.5">Supports .mp3, .mp4, and .wav formats</p>
            </div>
          )}

          {activeTab === 'link' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-outline tracking-wider uppercase">Direct Stream URL</label>
                <input 
                  type="text" 
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="Paste direct audio/video link (e.g. https://example.com/audio.mp3)"
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-4 py-3.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981] transition-all"
                />
              </div>
            </form>
          )}

          {activeTab === 'podcast' && (
            <div className="flex flex-col gap-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="Paste podcast site or direct RSS URL"
                  className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981] transition-all"
                />
                <button
                  type="submit"
                  disabled={loading || !inputUrl.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #0057cf 0%, #0284c7 45%, #10b981 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 18px rgba(0, 87, 207, 0.35), 0 0 12px rgba(16, 185, 129, 0.25)'
                  }}
                  className="px-6 py-3 text-white font-bold rounded-2xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none hover:scale-105"
                >
                  Search
                </button>
              </form>

              {/* Episodes List Container */}
              {episodes.length > 0 && (
                <div className="flex flex-col gap-3.5 border-t border-outline-variant/10 pt-4">
                  {/* Episode Search / Filter Input */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <h4 className="text-xs font-bold tracking-wider text-outline uppercase whitespace-nowrap">
                      Discovered Episodes ({filteredEpisodes.length}/{episodes.length})
                    </h4>
                    <div className="relative flex-1 sm:max-w-[260px]">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">
                        search
                      </span>
                      <input 
                        type="text" 
                        value={episodeSearchQuery}
                        onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                        placeholder="Type to filter episodes..."
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-9 pr-8 py-1.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981] transition-all shadow-sm"
                      />
                      {episodeSearchQuery && (
                        <button 
                          onClick={() => setEpisodeSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer bg-none border-none p-0 flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-outline-variant/10">
                    {filteredEpisodes.length > 0 ? (
                      filteredEpisodes.map((ep, idx) => (
                        <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-on-surface truncate">{ep.title}</p>
                            {ep.description && (
                              <p className="text-xs text-outline line-clamp-1 mt-0.5">{ep.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Play Preview */}
                            <button
                              onClick={() => setPlayingUrl(playingUrl === ep.audio_url ? null : ep.audio_url)}
                              className="p-2 bg-surface-container rounded-full text-outline hover:text-on-surface transition-colors cursor-pointer border-none"
                            >
                              <span className="material-symbols-outlined text-[16px] block">
                                {playingUrl === ep.audio_url ? 'pause' : 'play_arrow'}
                              </span>
                            </button>
                            {/* Ingest Button */}
                            <button
                              onClick={() => handleIngestEpisode(ep.audio_url, ep.title, ep.image_url)}
                              disabled={!!ingestingEpisodeUrl}
                              style={{
                                background: 'linear-gradient(135deg, #0057cf 0%, #0284c7 45%, #10b981 100%)',
                                color: '#ffffff',
                                boxShadow: '0 3px 12px rgba(0, 87, 207, 0.3)'
                              }}
                              className="px-4 py-1.5 text-white text-xs font-bold rounded-full transition-all cursor-pointer border-none flex items-center gap-1 hover:scale-105"
                            >
                              {ingestingEpisodeUrl === ep.audio_url ? (
                                <>
                                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                  <span>Ingesting...</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[14px]">download</span>
                                  <span>Ingest</span>
                                </>
                              )}
                            </button>
                          </div>
                          {playingUrl === ep.audio_url && (
                            <div className="w-full mt-2">
                              <audio src={ep.audio_url} controls autoPlay className="w-full rounded-lg bg-surface-container" />
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-outline italic">
                        No episodes found matching "{episodeSearchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loader */}
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2 text-primary font-medium animate-pulse text-sm">
              <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
              <span>Processing request...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {activeTab !== 'podcast' && (
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/10">
            <button
              onClick={handleModalClose}
              className="px-5 py-2.5 hover:bg-surface-variant/40 rounded-2xl text-sm font-semibold text-on-surface transition-colors cursor-pointer border-none"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (activeTab === 'upload' ? !selectedFile : !inputUrl.trim())}
              className="px-6 py-2.5 btn-shiny-gradient font-semibold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm cursor-pointer border-none"
            >
              Ingest into Vault
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
