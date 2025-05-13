import React, { useRef } from 'react';

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
  onPan: (playerId: string, dx: number, dy: number) => void;
  onReset: (playerId: string) => void;
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
  const panState = useRef<{panning: boolean; lastX: number; lastY: number}>({ panning: false, lastX: 0, lastY: 0 });

  // Mouse wheel for zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.altKey) {
      e.preventDefault();
      const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
      onScale(board.playerId, Math.max(0.1, transform.scale * scaleFactor));
    }
  };

  // Mouse down for pan
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.altKey && e.button === 0) {
      panState.current.panning = true;
      panState.current.lastX = e.clientX;
      panState.current.lastY = e.clientY;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Mouse move for pan
  const handleMouseMove = (e: MouseEvent) => {
    if (panState.current.panning) {
      const dx = e.clientX - panState.current.lastX;
      const dy = e.clientY - panState.current.lastY;
      panState.current.lastX = e.clientX;
      panState.current.lastY = e.clientY;
      onPan(board.playerId, dx, dy);
    }
  };

  // Mouse up to stop pan
  const handleMouseUp = () => {
    panState.current.panning = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="mb-4">
      <div className="card h-100">
        <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h5 className="mb-0">{board.playerName}</h5>
          <div className="btn-group flex-wrap">
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
        {isVisible && (
          <div
            className="board-container d-flex justify-content-center align-items-center"
            style={{
              width: '100%',
              minHeight: '250px',
              margin: '0 auto',
              maxWidth: '800px',
              position: 'relative'
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
                transition: 'transform 0.2s ease-out',
                background: '#0C6A35',
                border: '2px solid #8B4513',
                borderRadius: 4,
                cursor: 'grab'
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerBoardDisplay; 