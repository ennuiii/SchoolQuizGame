import React from 'react';
import { useCanvas } from '../../contexts/CanvasContext';

interface PlayerBoardDisplayProps {
  playerId: string;
  playerName: string;
  onToggleVisibility: (playerId: string) => void;
}

const PlayerBoardDisplay: React.FC<PlayerBoardDisplayProps> = ({
  playerId,
  playerName,
  onToggleVisibility
}) => {
  const {
    canvasRef,
    isVisible,
    scale,
    pan,
    handleScale,
    handlePan,
    handleReset,
    setVisibility
  } = useCanvas();

  const handleToggleVisibility = () => {
    setVisibility(!isVisible);
    onToggleVisibility(playerId);
  };

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">{playerName}'s Board</h5>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => handleScale(scale + 0.1)}
            title="Zoom in"
          >
            +
          </button>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => handleScale(Math.max(0.1, scale - 0.1))}
            title="Zoom out"
          >
            -
          </button>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={handleReset}
            title="Reset view"
          >
            Reset
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={handleToggleVisibility}
            title="Toggle visibility"
          >
            {isVisible ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <div className="card-body">
        <div
          className="canvas-container"
          style={{
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            height: '400px',
            border: '1px solid #dee2e6',
            borderRadius: '0.25rem'
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0',
              cursor: 'move'
            }}
            onMouseDown={(e) => {
              if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const startPan = { ...pan };

                const handleMouseMove = (e: MouseEvent) => {
                  const dx = e.clientX - startX;
                  const dy = e.clientY - startY;
                  handlePan({
                    x: startPan.x + dx / scale,
                    y: startPan.y + dy / scale
                  });
                };

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerBoardDisplay; 