import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CanvasProvider, useCanvas } from '../../contexts/CanvasContext';
import { useGame } from '../../contexts/GameContext';
import type { PlayerBoard } from '../../types/game';
import { useRoom } from '../../contexts/RoomContext';
import socketService from '../../services/socketService';
import { fabric } from 'fabric';

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
          socketService.updateBoard(roomCode, currentState);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [canvas, getCanvasState, isDrawing, gameStarted, gameOver, disabled, submittedAnswer, roomCode, lastSentState, onUpdate, connectionStatus]);

  // Initialize canvas
  useEffect(() => {
    if (canvasContainerRef.current && !canvas) {
      initializeCanvas(canvasContainerRef.current, width, height);
    }
  }, [canvas, initializeCanvas, width, height]);

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
        socketService.updateBoard(roomCode, currentState);
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
      socketService.updateBoard(roomCode, emptyState);
    }
  }, [clear, roomCode, disabled, submittedAnswer, onUpdate]);

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
            Drawing submitted! You cannot make further changes.
          </div>
        )}
      </div>

      {/* Controls are now OUTSIDE the drawing-board-container */}
      {controls ? controls : (
        !disabled && !submittedAnswer && (
          <div className="drawing-board-external-controls d-flex justify-content-end w-100 mt-2 mb-2">
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
              Clear Canvas
            </button>
          </div>
        )
      )}
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