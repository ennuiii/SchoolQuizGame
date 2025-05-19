import React from 'react';
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
  
  const getPlayerById = (persistentId: string) => players.find(p => p.persistentPlayerId === persistentId);

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
                        <span className={`badge ms-2 ${ans.isCorrect ? 'bg-success' : 'bg-danger'}`}>
                          {ans.isCorrect ? t('answerList.correct', language) : t('answerList.incorrect', language)}
                        </span>
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
  );
};

export default AnswerList; 