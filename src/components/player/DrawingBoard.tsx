import React, { useEffect, useRef, useCallback, useState } from 'react';
import { fabric } from 'fabric';
import { debounce } from 'lodash';

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
      getObjects(): any[];
      remove(object: any): void;
    }
    class Shadow {
      constructor(options: { blur: number; offsetX: number; offsetY: number; color: string });
    }
    class Path {
      constructor(path: string);
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
  const [isDrawing, setIsDrawing] = useState(false);
  const lastUpdateRef = useRef<string>('');

  // Create a debounced version of the board update function
  const debouncedBoardUpdate = useCallback(
    debounce((canvas: fabric.Canvas) => {
      if (canvas && roomCode && !submittedAnswer) {
        const currentSVG = canvas.toSVG();
        // Only send update if the content has changed
        if (currentSVG !== lastUpdateRef.current) {
          lastUpdateRef.current = currentSVG;
          onBoardUpdate(currentSVG);
        }
      }
    }, 100), // Debounce to 100ms for better performance
    [roomCode, submittedAnswer, onBoardUpdate]
  );

  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      // Initialize fabric canvas with error handling
      try {
        const canvas = new fabric.Canvas(canvasRef.current, {
          isDrawingMode: true,
          width: 800,
          height: 400,
          backgroundColor: '#0C6A35'
        });
        
        fabricCanvasRef.current = canvas;
        
        // Set up drawing brush with improved settings
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = '#FFFFFF';
          canvas.freeDrawingBrush.width = 4;
          canvas.freeDrawingBrush.opacity = 0.9;
          canvas.freeDrawingBrush.shadow = new fabric.Shadow({
            blur: 1,
            offsetX: 1,
            offsetY: 1,
            color: 'rgba(255,255,255,0.3)'
          });
        }
        
        // Track drawing state
        canvas.on('mouse:down', () => {
          if (canvas.isDrawingMode) {
            setIsDrawing(true);
          }
        });

        canvas.on('mouse:up', () => {
          if (isDrawing) {
            setIsDrawing(false);
            debouncedBoardUpdate(canvas);
          }
        });

        // Send updates only when path is completed
        canvas.on('path:created', () => {
          debouncedBoardUpdate(canvas);
        });

        // Handle board updates from other players with error handling
        canvas.on('board_update', (boardData: string) => {
          try {
            // Only clear if it's an empty board data
            if (!boardData) {
              canvas.clear();
              canvas.backgroundColor = '#0C6A35';
              canvas.renderAll();
              return;
            }

            // Load the SVG without clearing first
            fabric.loadSVGFromString(boardData, (objects: any[], options: any) => {
              try {
                const loadedObjects = fabric.util.groupSVGElements(objects, options);
                canvas.add(loadedObjects);
                canvas.renderAll();
              } catch (error) {
                console.error('Error loading SVG objects:', error);
                // Fallback: clear and try to load as single object
                canvas.clear();
                canvas.backgroundColor = '#0C6A35';
                const simpleObject = new fabric.Path(boardData);
                canvas.add(simpleObject);
                canvas.renderAll();
              }
            });
          } catch (error) {
            console.error('Error handling board update:', error);
          }
        });

      } catch (error) {
        console.error('Error initializing canvas:', error);
      }
    }
    
    return () => {
      if (fabricCanvasRef.current) {
        debouncedBoardUpdate.cancel(); // Cancel any pending updates
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [canvasKey, roomCode, submittedAnswer, debouncedBoardUpdate, isDrawing]);

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

  const clearCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas && !submittedAnswer) {
      canvas.clear();
      canvas.backgroundColor = '#0C6A35';
      canvas.renderAll();
      
      // Send empty canvas update
      debouncedBoardUpdate(canvas);
    }
  }, [submittedAnswer, debouncedBoardUpdate]);

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