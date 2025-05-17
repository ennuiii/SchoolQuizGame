import React, { useRef, useState } from 'react';

interface PlayerBoard {
  persistentPlayerId: string;
  playerName: string;
  boardData: string;
}

interface PlayerBoardDisplayProps {
  board: PlayerBoard;
  isVisible: boolean;
  onToggleVisibility: (persistentPlayerId: string) => void;
  transform: {
    scale: number;
    x: number;
    y: number;
  };
  onScale: (persistentPlayerId: string, scale: number) => void;
  onPan: (persistentPlayerId: string, dx: number, dy: number) => void;
  onReset: (persistentPlayerId: string) => void;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [scale, setScale] = useState(transform?.scale || 1);
  const [position, setPosition] = useState({ x: transform?.x || 0, y: transform?.y || 0 });

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.altKey) return;
    
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentScale = scale;
    const currentPosition = position;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.1, Math.min(5, currentScale * zoomFactor));

    const newX = currentPosition.x - (mouseX - currentPosition.x) * (newScale / currentScale - 1);
    const newY = currentPosition.y - (mouseY - currentPosition.y) * (newScale / currentScale - 1);

    setScale(newScale);
    setPosition({ x: newX, y: newY });
    onScale(board.persistentPlayerId, newScale);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!e.altKey || e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();

    isPanning.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    
    const container = containerRef.current;
    if (container) {
      container.style.cursor = 'grabbing';
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPanning.current) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    const newPositionX = position.x + dx;
    const newPositionY = position.y + dy;

    setPosition({ x: newPositionX, y: newPositionY });
    onPan(board.persistentPlayerId, dx, dy);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    
    const container = containerRef.current;
    if (container) {
      container.style.cursor = 'grab';
    }

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
              onClick={() => onToggleVisibility(board.persistentPlayerId)}
            >
              {isVisible ? 'Hide' : 'Show'}
            </button>
            <button 
              className="btn btn-sm btn-outline-secondary ms-2"
              onClick={() => {
                setScale(1);
                setPosition({ x: 0, y: 0 });
                onReset(board.persistentPlayerId);
              }}
              title="Reset pan/zoom"
            >
              Reset View
            </button>
          </div>
        </div>
        {isVisible && (
          <div className="drawing-board-container">
            <div
              ref={containerRef}
              className="board-container d-flex justify-content-center align-items-center"
              style={{
                width: '100%',
                minWidth: '400px',
                minHeight: '300px',
                margin: '0 auto',
                maxWidth: '100%',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'grab',
                userSelect: 'none'
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              tabIndex={0}
            >
              <div className="drawing-board" 
                style={{
                  width: '100%', 
                  height: '100%', 
                  minHeight: '300px',
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'top left',
                  transition: isPanning.current ? 'none' : 'transform 0.1s ease-out',
                }}>
                <div
                  dangerouslySetInnerHTML={{ __html: board.boardData || '' }}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    minWidth: 0,
                    objectFit: 'contain',
                    background: 'transparent'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerBoardDisplay; 