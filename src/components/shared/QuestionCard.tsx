import React, { useState, useEffect, ChangeEvent } from 'react';
import type { Question } from '../../contexts/GameContext';

interface QuestionCardProps {
  question: Question | null;
  timeRemaining: number | null;
  onSubmit: (textAnswer: string) => void;
  submitted: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, timeRemaining, onSubmit, submitted }) => {
  const [textAnswer, setTextAnswer] = useState('');

  useEffect(() => {
    setTextAnswer('');
  }, [question]);

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTextAnswer(e.target.value);
  };

  const handleSubmit = () => {
    onSubmit(textAnswer);
  };

  if (!question) return null;

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h3 className="mb-0">Question</h3>
      </div>
      <div className="card-body">
        <div className="question-container">
          <p className="lead mb-1">{question.text}</p>
          <small>
            Type: {question.type}
          </small>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard; 