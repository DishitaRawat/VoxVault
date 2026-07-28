import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {[1, 2, 3, 4].map((i) => (
        <div 
          key={i} 
          className="bg-surface-container-lowest/50 border border-outline-variant/20 rounded-3xl p-5 flex flex-col justify-between gap-5 animate-pulse shadow-lg"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-highest/40 shrink-0"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-surface-highest/50 rounded-full w-3/4"></div>
              <div className="h-3 bg-surface-highest/30 rounded-full w-1/2"></div>
            </div>
          </div>
          
          <div className="space-y-3 py-2">
            <div className="flex justify-between items-center text-xs">
              <div className="h-3 bg-surface-highest/40 rounded w-16"></div>
              <div className="h-3 bg-surface-highest/40 rounded w-16"></div>
            </div>
            <div className="flex items-center gap-1.5 justify-between py-1">
              {[1, 2, 3, 4, 5].map((dot) => (
                <div key={dot} className="flex items-center gap-1 flex-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-surface-highest/50"></div>
                  {dot < 5 && <div className="h-0.5 bg-surface-highest/30 flex-1"></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
