import React from 'react';

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
}

interface AnswerListProps {
  answers: AnswerSubmission[];
  onEvaluate: (playerId: string, isCorrect: boolean) => void;
}

const AnswerList: React.FC<AnswerListProps> = ({ answers, onEvaluate }) => {
  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h3 className="mb-0">Pending Answers</h3>
      </div>
      <div className="card-body">
        {answers.length === 0 ? (
          <p className="text-center">No pending answers</p>
        ) : (
          <ul className="list-group">
            {answers.map((submission, index) => (
              <li key={index} className="list-group-item">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className="mb-0">{submission.playerName}</h5>
                  <div>
                    <button 
                      className="btn btn-success me-2"
                      onClick={() => onEvaluate(submission.playerId, true)}
                    >
                      Correct
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => onEvaluate(submission.playerId, false)}
                    >
                      Incorrect
                    </button>
                  </div>
                </div>
                <div className="answer-container">
                  <p className="mb-1"><strong>Player's Answer:</strong> {submission.answer}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AnswerList; 