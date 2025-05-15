import React, { createContext, useContext, useRef, useCallback, ReactNode } from 'react';
import { fabric } from 'fabric';

interface CanvasContextType {
  getFabricCanvas: () => fabric.Canvas | null;
  isDrawing: boolean;
  lastSvgData: string | null;
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
  const isDrawingRef = useRef(false);
  const lastSvgDataRef = useRef<string | null>(null);
  const updateQueuedRef = useRef(false);
  const lastUpdateTimeRef = useRef(Date.now());

  const initializeCanvas = useCallback((
    canvasElement: HTMLCanvasElement,
    options: {
      width: number;
      height: number;
      isDrawingEnabled: boolean;
    }
  ) => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
    }

    const canvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: options.isDrawingEnabled,
      width: options.width,
      height: options.height,
      backgroundColor: '#0C6A35',
      enableRetinaScaling: true,
      renderOnAddRemove: true,
      skipTargetFind: true,
      selection: false,
      perPixelTargetFind: true,
      targetFindTolerance: 4
    });

    // Set chalkboard texture as repeated pattern background
    (fabric as any).util.loadImage('https://www.transparenttextures.com/patterns/green-dust-and-scratches.png', (img: HTMLImageElement) => {
      if (img) {
        const pattern = new (fabric as any).Pattern({ source: img, repeat: 'repeat' });
        (canvas as any).setBackgroundColor(pattern, canvas.renderAll.bind(canvas));
      }
    });

    // Set up drawing brush
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = '#FFFFFF';
      canvas.freeDrawingBrush.width = 4;
      canvas.freeDrawingBrush.opacity = 0.9;
      canvas.freeDrawingBrush.decimate = 4;
      (canvas.freeDrawingBrush as any).strokeLineCap = 'round';
      (canvas.freeDrawingBrush as any).strokeLineJoin = 'round';
    }

    fabricCanvasRef.current = canvas;
    setupCanvasHandlers(canvas);
  }, []);

  const setupCanvasHandlers = useCallback((canvas: fabric.Canvas) => {
    canvas.on('mouse:down', () => {
      if (canvas.isDrawingMode) {
        isDrawingRef.current = true;
        updateQueuedRef.current = false;
      }
    });

    canvas.on('mouse:move', () => {
      if (isDrawingRef.current && canvas.isDrawingMode) {
        isDrawingRef.current = true;
      }
    });

    canvas.on('mouse:up', () => {
      if (canvas.isDrawingMode) {
        isDrawingRef.current = false;
        updateQueuedRef.current = true;
      }
    });

    canvas.on('path:created', () => {
      if (canvas.isDrawingMode) {
        updateQueuedRef.current = true;
      }
    });

    canvas.on('mouse:out', () => {
      if (isDrawingRef.current && canvas.isDrawingMode) {
        isDrawingRef.current = false;
        updateQueuedRef.current = true;
      }
    });
  }, []);

  const clearCanvas = useCallback(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.getObjects().forEach((obj) => {
      if (obj !== canvas.backgroundImage) {
        canvas.remove(obj);
      }
    });
    canvas.backgroundColor = '#0C6A35';
    canvas.renderAll();
    lastSvgDataRef.current = canvas.toSVG();
  }, []);

  const updateBoard = useCallback((
    roomCode: string,
    onBoardUpdate: (svgData: string) => void
  ) => {
    if (!fabricCanvasRef.current || !updateQueuedRef.current) return;

    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 100) return;

    const svgData = fabricCanvasRef.current.toSVG();
    if (svgData !== lastSvgDataRef.current) {
      lastSvgDataRef.current = svgData;
      onBoardUpdate(svgData);
      lastUpdateTimeRef.current = now;
    }
    updateQueuedRef.current = false;
  }, []);

  const setDrawingEnabled = useCallback((enabled: boolean) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.isDrawingMode = enabled;
    canvas.selection = enabled;
    canvas.forEachObject((obj: any) => {
      obj.selectable = enabled;
      obj.evented = enabled;
    });
    canvas.renderAll();
  }, []);

  const disposeCanvas = useCallback(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }
  }, []);

  const getCurrentCanvasSVG = useCallback((): string | null => {
    if (fabricCanvasRef.current) {
      return fabricCanvasRef.current.toSVG();
    }
    return null;
  }, []);

  const value = {
    getFabricCanvas: () => fabricCanvasRef.current,
    isDrawing: isDrawingRef.current,
    lastSvgData: lastSvgDataRef.current,
    initializeCanvas,
    clearCanvas,
    updateBoard,
    setDrawingEnabled,
    disposeCanvas,
    getCurrentCanvasSVG
  };

  return (
    <CanvasContext.Provider value={value}>
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