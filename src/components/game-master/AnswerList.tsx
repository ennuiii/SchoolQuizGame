import React, { useState, useCallback } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface AnswerListProps {
  onEvaluate: (persistentPlayerId: string, isCorrect: boolean) => void;
}

interface DisplayAnswer {
  persistentPlayerId: string;
  playerName: string;
  answer: string;
  isPending: boolean;
  isCorrect?: boolean | null;
  isActive: boolean;
  hasDrawing?: boolean;
  drawingData?: string | null;
}

const AnswerList: React.FC<AnswerListProps> = ({ onEvaluate }) => {
  const { allAnswersThisRound, evaluatedAnswers, players } = useGame();
  const { language } = useLanguage();
  const [showCorrectionConfirm, setShowCorrectionConfirm] = useState(false);
  const [pendingCorrection, setPendingCorrection] = useState<{ playerId: string, newStatus: boolean } | null>(null);
  
  const getPlayerById = (persistentId: string) => players.find(p => p.persistentPlayerId === persistentId);

  const handleCorrection = useCallback((playerId: string, currentStatus: boolean) => {
    // Find the player in the context
    const player = players.find(p => p.persistentPlayerId === playerId);
    if (!player) {
      console.error('[DEBUG] Player not found for correction:', playerId);
      return;
    }
    console.log('[DEBUG] Correction button clicked', { playerId: player.persistentPlayerId, currentStatus });
    setPendingCorrection({ playerId: player.persistentPlayerId, newStatus: !currentStatus });
    setShowCorrectionConfirm(true);
  }, [players]);

  const confirmCorrection = useCallback(() => {
    if (pendingCorrection) {
      console.log('[DEBUG] Confirming correction', pendingCorrection);
      onEvaluate(pendingCorrection.playerId, pendingCorrection.newStatus);
    }
    setShowCorrectionConfirm(false);
    setPendingCorrection(null);
  }, [pendingCorrection, onEvaluate]);

  const cancelCorrection = useCallback(() => {
    setShowCorrectionConfirm(false);
    setPendingCorrection(null);
  }, []);

  const combinedAnswers: DisplayAnswer[] = Object.entries(allAnswersThisRound)
    .map(([pId, data]) => {
      const player = getPlayerById(pId);
      const isPlayerActive = true;
      
      return {
        persistentPlayerId: pId,
        playerName: data.playerName || player?.name || 'Unknown Player',
        answer: data.answer,
        isPending: evaluatedAnswers[pId] === undefined,
        isCorrect: evaluatedAnswers[pId],
        isActive: isPlayerActive,
        hasDrawing: data.hasDrawing,
        drawingData: data.drawingData,
      };
    })
    .sort((a, b) => {
      if (a.isPending && !b.isPending) return -1;
      if (!a.isPending && b.isPending) return 1;
      return a.playerName.localeCompare(b.playerName);
    });

  return (
    <>
      <div className="card mb-3 answer-list-card">
        <div className="card-header bg-light">
          <h3 className="h5 mb-0">{t('answerList.title', language)}</h3>
        </div>
        <div className="card-body p-0">
          <div className="list-group list-group-flush">
            {combinedAnswers.length === 0 ? (
              <div className="list-group-item text-center text-muted py-3">
                {t('answerList.noAnswers', language)}
              </div>
            ) : (
              combinedAnswers.map((ans) => (
                <div 
                  key={ans.persistentPlayerId}
                  className={`list-group-item ${
                    !ans.isPending && ans.isCorrect !== null 
                      ? (ans.isCorrect ? 'list-group-item-success' : 'list-group-item-danger') 
                      : ''
                  }`}
                >
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div style={{ flexGrow: 1 }}>
                      <h4 className="h6 mb-1 d-flex align-items-center">
                        {ans.playerName}
                        {!ans.isPending && ans.isCorrect !== null && (
                          <div className="d-flex align-items-center gap-2 ms-2">
                            <span className={`badge ${ans.isCorrect ? 'bg-success' : 'bg-danger'}`}>
                              {ans.isCorrect ? t('answerList.correct', language) : t('answerList.incorrect', language)}
                            </span>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleCorrection(ans.persistentPlayerId, ans.isCorrect!)}
                              title={t('previewOverlay.correctAnswer', language)}
                            >
                              <i className="bi bi-pencil-fill"></i>
                            </button>
                          </div>
                        )}
                        {ans.isPending && (
                          <span className="badge bg-info ms-2">{t('answerList.pendingEvaluation', language)}</span>
                        )}
                      </h4>
                      <p className="mb-0 answer-text">
                        {ans.answer || "-"}
                      </p>
                    </div>
                    {ans.isPending && (
                      <div className="d-flex gap-2 mt-2 mt-md-0 flex-shrink-0 align-self-md-center">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => onEvaluate(ans.persistentPlayerId, true)}
                          title={t('answerList.markAsCorrect', language)}
                        >
                          <i className="bi bi-check-lg me-1"></i>
                          {t('answerList.correct', language)}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => onEvaluate(ans.persistentPlayerId, false)}
                          title={t('answerList.markAsIncorrect', language)}
                        >
                          <i className="bi bi-x-lg me-1"></i>
                          {t('answerList.incorrect', language)}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Correction Confirmation Modal */}
      {showCorrectionConfirm && pendingCorrection && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('previewOverlay.confirmCorrection', language)}</h5>
                <button type="button" className="btn-close" onClick={cancelCorrection}></button>
              </div>
              <div className="modal-body">
                <p>{t('previewOverlay.correctionConfirmation', language)}</p>
                <p className="mb-0">
                  {t('previewOverlay.correctionDetails', language)}
                </p>
                <ul>
                  <li>{t('previewOverlay.correctionEffect1', language)}</li>
                  <li>{t('previewOverlay.correctionEffect2', language)}</li>
                  <li>{t('previewOverlay.correctionEffect3', language)}</li>
                </ul>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cancelCorrection}>
                  {t('cancel', language)}
                </button>
                <button type="button" className="btn btn-primary" onClick={confirmCorrection}>
                  {t('confirm', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AnswerList; 