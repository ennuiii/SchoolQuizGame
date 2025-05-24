import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface PointsBreakdownData {
  base: number;
  time: number;
  position: number;
  streakMultiplier: number;
  total: number;
}

interface PointsBreakdownProps {
  isOpen: boolean;
  onClose: () => void;
  pointsBreakdown: PointsBreakdownData | null;
  questionGrade?: number;
  answerTime?: number;
  submissionOrder?: number;
  streak?: number;
  playerName?: string;
}

const PointsBreakdown: React.FC<PointsBreakdownProps> = ({
  isOpen,
  onClose,
  pointsBreakdown,
  questionGrade,
  answerTime,
  submissionOrder,
  streak,
  playerName
}) => {
  const { language } = useLanguage();
  
  console.log(`[POINTS BREAKDOWN DEBUG] Component rendered with:`, {
    isOpen,
    pointsBreakdown,
    questionGrade,
    answerTime,
    submissionOrder,
    streak,
    playerName
  });

  if (!isOpen || !pointsBreakdown) return null;

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  const getPositionText = (order: number) => {
    const suffixes = ['st', 'nd', 'rd'];
    const suffix = suffixes[order - 1] || 'th';
    return `${order}${suffix}`;
  };

  const getPositionBonus = (position: number) => {
    const bonuses = [300, 200, 100, 50, 25];
    return position < bonuses.length ? bonuses[position] : 0;
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              {t('points.breakdown.title', language)}
              {playerName && ` - ${playerName}`}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <div className="row">
              {/* Breakdown Details */}
              <div className="col-md-8">
                <h6 className="text-primary mb-3">{t('points.breakdown.calculation', language)}</h6>
                
                {/* Base Points */}
                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <div>
                    <strong>{t('points.breakdown.base', language)}</strong>
                    <br />
                    <small className="text-muted">
                      {t('points.breakdown.gradeMultiplier', language)} 
                      {questionGrade && ` (${questionGrade} × 100)`}
                    </small>
                  </div>
                  <span className="h5 mb-0 text-success">+{pointsBreakdown.base}</span>
                </div>

                {/* Time Bonus */}
                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <div>
                    <strong>{t('points.breakdown.timeBonus', language)}</strong>
                    <br />
                    <small className="text-muted">
                      {answerTime && `${t('points.breakdown.answeredIn', language)} ${formatTime(answerTime)}`}
                    </small>
                  </div>
                  <span className="h5 mb-0 text-info">+{pointsBreakdown.time}</span>
                </div>

                {/* Position Bonus */}
                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <div>
                    <strong>{t('points.breakdown.positionBonus', language)}</strong>
                    <br />
                    <small className="text-muted">
                      {submissionOrder && `${getPositionText(submissionOrder)} ${t('points.breakdown.toSubmit', language)}`}
                    </small>
                  </div>
                  <span className="h5 mb-0 text-warning">+{pointsBreakdown.position}</span>
                </div>

                {/* Subtotal */}
                <div className="d-flex justify-content-between align-items-center py-2 border-bottom border-2">
                  <strong>{t('points.breakdown.subtotal', language)}</strong>
                  <span className="h5 mb-0">{(pointsBreakdown.base + pointsBreakdown.time + pointsBreakdown.position).toLocaleString()}</span>
                </div>

                {/* Streak Multiplier */}
                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <div>
                    <strong>{t('points.breakdown.streakMultiplier', language)}</strong>
                    <br />
                    <small className="text-muted">
                      {streak !== undefined && `${t('points.breakdown.streakCount', language)}: ${streak}`}
                    </small>
                  </div>
                  <span className="h5 mb-0 text-danger">×{pointsBreakdown.streakMultiplier}</span>
                </div>

                {/* Total */}
                <div className="d-flex justify-content-between align-items-center py-3 bg-light rounded mt-3">
                  <h4 className="mb-0 text-primary">{t('points.breakdown.total', language)}</h4>
                  <h3 className="mb-0 text-success">{pointsBreakdown.total.toLocaleString()}</h3>
                </div>
              </div>

              {/* Position Bonus Reference */}
              <div className="col-md-4">
                <h6 className="text-secondary mb-3">{t('points.breakdown.positionBonuses', language)}</h6>
                <div className="list-group list-group-flush small">
                  <div className="list-group-item d-flex justify-content-between">
                    <span>1st</span>
                    <span className="text-warning">+300</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>2nd</span>
                    <span className="text-warning">+200</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>3rd</span>
                    <span className="text-warning">+100</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>4th</span>
                    <span className="text-warning">+50</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>5th</span>
                    <span className="text-warning">+25</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>6th+</span>
                    <span className="text-muted">+0</span>
                  </div>
                </div>

                <h6 className="text-secondary mb-2 mt-4">{t('points.breakdown.streakMultipliers', language)}</h6>
                <div className="list-group list-group-flush small">
                  <div className="list-group-item d-flex justify-content-between">
                    <span>0 streak</span>
                    <span>×1.0</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>1 streak</span>
                    <span className="text-success">×1.2</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>2 streak</span>
                    <span className="text-success">×1.5</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>3 streak</span>
                    <span className="text-warning">×2.0</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>4 streak</span>
                    <span className="text-warning">×2.5</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span>5+ streak</span>
                    <span className="text-danger">×3.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              {t('common.close', language)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PointsBreakdown; 