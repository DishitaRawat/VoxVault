import React, { useState, useEffect, useRef } from 'react';
import MediaStatusStepper from './MediaStatusStepper';
import MediaPlayer from './MediaPlayer';
import { API_BASE_URL } from '../config';

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


export default function MediaDetail({ mediaId, onBack, isProcessingStarted, onProceed }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRightTab, setActiveRightTab] = useState('chat'); // 'chat', 'transcript', 'embeddings'
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchConversations = async (id, token) => {
    setLoadingConversations(true);
    try {
      const res = await fetch(`http://localhost:8000/media/${id}/conversations`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
      }
    } catch (e) {
      console.error("Error fetching conversations:", e);
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchMessages = async (convId, token) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`http://localhost:8000/conversations/${convId}/messages`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      }
    } catch (e) {
      console.error("Error fetching messages:", e);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Processing & Transcription States
  const [transcript, setTranscript] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  const [transcriptView, setTranscriptView] = useState('raw'); // 'raw' or 'cleaned'
  const [embeddings, setEmbeddings] = useState([]);

  const fetchEmbeddings = async (id, token) => {
    try {
      const res = await fetch(`http://localhost:8000/media/${id}/embeddings`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmbeddings(data.chunks || []);
      }
    } catch (e) {
      console.error("Error fetching embeddings:", e);
    }
  };

  const fetchTranscript = async (id, token) => {
    try {
      const res = await fetch(`http://localhost:8000/media/${id}/transcript`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data);
        if (data.clean_transcript) {
          setTranscriptView('cleaned');
        } else {
          setTranscriptView('raw');
        }
      }
    } catch (e) {
      console.error("Error fetching transcript:", e);
    }
  };

  useEffect(() => {
    const fetchMediaDetails = async () => {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('voxvault_token');
      try {
        const res = await fetch(`http://localhost:8000/media/${mediaId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to fetch media details');
        setMedia(data);

        // Retrieve existing transcript and embeddings if they exist
        if (data.status === 'embedded' || data.status === 'ready' || data.status === 'completed') {
          fetchTranscript(mediaId, token);
          fetchEmbeddings(mediaId, token);
          fetchConversations(mediaId, token);
          setActiveRightTab('embeddings'); // Auto-switch to embeddings if complete
        } else if (data.status === 'transcribed' || data.status === 'cleaned') {
          fetchTranscript(mediaId, token);
          setActiveRightTab('transcript');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (mediaId) {
      fetchMediaDetails();
    }
  }, [mediaId]);

  const handleProceedClick = async () => {
    setIsProcessing(true);
    setProcessingError('');

    const token = localStorage.getItem('voxvault_token');
    try {
      const endpoint = `http://localhost:8000/media/${mediaId}/next-step`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Media action failed.');

      // Notify parent of success to mark stepper status globally
      onProceed(mediaId);

      // Reload updated media metadata status
      const mediaRes = await fetch(`http://localhost:8000/media/${mediaId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let updatedStatus = '';
      if (mediaRes.ok) {
        const updatedMedia = await mediaRes.json();
        setMedia(updatedMedia);
        updatedStatus = updatedMedia.status;
      }

      if (updatedStatus === 'embedded') {
        await fetchTranscript(mediaId, token);
        await fetchEmbeddings(mediaId, token);
        setActiveRightTab('embeddings');
      } else if (updatedStatus === 'completed' || updatedStatus === 'ready') {
        await fetchTranscript(mediaId, token);
        await fetchEmbeddings(mediaId, token);
        await fetchConversations(mediaId, token);
        setActiveRightTab('chat'); // Focus on chat once pipeline completes!
      } else {
        await fetchTranscript(mediaId, token);
        setActiveRightTab('transcript');
      }

    } catch (err) {
      setProcessingError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds) => {
    if (seconds == null) return '00:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    
    const minsStr = mins.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');
    const msStr = ms.toString().padStart(2, '0');
    
    return `${minsStr}:${secsStr}.${msStr}`;
  };

  const handleCreateNewConversation = async () => {
    const token = localStorage.getItem('voxvault_token');
    try {
      const res = await fetch(`http://localhost:8000/media/${mediaId}/conversations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const newConvId = data.conversation_id;
        setActiveConversationId(newConvId);
        setMessages([]); // Clear chat window
        fetchConversations(mediaId, token);
      }
    } catch (e) {
      console.error("Error creating conversation:", e);
    }
  };

  const handleSelectConversation = (convId) => {
    const token = localStorage.getItem('voxvault_token');
    setActiveConversationId(convId);
    fetchMessages(convId, token);
  };

  const handleSubmitQuestion = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || sendingQuestion) return;

    const token = localStorage.getItem('voxvault_token');
    const questionText = chatInput.trim();
    setChatInput('');
    setSendingQuestion(true);

    const tempUserMsg = {
      message_id: 'temp_user_id',
      role: 'user',
      content: questionText,
      retrieval_sources: [],
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`http://localhost:8000/media/${mediaId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: questionText,
          conversation_id: activeConversationId
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to get RAG answer.');
      }
      
      const data = await res.json();
      if (!activeConversationId) {
        setActiveConversationId(data.conversation_id);
      }
      
      await fetchMessages(data.conversation_id || activeConversationId, token);
      fetchConversations(mediaId, token);
    } catch (err) {
      console.error("Chat question submission failed:", err);
      const tempErrorMsg = {
        message_id: 'temp_err_id',
        role: 'assistant',
        content: `Error: ${err.message}`,
        retrieval_sources: [],
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, tempErrorMsg]);
    } finally {
      setSendingQuestion(false);
    }
  };

  const handleTimestampSeek = (seconds) => {
    const audio = document.querySelector('audio');
    if (audio) {
      audio.currentTime = seconds;
      audio.play().catch((e) => console.error("Error seeking audio:", e));
    }
  };

  const renderMessageContent = (content, msg) => {
    const parts = content.split(/(\[\d+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1]);
        return (
          <span 
            key={idx}
            className="inline-flex items-center justify-center w-4.5 h-4.5 text-[9px] font-extrabold bg-primary-container text-primary rounded-full mx-0.5 cursor-pointer hover:bg-primary hover:text-on-primary transition-all shadow-sm select-none"
            title={`Source [${num}]`}
            onClick={() => {
              const sources = msg.retrieval_sources || [];
              const src = sources[num - 1];
              if (src) {
                if (src.type === 'transcript') {
                  handleTimestampSeek(src.start);
                } else if (src.type === 'web' && src.url) {
                  window.open(src.url, '_blank');
                }
              }
            }}
          >
            {num}
          </span>
        );
      }
      return part;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeConversationId) {
      scrollToBottom();
    }
  }, [messages]);

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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden select-none relative z-10" style={{background:'linear-gradient(160deg,#f0f6ff 0%,#f0fdf8 100%)'}}>
      
      {/* Top Action Navbar */}
      <div className="h-16 border-b px-6 flex items-center justify-between shrink-0" style={{borderColor:'rgba(37,99,235,0.12)',background:'rgba(255,255,255,0.85)',backdropFilter:'blur(16px)'}}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 py-2 px-3.5 rounded-2xl text-sm font-semibold transition-colors cursor-pointer border-none"
          style={{color:'#2563eb',background:'rgba(37,99,235,0.06)'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(37,99,235,0.12)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(37,99,235,0.06)'}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Library</span>
        </button>
        <div className="flex items-center gap-2">
          {media && (
            <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase" style={{background:'linear-gradient(135deg,rgba(37,99,235,0.1),rgba(16,185,129,0.1))',border:'1px solid rgba(37,99,235,0.2)',color:'#2563eb'}}>
              ID: {media.media_id.substring(0, 8)}...
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3 animate-pulse select-none text-primary">
          <span className="material-symbols-outlined animate-spin text-[32px]">sync</span>
          <p className="text-sm font-semibold">Loading media details...</p>
        </div>
      ) : error || !media ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center select-none">
          <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[28px]">error</span>
          </div>
          <h3 className="text-lg font-bold text-on-surface mb-2">Error Loading Media</h3>
          <p className="text-sm text-outline max-w-sm mb-6">{error || 'Media not found.'}</p>
          <button 
            onClick={onBack}
            className="px-5 py-2.5 bg-surface-container hover:bg-surface-variant text-sm font-semibold rounded-2xl transition-colors cursor-pointer border-none"
          >
            Go Back
          </button>
        </div>
      ) : (
        /* Main Dual-Pane Scrolling Body - CSS Grid resolves height stretching */
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:grid lg:grid-cols-[672px_1fr] gap-8" style={{minHeight:0}}>
          
          {/* Left Side Pane: Media Metadata, Audio player, Pipelines, and Summaries */}
          <div className="flex flex-col gap-6">
            {/* Header Metadata Title Card */}
            <div className="rounded-3xl p-6 flex flex-col gap-4" style={{background:'#fff',border:'1px solid rgba(37,99,235,0.14)',boxShadow:'0 4px 24px rgba(37,99,235,0.07)'}}>  

            {(() => {
              const sourceType = (media.source_type || '').toLowerCase();
              const filename = (media.original_filename || '').toLowerCase();
              const isPodcast = 
                sourceType.includes('podcast') || 
                sourceType.includes('rss') || 
                sourceType.includes('direct') || 
                filename.includes('podcast') || 
                filename.includes('ep-') || 
                filename.includes('episode');
              return isPodcast && (
                <div className="w-full max-w-[200px] aspect-square mb-4" style={{filter:'drop-shadow(0 10px 24px rgba(37,99,235,0.14))'}}>
                  <PodcastSVGThumbnail title={media.original_filename} imageUrl={media.image_url} size="100%" />
                </div>
              );
            })()}
            <div>
              <h1 className="text-xl font-bold text-on-surface leading-snug break-words">
                {media.original_filename}
              </h1>
              <p className="text-xs text-outline mt-1.5 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  <span>{new Date(media.upload_time).toLocaleString()}</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/50"></span>
                <span>Type: {getFriendlySourceName(media.source_type)}</span>
              </p>
            </div>

            {/* Stepper Pipeline */}
            <div className="py-2 border-t border-b border-outline-variant/10">
              <MediaStatusStepper 
                status={media.status} 
                explicitStages={media.explicit_stages} 
                isProcessingStarted={isProcessingStarted || isProcessing}
              />
            </div>

            {/* Custom Audio Player */}
            <div className="pt-2">
              <MediaPlayer src={media.audio_url || media.public_url || `${API_BASE_URL}/uploads/${media.stored_filename}`} />
            </div>

            {/* PROCEED Button */}
            {media.status !== 'ready' && media.status !== 'completed' && !isProcessing && (
              <div className="pt-4 border-t border-outline-variant/10 flex justify-end flex-col items-end gap-2">
                <button
                  onClick={handleProceedClick}
                  className="px-8 py-3 btn-shiny-gradient font-semibold rounded-2xl transition-all text-sm cursor-pointer border-none hover:-translate-y-0.5"
                >
                  PROCEED
                </button>
                {processingError && (
                  <span className="text-xs text-red-400 font-medium mt-1">{processingError}</span>
                )}
              </div>
            )}

            {isProcessing && (
              <div className="pt-4 border-t border-outline-variant/10 flex justify-end items-center gap-2.5 text-primary font-medium text-xs py-2">
                <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                <span>
                  {media.status === 'transcribed' 
                    ? 'Formatting & Cleaning transcript...' 
                    : media.status === 'cleaned'
                    ? 'Generating semantic chunks & embeddings...'
                    : media.status === 'embedded'
                    ? 'Completing media processing...'
                    : 'Processing & Transcribing media...'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side Pane: Tabs for Transcript, Embeddings, and Conversations */}
        <div className="flex flex-col gap-5 lg:pl-8 h-full" style={{borderLeft:'1px solid rgba(37,99,235,0.12)', minHeight:'100%'}}>
          
          {/* Tab Toggles */}
          <div className="flex p-1 rounded-2xl" style={{background:'rgba(37,99,235,0.06)',border:'1px solid rgba(37,99,235,0.14)'}}>
            {[
              { id: 'chat', label: 'Conversations' },
              { id: 'transcript', label: 'Transcript' },
              { id: 'embeddings', label: 'Embeddings' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRightTab(tab.id)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none"
                style={activeRightTab === tab.id
                  ? {background:'linear-gradient(135deg,#2563eb,#10b981)',color:'#fff',boxShadow:'0 4px 12px rgba(37,99,235,0.3)'}
                  : {background:'transparent',color:'#64748b'}}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Pane Body content based on Active Tab */}
          <div className="flex-1 flex flex-col h-full min-h-0" style={{minHeight:0}}>
            {activeRightTab === 'chat' && (
              media.status === 'completed' || media.status === 'ready' ? (
                activeConversationId !== null ? (
                  <div className="flex-1 flex flex-col justify-between border border-outline-variant/10 bg-surface-container-low/40 rounded-3xl overflow-hidden relative h-full">
                    {/* Chat Header */}
                    <div className="px-4 py-3 bg-surface/30 border-b border-outline-variant/10 flex items-center gap-2 select-none shrink-0">
                      <button 
                        onClick={() => { setActiveConversationId(null); setMessages([]); }}
                        className="p-1 hover:bg-surface-container rounded-lg text-outline hover:text-on-surface cursor-pointer border-none flex items-center justify-center shrink-0"
                      >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                      </button>
                      <span className="text-xs font-bold text-on-surface truncate">
                        {conversations.find(c => c.conversation_id === activeConversationId)?.title || "Chat"}
                      </span>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4 select-text">
                      {loadingMessages ? (
                        <div className="flex-1 flex items-center justify-center py-12 gap-2 text-outline select-none">
                          <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                          <span className="text-sm">Loading messages...</span>
                        </div>
                      ) : messages.length > 0 ? (
                        messages.map((msg) => (
                          <div 
                            key={msg.message_id} 
                            className={`flex flex-col max-w-[85%] rounded-2xl p-3.5 ${
                              msg.role === 'user' 
                                ? 'bg-primary text-on-primary ml-auto items-end rounded-br-none' 
                                : 'bg-surface-container border border-outline-variant/10 mr-auto items-start rounded-bl-none text-on-surface'
                            }`}
                          >
                            <div className="text-sm leading-relaxed break-words text-left w-full">
                              {msg.role === 'user' ? (
                                msg.content
                              ) : (
                                <div className="whitespace-pre-wrap">
                                  {renderMessageContent(msg.content, msg)}
                                </div>
                              )}
                            </div>


                            {/* Cited Sources list */}
                            {msg.role === 'assistant' && msg.retrieval_sources && msg.retrieval_sources.length > 0 && (
                              <div className="mt-3.5 pt-2 border-t border-outline-variant/10 w-full flex flex-col gap-1.5 select-none">
                                <span className="text-[9px] font-bold text-outline uppercase tracking-wider text-left">Cited Sources:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {msg.retrieval_sources.map((src, sIdx) => {
                                    const citationNumber = sIdx + 1;
                                    if (src.type === 'transcript') {
                                      return (
                                        <button
                                          key={sIdx}
                                          onClick={() => handleTimestampSeek(src.start)}
                                          className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-[10px] text-primary font-bold rounded-lg border-none cursor-pointer transition-colors"
                                          title={src.text}
                                        >
                                          <span className="material-symbols-outlined text-[12px]">play_circle</span>
                                          <span>[{citationNumber}] {formatTime(src.start)}</span>
                                        </button>
                                      );
                                    } else {
                                      return (
                                        <a
                                          key={sIdx}
                                          href={src.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 px-2 py-0.5 bg-outline-variant/10 hover:bg-outline-variant/20 text-[10px] text-outline hover:text-on-surface font-semibold rounded-lg no-underline transition-colors"
                                          title={src.summary}
                                        >
                                          <span className="material-symbols-outlined text-[12px]">public</span>
                                          <span>[{citationNumber}] {src.title || 'Web Result'}</span>
                                        </a>
                                      );
                                    }
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Token Usage Stats */}
                            {msg.role === 'assistant' && (msg.model || msg.tokens) && (
                              <div className="text-[8px] text-outline select-none mt-2 font-mono flex items-center gap-2 self-end opacity-60">
                                {msg.model && <span>{msg.model}</span>}
                                {msg.tokens > 0 && <span>{msg.tokens} tokens</span>}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-outline select-none py-12">
                          <span className="material-symbols-outlined text-[24px]">chat</span>
                          <p className="text-sm italic">Ask a question to begin.</p>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input form */}
                    <form 
                      onSubmit={handleSubmitQuestion}
                      className="p-3 border-t border-outline-variant/10 bg-surface/10 flex gap-2 shrink-0 items-center select-none"
                    >
                      <input 
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type your question..."
                        disabled={sendingQuestion}
                        className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={sendingQuestion || !chatInput.trim()}
                        className="w-8 h-8 rounded-lg btn-shiny-gradient text-white flex items-center justify-center cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {sendingQuestion ? (
                          <span className="material-symbols-outlined animate-spin text-[16px] text-white">sync</span>
                        ) : (
                          <span className="material-symbols-outlined text-[16px] text-white">send</span>
                        )}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs tracking-wider text-outline uppercase">Conversations</h3>
                      <button 
                        onClick={handleCreateNewConversation}
                        className="flex items-center gap-1 py-1.5 px-3 btn-shiny-gradient text-white text-xs font-bold rounded-lg transition-colors cursor-pointer border-none shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>New Chat</span>
                      </button>
                    </div>
                    
                    {loadingConversations ? (
                      <div className="flex-1 flex items-center justify-center py-12 gap-2 text-outline select-none">
                        <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                        <span className="text-xs">Loading conversations...</span>
                      </div>
                    ) : conversations.length > 0 ? (
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] custom-scrollbar pr-1">
                        {conversations.map((conv) => (
                          <div 
                            key={conv.conversation_id} 
                            onClick={() => handleSelectConversation(conv.conversation_id)}
                            className="p-3 bg-surface-container-low border border-outline-variant/10 hover:border-primary/20 hover:bg-surface-container rounded-2xl flex items-center justify-between cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-primary transition-colors">chat_bubble</span>
                              <span className="text-sm text-on-surface truncate font-semibold">{conv.title}</span>
                            </div>
                            <span className="material-symbols-outlined text-[14px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-surface-container-lowest/30 border border-outline-variant/10 rounded-2xl p-4 text-center mt-auto flex flex-col items-center justify-center gap-2 py-8 flex-1">
                        <span className="material-symbols-outlined text-outline text-[28px]">forum</span>
                        <p className="text-xs text-outline italic">No active conversations yet.</p>
                        <button 
                          onClick={handleCreateNewConversation}
                          className="mt-2 px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:bg-primary/95 transition-all cursor-pointer border-none"
                        >
                          Start a Conversation
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-outline-variant/20 rounded-3xl bg-surface-container-lowest/30 flex-1 gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                    <span className="material-symbols-outlined text-[24px]">lock</span>
                  </div>
                  <h4 className="text-sm font-semibold text-on-surface">Conversations Locked</h4>
                  <p className="text-xs text-outline italic max-w-[220px]">
                    Please complete all preprocessing pipeline stages (Upload, Processing, Transcription, Cleaning, Embeddings) to enable chat.
                  </p>
                </div>
              )
            )}

            {activeRightTab === 'transcript' && (
              transcript ? (
                <div className="flex-1 flex flex-col gap-3 h-full overflow-hidden select-text text-left">
                  
                  {/* Sub-toggle header bar */}
                  <div className="flex items-center justify-between shrink-0 select-none pb-1">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Format</span>
                    <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/15">
                      <button
                        onClick={() => setTranscriptView('raw')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border-none ${
                          transcriptView === 'raw'
                            ? 'bg-surface text-primary shadow-sm'
                            : 'bg-transparent text-outline hover:text-on-surface'
                        }`}
                      >
                        Raw
                      </button>
                      <button
                        onClick={() => {
                          if (transcript.clean_transcript) {
                            setTranscriptView('cleaned');
                          }
                        }}
                        disabled={!transcript.clean_transcript}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed ${
                          transcriptView === 'cleaned'
                            ? 'bg-surface text-primary shadow-sm'
                            : 'bg-transparent text-outline hover:text-on-surface'
                        }`}
                      >
                        Cleaned
                      </button>
                    </div>
                  </div>

                  {/* Display pane */}
                  <div className="flex-1 bg-surface-container-low/50 border border-outline-variant/10 rounded-2xl p-4 text-sm leading-relaxed overflow-y-auto custom-scrollbar">
                    {transcriptView === 'cleaned' ? (
                      <div className="font-sans text-on-surface whitespace-pre-wrap">
                        {transcript.clean_transcript}
                      </div>
                    ) : (
                      <div className="font-mono text-outline space-y-2 text-left">
                        {transcript.segments && transcript.segments.length > 0 ? (
                          transcript.segments.map((seg, idx) => (
                            <div key={idx} className="flex gap-3.5 items-start py-0.5 hover:bg-surface-container-high/40 rounded transition-colors px-1">
                              <span className="text-[10px] text-primary/70 font-semibold select-none shrink-0 pt-0.5">
                                [{formatTime(seg.start)} - {formatTime(seg.end)}]
                              </span>
                              <span className="text-on-surface-variant break-words">{seg.text}</span>
                            </div>
                          ))
                        ) : (
                          <div className="whitespace-pre-wrap">{transcript.raw_transcript}</div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-[10px] text-outline flex flex-wrap items-center justify-between gap-1.5 border-t border-outline-variant/10 pt-2 shrink-0 select-none">
                    <span>Model: {transcriptView === 'cleaned' ? 'llama-3.3-70b' : transcript.model}</span>
                    <span>API: {transcript.processing_time}s</span>
                    <span>Words: {transcript.word_count || 0}</span>
                    <span>Length: {transcript.duration ? `${transcript.duration.toFixed(1)}s` : 'N/A'}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-outline-variant/20 rounded-3xl bg-surface-container-lowest/30 flex-1 gap-2.5">
                  <span className="material-symbols-outlined text-[28px] text-outline animate-bounce">translate</span>
                  <h4 className="text-sm font-semibold text-on-surface">Transcript</h4>
                  <p className="text-xs text-outline italic max-w-[200px]">Coming Soon. Automated speech-to-text transcriptions are in pipeline.</p>
                </div>
              )
            )}

            {activeRightTab === 'embeddings' && (
              embeddings && embeddings.length > 0 ? (
                <div className="flex flex-col gap-3 h-full overflow-hidden select-text text-left" style={{flex:1}}>
                  <h4 className="text-xs font-bold uppercase tracking-wider select-none shrink-0" style={{color:'#2563eb'}}>Vector Chunks ({embeddings.length})</h4>
                  
                  <div className="overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-1" style={{flex:1}}>
                    {embeddings.map((emb, idx) => (
                      <div key={idx} className="rounded-2xl p-4 flex flex-col gap-2.5 transition-all cursor-pointer"
                        style={{background:'#fff',border:'1px solid rgba(37,99,235,0.14)',boxShadow:'0 2px 12px rgba(37,99,235,0.05)'}}
                        onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(37,99,235,0.35)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(37,99,235,0.12)'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(37,99,235,0.14)'; e.currentTarget.style.boxShadow='0 2px 12px rgba(37,99,235,0.05)'; }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full" style={{background:'linear-gradient(135deg,rgba(37,99,235,0.1),rgba(16,185,129,0.1))',color:'#2563eb',border:'1px solid rgba(37,99,235,0.2)'}}>Chunk #{emb.chunk_index + 1}</span>
                          <span className="text-[9px] font-mono select-none" style={{color:'#94a3b8'}}>ID: {emb.chunk_id.split('_').pop()}</span>
                        </div>
                        
                        <p className="text-sm leading-relaxed line-clamp-4 hover:line-clamp-none transition-all" style={{color:'#374151'}}>
                          {emb.text}
                        </p>
                        
                        {/* Vector preview */}
                        <div className="rounded-xl p-2.5 font-mono text-[9px] break-all select-none" style={{background:'linear-gradient(135deg,rgba(37,99,235,0.04),rgba(16,185,129,0.04))',border:'1px solid rgba(37,99,235,0.1)'}}>
                          <span className="font-semibold text-[8px] uppercase tracking-wide block mb-1" style={{color:'#10b981'}}>Embedding Preview (BGE-384)</span>
                          <span style={{color:'#2563eb'}}>[{emb.vector_preview ? emb.vector_preview.join(', ') : ''}, ...]</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-3xl flex-1 gap-2.5" style={{background:'linear-gradient(135deg,rgba(37,99,235,0.04),rgba(16,185,129,0.04))',border:'1px dashed rgba(37,99,235,0.25)'}}>
                  <div style={{width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(16,185,129,0.12))',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span className="material-symbols-outlined text-[28px] animate-pulse" style={{color:'#2563eb'}}>hub</span>
                  </div>
                  <h4 className="text-sm font-semibold" style={{color:'#0f172a'}}>Embeddings</h4>
                  <p className="text-xs italic max-w-[200px]" style={{color:'#64748b'}}>Waiting... Building vector profiles of your audio content.</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
