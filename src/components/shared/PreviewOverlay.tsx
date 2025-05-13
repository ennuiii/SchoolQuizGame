import React from 'react';
import { PreviewOverlayProps } from '../../types/game';
import PlayerBoardDisplay from './PlayerBoardDisplay';

const PreviewOverlay: React.FC<PreviewOverlayProps> = ({
  players,
  playerBoards,
  allAnswersThisRound,
  evaluatedAnswers,
  previewMode,
  onClose
}) => {
  return (
    <div className="preview-overlay">
      <div className="preview-content">
        <div className="preview-header">
          <h3>Preview Mode</h3>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="preview-boards">
          {playerBoards.map(board => {
            const player = players.find(p => p.id === board.playerId);
            if (!player || player.isSpectator) return null;

            const answer = allAnswersThisRound[board.playerId];
            const isEvaluated = evaluatedAnswers[board.playerId] !== undefined;
            const isCorrect = evaluatedAnswers[board.playerId];

            return (
              <div
                key={board.playerId}
                className={`preview-board ${previewMode.focusedPlayerId === board.playerId ? 'focused' : ''}`}
              >
                <h4>{board.playerName}</h4>
                <PlayerBoardDisplay
                  board={board}
                  isVisible={true}
                  onToggleVisibility={() => {}}
                  transform={{ scale: 1, x: 0, y: 0 }}
                  onScale={() => {}}
                  onPan={() => {}}
                  onReset={() => {}}
                />
                {answer && (
                  <div className="answer-info">
                    <p>Answer: {answer.answer}</p>
                    {isEvaluated && (
                      <p className={isCorrect ? 'correct' : 'incorrect'}>
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PreviewOverlay; 