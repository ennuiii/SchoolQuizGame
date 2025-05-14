import React from 'react';
import type { Question } from '../../contexts/GameContext';

interface QuestionDisplayProps {
  question: Question | null;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ question }) => {
  if (!question) {
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
      </div>
      <div className="card-body">
        <div className="mb-3">
          <h5 className="card-title">{question.text}</h5>
          <div className="text-muted small">
            <span className="me-3">Grade: {question.grade}</span>
            <span className="me-3">Subject: {question.subject}</span>
            {question.language && (
              <span>Language: {question.language}</span>
            )}
          </div>
        </div>
        {question.answer && (
          <div className="alert alert-info mb-0">
            <strong>Answer:</strong> {question.answer}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionDisplay; 