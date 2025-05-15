import React from 'react';
import type { Question } from '../../contexts/GameContext'; // Adjust path as needed

interface QuestionDisplayCardProps {
  question: Question | null;
  showAnswer?: boolean;
  title?: string; // Optional title, defaults to "Current Question"
}

const QuestionDisplayCard: React.FC<QuestionDisplayCardProps> = ({ question, showAnswer = false, title = "Current Question" }) => {
  if (!question) {
    return null; // Or some placeholder if preferred when no question
  }

  return (
    <div className="card mb-3"> {/* Reduced bottom margin slightly from mb-4 to mb-3 for tighter layout if multiple cards are used */}
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">{title}</h5>
        {/* Potential placeholder for timer or other info if needed in the future */}
      </div>
      <div className="card-body">
        <p className="lead" style={{ whiteSpace: 'pre-wrap' }}>{question.text}</p>
        <div className="mt-2">
          <small className="text-muted d-block">Type: {question.type}</small>
          <small className="text-muted d-block">Subject: {question.subject}</small>
          <small className="text-muted d-block">Grade: {question.grade}</small>
          {showAnswer && question.answer && (
            <small className="text-primary d-block fw-bold mt-1">Answer: {question.answer}</small>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionDisplayCard; 