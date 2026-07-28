import React, { useState } from 'react';
import MediaGrid from './MediaGrid';
import EmptyState from './EmptyState';
import LoadingSkeleton from './LoadingSkeleton';
import IngestionModal from './IngestionModal';

export default function Dashboard({ mediaList, loading, onCardClick, onIngestSuccess, userName, proceededMediaIds }) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter media based on search query
  const filteredMedia = mediaList.filter((item) =>
    (item.original_filename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 py-6 px-6 w-full h-full overflow-y-auto custom-scrollbar select-none relative z-10">
      {/* Upper header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-outline-variant/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">
            Welcome back, {userName || 'Dishita'}
          </h1>
          <p className="text-xs text-outline mt-1">Manage, transcribe, and query your media library.</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-5 py-3 btn-shiny-gradient font-semibold rounded-2xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer border-none shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
          <span>Upload New Media</span>
        </button>
      </div>

      {/* Search Filter Controls */}
      <div className="w-full max-w-md relative bg-surface-container-lowest/40 border border-outline-variant/20 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary rounded-2xl p-2 transition-all">
        <div className="flex items-center px-2">
          <span className="material-symbols-outlined text-[20px] text-outline">search</span>
          <input
            type="text"
            placeholder="Search media files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-on-surface placeholder-outline py-2 px-3 text-sm outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="p-1 hover:bg-surface-highest/40 rounded-full text-outline hover:text-on-surface cursor-pointer border-none"
            >
              <span className="material-symbols-outlined text-[16px] block">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Body */}
      <div className="flex-1">
        {loading ? (
          <LoadingSkeleton />
        ) : filteredMedia.length === 0 ? (
          <EmptyState onAddClick={() => setShowUploadModal(true)} />
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-bold text-outline uppercase tracking-wider mb-2">
              My Media Library ({filteredMedia.length})
            </h2>
            <MediaGrid mediaList={filteredMedia} onCardClick={onCardClick} proceededMediaIds={proceededMediaIds} />
          </div>
        )}
      </div>

      {/* Unified Ingestion Modal */}
      <IngestionModal 
        show={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
        onIngestSuccess={onIngestSuccess}
      />
    </div>
  );
}
