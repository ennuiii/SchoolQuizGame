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
      skipTargetFind: boolean;
      forEachObject(callback: (obj: fabric.Object) => void): void;
      setWidth(value: number): fabric.Canvas;
      setHeight(value: number): fabric.Canvas;
      setDimensions(dimensions: {width: number, height: number}): fabric.Canvas;
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
    // Completely disable object selection and manipulation
    canvas.selection = false;
    canvas.skipTargetFind = true;
    canvas.preserveObjectStacking = true;
    
    // Disable all events on objects by default
    canvas.forEachObject((obj: fabric.Object) => {
      obj.selectable = false;
      obj.evented = false;
      obj.lockMovementX = true;
      obj.lockMovementY = true;
    });
    
    // Override the _handleEvent method to prevent object dragging
    const originalHandleEvent = (canvas as any)._handleEvent;
    if (originalHandleEvent) {
      (canvas as any)._handleEvent = function(e: Event, eventType: string) {
        // Only allow drawing-related events when in drawing mode
        if (this.isDrawingMode) {
          if (eventType === 'down' || eventType === 'move' || eventType === 'up' || eventType === 'over' || eventType === 'out') {
            originalHandleEvent.call(this, e, eventType);
          }
        } else {
          // Pass through all events if not in drawing mode
          originalHandleEvent.call(this, e, eventType);
        }
      };
    }

    // Event handler for when a user starts drawing
    canvas.on('mouse:down', (opt: any) => {
      if (canvas.isDrawingMode) {
        isDrawingInternalRef.current = true;
        setIsDrawingReactive(true);
        updateQueuedRef.current = false;
        
        // Ensure we're not interacting with an object
        if (opt.target) {
          opt.target.selectable = false;
          opt.target.evented = false;
        }
      }
    });

    // Event handler for mouse movement while drawing
    canvas.on('mouse:move', (opt: any) => {
      if (isDrawingInternalRef.current && canvas.isDrawingMode) {
        // Ensure no object is selectable during drawing
        if (opt.target) {
          opt.target.selectable = false;
          opt.target.evented = false;
        }
      }
    });

    // Event handler for when a user stops drawing
    canvas.on('mouse:up', (opt: any) => {
      if (canvas.isDrawingMode) {
        isDrawingInternalRef.current = false;
        setIsDrawingReactive(false);
        updateQueuedRef.current = true;
        
        // Force render to ensure drawn path is fixed in place
        canvas.renderAll();
        
        // Re-disable selection globally to ensure nothing can be selected
        canvas.selection = false;
        canvas.skipTargetFind = true;
      }
    });

    // Event handler for when a path (drawing) is created
    canvas.on('path:created', (e: any) => {
      if (e.path) {
        // Lock the path and prevent any interaction
        e.path.selectable = false;
        e.path.evented = false;
        e.path.lockMovementX = true;
        e.path.lockMovementY = true;
        e.path.hasControls = false;
        e.path.hasBorders = false;
        
        updateQueuedRef.current = true;
      }
    });

    // Handle all object added events
    canvas.on('object:added', (e: any) => {
      if (e.target) {
        // Lock every new object
        e.target.selectable = false;
        e.target.evented = false;
        e.target.lockMovementX = true;
        e.target.lockMovementY = true;
        e.target.hasControls = false;
        e.target.hasBorders = false;
      }
    });

    // Event handler for mouse leaving the canvas area
    canvas.on('mouse:out', () => {
      if (isDrawingInternalRef.current && canvas.isDrawingMode) {
        isDrawingInternalRef.current = false;
        setIsDrawingReactive(false);
        updateQueuedRef.current = true;
        
        // Force render to ensure drawn path is fixed in place
        canvas.renderAll();
      }
    });
    
    // Immediately render to apply settings
    canvas.renderAll();
  }, []);

  const initializeCanvas = useCallback((container: HTMLElement, width = 800, height = 400) => {
    // Clean up any existing canvas
    if (canvas) {
      console.log('[CanvasContext] initializeCanvas: Disposing existing canvas before creating new one');
      canvas.dispose();
    }

    // Clear all content from the container first to avoid nested canvas containers
    container.innerHTML = '';
    console.log('[CanvasContext] initializeCanvas: Cleared container content, creating new canvas element');

    // Create canvas element
    const canvasEl = document.createElement('canvas');
    container.appendChild(canvasEl);

    // Apply solid background to container
    container.style.background = '#0C6A35';

    // Calculate actual container size
    const containerRect = container.getBoundingClientRect();
    const actualWidth = containerRect.width || width;
    const actualHeight = containerRect.height || height;
    console.log('[CanvasContext] initializeCanvas: Creating canvas with dimensions', { actualWidth, actualHeight });

    // Since the container is absolutely positioned, don't try to set explicit dimensions
    // as they may conflict with the layout

    // Initialize new canvas with exact dimensions
    const fabricCanvas = new fabric.Canvas(canvasEl, {
      width: actualWidth,
      height: actualHeight,
      backgroundColor: '#0C6A35', // Solid background color
      isDrawingMode: true,
      selection: false, // Disable group selection
      skipTargetFind: true, // Ignore all object selection
      preserveObjectStacking: true, // Keep objects in their stacking order
      renderOnAddRemove: true, // Ensure immediate rendering
      interactive: false, // Disable interactive mode for all objects
      stateful: false // Disable state tracking which can cause issues
    });

    console.log('[CanvasContext] initializeCanvas: Canvas created successfully', { 
      width: fabricCanvas.width, 
      height: fabricCanvas.height,
      isDrawingMode: fabricCanvas.isDrawingMode
    });

    // Set up drawing brush with chalk-like style
    fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.width = 8; // Medium chalk width
    fabricCanvas.freeDrawingBrush.color = '#FFFFFF'; // White chalk by default
    
    // Add chalk-like effect
    if ('shadow' in fabricCanvas.freeDrawingBrush) {
      // @ts-ignore - TypeScript might not know about shadow property
      fabricCanvas.freeDrawingBrush.shadow = new fabric.Shadow({
        blur: 1,
        offsetX: 1,
        offsetY: 1,
        color: 'rgba(0,0,0,0.3)'
      });
    }
    
    // Add slight opacity for more chalk-like appearance
    if ('opacity' in fabricCanvas.freeDrawingBrush) {
      // @ts-ignore - TypeScript might not know about opacity property
      fabricCanvas.freeDrawingBrush.opacity = 0.9;
    }
    
    console.log('[CanvasContext] initializeCanvas: Drawing brush configured with chalk-like style');

    // Store canvas in both state and ref
    setCanvas(fabricCanvas);
    fabricCanvasRef.current = fabricCanvas;
    
    // Set up event handlers
    setupCanvasHandlers(fabricCanvas);
    console.log('[CanvasContext] initializeCanvas: Canvas handlers set up, canvas is ready for drawing');
    
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
        // Make all objects non-selectable and non-movable
        canvas.selection = false;
        canvas.skipTargetFind = true;
        canvas.preserveObjectStacking = true;
        
        canvas.forEachObject((obj: fabric.Object) => {
          obj.selectable = false;
          obj.evented = false;
          obj.lockMovementX = true;
          obj.lockMovementY = true;
          obj.hasControls = false;
          obj.hasBorders = false;
        });
        
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
      
      // Restore canvas settings after clear
      canvas.backgroundColor = '#0C6A35';
      canvas.selection = false;
      canvas.skipTargetFind = true;
      canvas.preserveObjectStacking = true;
      canvas.isDrawingMode = true;
      
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
    getCurrentCanvasSVG: (): string | null => {
      if (fabricCanvasRef.current) {
        const canvasInstance = fabricCanvasRef.current;
        const objects = canvasInstance.getObjects();
        console.log(`[CanvasContext] getCurrentCanvasSVG (direct from contextValue): Canvas instance exists. Number of objects: ${objects.length}`);
        if (objects.length === 0) {
          console.warn("[CanvasContext] getCurrentCanvasSVG (direct from contextValue): No objects on canvas, toSVG() will likely be empty or minimal.");
        }
        const svgData = canvasInstance.toSVG();
        if (!svgData || !svgData.includes('<path') && objects.length > 0) {
            console.warn("[CanvasContext] getCurrentCanvasSVG (direct from contextValue): toSVG() produced an SVG without <path> elements, despite objects being present. SVG data (first 100 chars):", svgData ? svgData.substring(0,100) : "NULL");
        }
        return svgData;
      }
      console.warn("[CanvasContext] getCurrentCanvasSVG (direct from contextValue): fabricCanvasRef.current is null.");
      return null;
    }
  }), [
      canvas,
      isDrawingReactive, 
      lastSvgDataReactive,
      initializeCanvas,
      getCanvasState, 
      loadFromJSON, 
      clear, 
      updateBoard, 
      setDrawingEnabled, 
      disposeCanvas
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
