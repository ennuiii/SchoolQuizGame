import React, { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

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
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width: 800,
        height: 400,
        backgroundColor: '#0C6A35' // School green board color
      });
      
      // Set up drawing brush
      if (fabricCanvasRef.current.freeDrawingBrush) {
        fabricCanvasRef.current.freeDrawingBrush.color = '#FFFFFF'; // White chalk color
        fabricCanvasRef.current.freeDrawingBrush.width = 3;
      }
      
      // Send canvas updates
      fabricCanvasRef.current.on('path:created', () => {
        if (fabricCanvasRef.current && roomCode && !submittedAnswer) {
          const svgData = fabricCanvasRef.current.toSVG();
          onBoardUpdate(svgData);
        }
      });
      
      // Also send updates during mouse movement for real-time drawing
      fabricCanvasRef.current.on('mouse:move', () => {
        if (fabricCanvasRef.current && roomCode && fabricCanvasRef.current.isDrawingMode && !submittedAnswer) {
          const svgData = fabricCanvasRef.current.toSVG();
          onBoardUpdate(svgData);
        }
      });
    }
    
    return () => {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, [canvasKey, roomCode, submittedAnswer, onBoardUpdate]);

  // Add effect to disable canvas interaction after submission
  useEffect(() => {
    if (fabricCanvasRef.current) {
      if (submittedAnswer) {
        // Disable all interactions
        fabricCanvasRef.current.isDrawingMode = false;
        (fabricCanvasRef.current as any).selection = false;
        (fabricCanvasRef.current as any).forEachObject((obj: any) => {
          obj.selectable = false;
          obj.evented = false;
        });
        fabricCanvasRef.current.renderAll();
      } else {
        // Enable drawing mode if not submitted
        fabricCanvasRef.current.isDrawingMode = true;
      }
    }
  }, [submittedAnswer]);

  const clearCanvas = () => {
    if (fabricCanvasRef.current && !submittedAnswer) {
      fabricCanvasRef.current.clear();
      fabricCanvasRef.current.backgroundColor = '#0C6A35';
      fabricCanvasRef.current.renderAll();
      
      // Send empty canvas
      const svgData = fabricCanvasRef.current.toSVG();
      onBoardUpdate(svgData);
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h3 className="mb-0">Your Answer</h3>
        <div>
          <button 
            className="btn btn-outline-light me-2"
            onClick={clearCanvas}
            style={{ backgroundColor: '#8B4513', border: 'none' }}
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
            width: '800px',
            height: '400px',
            border: '12px solid #8B4513', 
            borderRadius: '4px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
            position: 'relative',
            overflow: 'hidden',
            margin: '0 auto',
            background: '#0C6A35',
          }}
        >
          <canvas 
            ref={canvasRef} 
            id={`canvas-${canvasKey}`} 
            width="800" 
            height="400" 
            style={{ display: 'block' }} 
          />
        </div>
      </div>
    </div>
  );
};

export default DrawingBoard; 