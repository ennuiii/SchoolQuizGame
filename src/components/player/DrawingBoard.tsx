import React, { useEffect, useRef, useCallback } from 'react';
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
  const updateQueued = useRef(false);
  const lastUpdateTime = useRef(Date.now());

  // Initialize canvas with settings
  const initializeCanvas = useCallback(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: !submittedAnswer,
      width: 800,
      height: 400,
      backgroundColor: '#0C6A35',
      enableRetinaScaling: true,
      renderOnAddRemove: true,
      skipTargetFind: true,
      selection: false,
      perPixelTargetFind: true,
      targetFindTolerance: 4
    });

    fabricCanvasRef.current = canvas;

    // Set up drawing brush
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = '#FFFFFF';
      canvas.freeDrawingBrush.width = 4;
      canvas.freeDrawingBrush.opacity = 0.9;
      canvas.freeDrawingBrush.decimate = 4;
      (canvas.freeDrawingBrush as any).strokeLineCap = 'round';
      (canvas.freeDrawingBrush as any).strokeLineJoin = 'round';
    }

    return canvas;
  }, [submittedAnswer]);

  // Handle board updates
  const handleBoardUpdate = useCallback(() => {
    if (!fabricCanvasRef.current || submittedAnswer || !updateQueued.current) return;
    
    const now = Date.now();
    // Ensure minimum time between updates to prevent rapid updates
    if (now - lastUpdateTime.current < 100) return;
    
    const svgData = fabricCanvasRef.current.toSVG();
    if (svgData !== lastSvgData.current) {
      lastSvgData.current = svgData;
      onBoardUpdate(svgData);
      lastUpdateTime.current = now;
    }
    updateQueued.current = false;
  }, [submittedAnswer, onBoardUpdate]);

  // Queue an update
  const queueUpdate = useCallback(() => {
    if (!isDrawing.current) {
      updateQueued.current = true;
      handleBoardUpdate();
    }
  }, [handleBoardUpdate]);

  // Set up canvas event handlers
  const setupCanvasHandlers = useCallback((canvas: fabric.Canvas) => {
    canvas.on('mouse:down', () => {
      if (canvas.isDrawingMode && !submittedAnswer) {
        isDrawing.current = true;
        updateQueued.current = false;
      }
    });

    canvas.on('mouse:move', () => {
      if (isDrawing.current && !submittedAnswer) {
        // Just track that we're drawing, don't update yet
        isDrawing.current = true;
      }
    });

    canvas.on('mouse:up', () => {
      if (!submittedAnswer) {
        isDrawing.current = false;
        queueUpdate();
      }
    });

    canvas.on('path:created', () => {
      if (!submittedAnswer) {
        queueUpdate();
      }
    });

    canvas.on('mouse:out', () => {
      if (isDrawing.current && !submittedAnswer) {
        isDrawing.current = false;
        queueUpdate();
      }
    });
  }, [submittedAnswer, queueUpdate]);

  // Initialize canvas and set up handlers
  useEffect(() => {
    const canvas = initializeCanvas();
    if (canvas) {
      setupCanvasHandlers(canvas);
    }

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [canvasKey, initializeCanvas, setupCanvasHandlers]);

  // Handle submission state changes
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

  const clearCanvas = useCallback(() => {
    if (fabricCanvasRef.current && !submittedAnswer) {
      const canvas = fabricCanvasRef.current;
      canvas.getObjects().forEach((obj) => {
        if (obj !== canvas.backgroundImage) {
          canvas.remove(obj);
        }
      });
      canvas.backgroundColor = '#0C6A35';
      canvas.renderAll();
      
      const svgData = canvas.toSVG();
      lastSvgData.current = svgData;
      onBoardUpdate(svgData);
    }
  }, [submittedAnswer, onBoardUpdate]);

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