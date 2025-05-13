import React from 'react';
import { PlayerBoard, PlayerBoardDisplayProps } from '../../types/game';

const PlayerBoardDisplay: React.FC<PlayerBoardDisplayProps> = ({
  board,
  isVisible = true,
  isFocused = false,
  onToggleVisibility,
  transform = { scale: 1, x: 0, y: 0 },
  onScale,
  onPan,
  onReset
}) => {
  return (
    <div className={`player-board-display ${isFocused ? 'focused' : ''}`}>
      {onToggleVisibility && (
        <div className="board-controls">
          <button onClick={() => onToggleVisibility(board.playerId)}>
            {isVisible ? 'Hide' : 'Show'} Board
          </button>
          {onScale && (
            <>
              <button onClick={() => onScale(board.playerId, transform.scale + 0.1)}>Zoom In</button>
              <button onClick={() => onScale(board.playerId, transform.scale - 0.1)}>Zoom Out</button>
            </>
          )}
          {onReset && <button onClick={() => onReset(board.playerId)}>Reset View</button>}
        </div>
      )}
      {isVisible && (
        <div
          className="board-container"
          style={{
            transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
            transformOrigin: 'center',
            transition: 'transform 0.2s ease-out'
          }}
        >
          <div
            className="drawing-board"
            dangerouslySetInnerHTML={{ __html: board.boardData || '' }}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '250px',
              background: 'transparent'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PlayerBoardDisplay; 