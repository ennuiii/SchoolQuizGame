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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'small';
      case 'lg': return 'h4';
      default: return 'h5';
    }
  };

  return (
    <div className="timer-container">
      {/* Timer Display */}
      <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
        <span className="timer-icon">{getTimerIcon()}</span>
        <div className={`timer text-${getTimerColor()} ${getSizeClass()} mb-0 fw-bold`}>
          {showSeconds ? (
            <span>{t('seconds', language).replace('{seconds}', timeRemaining.toString())}</span>
          ) : (
            <span>{formatTime(timeRemaining)}</span>
          )}
        </div>
        {isActive && (
          <div className={`spinner-border spinner-border-${size === 'sm' ? 'sm' : ''} text-${getTimerColor()}`} role="status">
            <span className="visually-hidden">{t('loading', language)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {showProgressBar && (
        <div className="progress" style={{ height: size === 'sm' ? '4px' : size === 'lg' ? '8px' : '6px' }}>
          <div
            className={`progress-bar bg-${getTimerColor()} ${timeRemaining <= 10 ? 'progress-bar-striped progress-bar-animated' : ''}`}
            role="progressbar"
            style={{ width: `${percentage}%`, transition: 'width 1s ease-in-out' }}
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
  );
};

export default Timer; 