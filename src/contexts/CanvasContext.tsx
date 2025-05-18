import React, { createContext, useContext, useRef, useCallback, ReactNode, useState, useEffect } from 'react';
import { fabric } from 'fabric';

interface CanvasContextType {
  canvas: fabric.Canvas | null;
  initializeCanvas: (container: HTMLElement, width?: number, height?: number) => void;
  getCanvasState: () => string;
  loadFromJSON: (jsonData: string) => void;
  clear: () => void;
  getFabricCanvas: () => fabric.Canvas | null;
  isDrawing: boolean; // Now reactive
  lastSvgData: string | null; // Now reactive
  updateBoard: (roomCode: string, onBoardUpdate: (svgData: string) => void) => void;
  setDrawingEnabled: (enabled: boolean) => void;
  disposeCanvas: () => void;
  getCurrentCanvasSVG: () => string | null;
}

// Make sure fabric.Canvas has the correct type definitions
declare module 'fabric' {
  namespace fabric {
    interface IObjectOptions {
      selectable?: boolean;
      evented?: boolean;
    }
    
    interface Object {
      selectable?: boolean;
      evented?: boolean;
    }

    class BaseBrush {
      constructor(canvas: fabric.Canvas);
      width: number;
      color: string;
    }
    
    class PencilBrush extends BaseBrush {
      constructor(canvas: fabric.Canvas);
      width: number;
      color: string;
    }
    
    interface Canvas {
      toJSON(): any;
      loadFromJSON(json: any, callback?: Function): void;
      on(event: string, handler: Function): void;
      off(event: string, handler?: Function): void;
      isDrawingMode: boolean;
      selection: boolean;
      interactive: boolean;
      forEachObject(callback: (obj: fabric.Object) => void): void;
    }
  }
}

const CanvasContext = createContext<CanvasContextType | null>(null);

interface CanvasProviderProps {
  children: ReactNode;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  // Refs for internal logic, not directly exposed or for triggering re-renders of consumers
  const isDrawingInternalRef = useRef(false); 
  const lastSvgDataInternalRef = useRef<string | null>(null);
  const updateQueuedRef = useRef(false);
  const lastUpdateTimeRef = useRef(Date.now());

  // State for reactive context values
  const [isDrawingReactive, setIsDrawingReactive] = useState(false);
  const [lastSvgDataReactive, setLastSvgDataReactive] = useState<string | null>(null);

  const setupCanvasHandlers = useCallback((canvas: fabric.Canvas) => {
    // Event handler for when a user starts drawing
    canvas.on('mouse:down', () => {
      if (canvas.isDrawingMode) {
        isDrawingInternalRef.current = true;
        setIsDrawingReactive(true); // Update reactive state
        updateQueuedRef.current = false; // Reset queue flag
      }
    });

    // Event handler for mouse movement while drawing
    canvas.on('mouse:move', () => {
      // This check is mostly for internal logic, isDrawingReactive handles UI updates
      if (isDrawingInternalRef.current && canvas.isDrawingMode) {
        // No need to set isDrawingInternalRef.current = true again here, it's already true
      }
    });

    // Event handler for when a user stops drawing
    canvas.on('mouse:up', () => {
      if (canvas.isDrawingMode) {
        isDrawingInternalRef.current = false;
        setIsDrawingReactive(false); // Update reactive state
        updateQueuedRef.current = true; // Queue an update
      }
    });

    // Event handler for when a path (drawing) is created
    canvas.on('path:created', () => {
      if (canvas.isDrawingMode) {
        updateQueuedRef.current = true; // Queue an update
      }
    });

    // Event handler for mouse leaving the canvas area
    canvas.on('mouse:out', () => {
      if (isDrawingInternalRef.current && canvas.isDrawingMode) {
        isDrawingInternalRef.current = false;
        setIsDrawingReactive(false); // Update reactive state
        updateQueuedRef.current = true; // Queue an update
      }
    });
  }, []); // Empty dependency array: this function is stable and doesn't depend on component scope variables that change

