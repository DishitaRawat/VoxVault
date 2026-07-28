import React, { useState, useEffect, useRef } from 'react';

export default function MediaPlayer({ src }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // Sync state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);

    // Initial load check
    if (audio.duration) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
    };
  }, [isSeeking]);

  // Restart play state when source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Audio play failed", e));
    }
  };

  const handleSeekChange = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    setIsSeeking(true);
  };

  const handleSeekEnd = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setIsSeeking(false);
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = vol === 0;
    }
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (audioRef.current) {
      audioRef.current.muted = newMute;
      audioRef.current.volume = newMute ? 0 : volume;
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPct = Math.min(100, Math.max(0, (currentTime / (duration || 1)) * 100));
  const volumePct = isMuted ? 0 : volume * 100;

  return (
    <div className="bg-surface-container border border-outline-variant/30 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 w-full select-none">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Track Progression Slider */}
      <div className="flex flex-col gap-1 w-full">
        <input 
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeekChange}
          onMouseUp={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#10b981]"
          style={{
            background: progressPct > 0 
              ? `linear-gradient(to right, #0057cf 0%, #10b981 ${progressPct}%, rgba(200,200,200,0.3) ${progressPct}%, rgba(200,200,200,0.3) 100%)`
              : 'rgba(200,200,200,0.3)'
          }}
        />
        <div className="flex justify-between items-center text-[11px] text-outline px-1 mt-1 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Interactive Controls Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Play / Pause button */}
        <button
          onClick={togglePlay}
          style={{
            background: 'linear-gradient(135deg, #0057cf 0%, #0284c7 45%, #10b981 100%)',
            color: '#ffffff',
            boxShadow: '0 4px 20px rgba(0, 87, 207, 0.4), 0 0 14px rgba(16, 185, 129, 0.3)'
          }}
          className="w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 transition-all cursor-pointer border-none shrink-0"
        >
          <span className="material-symbols-outlined text-[26px] text-white">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        {/* Volume slider controls */}
        <div className="flex items-center gap-2 group/volume">
          <button 
            onClick={toggleMute}
            className="p-2 hover:bg-surface-highest/50 rounded-full transition-colors text-outline hover:text-on-surface cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isMuted ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
            </span>
          </button>
          <input 
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 rounded-lg appearance-none cursor-pointer accent-[#10b981]"
            style={{
              background: volumePct > 0 
                ? `linear-gradient(to right, #0057cf 0%, #10b981 ${volumePct}%, rgba(200,200,200,0.3) ${volumePct}%, rgba(200,200,200,0.3) 100%)`
                : 'rgba(200,200,200,0.3)'
            }}
          />
        </div>
      </div>
    </div>
  );
}
