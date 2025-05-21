import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CanvasProvider, useCanvas } from '../../contexts/CanvasContext';
import { useGame } from '../../contexts/GameContext';
import type { PlayerBoard } from '../../types/game';
import { useRoom } from '../../contexts/RoomContext';
import socketService from '../../services/socketService';
import { fabric } from 'fabric';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

// Import PencilBrush for better TypeScript compatibility
const { PencilBrush } = fabric;

// Match the BoardData type used in Player.tsx
interface BoardData {
  data: string;
  timestamp: number;
}

interface DrawingBoardProps {
  onUpdate: (boardData: BoardData) => void;
  disabled: boolean;
  controls?: React.ReactNode; // Optional custom controls
  initialBoardData?: string;
  boardLabel?: string;
  height?: number;
  width?: number;
}

// Define preset chalk colors for the drawing board
const CHALK_COLORS = [
  '#FFFFFF', // White chalk
  '#FFE66D', // Yellow chalk
  '#7BDFF2', // Blue chalk
  '#FF6B6B', // Red chalk
  '#B1E77B', // Green chalk
  '#F7AEF8', // Pink chalk
];

// Define preset brush sizes
const BRUSH_SIZES = [
  { name: 'XS', value: 2 },
  { name: 'S', value: 4 },
  { name: 'M', value: 8 },
  { name: 'L', value: 12 },
  { name: 'XL', value: 16 },
];

// Define preset eraser sizes
const ERASER_SIZES = [
  { name: 'S', value: 10 },
  { name: 'M', value: 20 },
  { name: 'L', value: 30 },
];

