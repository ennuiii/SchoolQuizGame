import React, { useState, useEffect, ChangeEvent } from 'react';
import type { Question } from '../../contexts/GameContext';
import QuestionDisplayCard from './QuestionDisplayCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface QuestionCardProps {
  question: Question | null;
  timeRemaining: number | null;
  onSubmit: (textAnswer: string) => void;
  submitted: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, timeRemaining, onSubmit, submitted }) => {
  const { language } = useLanguage();

  if (!question) {
    return <QuestionDisplayCard question={null} showAnswer={false} title={t('question', language)} />;
  }

  return (
    <QuestionDisplayCard question={question} showAnswer={false} title={t('question', language)} />
  );
};

export default QuestionCard; 