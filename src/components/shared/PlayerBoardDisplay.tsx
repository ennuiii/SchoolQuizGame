import React, { useRef, useState, useEffect } from 'react';

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
  const [svgContent, setSvgContent] = useState<React.ReactNode>(null);
  const [viewBox, setViewBox] = useState<[number, number, number, number]>([0, 0, 800, 400]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!board.boardData) {
      setSvgContent(null);
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(board.boardData, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (!svg || !svg.innerHTML) {
      setSvgContent(<div style={{color: 'red'}}>Invalid SVG</div>);
      return;
    }

    // Get initial viewBox from SVG
    const vb = svg.getAttribute('viewBox');
    if (typeof vb === 'string' && vb.trim().length > 0) {
      const parts = vb.split(' ').map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        setViewBox(parts as [number, number, number, number]);
      }
    }

    setSvgContent(
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox.join(' ')}
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        style={{ display: 'block' }}
        dangerouslySetInnerHTML={{ __html: svg.innerHTML }}
      />
    );
  }, [board.boardData]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.altKey) return;
    
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate mouse position in SVG coordinates
    const svgX = (mouseX / rect.width) * viewBox[2] + viewBox[0];
    const svgY = (mouseY / rect.height) * viewBox[3] + viewBox[1];

    // Calculate zoom factor
    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
    const newWidth = viewBox[2] * zoomFactor;
    const newHeight = viewBox[3] * zoomFactor;

    // Calculate new viewBox to zoom towards mouse position
    const newX = svgX - (mouseX / rect.width) * newWidth;
    const newY = svgY - (mouseY / rect.height) * newHeight;

    setViewBox([newX, newY, newWidth, newHeight]);
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

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    // Convert pixel movement to SVG coordinates
    const svgDx = (dx / rect.width) * viewBox[2];
    const svgDy = (dy / rect.height) * viewBox[3];

    setViewBox(prev => [
      prev[0] - svgDx,
      prev[1] - svgDy,
      prev[2],
      prev[3]
    ]);

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
              onClick={() => onToggleVisibility(board.playerId)}
            >
              {isVisible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {isVisible && (
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
            <div
              className="drawing-board"
              style={{
                width: '100%',
                height: '100%',
                minHeight: '300px',
                background: '#0C6A35',
                border: '4px solid #8B4513',
                borderRadius: 4,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {svgContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerBoardDisplay; 