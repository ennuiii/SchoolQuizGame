import React from 'react';

interface GameControlsProps {
  gameStarted: boolean;
  currentQuestionIndex: number;
  totalQuestions: number;
  onStartGame: () => void;
  onNextQuestion: () => void;
  onRestartGame: () => void;
  onEndRoundEarly: () => void;
  isRestarting: boolean;
  showEndRoundConfirm: boolean;
  onConfirmEndRound: () => void;
  onCancelEndRound: () => void;
  hasPendingAnswers: boolean;
}

const GameControls: React.FC<GameControlsProps> = ({
  gameStarted,
  currentQuestionIndex,
  totalQuestions,
  onStartGame,
  onNextQuestion,
  onRestartGame,
  onEndRoundEarly,
  isRestarting,
  showEndRoundConfirm,
  onConfirmEndRound,
  onCancelEndRound,
  hasPendingAnswers
}) => {
  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">Game Controls</h6>
      </div>
      <div className="card-body">
        {!gameStarted ? (
          <button
            className="btn btn-primary btn-lg w-100"
            onClick={onStartGame}
            disabled={isRestarting}
          >
            {isRestarting ? 'Restarting...' : 'Start Game'}
          </button>
        ) : (
          <div className="d-flex gap-2">
            <button
              className="btn btn-primary flex-grow-1"
              onClick={onNextQuestion}
              disabled={currentQuestionIndex >= totalQuestions - 1 || hasPendingAnswers}
            >
              Next Question
            </button>
            <button
              className="btn btn-warning flex-grow-1"
              onClick={onEndRoundEarly}
              disabled={!hasPendingAnswers}
            >
              End Round Early
            </button>
            <button
              className="btn btn-danger flex-grow-1"
              onClick={onRestartGame}
              disabled={isRestarting}
            >
              {isRestarting ? 'Restarting...' : 'Restart Game'}
            </button>
          </div>
        )}

        {showEndRoundConfirm && (
          <div className="alert alert-warning mt-3">
            <p>Are you sure you want to end this round early?</p>
            <div className="d-flex gap-2">
              <button
                className="btn btn-warning flex-grow-1"
                onClick={onConfirmEndRound}
              >
                Yes, End Round
              </button>
              <button
                className="btn btn-secondary flex-grow-1"
                onClick={onCancelEndRound}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameControls; 