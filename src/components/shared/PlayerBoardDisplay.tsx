import React, { useRef, useState, useEffect } from 'react';
import { fabric } from 'fabric';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Initialize fabric canvas
  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: false,
        width: 800,
        height: 400,
        backgroundColor: '#0C6A35'
      });
    }

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []);

  // Handle board data updates
  useEffect(() => {
    if (!fabricCanvasRef.current || !board.boardData) return;

    const canvas = fabricCanvasRef.current;
    
    // Load the SVG data
    fabric.loadSVGFromString(board.boardData, (objects, options) => {
      // Keep the background color
      const currentBgColor = canvas.backgroundColor;
      
      // Clear existing objects but keep background
      canvas.getObjects().forEach((obj) => {
        if (obj !== canvas.backgroundImage) {
          canvas.remove(obj);
        }
      });
      
      // Add new objects
      objects.forEach(obj => {
        canvas.add(obj);
      });
      
      // Restore background color
      canvas.backgroundColor = currentBgColor;
      canvas.renderAll();
    });
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

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.1, Math.min(5, scale * zoomFactor));

    const newX = position.x - (mouseX - position.x) * (zoomFactor - 1);
    const newY = position.y - (mouseY - position.y) * (zoomFactor - 1);

    setScale(newScale);
    setPosition({ x: newX, y: newY });
    onScale(board.playerId, newScale);
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

    setPosition(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));

    onPan(board.playerId, dx, dy);
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
                justifyContent: 'center'
              }}
            >
              <canvas 
                ref={canvasRef}
                style={{
                  width: '100%',
                  height: '100%',
                  transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerBoardDisplay; 