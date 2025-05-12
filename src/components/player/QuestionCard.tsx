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
      <div className="card-header">
        <h3 className="mb-0">Question</h3>
      </div>
      <div className="card-body">
        <div className="question-container">
          <p className="lead mb-1">{currentQuestion.text}</p>
          <small>
            Grade: {currentQuestion.grade} | Subject: {currentQuestion.subject}
            {currentQuestion.language && ` | Language: ${currentQuestion.language}`}
          </small>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard; 