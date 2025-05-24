import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface TimerProps {
  isActive: boolean;
  showSeconds?: boolean;
  showProgressBar?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Timer: React.FC<TimerProps> = ({
  isActive,
  showSeconds = false,
  showProgressBar = true,
  size = 'md'
}) => {
  const { timeLimit, timeRemaining } = useGame();
  const { language } = useLanguage();

  if (timeLimit === null || timeRemaining === null || timeLimit >= 99999) {
    return null;
  }

  // Calculate percentage for progress bar
  const percentage = Math.max(0, (timeRemaining / timeLimit) * 100);
  
  // Determine color based on time remaining
  const getTimerColor = () => {
    if (timeRemaining <= 10) return 'danger';
    if (timeRemaining <= 30) return 'warning';
    return 'success';
  };

  const getTimerIcon = () => {
    if (timeRemaining <= 10) return '⚠️';
    if (timeRemaining <= 30) return '⏰';
    return '⏱️';
  };

  const formatTime = (seconds: number): string => {
    // Ensure we have a valid number
    const validSeconds = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(validSeconds / 60);
    const secs = validSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSecondsText = (seconds: number): string => {
    try {
      // Try to get the translation, with fallback
      const secondsText = t('seconds', language);
      if (secondsText && secondsText.includes('{seconds}')) {
        return secondsText.replace('{seconds}', seconds.toString());
      }
      // Fallback if translation is missing or malformed
      return `${seconds}s`;
    } catch (error) {
      // Ultimate fallback
      return `${seconds}s`;
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'small';
      case 'lg': return 'h4';
      default: return 'h5';
    }
  };

  const displayTime = showSeconds ? formatSecondsText(timeRemaining) : formatTime(timeRemaining);

  // Styles converted from your styled-jsx to CSS-in-JS
  const timerContainerStyle: React.CSSProperties = {
    position: 'relative',
  };

  const progressContainerStyle: React.CSSProperties = {
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    height: size === 'sm' ? '4px' : size === 'lg' ? '8px' : '6px',
  };

  const progressBarStyle: React.CSSProperties = {
    width: `${percentage}%`,
    transformOrigin: 'left',
    transform: 'scaleX(1)',
    // Keep your exact animation timing - 1s linear transition
    transition: 'width 1s linear, background-color 0.3s ease-in-out',
    willChange: 'width, background-color'
  };

  // CSS animations as style object (for striped animation)
  const stripedAnimationStyle: React.CSSProperties = {
    animation: 'progress-bar-stripes 0.5s linear infinite',
  };

  return (
    <>
      {/* Add keyframe animation to document head */}
      <style>
        {`
          @keyframes progress-bar-stripes {
            from {
              background-position: 1rem 0;
            }
            to {
              background-position: 0 0;
            }
          }
        `}
      </style>
      
      <div className="timer-container" style={timerContainerStyle}>
        {/* Timer Display */}
        <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
          <span className="timer-icon">{getTimerIcon()}</span>
          <div className={`timer text-${getTimerColor()} ${getSizeClass()} mb-0 fw-bold`}>
            <span>{displayTime}</span>
          </div>
          {isActive && (
            <div className={`spinner-border spinner-border-${size === 'sm' ? 'sm' : ''} text-${getTimerColor()}`} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {showProgressBar && (
          <div className="progress" style={progressContainerStyle}>
            <div
              className={`progress-bar bg-${getTimerColor()} ${timeRemaining <= 10 ? 'progress-bar-striped progress-bar-animated' : ''}`}
              role="progressbar"
              style={{
                ...progressBarStyle,
                // Apply striped animation for critical time
                ...(timeRemaining <= 10 ? stripedAnimationStyle : {})
              }}
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}

        {/* Time bonus hint for points mode */}
        {timeRemaining > timeLimit * 0.7 && (
          <div className="small text-muted text-center mt-1">
            <span className="text-success">💡</span> Fast answers earn bonus points!
          </div>
        )}
      </div>
    </>
  );
};

export default Timer;