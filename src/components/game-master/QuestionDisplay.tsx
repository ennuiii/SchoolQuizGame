import React from 'react';

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

interface QuestionDisplayProps {
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  totalQuestions: number;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  currentQuestion,
  currentQuestionIndex,
  totalQuestions
}) => {
  if (!currentQuestion) {
    return (
      <div className="card mb-3">
        <div className="card-header bg-light">
          <h6 className="mb-0">Current Question</h6>
        </div>
        <div className="card-body">
          <p className="text-center text-muted">No question selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-3">
      <div className="card-header bg-light d-flex justify-content-between align-items-center">
        <h6 className="mb-0">Current Question</h6>
        <span className="badge bg-primary">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </span>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <h5 className="card-title">{currentQuestion.text}</h5>
          <div className="text-muted small">
            <span className="me-3">Grade: {currentQuestion.grade}</span>
            <span className="me-3">Subject: {currentQuestion.subject}</span>
            {currentQuestion.language && (
              <span>Language: {currentQuestion.language}</span>
            )}
          </div>
        </div>
        {currentQuestion.answer && (
          <div className="alert alert-info mb-0">
            <strong>Answer:</strong> {currentQuestion.answer}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionDisplay; 