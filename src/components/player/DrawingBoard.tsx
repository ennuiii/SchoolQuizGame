import React, { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../contexts/CanvasContext';

interface BoardData {
  data: string;
  timestamp: number;
}

interface DrawingBoardProps {
  onUpdate: (boardData: BoardData) => Promise<void>;
  onSubmit: () => Promise<void>;
  disabled: boolean;
}

const DrawingBoard: React.FC<DrawingBoardProps> = ({ onUpdate, onSubmit, disabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [key, setKey] = useState(0);

  const {
    initializeCanvas,
    disposeCanvas,
    clearCanvas,
    setDrawingEnabled,
    updateBoard
  } = useCanvas();

  // Initialize canvas when component mounts
  useEffect(() => {
    if (canvasRef.current) {
      initializeCanvas(canvasRef.current, {
        width: 800,
        height: 400,
        isDrawingEnabled: !disabled
      });
    }

    return () => {
      disposeCanvas();
    };
  }, [disabled, initializeCanvas, disposeCanvas]);

  // Handle submission state changes - only disable drawing, don't clear
  useEffect(() => {
    setDrawingEnabled(!disabled);
  }, [disabled, setDrawingEnabled]);

  // Handle board updates
  useEffect(() => {
    const updateInterval = setInterval(() => {
      if (!canvasRef.current) return;
      
      const mockRoomCode = 'TEMP'; // We don't actually use this
      updateBoard(mockRoomCode, (svgData: string) => {
        const boardData: BoardData = {
          data: svgData,
          timestamp: Date.now()
        };
        onUpdate(boardData);
      });
    }, 100);

    return () => {
      clearInterval(updateInterval);
    };
  }, [onUpdate, updateBoard]);

  // Reset canvas
  const handleReset = () => {
    clearCanvas();
    setKey(prev => prev + 1);
  };

  return (
    <div className="drawing-board mb-4" key={key}>
      <div className="drawing-board-controls mb-2 d-flex justify-content-between">
        <div>
          <button
            className="btn btn-outline-light me-2"
            onClick={clearCanvas}
            disabled={disabled}
            style={{ 
              backgroundColor: '#8B4513', 
              borderColor: '#8B4513',
              color: 'white'
            }}
          >
            Clear Canvas
          </button>
          <button
            className="btn btn-outline-light me-2"
            onClick={handleReset}
            disabled={disabled}
            style={{ 
              backgroundColor: '#8B4513', 
              borderColor: '#8B4513',
              color: 'white'
            }}
          >
            Reset
          </button>
        </div>
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={disabled}
        >
          Submit Drawing
        </button>
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: '800px',
          height: '400px',
          overflow: 'hidden',
          margin: '0 auto',
          cursor: disabled ? 'default' : 'crosshair',
          border: '4px solid #8B4513',
          borderRadius: '4px'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    </div>
  );
};

export default DrawingBoard; 