import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface GameControlsProps {
  onStartGame: () => void;
  onNextQuestion: () => void;
  onRestartGame: () => void;
  onEndRoundEarly: () => void;
  onEndGame: () => void;
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
  onEndGame,
  isRestarting,
  showEndRoundConfirm,
  onConfirmEndRound,
  onCancelEndRound
}) => {
  const { gameStarted, currentQuestionIndex, questions } = useGame();
  const { language } = useLanguage();

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
          <div className="d-flex flex-column gap-2">
            <div className="d-flex gap-2">
              <button
                className="btn btn-primary flex-grow-1"
                onClick={onNextQuestion}
                disabled={currentQuestionIndex >= questions.length - 1}
              >
                {t('gameControls.nextQuestion', language)}
              </button>
              <button
                className="btn btn-warning flex-grow-1"
                onClick={onEndRoundEarly}
              >
                {t('gameControls.endRoundEarly', language)}
              </button>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-danger flex-grow-1"
                onClick={onRestartGame}
                disabled={isRestarting}
              >
                {isRestarting ? t('gameControls.restarting', language) : t('gameControls.restartGame', language)}
              </button>
              <button
                className="btn btn-outline-danger flex-grow-1"
                onClick={onEndGame}
                disabled={isRestarting}
              >
                {t('gameControls.endGame', language)}
              </button>
            </div>
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