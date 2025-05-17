import React from 'react';
import { useGame } from '../../contexts/GameContext';

interface AnswerListProps {
  onEvaluate: (playerId: string, isCorrect: boolean) => void;
}

interface Answer {
  playerId: string;
  playerName: string;
  answer: string;
  isPending: boolean;
  isCorrect?: boolean | null;
}

const AnswerList: React.FC<AnswerListProps> = ({ onEvaluate }) => {
  const { allAnswersThisRound, evaluatedAnswers } = useGame();
  
  // Get pending answers
  const pendingAnswers: Answer[] = Object.entries(allAnswersThisRound)
    .filter(([playerId]) => evaluatedAnswers[playerId] === undefined)
    .map(([playerId, data]) => ({
      playerId,
      playerName: data.playerName,
      answer: data.answer,
      isPending: true
    }));

  // Get evaluated answers
  const evaluatedAnswersList: Answer[] = Object.entries(allAnswersThisRound)
    .filter(([playerId]) => evaluatedAnswers[playerId] !== undefined)
    .map(([playerId, data]) => ({
      playerId,
      playerName: data.playerName,
      answer: data.answer,
      isPending: false,
      isCorrect: evaluatedAnswers[playerId]
    }));

  // Combine answers with pending first
  const allAnswers = [...pendingAnswers, ...evaluatedAnswersList];

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h3 className="h5 mb-0">Answers</h3>
      </div>
      <div className="card-body p-0">
        <div className="list-group list-group-flush">
          {allAnswers.length === 0 ? (
            <div className="list-group-item text-center text-muted">
              No answers submitted yet
            </div>
          ) : (
            allAnswers.map((answer) => (
              <div 
                key={answer.playerId} 
                className={`list-group-item ${!answer.isPending && answer.isCorrect !== null ? (answer.isCorrect ? 'list-group-item-success' : 'list-group-item-danger') : ''}`}
              >
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                  <div>
                    <h4 className="h6 mb-1">
                      {answer.playerName}
                      {!answer.isPending && answer.isCorrect !== null && (
                        <span className={`badge ms-2 ${answer.isCorrect ? 'bg-success' : 'bg-danger'}`}>
                          {answer.isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                      {answer.isPending && (
                        <span className="badge bg-warning ms-2">Pending</span>
                      )}
                    </h4>
                    <p className="mb-0">{answer.answer}</p>
                  </div>
                  {answer.isPending && (
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => onEvaluate(answer.playerId, true)}
                      >
                        <i className="bi bi-check-lg me-1"></i>
                        Correct
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onEvaluate(answer.playerId, false)}
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