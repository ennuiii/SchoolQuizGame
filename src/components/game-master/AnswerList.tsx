import React from 'react';
import { useGame } from '../../contexts/GameContext';

interface AnswerListProps {
  onEvaluate: (playerId: string, isCorrect: boolean) => void;
}

const AnswerList: React.FC<AnswerListProps> = ({ onEvaluate }) => {
  const { allAnswersThisRound, evaluatedAnswers } = useGame();
  
  // Filter out evaluated answers and ensure we only show answers that exist in allAnswersThisRound
  const pendingAnswers = Object.entries(allAnswersThisRound)
    .filter(([id]) => evaluatedAnswers[id] === undefined)
    .map(([id, answerData]) => ({
      id,
      ...answerData
    }));

  if (pendingAnswers.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header bg-light">
        <h3 className="h5 mb-0">Pending Answers</h3>
      </div>
      <div className="card-body p-0">
        <div className="list-group list-group-flush">
          {pendingAnswers.map((answer) => (
            <div key={answer.id} className="list-group-item">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                <div>
                  <h4 className="h6 mb-1">{answer.playerName}</h4>
                  <p className="mb-0">{answer.answer}</p>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => onEvaluate(answer.id, true)}
                  >
                    <i className="bi bi-check-lg me-1"></i>
                    Correct
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onEvaluate(answer.id, false)}
                  >
                    <i className="bi bi-x-lg me-1"></i>
                    Incorrect
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnswerList; 