  const initializeCanvas = useCallback((container: HTMLElement, width = 800, height = 400) => {
    // Clean up any existing canvas
    if (canvas) {
      canvas.dispose();
    }

    // Create canvas container div if it doesn't exist
    let canvasEl = container.querySelector('canvas');
    if (!canvasEl) {
      canvasEl = document.createElement('canvas');
      container.appendChild(canvasEl);
    }

    // Initialize new canvas
    const fabricCanvas = new fabric.Canvas(canvasEl, {
      width,
      height,
      backgroundColor: '#fff',
      isDrawingMode: true
    });

    // Set up drawing brush
    fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.width = 5;
    fabricCanvas.freeDrawingBrush.color = '#000';

    // Store canvas in both state and ref
    setCanvas(fabricCanvas);
    fabricCanvasRef.current = fabricCanvas;
    
    // Set up event handlers
    setupCanvasHandlers(fabricCanvas);
    
    return fabricCanvas;
  }, [canvas, setupCanvasHandlers]);

  const getCanvasState = useCallback(() => {
    if (!canvas) return '';
    return JSON.stringify(canvas.toJSON());
  }, [canvas]);

  const loadFromJSON = useCallback((jsonData: string) => {
    if (!canvas) return;
    
    try {
      canvas.loadFromJSON(jsonData, () => {
        canvas.renderAll();
        console.log('[CanvasContext] Successfully loaded canvas from JSON');
      });
    } catch (error) {
      console.error('[CanvasContext] Error loading canvas from JSON:', error);
    }
  }, [canvas]);

  const clear = useCallback(() => {
    if (canvas) {
      canvas.clear();
      canvas.backgroundColor = '#fff';
      canvas.renderAll();
    }
  }, [canvas]);

  const updateBoard = useCallback((
    roomCode: string, // roomCode is not used in this snippet, but kept for API consistency
    onBoardUpdate: (svgData: string) => void
  ) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !updateQueuedRef.current) return;

    const now = Date.now();
    // Throttle updates to prevent excessive calls
    if (now - lastUpdateTimeRef.current < 100) return; // Update at most every 100ms

    const svgData = canvas.toSVG();
    // Only send update if SVG data has actually changed
    if (svgData !== lastSvgDataInternalRef.current) {
      lastSvgDataInternalRef.current = svgData;
      setLastSvgDataReactive(svgData); // Update reactive state
      onBoardUpdate(svgData); // Call the provided callback with new SVG data
      lastUpdateTimeRef.current = now;
    }
    updateQueuedRef.current = false; // Reset queue flag
  }, []); // No dependencies from component scope

  const setDrawingEnabled = useCallback((enabled: boolean) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = enabled;
    canvas.renderAll();
  }, []); // No dependencies

  const disposeCanvas = useCallback(() => {
    if (canvas) {
      canvas.dispose();
      setCanvas(null);
    }
    fabricCanvasRef.current = null;
  }, [canvas]);

  const getCurrentCanvasSVG = useCallback((): string | null => {
    if (fabricCanvasRef.current) {
      return fabricCanvasRef.current.toSVG();
    }
    return null;
  }, []); // No dependencies

  const contextValue = React.useMemo(() => ({
    canvas,
    initializeCanvas,
    getCanvasState,
    loadFromJSON,
    clear,
    getFabricCanvas: () => fabricCanvasRef.current,
    isDrawing: isDrawingReactive, 
    lastSvgData: lastSvgDataReactive, 
    updateBoard,
    setDrawingEnabled,
    disposeCanvas,
    getCurrentCanvasSVG
  }), [
      isDrawingReactive, 
      lastSvgDataReactive,
      initializeCanvas, 
      getCanvasState, 
      loadFromJSON, 
      clear, 
      updateBoard, 
      setDrawingEnabled, 
      disposeCanvas, 
      getCurrentCanvasSVG
    ]
  );

  useEffect(() => {
    return () => {
      disposeCanvas();
    };
  }, [disposeCanvas]);

  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
};
