import React from 'react';
import { useGame } from '../../contexts/GameContext';

interface AnswerListProps {
  onEvaluate: (playerId: string, isCorrect: boolean) => void;
}

const AnswerList: React.FC<AnswerListProps> = ({ onEvaluate }) => {
  const { allAnswersThisRound, evaluatedAnswers } = useGame();
  
  // Filter out evaluated answers and ensure we only show answers that exist in allAnswersThisRound
  const pendingAnswers = Object.entries(allAnswersThisRound)
    .filter(([playerId]) => evaluatedAnswers[playerId] === undefined)
    .map(([playerId, data]) => ({
      playerId,
      playerName: data.playerName,
      answer: data.answer
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
            <div key={answer.playerId} className="list-group-item">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                <div>
                  <h4 className="h6 mb-1">{answer.playerName}</h4>
                  <p className="mb-0">{answer.answer}</p>
                </div>
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnswerList; 