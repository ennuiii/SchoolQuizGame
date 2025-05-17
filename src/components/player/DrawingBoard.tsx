import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvas } from '../../contexts/CanvasContext';

interface BoardData {
  data: string;
  timestamp: number;
}

interface DrawingBoardProps {
  onUpdate: (boardData: BoardData) => Promise<void>;
  disabled: boolean;
  controls?: React.ReactNode; // Optional custom controls
}

const DrawingBoard: React.FC<DrawingBoardProps> = ({ onUpdate, disabled, controls }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [key, setKey] = useState(0);
  const [brushColor, setBrushColor] = useState('#FFFFFF');
  const [brushSize, setBrushSize] = useState(4);

  const {
    getFabricCanvas,
    initializeCanvas,
    disposeCanvas,
    clearCanvas,
    setDrawingEnabled,
    updateBoard
  } = useCanvas();

  const updateBrush = useCallback(() => {
    const fabricCanvas = getFabricCanvas();
    if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = brushColor;
      fabricCanvas.freeDrawingBrush.width = brushSize;
    }
  }, [brushColor, brushSize, getFabricCanvas]);

  useEffect(() => {
    updateBrush();
  }, [updateBrush]);

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
  }, [initializeCanvas, disposeCanvas]);

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

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushColor(e.target.value);
    updateBrush();
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushSize(parseInt(e.target.value));
    updateBrush();
  };

  return (
    <>
      <div className="drawing-board-controls mb-2 d-flex justify-content-end align-items-center" style={{ minHeight: 40 }}>
        <input
          type="color"
          value={brushColor}
          onChange={handleColorChange}
          className="me-2"
        />
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={handleSizeChange}
          className="me-2"
        />
        {controls ? controls : (
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
        )}
      </div>
      <div className="drawing-board-container">
        <div className="drawing-board mb-4" key={key}>
          <div style={{ width: '100%', maxWidth: '800px', height: '400px', overflow: 'hidden', margin: '0 auto', cursor: disabled ? 'default' : 'crosshair' }}>
            <div className="canvas-container" style={{ width: 800, height: 400, position: 'relative', userSelect: 'none' }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DrawingBoard; 