import React from 'react';

export default function EmptyState({ onAddClick }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-outline-variant/30 rounded-3xl bg-surface-container-lowest/50 backdrop-blur-md">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6 animate-pulse">
        <span className="material-symbols-outlined text-[32px]">audio_file</span>
      </div>
      <h3 className="text-xl font-semibold text-on-surface mb-2">No media uploaded yet</h3>
      <p className="text-sm text-outline max-w-sm mb-8 leading-relaxed">
        Upload your first podcast, local MP3/WAV audio, or MP4 video to start processing and analyzing your media files.
      </p>
      <button
        onClick={onAddClick}
        className="px-6 py-3 btn-shiny-gradient font-semibold rounded-full transition-all flex items-center gap-2 cursor-pointer border-none"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        <span>Upload your first media</span>
      </button>
    </div>
  );
}
