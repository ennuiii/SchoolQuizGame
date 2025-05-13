import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import socketService from '../services/socketService';
import { throttle } from '../utils/throttle';

// Add type declarations for fabric.js methods
declare module 'fabric' {
  namespace fabric {
    interface IUtilMixin {
      groupSVGElements(objects: any[], options: any): any;
    }
    interface ICanvas extends Canvas {
      // Additional properties if needed
    }
    function loadSVGFromString(string: string, callback: (objects: any[], options: any) => void): void;
    const util: IUtilMixin;
  }
}

interface CanvasContextType {
  // Canvas State
  canvasKey: number;
  canvasSize: { width: number; height: number };
  canvasInitialized: boolean;
  submittedAnswer: boolean;
  isVisible: boolean;
  scale: number;
  pan: { x: number; y: number };
  
  // Refs
  canvasRef: React.RefObject<HTMLCanvasElement>;
  fabricCanvasRef: React.RefObject<fabric.Canvas | null>;
  boardContainerRef: React.RefObject<HTMLDivElement>;
  
  // Actions
  initializeCanvas: () => void;
  resetCanvas: () => void;
  clearCanvas: () => void;
  updateCanvasSize: (width: number, height: number) => void;
  setSubmittedAnswer: (submitted: boolean) => void;
  setVisibility: (visible: boolean) => void;
  handleScale: (newScale: number) => void;
  handlePan: (newPan: { x: number; y: number }) => void;
  handleReset: () => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [canvasKey, setCanvasKey] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Create a throttled version of the update function
  const sendBoardUpdate = useCallback(
    throttle((roomCode: string, svgData: string) => {
      socketService.updateBoard(roomCode, svgData);
    }, 50),
    []
  );

  const initializeCanvas = useCallback(() => {
    if (!canvasRef.current || !boardContainerRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: '#0C6A35', // School green board color
      isDrawingMode: true,
      freeDrawingBrush: {
        color: '#FFFFFF',
        width: 4,
        opacity: 0.9,
        shadow: {
          color: 'rgba(0,0,0,0.3)',
          blur: 5,
          offsetX: 2,
          offsetY: 2
        }
      }
    });

    fabricCanvasRef.current = canvas;
    setCanvasInitialized(true);

    // Add drawing event listeners
    canvas.on('path:created', () => {
      if (!submittedAnswer) {
        const svgData = canvas.toSVG();
        const roomCode = sessionStorage.getItem('roomCode');
        if (roomCode) {
          sendBoardUpdate(roomCode, svgData);
        }
      }
    });

    // Also send updates during mouse movement for real-time drawing
    canvas.on('mouse:move', () => {
      if (canvas.isDrawingMode && !submittedAnswer) {
        const svgData = canvas.toSVG();
        const roomCode = sessionStorage.getItem('roomCode');
        if (roomCode) {
          sendBoardUpdate(roomCode, svgData);
        }
      }
    });

    // Listen for board updates from other players
    socketService.on('board_update', ({ boardData, playerId }) => {
      if (playerId !== socketService.getSocketId()) {
        const canvas = fabricCanvasRef.current as unknown as { add: (obj: any) => void; clear: () => void; renderAll: () => void; backgroundColor: string };
        if (canvas) {
          canvas.clear();
          canvas.backgroundColor = '#0C6A35';
          fabric.loadSVGFromString(boardData, (objects: any[], options: any) => {
            const loadedObjects = fabric.util.groupSVGElements(objects, options);
            canvas.add(loadedObjects);
            canvas.renderAll();
          });
        }
      }
    });
  }, [canvasSize, sendBoardUpdate, submittedAnswer]);

  const resetCanvas = useCallback(() => {
    setCanvasKey(prev => prev + 1);
  }, []);

  const clearCanvas = useCallback(() => {
    if (fabricCanvasRef.current && !submittedAnswer) {
      fabricCanvasRef.current.clear();
      fabricCanvasRef.current.backgroundColor = '#0C6A35';
      fabricCanvasRef.current.renderAll();
      
      const svgData = fabricCanvasRef.current.toSVG();
      const roomCode = sessionStorage.getItem('roomCode');
      if (roomCode) {
        socketService.updateBoard(roomCode, svgData);
      }
    }
  }, [submittedAnswer]);

  const updateCanvasSize = useCallback((width: number, height: number) => {
    setCanvasSize({ width, height });
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.width = width;
      fabricCanvasRef.current.height = height;
      fabricCanvasRef.current.renderAll();
    }
  }, []);

  const setVisibility = useCallback((visible: boolean) => {
    setIsVisible(visible);
  }, []);

  const handleScale = useCallback((newScale: number) => {
    setScale(Math.max(0.1, Math.min(5, newScale)));
  }, []);

  const handlePan = useCallback((newPan: { x: number; y: number }) => {
    setPan(newPan);
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const value = {
    canvasKey,
    canvasSize,
    canvasInitialized,
    submittedAnswer,
    isVisible,
    scale,
    pan,
    canvasRef,
    fabricCanvasRef,
    boardContainerRef,
    initializeCanvas,
    resetCanvas,
    clearCanvas,
    updateCanvasSize,
    setSubmittedAnswer,
    setVisibility,
    handleScale,
    handlePan,
    handleReset
  };

  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
}; 