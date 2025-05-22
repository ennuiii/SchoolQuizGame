import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CanvasProvider, useCanvas, CHALKBOARD_BACKGROUND_COLOR } from '../../contexts/CanvasContext';
import { useGame } from '../../contexts/GameContext';
import type { PlayerBoard } from '../../types/game';
import { useRoom } from '../../contexts/RoomContext';
import socketService from '../../services/socketService';
import { fabric } from 'fabric'; // Import fabric.js library
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

// Define tool types
const TOOL_TYPES = {
  BRUSH: 'brush',
  ERASER: 'eraser'
};

// Helper function to convert hex color to rgba
function hexToRgba(hex: string, alpha: number): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

  // Add state for tool type
  const [toolType, setToolType] = useState(TOOL_TYPES.BRUSH);

  // --- NEW: Refs for Brush Size Indicator Overlay ---
  const overlayRef = useRef<HTMLCanvasElement>(null); // For the overlay DOM node
  const overlayFabricRef = useRef<fabric.Canvas | null>(null); // For the overlay fabric.Canvas instance
  const brushCursorRef = useRef<fabric.Circle | null>(null); // For the brush cursor indicator object
  // --- END NEW ---

  // Apply brush settings to the main canvas
  useEffect(() => {
    if (!canvas) return;

    // Standard drawing brush setup
    const pencilBrush = new PencilBrush(canvas);

    if (toolType === TOOL_TYPES.ERASER) {
      pencilBrush.color = CHALKBOARD_BACKGROUND_COLOR;
      pencilBrush.width = brushSize * 1.5; // Make eraser slightly larger than brush
    } else {
      pencilBrush.color = brushColor;
      pencilBrush.width = brushSize;
    }

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
    canvas.renderAll();
  }, [canvas, brushColor, brushSize, toolType]);

  // Force update canvas state manually - with reduced logging
  const forceUpdateCanvasState = useCallback(() => {
    if (!canvas || !roomCode || disabled || submittedAnswer) return;

    // Remove excessive logging
    // console.log('[DrawingBoard] Force updating canvas state');
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

  // Get canvas state and send to server periodically with a more efficient interval
  useEffect(() => {
    if (!canvas || !gameStarted || gameOver || disabled || submittedAnswer || !roomCode || connectionStatus !== 'connected') {
      return;
    }

    // Create a variable to track the last time we sent an update
    let lastUpdateTime = Date.now();
    
    // Increase the interval for updates to reduce network traffic
    const interval = setInterval(() => {
      // Only update if actively drawing and enough time has passed (at least 800ms)
      const now = Date.now();
      if (isDrawing && (now - lastUpdateTime > 800)) {
        const currentState = getCanvasState();

        // Only send if the state has changed and is not empty
        if (currentState && 
            currentState !== lastSentState && 
            currentState !== '{"objects":[]}') {
          setLastSentState(currentState);
          if (onUpdate) {
            onUpdate({
              data: currentState,
              timestamp: now
            });
            lastUpdateTime = now;
          }
        }
      }
    }, 1000); // Increased from 500ms to 1000ms to reduce frequency

    return () => clearInterval(interval);
  }, [canvas, getCanvasState, isDrawing, gameStarted, gameOver, disabled, submittedAnswer, roomCode, lastSentState, onUpdate, connectionStatus]);

  // Initialize main canvas
  useEffect(() => {
    console.log('[FabricDrawingBoard] Init useEffect running. Context canvas:', canvas);
    if (canvasContainerRef.current) {
      console.log('[FabricDrawingBoard] canvasContainerRef is available.');
      if (!canvas) {
        console.log('[FabricDrawingBoard] Context canvas is null, calling initializeCanvas.');
        initializeCanvas(canvasContainerRef.current, width, height);
      } else {
        console.log('[FabricDrawingBoard] Context canvas already exists. Instance:', canvas);
        // Ensure main canvas is sized correctly if it already exists (e.g., on HMR)
        const containerRect = canvasContainerRef.current.getBoundingClientRect();
        if (containerRect.width > 0 && containerRect.height > 0) {
          canvas.setDimensions({ width: containerRect.width, height: containerRect.height });
          console.log('[FabricDrawingBoard] Existing main canvas dimensions synced.');
        }
        canvas.isDrawingMode = !disabled && !submittedAnswer;
        console.log('[FabricDrawingBoard] Existing canvas isDrawingMode synced to:', canvas.isDrawingMode);
        canvas.renderAll();
      }
    } else {
      console.warn('[FabricDrawingBoard] canvasContainerRef is NOT available yet for initialization.');
    }
  }, [canvas, initializeCanvas, width, height, disabled, submittedAnswer]);

  // Initialize and sync overlay canvas
  useEffect(() => {
    if (!canvasContainerRef.current || !overlayRef.current || !canvas) {
      console.warn('[OverlayEffect] Conditions not met for overlay init/sync:',
        { container: !!canvasContainerRef.current, overlayEl: !!overlayRef.current, mainCanvas: !!canvas });
      return;
    }
    console.log('[OverlayEffect] Running for overlay canvas init/sync.');

    const initializeOverlayFabric = () => {
      if (!overlayRef.current || !canvasContainerRef.current) return null;

      const containerRect = canvasContainerRef.current.getBoundingClientRect();
      if (containerRect.width <= 0 || containerRect.height <= 0) {
        console.warn('[OverlayEffect] Container has zero dimensions, skipping overlay Fabric init.', containerRect);
        return null;
      }

      // Set HTML attributes for the overlay canvas element itself
      overlayRef.current.width = containerRect.width;
      overlayRef.current.height = containerRect.height;
      console.log('[OverlayEffect] Set overlayRef HTML width/height:', overlayRef.current.width, overlayRef.current.height);

      const newOverlayFabric = new fabric.Canvas(overlayRef.current, {
        selection: false,
        interactive: false,
        renderOnAddRemove: false,
        width: containerRect.width, // also pass to fabric constructor
        height: containerRect.height, // also pass to fabric constructor
      });

      // Transparent background for overlay
      newOverlayFabric.backgroundColor = 'rgba(0, 0, 0, 0)'; // Completely transparent
      
      // Remove debug background
      // newOverlayFabric.backgroundColor = 'rgba(255, 0, 255, 0.1)'; // Semi-transparent magenta

      console.log('[OverlayEffect] New Overlay Fabric.js Canvas initialized with dimensions:', newOverlayFabric.width, newOverlayFabric.height);
      return newOverlayFabric;
    };

    const createBrushCursor = (overlayCanvasInstance: fabric.Canvas) => {
      if (!canvasContainerRef.current) return null;
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Use actual brush settings instead of debug values
      const cursorRadius = Math.max(brushSize / 1, 1);
      
      let newBrushCursor;
      
      if (toolType === TOOL_TYPES.ERASER) {
        // Eraser styling - pinkish rubber eraser look
        newBrushCursor = new fabric.Circle({
          left: centerX,
          top: centerY,
          radius: cursorRadius,
          fill: 'rgba(255, 192, 203, 0.7)', // Light pink like a rubber eraser
          stroke: '#d3d3d3', // Light gray border
          strokeWidth: 1,
          selectable: false, 
          evented: false,
        });
      } else {
        // Normal brush styling
        const cursorColor = hexToRgba(brushColor, 0.8);
        newBrushCursor = new fabric.Circle({
          left: centerX,
          top: centerY,
          radius: cursorRadius,
          fill: cursorColor,
          stroke: brushColor,
          strokeWidth: 1,
          selectable: false, 
          evented: false,
        });
      }
      
      // Set originX and originY after creation, casting the object to any to allow these properties
      (newBrushCursor as any).originX = 'center';
      (newBrushCursor as any).originY = 'center';

      overlayCanvasInstance.add(newBrushCursor);
      console.log('[OverlayEffect] Brush cursor object created and added to overlay at center:', centerX, centerY);
      return newBrushCursor;
    };

    if (!overlayFabricRef.current && overlayRef.current) {
      const newOverlayInstance = initializeOverlayFabric();
      if (newOverlayInstance) {
        overlayFabricRef.current = newOverlayInstance;
        if (!brushCursorRef.current) {
          brushCursorRef.current = createBrushCursor(newOverlayInstance);
          console.log('[OverlayEffect] Brush cursor created and stored in ref:', brushCursorRef.current);
        }
        newOverlayInstance.renderAll();
      } else {
        console.warn('[OverlayEffect] Failed to initialize new overlay Fabric instance.');
      }
    } else if (overlayFabricRef.current && overlayRef.current) {
      // Overlay fabric instance exists, ensure its dimensions are synced
      const containerRect = canvasContainerRef.current.getBoundingClientRect();
      if (containerRect.width > 0 && containerRect.height > 0) {
        overlayRef.current.width = containerRect.width;
        overlayRef.current.height = containerRect.height;
        overlayFabricRef.current.setDimensions({ width: containerRect.width, height: containerRect.height });
        // Keep overlay transparent
        overlayFabricRef.current.backgroundColor = 'rgba(0, 0, 0, 0)';
        console.log('[OverlayEffect] Synced existing overlay Fabric instance dimensions:', containerRect.width, containerRect.height);
        overlayFabricRef.current.renderAll();
      } else {
        console.warn('[OverlayEffect] Container has zero dimensions, skipping sync for existing overlay.');
      }
    }

    const syncOverlaySize = () => {
      if (!canvasContainerRef.current || !overlayRef.current || !overlayFabricRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
         console.warn('[syncOverlaySize] Container has zero dimensions, skipping sync.', rect);
        return;
      }
      console.log('[syncOverlaySize] canvasContainerRef.current.getBoundingClientRect():', rect);

      overlayRef.current.width = rect.width;
      overlayRef.current.height = rect.height;
      overlayFabricRef.current.setDimensions({ width: rect.width, height: rect.height });
      overlayFabricRef.current.renderAll();
      console.log(`[syncOverlaySize] Overlay canvas resized to: ${rect.width}x${rect.height}`);
    };

    syncOverlaySize(); // Initial sync for current dimensions
    window.addEventListener('resize', syncOverlaySize);

    return () => {
      window.removeEventListener('resize', syncOverlaySize);
      // Do not dispose overlayFabricRef here if main canvas is also being disposed by context
      // Let the main canvas cleanup handle its own Fabric instance, and this component its overlay
      // brushCursorRef.current = null; // Keep refs unless component truly unmounts
      // overlayFabricRef.current?.dispose(); 
      // overlayFabricRef.current = null;
      console.log('[OverlayEffect] Cleanup: resize listener removed.');
    };
  // Ensure this effect re-runs if the main canvas instance changes OR if the overlay DOM element ref changes.
  // Explicit width/height props are from parent, they dictate container size which then dictates canvas size.
  }, [canvas, overlayRef, width, height]); 

  // Update brush cursor visual properties (color, size based on tool)
  useEffect(() => {
    const overlayFabric = overlayFabricRef.current;
    const brushCursor = brushCursorRef.current;
    if (!overlayFabric || !brushCursor) {
      console.warn('[UpdateBrushCursor] Missing required refs:', {overlayFabric: !!overlayFabric, brushCursor: !!brushCursor});
      return;
    }
    
    console.log('[UpdateBrushCursor] Updating brush cursor with:', {brushSize, brushColor, toolType});
    
    // Set cursor size and color based on active brush settings
    const cursorRadius = Math.max(brushSize / 1, 1);
    
    // Different styling for eraser vs brush
    if (toolType === TOOL_TYPES.ERASER) {
      // Eraser styling - pinkish rubber eraser look
      (brushCursor as any).set({
        radius: cursorRadius,
        fill: 'rgba(255, 192, 203, 0.7)', // Light pink like a rubber eraser
        stroke: '#d3d3d3', // Light gray border
        strokeWidth: 1,
        originX: 'center',
        originY: 'center'
      });
    } else {
      // Normal brush styling
      const cursorColor = hexToRgba(brushColor, 0.8);
      (brushCursor as any).set({
        radius: cursorRadius,
        fill: cursorColor,
        stroke: brushColor,
        strokeWidth: 1,
        originX: 'center',
        originY: 'center'
      });
    }
    
    overlayFabric.renderAll();
    console.log('[UpdateBrushCursor] Brush cursor updated and canvas rendered');
  }, [brushSize, brushColor, toolType]);

  // Optimize mouse event handlers to reduce unnecessary function calls
  useEffect(() => {
    if (!canvas || !overlayFabricRef.current || !brushCursorRef.current || disabled || submittedAnswer) return;

    const overlayFabric = overlayFabricRef.current;
    const brushCursor = brushCursorRef.current;

    // Hide default Fabric.js cursor completely on both canvas elements
    if ((canvas as any).lowerCanvasEl) {
      (canvas as any).lowerCanvasEl.style.cursor = 'none !important';
    }
    
    if ((canvas as any).upperCanvasEl) {
      (canvas as any).upperCanvasEl.style.cursor = 'none !important';
    }
    
    // Track if cursor is visible or hidden to avoid unnecessary updates
    let isCursorVisible = false;
    
    // Track last cursor position to avoid unnecessary updates
    let lastCursorPosition = { x: -100, y: -100 };
    
    // Simple throttle mechanism
    let lastUpdateTime = 0;
    const throttleDelay = 16; // ~60fps - only update every ~16ms for smooth performance
    
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

    // Optimized mouse move handler for cursor position
    const handleMouseMove = (opt: any) => {
      if (!opt.pointer || !brushCursor || !canvas.isDrawingMode) return;
      
      // Skip updates if cursor position hasn't changed significantly
      const now = Date.now();
      if (now - lastUpdateTime < throttleDelay) return;
      
      const x = Math.round(opt.pointer.x);
      const y = Math.round(opt.pointer.y);
      
      // Only update if position changed significantly (more than 1px in any direction)
      if (Math.abs(x - lastCursorPosition.x) > 1 || Math.abs(y - lastCursorPosition.y) > 1) {
        (brushCursor as any).set({ left: x, top: y });
        overlayFabric.renderAll();
        
        lastCursorPosition = { x, y };
        lastUpdateTime = now;
        isCursorVisible = true;
      }
    };

    // Optimized mouse out handler - only hide cursor once
    const handleMouseOut = () => {
      if (isCursorVisible) {
        (brushCursor as any).set({ left: -100, top: -100 });
        overlayFabric.renderAll();
        isCursorVisible = false;
      }
    };

    // Optimized mouse over handler - only show cursor if it was hidden
    const handleMouseOver = (opt: any) => {
      if (!opt.pointer || !brushCursor || !canvas.isDrawingMode) return;
      
      // Only update if cursor is currently hidden
      if (!isCursorVisible) {
        (brushCursor as any).set({ left: opt.pointer.x, top: opt.pointer.y });
        lastCursorPosition = { x: opt.pointer.x, y: opt.pointer.y };
        overlayFabric.renderAll();
        isCursorVisible = true;
      }
    };

    // Attach event listeners to the main canvas
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:out', handleMouseOut);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:over', handleMouseOver);

    // Cleanup function
    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:out', handleMouseOut);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:over', handleMouseOver);
    };
  }, [canvas, getCanvasState, lastSentState, onUpdate, roomCode, disabled, submittedAnswer, overlayFabricRef, brushCursorRef]);

  // Set canvas interactivity and update cursor visibility based on drawing mode
  useEffect(() => {
    if (!canvas || !overlayFabricRef.current || !brushCursorRef.current) return;
    const newDrawingMode = !disabled && !submittedAnswer;
    canvas.isDrawingMode = newDrawingMode;
    canvas.selection = newDrawingMode;
    canvas.interactive = newDrawingMode;
    canvas.forEachObject((obj: fabric.Object) => {
      obj.selectable = newDrawingMode;
      obj.evented = newDrawingMode;
    });
    canvas.renderAll();

    // Explicitly hide cursor if drawing mode is disabled
    if (!newDrawingMode) {
      (brushCursorRef.current as any).set({ left: -100, top: -100 });
      overlayFabricRef.current.renderAll();
    }
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

  // Handle window resize (main canvas and overlay canvas)
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current && canvas && overlayFabricRef.current && overlayRef.current) { // Added overlayRef.current check
        const containerRect = canvasContainerRef.current.getBoundingClientRect();
        console.log('[Window Resize] containerRect:', containerRect); // Log dimensions

        if (containerRect.width > 10 && containerRect.height > 10) {
          canvas.setDimensions({
            width: containerRect.width,
            height: containerRect.height
          });

          // --- CRITICAL: Set HTML canvas attributes for overlay ---
          overlayRef.current.width = containerRect.width;
          overlayRef.current.height = containerRect.height;
          // --- END CRITICAL ---

          overlayFabricRef.current.setDimensions({ // Resize overlay Fabric canvas
            width: containerRect.width,
            height: containerRect.height
          });
          canvas.renderAll();
          overlayFabricRef.current.renderAll(); // Render overlay after resize
          console.log(`[Window Resize] Canvases resized to: ${containerRect.width}x${containerRect.height} (HTML attributes and Fabric canvas for overlay)`);
        } else {
          console.warn('[Window Resize] Container dimensions too small, not resizing canvases.', containerRect);
        }
      } else {
        console.warn('[Window Resize] Refs not available for resize.', {
          container: !!canvasContainerRef.current,
          mainCanvas: !!canvas,
          overlayFabric: !!overlayFabricRef.current,
          overlayElement: !!overlayRef.current
        });
      }
    };
    window.addEventListener('resize', handleResize);
    const initialResizeTimeout = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(initialResizeTimeout);
    };
  }, [canvas]); // Depend on main canvas only for this effect

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
          <div className="tool-type-controls">
            <div className="btn-group me-3">
              <button
                className={`btn btn-sm ${toolType === TOOL_TYPES.BRUSH ? 'btn-light' : 'btn-outline-light'}`}
                onClick={() => setToolType(TOOL_TYPES.BRUSH)}
                title={t('drawingBoard.brush', language) || 'Brush'}
              >
                ✏️
              </button>
              <button
                className={`btn btn-sm ${toolType === TOOL_TYPES.ERASER ? 'btn-light' : 'btn-outline-light'}`}
                onClick={() => setToolType(TOOL_TYPES.ERASER)}
                title={t('drawingBoard.eraser', language) || 'Eraser'}
              >
                🧽
              </button>
            </div>
          </div>

          <div className="brush-size-controls">
            <label className="me-2 fw-bold" style={{ color: "#FFF" }}>{t('drawingBoard.size', language) || 'Size'}:</label>
            <div className="btn-group">
              {BRUSH_SIZES.map((size) => (
                <button
                  key={size.name}
                  className={`btn btn-sm ${brushSize === size.value ? 'btn-light' : 'btn-outline-light'}`}
                  onClick={() => {
                    console.log(`[BrushSizeButton] Setting brush size to ${size.value}px from ${brushSize}px`);
                    setBrushSize(size.value);
                  }}
                  title={`${size.name} ${t('drawingBoard.brush', language) || 'Brush'} (${size.value}px)`}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </div>

          {toolType === TOOL_TYPES.BRUSH && (
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

  // Add a safety check to create brush cursor if it doesn't exist but refs are available
  useEffect(() => {
    if (!brushCursorRef.current && overlayFabricRef.current && canvasContainerRef.current) {
      console.log('[SafetyCheck] Creating brush cursor because it was missing');
      
      const createBrushCursor = () => {
        if (!canvasContainerRef.current || !overlayFabricRef.current) return null;
        
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const cursorRadius = Math.max(brushSize / 1, 1);
        
        let newBrushCursor;
        
        if (toolType === TOOL_TYPES.ERASER) {
          // Eraser styling - pinkish rubber eraser look
          newBrushCursor = new fabric.Circle({
            left: centerX,
            top: centerY,
            radius: cursorRadius,
            fill: 'rgba(255, 192, 203, 0.7)', // Light pink like a rubber eraser
            stroke: '#d3d3d3', // Light gray border
            strokeWidth: 1,
            selectable: false, 
            evented: false,
          });
        } else {
          // Normal brush styling
          const cursorColor = hexToRgba(brushColor, 0.8);
          newBrushCursor = new fabric.Circle({
            left: centerX,
            top: centerY,
            radius: cursorRadius,
            fill: cursorColor,
            stroke: brushColor,
            strokeWidth: 1,
            selectable: false, 
            evented: false,
          });
        }
        
        (newBrushCursor as any).originX = 'center';
        (newBrushCursor as any).originY = 'center';

        overlayFabricRef.current.add(newBrushCursor);
        console.log('[SafetyCheck] Brush cursor created and added to overlay');
        return newBrushCursor;
      };
      
      const newCursor = createBrushCursor();
      if (newCursor) {
        brushCursorRef.current = newCursor;
        overlayFabricRef.current.renderAll();
      }
    }
  }, [canvas, brushSize, brushColor, toolType]);

  // Force brush cursor to be visible on first render and when needed
  useEffect(() => {
    // This effect runs when the component mounts and ensures the brush cursor is initialized
    const checkBrushCursor = () => {
      if (canvas && overlayFabricRef.current && canvasContainerRef.current) {
        if (!brushCursorRef.current) {
          console.log('[ForceVisibility] Creating brush cursor because it was not found');
          // Similar to our safety check
          const rect = canvasContainerRef.current.getBoundingClientRect();
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          
          // Use actual brush settings
          const cursorRadius = Math.max(brushSize / 1, 1);
          
          let newBrushCursor;
          
          if (toolType === TOOL_TYPES.ERASER) {
            // Eraser styling - pinkish rubber eraser look
            newBrushCursor = new fabric.Circle({
              left: centerX,
              top: centerY,
              radius: cursorRadius,
              fill: 'rgba(255, 192, 203, 0.7)', // Light pink like a rubber eraser
              stroke: '#d3d3d3', // Light gray border
              strokeWidth: 1,
              selectable: false, 
              evented: false,
            });
          } else {
            // Normal brush styling
            const cursorColor = hexToRgba(brushColor, 0.8);
            newBrushCursor = new fabric.Circle({
              left: centerX,
              top: centerY,
              radius: cursorRadius,
              fill: cursorColor,
              stroke: brushColor,
              strokeWidth: 1,
              selectable: false, 
              evented: false,
            });
          }
          
          (newBrushCursor as any).originX = 'center';
          (newBrushCursor as any).originY = 'center';

          overlayFabricRef.current.add(newBrushCursor);
          brushCursorRef.current = newBrushCursor;
          overlayFabricRef.current.renderAll();
          
          console.log('[ForceVisibility] Brush cursor created and added to overlay');
        } else {
          // Update existing cursor to match current brush settings
          if (toolType === TOOL_TYPES.ERASER) {
            // Eraser styling
            (brushCursorRef.current as any).set({
              radius: Math.max(brushSize / 1, 1),
              fill: 'rgba(255, 192, 203, 0.7)', // Light pink like a rubber eraser
              stroke: '#d3d3d3', // Light gray border
              strokeWidth: 1
            });
          } else {
            // Normal brush styling
            (brushCursorRef.current as any).set({
              radius: Math.max(brushSize / 1, 1),
              fill: hexToRgba(brushColor, 0.8),
              stroke: brushColor,
              strokeWidth: 1
            });
          }
          overlayFabricRef.current.renderAll();
          console.log('[ForceVisibility] Existing brush cursor updated to match current settings');
        }
      }
    };
    
    // Run immediately and then on a delay to ensure canvas is fully initialized
    checkBrushCursor();
    const timer = setTimeout(checkBrushCursor, 500);
    const timer2 = setTimeout(checkBrushCursor, 1500);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [canvas, brushSize, brushColor, toolType]);

  return (
    <>
      <div
        className="drawing-board-container"
        style={{
          height: height,
          position: 'relative',
          backgroundColor: CHALKBOARD_BACKGROUND_COLOR,
          isolation: 'isolate',
          overflow: 'hidden',
        }}
      >
        {boardLabel && <div className="board-label">{boardLabel}</div>}
        
        {/* Wrapper div to ensure proper positioning */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Main drawing canvas container */}
          <div
            className="canvas-container"
            ref={canvasContainerRef}
            style={{ 
              width: '100%', 
              height: '100%',
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 1,
              background: CHALKBOARD_BACKGROUND_COLOR,
              cursor: 'none',
            }}
          >
            {/* Main Fabric.js canvas will be rendered here by initializeCanvas */}
          </div>
          
          {/* Overlay canvas for brush cursor */}
          <canvas
            ref={overlayRef}
            className="brush-cursor-overlay" 
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1000,
              mixBlendMode: 'normal',
              border: 'none',
              outline: 'none',
              cursor: 'none',
            }}
          />
        </div>

        {/* Answer submission overlay */}
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
