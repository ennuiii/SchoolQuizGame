import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface QuestionCardProps {
  showAnswer?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ showAnswer = false }) => {
  const { currentQuestion, currentQuestionIndex, questions } = useGame();
  const { language } = useLanguage();

  if (!currentQuestion) return null;

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h3 className="mb-0">{t('questionCard.title', language)}</h3>
        {currentQuestionIndex !== undefined && questions.length > 0 && (
          <span className="badge bg-primary">
            {t('questionCard.questionNumber', language, { current: currentQuestionIndex + 1, total: questions.length })}
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="question-container">
          <p className="lead mb-1">{currentQuestion.text}</p>
          <small>
            {t('questionCard.grade', language)}: {currentQuestion.grade} | {t('questionCard.subject', language)}: {currentQuestion.subject}
            {currentQuestion.language && ` | ${t('questionCard.language', language)}: ${currentQuestion.language}`}
          </small>
        </div>
        {showAnswer && currentQuestion.answer && (
          <div className="alert alert-info mt-3 mb-0">
            <strong>{t('questionCard.answer', language)}:</strong> {currentQuestion.answer}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionCard; 