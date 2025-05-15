import React, { useState, useEffect, ChangeEvent } from 'react';
import type { Question } from '../../contexts/GameContext';
import QuestionDisplayCard from './QuestionDisplayCard';

interface QuestionCardProps {
  question: Question | null;
  timeRemaining: number | null;
  onSubmit: (textAnswer: string) => void;
  submitted: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, timeRemaining, onSubmit, submitted }) => {
  if (!question) {
    return <QuestionDisplayCard question={null} showAnswer={false} title="Question" />;
  }

  return (
    <QuestionDisplayCard question={question} showAnswer={false} title="Question" />
  );
};

export default QuestionCard; 