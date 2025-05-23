import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface GameControlsProps {
  onStartGame: () => void;
  onNextQuestion: () => void;
  onRestartGame: () => void;
  onEndRoundEarly: () => void;
  isRestarting: boolean;
  showEndRoundConfirm: boolean;
  onConfirmEndRound: () => void;
  onCancelEndRound: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  onStartGame,
  onNextQuestion,
  onRestartGame,
  onEndRoundEarly,
  isRestarting,
  showEndRoundConfirm,
  onConfirmEndRound,
  onCancelEndRound
}) => {
  const { gameStarted, currentQuestionIndex, questions, allAnswersThisRound } = useGame();
  const { language } = useLanguage();
  const hasPendingAnswers = Object.keys(allAnswersThisRound).length > 0;

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">{t('gameControls.title', language)}</h6>
      </div>
      <div className="card-body">
        {!gameStarted ? (
          <button
            className="btn btn-primary btn-lg w-100"
            onClick={onStartGame}
            disabled={isRestarting}
          >
            {isRestarting ? t('gameControls.restarting', language) : t('gameControls.startGame', language)}
          </button>
        ) : (
          <div className="d-flex gap-2">
            <button
              className="btn btn-primary flex-grow-1"
              onClick={onNextQuestion}
              disabled={currentQuestionIndex >= questions.length - 1 || hasPendingAnswers}
            >
              {t('gameControls.nextQuestion', language)}
            </button>
            <button
              className="btn btn-warning flex-grow-1"
              onClick={onEndRoundEarly}
            >
              {t('gameControls.endRoundEarly', language)}
            </button>
            <button
              className="btn btn-danger flex-grow-1"
              onClick={onRestartGame}
              disabled={isRestarting}
            >
              {isRestarting ? t('gameControls.restarting', language) : t('gameControls.restartGame', language)}
            </button>
          </div>
        )}

        {showEndRoundConfirm && (
          <div className="alert alert-warning mt-3">
            <p>{t('gameControls.endRoundConfirm', language)}</p>
            <div className="d-flex gap-2">
              <button
                className="btn btn-warning flex-grow-1"
                onClick={onConfirmEndRound}
              >
                {t('gameControls.confirmEndRound', language)}
              </button>
              <button
                className="btn btn-secondary flex-grow-1"
                onClick={onCancelEndRound}
              >
                {t('gameControls.cancel', language)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameControls; 