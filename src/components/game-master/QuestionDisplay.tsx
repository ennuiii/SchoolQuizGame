import React from 'react';
import type { Question } from '../../contexts/GameContext';
import QuestionDisplayCard from '../shared/QuestionDisplayCard';

interface QuestionDisplayProps {
  question: Question | null;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ question }) => {
  if (!question) {
    return (
      <div className="card mb-3">
        <div className="card-header bg-light">
          <h5 className="mb-0">Current Question</h5>
        </div>
        <div className="card-body">
          <p className="text-center text-muted">No question currently active or selected.</p>
        </div>
      </div>
    );
  }

  return (
    <QuestionDisplayCard question={question} showAnswer={true} title="Current Question" />
  );
};

export default QuestionDisplay; 