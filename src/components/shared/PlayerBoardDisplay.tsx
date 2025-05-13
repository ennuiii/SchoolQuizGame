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
  // Parse SVG and extract initial viewBox
  const [svgContent, setSvgContent] = useState<React.ReactNode>(null);
  const [viewBox, setViewBox] = useState<[number, number, number, number]>([0, 0, 800, 400]);
  const panState = useRef<{panning: boolean; lastX: number; lastY: number}>({ panning: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    if (!board.boardData) {
      setSvgContent(null);
      return;
    }
    // Parse SVG string
    const parser = new DOMParser();
    const doc = parser.parseFromString(board.boardData, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || !svg.innerHTML) {
      setSvgContent(<div style={{color: 'red'}}>Invalid SVG</div>);
      return;
    }
    // Get initial viewBox
    const vb = svg.getAttribute('viewBox');
    if (typeof vb === 'string' && vb.trim().length > 0) {
      const parts = vb.split(' ').map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        setViewBox([parts[0], parts[1], parts[2], parts[3]]);
      } else {
        setViewBox([0, 0, 800, 400]); // fallback
      }
    } else {
      setViewBox([0, 0, 800, 400]); // fallback
    }
    // Convert SVG element to React
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
    // eslint-disable-next-line
  }, [board.boardData, viewBox.join(' ')]);

  // Mouse wheel for zoom (Alt+Wheel)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.altKey) {
      e.preventDefault();
      const [x, y, w, h] = viewBox;
      const scaleFactor = e.deltaY < 0 ? 0.9 : 1.1;
      // Zoom centered on mouse position
      const rect = (e.target as HTMLDivElement).getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * w + x;
      const my = ((e.clientY - rect.top) / rect.height) * h + y;
      const newW = w * scaleFactor;
      const newH = h * scaleFactor;
      const newX = mx - ((mx - x) * newW) / w;
      const newY = my - ((my - y) * newH) / h;
      setViewBox([newX, newY, newW, newH]);
    }
  };

  // Mouse down for pan (Alt+Drag)
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
      // Convert pixel movement to SVG units
      const [, , w, h] = viewBox;
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const svgDx = (dx / rect.width) * w;
        const svgDy = (dy / rect.height) * h;
        setViewBox(([x, y, w, h]) => [x - svgDx, y - svgDy, w, h]);
      }
    }
  };

  // Mouse up to stop pan
  const handleMouseUp = () => {
    panState.current.panning = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const containerRef = useRef<HTMLDivElement>(null);

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
                cursor: 'grab',
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