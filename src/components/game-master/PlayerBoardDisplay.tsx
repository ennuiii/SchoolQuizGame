import React from 'react';

interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

interface PlayerBoardDisplayProps {
  board: PlayerBoard;
  isVisible: boolean;
  onToggleVisibility: (playerId: string) => void;
  transform: {
    scale: number;
    x: number;
    y: number;
  };
  onScale: (playerId: string, scale: number) => void;
  onReset: (playerId: string) => void;
}

const PlayerBoardDisplay: React.FC<PlayerBoardDisplayProps> = ({
  board,
  isVisible,
  onToggleVisibility,
  transform,
  onScale,
  onReset
}) => {
  return (
    <div className="col-md-6 mb-4">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{board.playerName}</h5>
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => onToggleVisibility(board.playerId)}
            >
              {isVisible ? 'Hide' : 'Show'}
            </button>
            {isVisible && (
              <>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => onScale(board.playerId, transform.scale * 1.2)}
                >
                  Zoom In
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => onScale(board.playerId, transform.scale * 0.8)}
                >
                  Zoom Out
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => onReset(board.playerId)}
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
        <div className="card-body">
          {isVisible && (
            <div
              className="board-container"
              style={{
                width: '100%',
                height: '300px',
                backgroundColor: '#0C6A35',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '8px solid #8B4513',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div
                className="drawing-board"
                dangerouslySetInnerHTML={{ __html: board.boardData || '' }}
                style={{
                  width: '100%',
                  height: '100%',
                  transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
                  transformOrigin: 'top left',
                  transition: 'transform 0.2s ease-out'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerBoardDisplay; 