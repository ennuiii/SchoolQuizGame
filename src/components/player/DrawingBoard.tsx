import React, { useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { throttle } from 'lodash';

// Extend fabric types
declare module 'fabric' {
  namespace fabric {
    interface IUtilMixin {
      groupSVGElements(objects: any[], options: any): any;
    }
    interface Canvas {
      selection: boolean;
      forEachObject(callback: (obj: any) => void): void;
      add(object: any): void;
    }
    function loadSVGFromString(string: string, callback: (objects: any[], options: any) => void): void;
    const util: IUtilMixin;
  }
}

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

  // Create a throttled version of the board update function
  const throttledBoardUpdate = useCallback(
    throttle((canvas: fabric.Canvas) => {
      if (canvas && roomCode && !submittedAnswer) {
        const svgData = canvas.toSVG();
        onBoardUpdate(svgData);
      }
    }, 50), // Throttle to 50ms
    [roomCode, submittedAnswer, onBoardUpdate]
  );

  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      // Initialize fabric canvas
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width: 800,
        height: 400,
        backgroundColor: '#0C6A35' // Classic chalkboard green
      });
      
      fabricCanvasRef.current = canvas;
      
      // Set up drawing brush for chalk-like appearance
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = '#FFFFFF'; // White chalk color
        canvas.freeDrawingBrush.width = 4; // Slightly thicker for chalk effect
        canvas.freeDrawingBrush.opacity = 0.9; // Slightly transparent for chalk texture
      }
      
      // Send canvas updates on path creation
      canvas.on('path:created', () => {
        throttledBoardUpdate(canvas);
      });
      
      // Send updates during mouse movement for real-time drawing
      canvas.on('mouse:move', () => {
        if (canvas.isDrawingMode) {
          throttledBoardUpdate(canvas);
        }
      });

      // Handle board updates from other players
      canvas.on('board_update', (boardData: string) => {
        canvas.clear();
        canvas.backgroundColor = '#0C6A35';
        fabric.loadSVGFromString(boardData, (objects: any[], options: any) => {
          const loadedObjects = fabric.util.groupSVGElements(objects, options);
          canvas.add(loadedObjects);
          canvas.renderAll();
        });
      });
    }
    
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [canvasKey, roomCode, submittedAnswer, throttledBoardUpdate]);

  // Add effect to disable canvas interaction after submission
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.isDrawingMode = !submittedAnswer;
      canvas.selection = !submittedAnswer;
      canvas.forEachObject((obj: any) => {
        obj.selectable = !submittedAnswer;
        obj.evented = !submittedAnswer;
      });
      canvas.renderAll();
    }
  }, [submittedAnswer]);

  const clearCanvas = () => {
    const canvas = fabricCanvasRef.current;
    if (canvas && !submittedAnswer) {
      canvas.clear();
      canvas.backgroundColor = '#0C6A35';
      canvas.renderAll();
      
      // Send empty canvas
      throttledBoardUpdate(canvas);
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
            cursor: submittedAnswer ? 'default' : 'crosshair'
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