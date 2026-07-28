import React from 'react';
import MediaCard from './MediaCard';

export default function MediaGrid({ mediaList, onCardClick, proceededMediaIds }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {mediaList.map((media) => (
        <MediaCard 
          key={media.media_id} 
          media={media} 
          onClick={onCardClick} 
          isProcessingStarted={proceededMediaIds?.includes(media.media_id)}
        />
      ))}
    </div>
  );
}
