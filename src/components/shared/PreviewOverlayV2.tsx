// Copy of PreviewOverlay for alternate design testing
import React, { useEffect, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { fabric } from 'fabric';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
  timestamp?: number;
}

interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

interface PreviewOverlayProps {
  onFocus: (playerId: string) => void;
  onClose: () => void;
  isGameMaster: boolean;
}

const boardColors = [
  '#1976d2', // blue
  '#d32f2f', // red
  '#fbc02d', // yellow
  '#388e3c', // green
  '#7b1fa2', // purple
  '#f57c00', // orange
  '#0288d1', // cyan
  '#c2185b', // pink
  '#455a64', // gray
];

const PreviewOverlayV2: React.FC<PreviewOverlayProps> = ({
  onFocus,
  onClose,
  isGameMaster
}) => {
  const context = useGame();
  const { setDrawingEnabled } = useCanvas();

  if (!context.previewMode.isActive) return null;

  const activePlayerBoards = context.playerBoards.filter(board => {
    const player = context.players.find(p => p.id === board.playerId);
    return player && !player.isSpectator;
  });

  useEffect(() => {
    setDrawingEnabled(false);
    return () => setDrawingEnabled(true);
  }, [setDrawingEnabled]);

  // --- Chalkboard question card ---
  const currentQuestion = context.currentQuestion;

  // --- Responsive grid: always at least 3 columns ---
  const gridTemplateColumns = `repeat(auto-fit, minmax(260px, 1fr))`;

  if (activePlayerBoards.length === 0) {
    return (
      <div className="preview-overlay-v2">
        <div className="preview-chalkboard-card">
          <span className="chalkboard-title">No player boards available to display.</span>
        </div>
        <button className="btn btn-primary preview-close-btn" onClick={onClose}>
          Close Preview
        </button>
      </div>
    );
  }

  return (
    <div className="preview-overlay-v2">
      {/* Chalkboard question card */}
      <div className="preview-chalkboard-card">
        <div className="chalkboard-content">
          <div className="chalkboard-grade">{currentQuestion ? `${currentQuestion.grade}. Klasse – ${currentQuestion.subject}` : ''}</div>
          <div className="chalkboard-question">
            {currentQuestion ? currentQuestion.text : 'No question'}
          </div>
        </div>
        <div className="chalkboard-sponge" />
      </div>
      <button className="btn btn-primary preview-close-btn" onClick={onClose}>
        Close Preview
      </button>
      {/* Player boards grid */}
      <div
        className="preview-whiteboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns,
          gap: 32,
          marginTop: 32,
          justifyItems: 'center',
        }}
      >
        {activePlayerBoards.map((board, idx) => {
          const player = context.players.find(p => p.id === board.playerId);
          const answer = context.allAnswersThisRound[board.playerId];
          const evaluation = context.evaluatedAnswers[board.playerId];
          const borderColor = boardColors[idx % boardColors.length];
          return (
            <div
              key={board.playerId}
              className="preview-whiteboard-card"
              style={{ borderColor }}
            >
              <div className="preview-whiteboard-content">
                <div
                  className="preview-whiteboard-svg"
                  dangerouslySetInnerHTML={{ __html: board.boardData || '' }}
                />
                {answer && (
                  <div className="preview-whiteboard-answer">
                    {answer.answer}
                  </div>
                )}
                {evaluation !== undefined && (
                  <span className={`preview-whiteboard-badge ${evaluation ? 'correct' : 'incorrect'}`}>{evaluation ? 'Correct' : 'Incorrect'}</span>
                )}
              </div>
              <div className="preview-whiteboard-tape">
                <span className="preview-whiteboard-name">{player?.name || ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PreviewOverlayV2; 