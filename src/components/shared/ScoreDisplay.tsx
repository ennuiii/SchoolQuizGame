import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface ScoreDisplayProps {
  score: number;
  streak: number;
  lastPointsEarned: number | null;
  lastAnswerTimestamp: number | null;
  playerName: string;
  showAnimation?: boolean;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  streak,
  lastPointsEarned,
  lastAnswerTimestamp,
  playerName,
  showAnimation = true
}) => {  const { language } = useLanguage();  const [showPointsAnimation, setShowPointsAnimation] = useState(false);    console.log(`[SCORE DISPLAY DEBUG] Component rendered with:`, {    score,    streak,    lastPointsEarned,    lastAnswerTimestamp,    playerName,    showAnimation  });

  // Trigger animation when points are earned
  useEffect(() => {
    if (lastPointsEarned && lastPointsEarned > 0 && showAnimation) {
      setShowPointsAnimation(true);
      const timer = setTimeout(() => setShowPointsAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastPointsEarned, showAnimation]);

  const getStreakIcon = (streak: number) => {
    if (streak >= 5) return '🔥';
    if (streak >= 3) return '⚡';
    if (streak >= 1) return '✅';
    return '';
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 5) return 'text-danger';
    if (streak >= 3) return 'text-warning';
    if (streak >= 1) return 'text-success';
    return 'text-muted';
  };

  return (
    <div className="score-display-container position-relative">
      {/* Main Score Display */}
      <div className="card bg-dark text-white shadow-sm">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h6 className="card-title mb-1 text-primary">{playerName}</h6>
              <div className="d-flex align-items-center gap-2">
                <span className="h4 mb-0 text-white">{score.toLocaleString()}</span>
                <span className="small text-muted">pts</span>
              </div>
            </div>
            
            {/* Streak Display */}
            <div className="text-end">
              <div className={`d-flex align-items-center gap-1 ${getStreakColor(streak)}`}>
                <span className="small">{t('points.streak', language)}</span>
                <span className="fw-bold">{streak}</span>
                {getStreakIcon(streak) && <span>{getStreakIcon(streak)}</span>}
              </div>
              {streak >= 2 && (
                <div className="small text-info">
                  {t('points.multiplier', language)}: {(1 + Math.min(streak, 5) * 0.5).toFixed(1)}x
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Points Animation */}
      {showPointsAnimation && lastPointsEarned && lastPointsEarned > 0 && (
        <div className="points-animation position-absolute top-0 start-50 translate-middle">
          <div className="bg-success text-white px-3 py-2 rounded-pill shadow animate__animated animate__bounceIn">
            <strong>+{lastPointsEarned.toLocaleString()}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreDisplay; 