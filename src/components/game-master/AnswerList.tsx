import React from 'react';

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
}

interface AnswerListProps {
  answers: AnswerSubmission[];
  onEvaluate: (playerId: string, isCorrect: boolean) => void;
  evaluatedAnswers: { [playerId: string]: boolean | null };
}

const AnswerList: React.FC<AnswerListProps> = ({
  answers,
  onEvaluate,
  evaluatedAnswers
}) => {
  if (answers.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header bg-light">
        <h3 className="h5 mb-0">Pending Answers</h3>
      </div>
      <div className="card-body p-0">
        <div className="list-group list-group-flush">
          {answers.map((answer) => {
            const evaluation = evaluatedAnswers[answer.playerId];
            return (
              <div key={answer.playerId} className="list-group-item">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                  <div>
                    <h4 className="h6 mb-1">{answer.playerName}</h4>
                    <p className="mb-0">{answer.answer}</p>
                  </div>
                  {evaluation === undefined && (
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
                  {evaluation !== undefined && (
                    <div className={`badge ${evaluation ? 'bg-success' : 'bg-danger'}`}>
                      {evaluation ? 'Correct' : 'Incorrect'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnswerList; 