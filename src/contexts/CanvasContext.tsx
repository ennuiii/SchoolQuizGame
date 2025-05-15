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

    // --- Image Loading for Texture ---
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Necessary for loading cross-origin images onto canvas

    // Store a reference to this specific canvas instance for the callbacks
    // to ensure they operate on the correct (non-disposed) canvas.
    const associatedCanvasInstance = canvas;

    img.onload = () => {
      // Check if the canvas this image was intended for is still the current active canvas
      if (fabricCanvasRef.current === associatedCanvasInstance) {
        try {
          // Create a new Fabric.js pattern object
          const pattern = new (fabric as any).Pattern({ // Using 'as any' to bypass potential strict typing issues with fabric.Pattern
            source: img,      // The loaded image element
            repeat: 'repeat', // How the pattern should repeat
          });
          associatedCanvasInstance.backgroundColor = pattern; // Set the canvas background to the pattern
          associatedCanvasInstance.renderAll();             // Re-render the canvas to show the new background
          console.log('Texture loaded and applied successfully.');
        } catch (e) {
          console.error('Error applying pattern to canvas:', e);
          // Fallback to baseColor if pattern creation or application fails
          associatedCanvasInstance.backgroundColor = baseColor;
          associatedCanvasInstance.renderAll();
        }
      } else {
        // This can happen if the canvas was re-initialized before the image finished loading
        console.log('Texture loaded for a discarded canvas instance. Ignoring.');
      }
    };

    img.onerror = (event) => {
      // Check if the error is for the current canvas instance
      if (fabricCanvasRef.current === associatedCanvasInstance) {
        console.warn('Texture failed to load for the current canvas. Event details:', event);
        console.warn('Attempted to load texture from URL:', textureUrl);
        console.warn('Falling back to solid background color. Check browser network tab and console for more specific errors (e.g., CORS, CSP, 404, ad-blockers).');
        associatedCanvasInstance.backgroundColor = baseColor; // Fallback to solid color
        associatedCanvasInstance.renderAll();
      } else {
        console.warn('Texture failed to load for a discarded canvas instance. Ignoring. Event:', event);
      }
    };

    // Start loading the image. This is asynchronous.
    img.src = textureUrl;

    /*
    // Alternative using fabric.util.loadImage (Fabric.js idiomatic way)
    // This might handle some aspects of image loading internally.
    fabric.util.loadImage(textureUrl, (loadedImg) => {
      if (loadedImg && fabricCanvasRef.current === associatedCanvasInstance) {
        const pattern = new fabric.Pattern({
          source: loadedImg,
          repeat: 'repeat',
        });
        associatedCanvasInstance.backgroundColor = pattern;
        associatedCanvasInstance.renderAll();
        console.log('Texture loaded via fabric.util.loadImage.');
      } else if (!loadedImg && fabricCanvasRef.current === associatedCanvasInstance) {
        console.warn('Texture failed to load via fabric.util.loadImage. Falling back to solid color.');
        associatedCanvasInstance.backgroundColor = baseColor;
        associatedCanvasInstance.renderAll();
      } else if (loadedImg) {
         console.log('Texture loaded via fabric.util.loadImage for a discarded canvas. Ignoring.');
      }
    }, null, 'anonymous'); // context is null, 'anonymous' for crossOrigin
    */

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
    // fabric.js typically handles selectable/evented based on isDrawingMode for paths,
    // but explicitly setting for other objects might be needed if you add them.
    // For free drawing, isDrawingMode is the main control.
    // If you add other objects (shapes, text) and want them to be selectable
    // when not in drawing mode, you'd manage their 'selectable' and 'evented' properties.
    // canvas.selection = enabled; // This enables group selection, usually false if isDrawingMode is true.
    // canvas.forEachObject((obj: fabric.Object) => {
    //   obj.selectable = enabled; // This might be too broad if you only want drawing.
    //   obj.evented = enabled;
    // });
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
      // Ensure canvas is not empty or in a weird state before getting SVG
      // The toSVG() method itself is robust.
      return fabricCanvasRef.current.toSVG();
    }
    return null;
  }, []); // No dependencies

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // if CanvasProvider re-renders but these values haven't changed.
  const contextValue = React.useMemo(() => ({
    getFabricCanvas: () => fabricCanvasRef.current,
    isDrawing: isDrawingReactive, // Use reactive state
    lastSvgData: lastSvgDataReactive, // Use reactive state
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

  // Cleanup effect to dispose canvas when component unmounts
  useEffect(() => {
    return () => {
      if (fabricCanvasRef.current) {
        console.log('CanvasProvider unmounting. Disposing canvas.');
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []); // Run only on mount and unmount

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
