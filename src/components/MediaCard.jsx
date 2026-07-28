import React from 'react';
import MediaStatusStepper from './MediaStatusStepper';

export default function MediaCard({ media, onClick, isProcessingStarted }) {
  const getSourceIcon = (sourceType) => {
    const src = (sourceType || '').toLowerCase();
    if (src.includes('mp4') || src.includes('video')) return 'movie';
    if (src.includes('wav') || src.includes('wave')) return 'graphic_eq';
    if (src.includes('podcast')) return 'mic';
    if (src.includes('rss')) return 'rss_feed';
    return 'audiotrack'; // Default audio
  };

  const getFriendlySourceName = (sourceType) => {
    const src = (sourceType || '').toLowerCase();
    if (src === 'local_mp3') return 'Local MP3';
    if (src === 'local_mp4') return 'Local MP4';
    if (src === 'local_wav') return 'Local WAV';
    if (src === 'podcast_website' || src === 'podcast') return 'Podcast';
    if (src === 'rss_feed') return 'RSS Feed';
    if (src === 'direct_media_url') return 'Direct URL';
    return sourceType || 'Media';
  };

  const getSourceColorClass = (sourceType) => {
    const src = (sourceType || '').toLowerCase();
    if (src.includes('mp4')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (src.includes('wav')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    if (src.includes('podcast')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (src.includes('rss')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20'; // Default
  };

  const formatUploadTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      return d.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (_) {
      return timeStr;
    }
  };

  return (
    <div 
      onClick={() => onClick(media.media_id)}
      className="group bg-surface-container-lowest/40 hover:bg-surface-container-low border border-outline-variant/20 hover:border-primary/30 rounded-[24px] p-5 flex flex-col justify-between gap-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] cursor-pointer select-none relative overflow-hidden"
    >
      {/* Background soft glow on card hover */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

      <div className="flex items-start gap-4 relative z-10">
        {/* Fallback Artwork/Icon */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 transition-transform duration-300 group-hover:scale-105 ${getSourceColorClass(media.source_type)}`}>
          <span className="material-symbols-outlined text-[24px]">
            {getSourceIcon(media.source_type)}
          </span>
        </div>

        {/* Media Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base text-on-surface truncate group-hover:text-primary-container transition-colors duration-200">
            {media.original_filename}
          </h3>
          <p className="text-xs text-outline mt-0.5">
            {formatUploadTime(media.upload_time)}
          </p>
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        <div className="flex justify-between items-center text-xs">
          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide uppercase ${getSourceColorClass(media.source_type)}`}>
            {getFriendlySourceName(media.source_type)}
          </span>
          <span className={`font-semibold capitalize text-[11px] ${
            media.status === 'failed' ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {media.status}
          </span>
        </div>
        
        {/* Compact Stepper */}
        <div className="pt-2 border-t border-outline-variant/10">
          <MediaStatusStepper 
            status={media.status} 
            explicitStages={media.explicit_stages} 
            isProcessingStarted={isProcessingStarted} 
            size="compact" 
          />
        </div>
      </div>
    </div>
  );
}
