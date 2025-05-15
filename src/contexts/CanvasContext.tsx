import React, { createContext, useContext, useRef, useCallback, ReactNode, useState, useEffect } from 'react';
import { fabric } from 'fabric';

interface CanvasContextType {
  getFabricCanvas: () => fabric.Canvas | null;
  isDrawing: boolean; // Now reactive
  lastSvgData: string | null; // Now reactive
  initializeCanvas: (
    canvasElement: HTMLCanvasElement,
    options: {
      width: number;
      height: number;
      isDrawingEnabled: boolean;
    }
  ) => void;
  clearCanvas: () => void;
  updateBoard: (roomCode: string, onBoardUpdate: (svgData: string) => void) => void;
  setDrawingEnabled: (enabled: boolean) => void;
  disposeCanvas: () => void;
  getCurrentCanvasSVG: () => string | null;
}

const CanvasContext = createContext<CanvasContextType | null>(null);

interface CanvasProviderProps {
  children: ReactNode;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
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

  const initializeCanvas = useCallback((
    canvasElement: HTMLCanvasElement,
    options: {
      width: number;
      height: number;
      isDrawingEnabled: boolean;
    }
  ) => {
    // Dispose of any existing canvas instance to prevent memory leaks
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    // Create a new Fabric.js canvas instance
    const canvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: options.isDrawingEnabled,
      width: options.width,
      height: options.height,
      backgroundColor: '#0C6A35', // Initial solid background color
      enableRetinaScaling: true,    // Improves rendering on high-DPI displays
      renderOnAddRemove: true,      // Automatically re-render when objects are added/removed
      skipTargetFind: true,         // Optimisation: If true, canvas will not search for objects during events
      selection: false,             // Disable group selection
      perPixelTargetFind: true,     // Enables more accurate object detection
      targetFindTolerance: 4        // Tolerance for object detection
    });

    fabricCanvasRef.current = canvas; // Store the new canvas instance in the ref

    const baseColor = '#0C6A35';
    const textureUrl = 'https://www.transparenttextures.com/patterns/green-dust-and-scratches.png';

    // Set initial solid background color
    canvas.backgroundColor = baseColor;
    canvas.renderAll();

    // --- Image Loading for Texture using fabric.util.loadImage ---
    // Store a reference to this specific canvas instance for the callbacks
    // to ensure they operate on the correct (non-disposed) canvas.
    const associatedCanvasInstance = canvas;

    fabric.util.loadImage(textureUrl, (loadedImg) => {
      // Check if the image loaded successfully AND if the canvas it was loaded for is still the current one
      if (loadedImg && fabricCanvasRef.current === associatedCanvasInstance) {
        try {
          const pattern = new fabric.Pattern({
            source: loadedImg,
            repeat: 'repeat',
          });
          associatedCanvasInstance.backgroundColor = pattern;
          associatedCanvasInstance.renderAll();
          console.log('Texture loaded and applied successfully via fabric.util.loadImage.');
        } catch (e) {
          console.error('Error applying pattern to canvas via fabric.util.loadImage:', e);
          // Fallback to baseColor if pattern creation or application fails
          associatedCanvasInstance.backgroundColor = baseColor;
          associatedCanvasInstance.renderAll();
        }
      } else if (!loadedImg && fabricCanvasRef.current === associatedCanvasInstance) {
        // Image failed to load, but it was for the current canvas
        console.warn('Texture failed to load via fabric.util.loadImage for the current canvas. URL:', textureUrl);
        console.warn('Falling back to solid background color. Check browser network tab and console for errors (CORS, CSP, 404, ad-blockers).');
        associatedCanvasInstance.backgroundColor = baseColor;
        associatedCanvasInstance.renderAll();
      } else if (loadedImg) {
        // Image loaded, but the canvas instance has changed (e.g., re-initialized quickly)
        console.log('Texture loaded via fabric.util.loadImage for a discarded canvas instance. Ignoring.');
      } else {
        // Image failed to load for a discarded canvas instance
        console.warn('Texture failed to load via fabric.util.loadImage for a discarded canvas instance. Ignoring.');
      }
    }, null, { crossOrigin: 'anonymous' }); // context is null, options object with crossOrigin

    // Set up drawing brush properties
    if (canvas.freeDrawingBrush) {
      Object.assign(canvas.freeDrawingBrush, {
        color: '#fff',       // Brush color
        width: 4,            // Brush width
        opacity: 0.9,        // Brush opacity
        strokeLineCap: 'round', // Rounded line endings
        strokeLineJoin: 'round',// Rounded line joins
      });
    }

    // Attach event handlers to the canvas
    setupCanvasHandlers(canvas);

  }, [setupCanvasHandlers]); // Dependency: setupCanvasHandlers (which is stable itself)

  const clearCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove all objects except potential persistent background image (if any, though we use backgroundColor for pattern)
    canvas.getObjects().forEach((obj) => {
      if (obj !== canvas.backgroundImage) { // Check against backgroundImage just in case
        canvas.remove(obj);
      }
    });
    // Revert to the base solid color
    canvas.backgroundColor = '#0C6A35'; 
    canvas.renderAll();
    
    const newSvgData = canvas.toSVG();
    lastSvgDataInternalRef.current = newSvgData;
    setLastSvgDataReactive(newSvgData); // Update reactive state
  }, []); // No dependencies from component scope

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
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
      console.log('Fabric canvas disposed.');
    }
  }, []); // No dependencies

  const getCurrentCanvasSVG = useCallback((): string | null => {
    if (fabricCanvasRef.current) {
      return fabricCanvasRef.current.toSVG();
    }
    return null;
  }, []); // No dependencies

  const contextValue = React.useMemo(() => ({
    getFabricCanvas: () => fabricCanvasRef.current,
    isDrawing: isDrawingReactive, 
    lastSvgData: lastSvgDataReactive, 
    initializeCanvas,
    clearCanvas,
    updateBoard,
    setDrawingEnabled,
    disposeCanvas,
    getCurrentCanvasSVG
  }), [
      isDrawingReactive, 
      lastSvgDataReactive,
      initializeCanvas, 
      clearCanvas, 
      updateBoard, 
      setDrawingEnabled, 
      disposeCanvas, 
      getCurrentCanvasSVG
    ]
  );

  useEffect(() => {
    return () => {
      if (fabricCanvasRef.current) {
        console.log('CanvasProvider unmounting. Disposing canvas.');
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []); 

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
