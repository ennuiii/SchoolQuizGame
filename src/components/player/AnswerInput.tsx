import React from 'react';
import { useGame } from '../../contexts/GameContext';

interface AnswerInputProps {
  answer: string;
  onAnswerChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitAnswer: () => void;
}

const AnswerInput: React.FC<AnswerInputProps> = ({
  answer,
  onAnswerChange,
  onSubmitAnswer
}) => {
  const { timeLimit, timeRemaining, submittedAnswer } = useGame();
  const isDisabled = submittedAnswer || !!(timeLimit && (!timeRemaining || timeRemaining <= 0));

  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="input-group mb-3">
          <input
            type="text"
            className="form-control form-control-lg"
            placeholder="Type your answer here..."
            value={answer}
            onChange={onAnswerChange}
            disabled={isDisabled}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={onSubmitAnswer}
            disabled={isDisabled}
          >
            Submit Answer
          </button>
        </div>
        
        {timeLimit !== null && timeRemaining !== null && timeLimit < 99999 && (
          <div className={`text-center ${timeRemaining <= 10 ? 'text-danger fw-bold' : ''}`}>
            Time remaining: {formatTime(timeRemaining)}
            {timeRemaining <= 10 && (
              <span className="ms-1">- Answer will be auto-submitted when time is up!</span>
            )}
          </div>
        )}
        
        {submittedAnswer && (
          <div className="alert alert-info">
            Your answer has been submitted. Wait for the Game Master to evaluate it.
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default AnswerInput; 