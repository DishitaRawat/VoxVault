import React from 'react';

export default function MediaStatusStepper({ status, explicitStages, isProcessingStarted, size = 'normal' }) {
  // Map standard pipeline stages: Upload, Media Processing, Transcription, Cleaning, Embeddings, Ready
  const stages = [
    { key: 'upload', label: 'Upload', icon: 'upload' },
    { key: 'processing', label: 'Media Processing', icon: 'sync' },
    { key: 'transcription', label: 'Transcription', icon: 'description' },
    { key: 'cleaning', label: 'Transcript Cleaning', icon: 'spellcheck' },
    { key: 'embeddings', label: 'Embeddings', icon: 'hub' },
    { key: 'ready', label: 'Ready', icon: 'task_alt' }
  ];

  // Infer statuses dynamically based on task completion
  const getStageColor = (stageKey) => {
    if (explicitStages && explicitStages[stageKey]) {
      return explicitStages[stageKey]; // 'green', 'blue', 'red', 'gray'
    }

    const s = (status || '').toLowerCase();
    
    // 1. Identify which stages have finished processing (green)
    let completedStages = [];
    if (s === 'completed' || s === 'ready') {
      completedStages = ['upload', 'processing', 'transcription', 'cleaning', 'embeddings', 'ready'];
    } else if (s === 'embedded') {
      completedStages = ['upload', 'processing', 'transcription', 'cleaning', 'embeddings'];
    } else if (s === 'cleaned') {
      completedStages = ['upload', 'processing', 'transcription', 'cleaning'];
    } else if (s === 'transcribed') {
      completedStages = ['upload', 'processing', 'transcription'];
    } else if (s === 'processing') {
      completedStages = ['upload'];
    } else if (s === 'failed') {
      completedStages = ['upload'];
    } else {
      // Default: 'uploaded' (only file upload is complete)
      completedStages = ['upload'];
    }

    // 2. Return green if the stage is complete
    if (completedStages.includes(stageKey)) {
      return 'green';
    }

    // 3. Return red if processing failed
    if (s === 'failed' && stageKey === 'processing') {
      return 'red';
    }

    // Special condition: When status is embedded, Ready turns blue as requested
    if (s === 'embedded' && stageKey === 'ready') {
      return 'blue';
    }

    // 4. Find the first incomplete stage in the order
    const pipelineOrder = ['upload', 'processing', 'transcription', 'cleaning', 'embeddings', 'ready'];
    const incompleteStages = pipelineOrder.filter(key => !completedStages.includes(key));
    const firstIncompleteStage = incompleteStages[0];

    // 5. If this is the active incomplete stage, and the proceed request is running, mark as blue
    if (stageKey === firstIncompleteStage && isProcessingStarted) {
      return 'blue';
    }

    // 6. Otherwise, keep it gray (waiting)
    return 'gray';
  };

  const getColorClasses = (color) => {
    switch (color) {
      case 'green':
        return {
          dot: 'bg-emerald-500 shadow-emerald-500/30 border-emerald-400 text-white',
          line: 'bg-emerald-500',
          text: 'text-emerald-500 font-semibold'
        };
      case 'blue':
        return {
          dot: 'bg-primary shadow-primary/30 border-primary text-white animate-pulse',
          line: 'bg-primary/30',
          text: 'text-primary font-semibold animate-pulse'
        };
      case 'red':
        return {
          dot: 'bg-red-500 shadow-red-500/30 border-red-400 text-white',
          line: 'bg-red-500',
          text: 'text-red-500 font-semibold'
        };
      case 'gray':
      default:
        return {
          dot: 'bg-surface-highest border-outline-variant/30 text-outline',
          line: 'bg-outline-variant/25',
          text: 'text-outline'
        };
    }
  };

  const isCompact = size === 'compact';

  return (
    <div className={`w-full ${isCompact ? '' : 'pb-6'}`}>
      {/* Horizontal Line Stepper */}
      <div className="flex items-center justify-between relative w-full px-2">
        {stages.map((stage, idx) => {
          const color = getStageColor(stage.key);
          const classes = getColorClasses(color);
          const nextColor = idx < stages.length - 1 ? getStageColor(stages[idx + 1].key) : 'gray';
          const lineClasses = getColorClasses(
            nextColor === 'green' && color === 'green' ? 'green' : 
            (color === 'blue' || nextColor === 'blue' ? 'blue' : 'gray')
          );

          return (
            <React.Fragment key={stage.key}>
              {/* Stage Dot & Label container */}
              <div className="relative flex flex-col items-center select-none z-10">
                {/* Custom Icon Circle */}
                <div 
                  className={`rounded-full border flex items-center justify-center transition-all duration-300 shadow-md ${
                    isCompact ? 'w-5 h-5' : 'w-9 h-9'
                  } ${classes.dot}`}
                >
                  <span className={`material-symbols-outlined font-semibold ${
                    isCompact ? 'text-[11px]' : 'text-[16px]'
                  }`}>
                    {color === 'red' ? 'close' : stage.icon}
                  </span>
                </div>
                
                {/* Absolutely positioned label to avoid shifting the connecting line */}
                {!isCompact && (
                  <span className={`absolute top-11 text-[10px] font-semibold tracking-wide whitespace-nowrap text-center ${classes.text}`}>
                    {stage.label}
                  </span>
                )}
              </div>

              {/* Connecting Line */}
              {idx < stages.length - 1 && (
                <div className={`h-[2.5px] flex-1 -mx-0.5 relative z-0 transition-all duration-300 ${lineClasses.line}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
