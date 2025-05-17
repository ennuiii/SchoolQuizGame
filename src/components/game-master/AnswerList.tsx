import React from 'react';
import { useGame } from '../../contexts/GameContext';

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
  
  const getPlayerById = (persistentId: string) => players.find(p => p.persistentPlayerId === persistentId);

  const combinedAnswers: DisplayAnswer[] = Object.entries(allAnswersThisRound)
    .map(([pId, data]) => {
      const player = getPlayerById(pId);
      return {
        persistentPlayerId: pId,
        playerName: data.playerName || player?.name || 'Unknown Player',
        answer: data.answer,
        isPending: evaluatedAnswers[pId] === undefined,
        isCorrect: evaluatedAnswers[pId],
        isActive: player?.isActive ?? false,
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
        <h3 className="h5 mb-0">Answers Received</h3>
      </div>
      <div className="card-body p-0">
        <div className="list-group list-group-flush">
          {combinedAnswers.length === 0 ? (
            <div className="list-group-item text-center text-muted py-3">
              No answers submitted for this round yet.
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
                style={{ opacity: ans.isActive ? 1 : 0.7 }}
              >
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                  <div style={{ flexGrow: 1 }}>
                    <h4 className="h6 mb-1 d-flex align-items-center">
                      {ans.playerName}
                      {!ans.isActive && (
                        <span className="badge bg-warning text-dark rounded-pill ms-2">Disconnected</span>
                      )}
                      {!ans.isPending && ans.isCorrect !== null && (
                        <span className={`badge ms-2 ${ans.isCorrect ? 'bg-success' : 'bg-danger'}`}>
                          {ans.isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                      {ans.isPending && (
                        <span className="badge bg-info ms-2">Pending Evaluation</span>
                      )}
                    </h4>
                    {ans.hasDrawing && ans.drawingData ? (
                      <div className="mt-2">
                        <p className="mb-1 fst-italic">Text: {ans.answer || "No text answer"}</p>
                        <details>
                          <summary className="text-primary" style={{ cursor: 'pointer'}}>View Drawing</summary>
                          <div className="submitted-drawing-preview border p-2 mt-1" 
                               style={{ maxHeight: '200px', overflowY: 'auto', background: '#f8f9fa' }}>
                            <img src={ans.drawingData} alt={`${ans.playerName}'s drawing`} style={{ maxWidth: '100%', maxHeight: '180px' }} />
                          </div>
                        </details>
                      </div>
                    ) : (
                      <p className="mb-0 answer-text">{ans.answer || "-"}</p>
                    )}
                  </div>
                  {ans.isPending && (
                    <div className="d-flex gap-2 mt-2 mt-md-0 flex-shrink-0 align-self-md-center">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => onEvaluate(ans.persistentPlayerId, true)}
                        disabled={!ans.isActive}
                        title={!ans.isActive ? `Cannot evaluate, ${ans.playerName} is disconnected` : 'Mark as Correct'}
                      >
                        <i className="bi bi-check-lg me-1"></i>
                        Correct
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onEvaluate(ans.persistentPlayerId, false)}
                        disabled={!ans.isActive}
                        title={!ans.isActive ? `Cannot evaluate, ${ans.playerName} is disconnected` : 'Mark as Incorrect'}
                      >
                        <i className="bi bi-x-lg me-1"></i>
                        Incorrect
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