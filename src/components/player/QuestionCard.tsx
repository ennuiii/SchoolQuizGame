import React from 'react';
import { useGame } from '../../contexts/GameContext';

interface QuestionCardProps {
  showAnswer?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ showAnswer = false }) => {
  const { currentQuestion, currentQuestionIndex, questions } = useGame();

  if (!currentQuestion) return null;

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h3 className="mb-0">Question</h3>
        {currentQuestionIndex !== undefined && questions.length > 0 && (
          <span className="badge bg-primary">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="question-container">
          <p className="lead mb-1">{currentQuestion.text}</p>
          <small>
            Grade: {currentQuestion.grade} | Subject: {currentQuestion.subject}
            {currentQuestion.language && ` | Language: ${currentQuestion.language}`}
          </small>
        </div>
        {showAnswer && currentQuestion.answer && (
          <div className="alert alert-info mt-3 mb-0">
            <strong>Answer:</strong> {currentQuestion.answer}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionCard; 