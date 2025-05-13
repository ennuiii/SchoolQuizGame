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
}

const QuestionCard: React.FC<QuestionCardProps> = ({ currentQuestion }) => {
  if (!currentQuestion) return null;

  return (
    <div className="card mb-4">
      <div className="card-header bg-light">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h3 className="h5 mb-0">Current Question</h3>
          <div className="d-flex gap-2">
            <span className="badge bg-primary">Grade {currentQuestion.grade}</span>
            <span className="badge bg-secondary">{currentQuestion.subject}</span>
            {currentQuestion.language && (
              <span className="badge bg-info">{currentQuestion.language.toUpperCase()}</span>
            )}
          </div>
        </div>
      </div>
      <div className="card-body">
        <p className="lead mb-0">{currentQuestion.text}</p>
      </div>
    </div>
  );
};

export default QuestionCard; 