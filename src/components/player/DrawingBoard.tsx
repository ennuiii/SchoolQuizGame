import React, { useEffect, useRef } from 'react';
import { useCanvas } from '../../contexts/CanvasContext';

interface DrawingBoardProps {
  canvasKey: number;
  roomCode: string;
  submittedAnswer: boolean;
  onBoardUpdate: (svgData: string) => void;
}

const DrawingBoard: React.FC<DrawingBoardProps> = ({
  canvasKey,
  roomCode,
  submittedAnswer,
  onBoardUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const { initializeCanvas, clearCanvas, updateBoard, setDrawingEnabled, disposeCanvas } = useCanvas();

  // Initialize canvas when component mounts or key changes
  useEffect(() => {
    if (canvasRef.current) {
      initializeCanvas(canvasRef.current, {
        width: 800,
        height: 400,
        isDrawingEnabled: !submittedAnswer
      });
    }

    return () => {
      disposeCanvas();
    };
  }, [canvasKey, initializeCanvas, disposeCanvas, submittedAnswer]);

  // Handle submission state changes
  useEffect(() => {
    setDrawingEnabled(!submittedAnswer);
  }, [submittedAnswer, setDrawingEnabled]);

  // Handle board updates
  useEffect(() => {
    const updateInterval = setInterval(() => {
      updateBoard(roomCode, onBoardUpdate);
    }, 100);

    return () => {
      clearInterval(updateInterval);
    };
  }, [roomCode, onBoardUpdate, updateBoard]);

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h3 className="mb-0">Drawing Board</h3>
        <div>
          <button 
            className="btn btn-outline-light me-2"
            onClick={clearCanvas}
            disabled={submittedAnswer}
            style={{ 
              backgroundColor: '#8B4513', 
              border: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            Erase Board
          </button>
        </div>
      </div>
      <div className="card-body">
        <div 
          ref={boardContainerRef}
          className="mb-4 drawing-board-container" 
          style={{ 
            width: '100%',
            maxWidth: '800px',
            height: 'auto',
            minHeight: '250px',
            position: 'relative',
            overflow: 'hidden',
            margin: '0 auto',
            cursor: submittedAnswer ? 'default' : 'crosshair',
            border: '4px solid #8B4513',
            borderRadius: '4px'
          }}
        >
          <canvas 
            ref={canvasRef} 
            id={`canvas-${canvasKey}`} 
            width="800" 
            height="400" 
            style={{ display: 'block', width: '100%', height: '100%' }} 
          />
        </div>
      </div>
    </div>
  );
};

export default DrawingBoard; 