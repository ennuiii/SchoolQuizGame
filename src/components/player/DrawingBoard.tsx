
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
  const lastSvgData = useRef<string | null>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width: 800,
        height: 400,
        backgroundColor: '#0C6A35', // Classic chalkboard green
        enableRetinaScaling: true,
        renderOnAddRemove: true,
        skipTargetFind: true,
        selection: false
      });
      
      fabricCanvasRef.current = canvas;
      
      // Set up drawing brush for chalk-like appearance
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = '#FFFFFF'; // White chalk color
        canvas.freeDrawingBrush.width = 4; // Slightly thicker for chalk effect
        canvas.freeDrawingBrush.opacity = 0.9; // Slightly transparent for chalk texture
        canvas.freeDrawingBrush.decimate = 2; // Optimize performance by reducing points
      }

      // Track when drawing starts
      canvas.on('mouse:down', () => {
        if (canvas.isDrawingMode && !submittedAnswer) {
          isDrawing.current = true;
        }
      });

      // Track mouse movement during drawing
      canvas.on('mouse:move', () => {
        if (isDrawing.current && !submittedAnswer) {
          // The actual drawing is handled by Fabric.js
          // We just need to ensure isDrawing stays true
          isDrawing.current = true;
        }
      });

      // Track when drawing ends
      canvas.on('mouse:up', () => {
        if (isDrawing.current && !submittedAnswer) {
          isDrawing.current = false;
          const svgData = canvas.toSVG();
          // Only send if data has changed
          if (svgData !== lastSvgData.current) {
            console.log('Sending board update on mouse up');
            lastSvgData.current = svgData;
            onBoardUpdate(svgData);
          }
        }
      });

      // Send canvas updates when path is created
      canvas.on('path:created', () => {
        if (!submittedAnswer) {
          const svgData = canvas.toSVG();
          // Only send if data has changed
          if (svgData !== lastSvgData.current) {
            console.log('Sending board update on path created');
            lastSvgData.current = svgData;
            onBoardUpdate(svgData);
          }
        }
      });

      // Handle mouse out of canvas
      canvas.on('mouse:out', () => {
        if (isDrawing.current && !submittedAnswer) {
          isDrawing.current = false;
          const svgData = canvas.toSVG();
          if (svgData !== lastSvgData.current) {
            console.log('Sending board update on mouse out');
            lastSvgData.current = svgData;
            onBoardUpdate(svgData);
          }
        }
      });
    }
    
    return () => {
      if (fabricCanvasRef.current) {
        // Save the current state before disposing
        lastSvgData.current = fabricCanvasRef.current.toSVG();
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [canvasKey, roomCode, submittedAnswer, onBoardUpdate]);

  // Add effect to clear canvas when canvasKey changes (new question starts)
  useEffect(() => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      canvas.clear();
      canvas.backgroundColor = '#0C6A35';
      canvas.renderAll();
      lastSvgData.current = null;
      isDrawing.current = false;
    }
  }, [canvasKey]);

  // Add effect to disable canvas interaction after submission
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.isDrawingMode = !submittedAnswer;
      fabricCanvasRef.current.selection = !submittedAnswer;
      fabricCanvasRef.current.forEachObject((obj: any) => {
        obj.selectable = !submittedAnswer;
        obj.evented = !submittedAnswer;
      });
      fabricCanvasRef.current.renderAll();
    }
  }, [submittedAnswer]);

  const clearCanvas = () => {
    if (fabricCanvasRef.current && !submittedAnswer) {
      const canvas = fabricCanvasRef.current;
      canvas.getObjects().forEach((obj) => {
        if (obj !== canvas.backgroundImage) {
          canvas.remove(obj);
        }
      });
      canvas.backgroundColor = '#0C6A35';
      canvas.renderAll();
      
      // Update the last SVG data and send the cleared state
      const svgData = canvas.toSVG();
      lastSvgData.current = svgData;
      onBoardUpdate(svgData);
    }
  };

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