const FabricDrawingBoard: React.FC<DrawingBoardProps> = ({
  onUpdate,
  disabled,
  controls,
  initialBoardData,
  boardLabel,
  height = 400,
  width = 600
}) => {
  const { canvas, initializeCanvas, loadFromJSON, getCanvasState, clear } = useCanvas();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { gameStarted, gameOver, submittedAnswer, currentQuestionIndex, playerBoards } = useGame();
  const { connectionStatus, roomCode, persistentPlayerId } = useRoom();
  const [lastSentState, setLastSentState] = useState('');
  const [boardRestored, setBoardRestored] = useState(false);
  const { language } = useLanguage();
  
  // Add state for brush color and size
  const [brushColor, setBrushColor] = useState(CHALK_COLORS[0]); // Default white chalk
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[2].value); // Default medium size
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES[1].value); // Default medium eraser
  const lastBrushColorRef = useRef(brushColor);
  const lastBrushSizeRef = useRef(brushSize);
  
  // Apply brush settings or switch to eraser
  useEffect(() => {
    if (!canvas) return;
    
    if (isEraserMode) {
      // Store current brush settings before switching to eraser
      lastBrushColorRef.current = brushColor;
      lastBrushSizeRef.current = brushSize;
      
      try {
        // Try to use the EraserBrush if fabric.js version supports it
        console.log('[DrawingBoard] Setting up EraserBrush');
        // @ts-ignore - EraserBrush might not be in the types
        if (fabric.EraserBrush) {
          // @ts-ignore - EraserBrush might not be in the types
          const eraserBrush = new fabric.EraserBrush(canvas);
          eraserBrush.width = eraserSize;
          canvas.freeDrawingBrush = eraserBrush;
          
          // Add event listeners for eraser start/end
          eraserBrush.on('start', () => {
            console.log('[DrawingBoard] Eraser start');
          });
          
          eraserBrush.on('end', () => {
            console.log('[DrawingBoard] Eraser end');
            
            // Send the updated board state after erasing
            if (roomCode && !disabled && !submittedAnswer) {
              const currentState = getCanvasState();
              if (currentState && currentState !== lastSentState) {
                console.log('[DrawingBoard] Sending updated board state after erasing');
                setLastSentState(currentState);
                if (onUpdate) {
                  onUpdate({
                    data: currentState,
                    timestamp: Date.now()
                  });
                }
              }
            }
          });
        } else {
          throw new Error('EraserBrush not available');
        }
      } catch (error) {
        console.error('[DrawingBoard] Error setting up EraserBrush:', error);
        // Fallback to standard brush with background color if EraserBrush fails
        const fallbackBrush = new PencilBrush(canvas);
        fallbackBrush.color = '#0C6A35'; // Match the chalkboard background color
        fallbackBrush.width = eraserSize;
        canvas.freeDrawingBrush = fallbackBrush;
      }
    } else {
      // Standard drawing brush setup
      const pencilBrush = new PencilBrush(canvas);
      pencilBrush.color = brushColor;
      pencilBrush.width = brushSize;
      
      // For chalk effect - make the brush have a subtle shadow and opacity
      if ((pencilBrush as any).shadow) {
        (pencilBrush as any).shadow.blur = 1;
        (pencilBrush as any).shadow.offsetX = 1;
        (pencilBrush as any).shadow.offsetY = 1;
        (pencilBrush as any).shadow.color = 'rgba(0,0,0,0.3)';
      }
      
      // Set the opacity slightly less than 1 for chalk effect
      if ((pencilBrush as any).opacity !== undefined) {
        (pencilBrush as any).opacity = 0.9;
      }
      
      canvas.freeDrawingBrush = pencilBrush;
    }
    
    canvas.renderAll();
  }, [canvas, brushColor, brushSize, isEraserMode, eraserSize, roomCode, disabled, submittedAnswer, getCanvasState, lastSentState, onUpdate]);
  
  // Toggle between eraser and normal brush
  const toggleEraserMode = useCallback(() => {
    if (isEraserMode) {
      // Switch back to brush mode with last used settings
      setIsEraserMode(false);
      setBrushColor(lastBrushColorRef.current);
      setBrushSize(lastBrushSizeRef.current);
    } else {
      // Switch to eraser mode
      setIsEraserMode(true);
    }
  }, [isEraserMode]);
  
  // Change eraser size
  const changeEraserSize = useCallback((size: number) => {
    setEraserSize(size);
  }, []);

  // Force update canvas state manually
  const forceUpdateCanvasState = useCallback(() => {
    if (!canvas || !roomCode || disabled || submittedAnswer) return;
    
    console.log('[DrawingBoard] Force updating canvas state');
    const currentState = getCanvasState();
    if (currentState && currentState !== lastSentState) {
      setLastSentState(currentState);
      if (onUpdate) {
        onUpdate({
          data: currentState,
          timestamp: Date.now()
        });
      }
    }
  }, [canvas, roomCode, disabled, submittedAnswer, getCanvasState, lastSentState, onUpdate]);

  // Get canvas state and send to server periodically
  useEffect(() => {
    if (!canvas || !gameStarted || gameOver || disabled || submittedAnswer || !roomCode || connectionStatus !== 'connected') {
      return;
    }

    const interval = setInterval(() => {
      if (isDrawing) {
        const currentState = getCanvasState();
        
        // Only send if the state has changed and is not empty
        if (currentState && currentState !== lastSentState && currentState !== '{"objects":[]}') {
          setLastSentState(currentState);
          if (onUpdate) {
            onUpdate({
              data: currentState,
              timestamp: Date.now()
            });
          }
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [canvas, getCanvasState, isDrawing, gameStarted, gameOver, disabled, submittedAnswer, roomCode, lastSentState, onUpdate, connectionStatus]);

  // Initialize canvas
  useEffect(() => {
    console.log('[FabricDrawingBoard] Init useEffect running. Context canvas:', canvas);
    if (canvasContainerRef.current) {
      console.log('[FabricDrawingBoard] canvasContainerRef is available.');
      if (!canvas) {
        console.log('[FabricDrawingBoard] Context canvas is null, calling initializeCanvas.');
        initializeCanvas(canvasContainerRef.current, width, height);
      } else {
        // 'canvas' here is the fabric.Canvas instance from the context
        console.log('[FabricDrawingBoard] Context canvas already exists. Instance:', canvas);
        // Ensure drawing mode is correctly set if canvas already exists (e.g., on re-render)
        // This is important because the `disabled` or `submittedAnswer` prop might have changed
        canvas.isDrawingMode = !disabled && !submittedAnswer;
        console.log('[FabricDrawingBoard] Existing canvas isDrawingMode synced to:', canvas.isDrawingMode);
        canvas.renderAll(); // Re-render to apply drawing mode change if any
      }
    } else {
      console.warn('[FabricDrawingBoard] canvasContainerRef is NOT available yet for initialization.');
    }
  }, [canvas, initializeCanvas, width, height, disabled, submittedAnswer]);

  // Handle drawing state
  useEffect(() => {
    if (!canvas) return;

    const handleMouseDown = () => setIsDrawing(true);
    const handleMouseUp = () => {
      setIsDrawing(false);
      const currentState = getCanvasState();
      if (currentState && currentState !== lastSentState && currentState !== '{"objects":[]}' && roomCode) {
        setLastSentState(currentState);
        if (onUpdate) {
          onUpdate({
            data: currentState,
            timestamp: Date.now()
          });
        }
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:out', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:out', handleMouseUp);
    };
  }, [canvas, getCanvasState, lastSentState, onUpdate, roomCode]);

  // Set canvas interactivity
  useEffect(() => {
    if (!canvas) return;
    canvas.isDrawingMode = !disabled && !submittedAnswer;
    canvas.selection = !disabled && !submittedAnswer;
    canvas.interactive = !disabled && !submittedAnswer;
    canvas.forEachObject((obj: fabric.Object) => {
      obj.selectable = !disabled && !submittedAnswer;
      obj.evented = !disabled && !submittedAnswer;
    });
    canvas.renderAll();
  }, [canvas, disabled, submittedAnswer]);

  // Load initial or server-restored board data
  useEffect(() => {
    if (!canvas || !roomCode || boardRestored) return;

    const mySocketId = socketService.getSocketId();
    if (!mySocketId && !initialBoardData) return; // No way to identify or load

    if (initialBoardData) {
      loadFromJSON(initialBoardData);
      setLastSentState(initialBoardData);
      setBoardRestored(true);
      return;
    }
    
    if (mySocketId) {
      const myBoard = playerBoards.find(b => 
        b.playerId === mySocketId && 
        (b.roundIndex === undefined || b.roundIndex === currentQuestionIndex)
      );
      if (myBoard && myBoard.boardData && myBoard.boardData !== '') {
        loadFromJSON(myBoard.boardData);
        setLastSentState(myBoard.boardData);
        setBoardRestored(true);
      }
    }
  }, [canvas, initialBoardData, roomCode, playerBoards, currentQuestionIndex, loadFromJSON, boardRestored]);

  // Reset board on question change
  useEffect(() => {
    if (!canvas) return;
    setBoardRestored(false); // Allow restoring for new question
  }, [canvas, currentQuestionIndex]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current && canvas) {
        const containerRect = canvasContainerRef.current.getBoundingClientRect();
        if (containerRect.width > 10 && containerRect.height > 10) {
          canvas.setDimensions({
            width: containerRect.width,
            height: containerRect.height
          });
          canvas.renderAll();
        }
      }
    };
    window.addEventListener('resize', handleResize);
    const initialResizeTimeout = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(initialResizeTimeout);
    };
  }, [canvas]);
  
  const clearCanvas = useCallback(() => {
    if (clear) clear(); // Use clear from context
    if (roomCode && !disabled && !submittedAnswer) {
      const emptyState = '{"objects":[]}';
      setLastSentState(emptyState);
      if (onUpdate) {
        onUpdate({ data: emptyState, timestamp: Date.now() });
      }
    }
  }, [clear, roomCode, disabled, submittedAnswer, onUpdate]);

  // Custom drawing control panel
  const renderDrawingControls = () => {
    if (disabled || submittedAnswer) return null;
    
    return (
      <div className="drawing-board-external-controls d-flex justify-content-between w-100 mt-2 mb-2">
        <div className="drawing-controls-left d-flex align-items-center gap-2">
          {/* Mode toggle button */}
          <div className="mode-toggle me-3">
            <button
              className={`btn ${isEraserMode ? 'btn-light' : 'btn-outline-light'}`}
              onClick={toggleEraserMode}
              title={isEraserMode ? t('drawingBoard.switchToBrush', language) || 'Switch to Brush' : t('drawingBoard.switchToEraser', language) || 'Switch to Eraser'}
              style={{ minWidth: '120px' }}
            >
              {isEraserMode ? (
                <span>
                  <i className="bi bi-brush me-1"></i>
                  {t('drawingBoard.brushMode', language) || 'Brush'}
                </span>
              ) : (
                <span>
                  <i className="bi bi-eraser me-1"></i>
                  {t('drawingBoard.eraserMode', language) || 'Eraser'}
                </span>
              )}
            </button>
          </div>
          
          {/* Size controls - show brush sizes or eraser sizes based on mode */}
          {isEraserMode ? (
            <div className="eraser-size-controls">
              <label className="me-2 fw-bold" style={{ color: "#FFF" }}>{t('drawingBoard.size', language) || 'Size'}:</label>
              <div className="btn-group">
                {ERASER_SIZES.map((size) => (
                  <button
                    key={size.name}
                    className={`btn btn-sm ${eraserSize === size.value ? 'btn-light' : 'btn-outline-light'}`}
                    onClick={() => changeEraserSize(size.value)}
                    title={`${size.name} ${t('drawingBoard.eraser', language) || 'Eraser'} (${size.value}px)`}
                  >
                    {size.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="brush-size-controls">
                <label className="me-2 fw-bold" style={{ color: "#FFF" }}>{t('drawingBoard.size', language) || 'Size'}:</label>
                <div className="btn-group">
                  {BRUSH_SIZES.map((size) => (
                    <button
                      key={size.name}
                      className={`btn btn-sm ${brushSize === size.value ? 'btn-light' : 'btn-outline-light'}`}
                      onClick={() => setBrushSize(size.value)}
                      title={`${size.name} ${t('drawingBoard.brush', language) || 'Brush'} (${size.value}px)`}
                    >
                      {size.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="color-palette d-flex align-items-center ms-3">
                <label className="me-2 fw-bold" style={{ color: "#FFF" }}>{t('drawingBoard.color', language) || 'Color'}:</label>
                <div className="d-flex gap-1">
                  {CHALK_COLORS.map((color) => (
                    <button
                      key={color}
                      className="btn btn-sm color-button p-0"
                      onClick={() => setBrushColor(color)}
                      title={color === '#FFFFFF' ? t('drawingBoard.whiteChalk', language) : 
                             color === '#FFE66D' ? t('drawingBoard.yellowChalk', language) : 
                             color === '#7BDFF2' ? t('drawingBoard.blueChalk', language) : 
                             color === '#FF6B6B' ? t('drawingBoard.redChalk', language) : 
                             color === '#B1E77B' ? t('drawingBoard.greenChalk', language) : t('drawingBoard.pinkChalk', language)}
                      style={{
                        width: '24px',
                        height: '24px',
                        backgroundColor: color,
                        border: color === brushColor ? '2px solid #fff' : '1px solid rgba(255,255,255,0.5)',
                        borderRadius: '50%',
                        boxShadow: color === brushColor ? '0 0 0 2px #0C6A35' : 'none'
                      }}
                    >
                      <span className="visually-hidden">{color}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="drawing-controls-right d-flex gap-2">
          <button 
            className="btn" 
            onClick={clearCanvas}
            style={{
              backgroundColor: '#8B4513',
              borderColor: '#8B4513',
              color: 'white',
              minWidth: '120px',
              fontWeight: 'bold'
            }}
          >
            {t('drawingBoard.clearCanvas', language) || 'Clear'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="drawing-board-container" style={{ height: height, position: 'relative' }}>
        {boardLabel && <div className="board-label">{boardLabel}</div>}
        <div 
          className="canvas-container" 
          ref={canvasContainerRef}
          // Inline styles removed, CSS handles flex sizing
        ></div>
        {/* The submittedAnswer overlay can stay inside if it's styled as an overlay itself */}
        {submittedAnswer && (
          <div className="alert alert-info drawing-submitted-overlay">
            {t('drawingBoard.submitted', language)}
          </div>
        )}
      </div>

      {/* Controls are now OUTSIDE the drawing-board-container */}
      {controls ? controls : renderDrawingControls()}
    </>
  );
};

const DrawingBoard: React.FC<DrawingBoardProps> = (props) => {
  return (
    <CanvasProvider>
      <FabricDrawingBoard {...props} />
    </CanvasProvider>
  );
};

export default DrawingBoard; 