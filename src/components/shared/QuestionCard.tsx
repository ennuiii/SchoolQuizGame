import React from 'react';

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

interface QuestionCardProps {
  currentQuestion: Question | null;
  currentQuestionIndex?: number;
  totalQuestions?: number;
  showAnswer?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  showAnswer = false
}) => {
  if (!currentQuestion) return null;

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h3 className="mb-0">Question</h3>
        {currentQuestionIndex !== undefined && totalQuestions !== undefined && (
          <span className="badge bg-primary">
            Question {currentQuestionIndex + 1} of {totalQuestions}
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