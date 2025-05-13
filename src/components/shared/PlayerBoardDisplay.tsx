import React from 'react';
import { PlayerBoard } from '../../types/game';

interface PlayerBoardDisplayProps {
  board: PlayerBoard;
  isVisible: boolean;
  onToggleVisibility: () => void;
  transform: {
    scale: number;
    x: number;
    y: number;
  };
  onScale: (scale: number) => void;
  onPan: (x: number, y: number) => void;
  onReset: () => void;
}

const PlayerBoardDisplay: React.FC<PlayerBoardDisplayProps> = ({
  board,
  isVisible,
  onToggleVisibility,
  transform,
  onScale,
  onPan,
  onReset
}) => {
  return (
    <div className="player-board-display">
      <div className="board-controls">
        <button onClick={onToggleVisibility}>
          {isVisible ? 'Hide' : 'Show'} Board
        </button>
        <button onClick={() => onScale(transform.scale + 0.1)}>Zoom In</button>
        <button onClick={() => onScale(transform.scale - 0.1)}>Zoom Out</button>
        <button onClick={onReset}>Reset View</button>
      </div>
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