import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CanvasProvider, useCanvas } from '../../contexts/CanvasContext';
import { useGame } from '../../contexts/GameContext';
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
  const { canvas, initializeCanvas, loadFromJSON, getCanvasState } = useCanvas();
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
          // Update local reference of what we've sent
          setLastSentState(currentState);
          
          // Call the prop callback if provided
          if (onUpdate) {
            onUpdate({
              data: currentState,
              timestamp: Date.now()
            });
          }
          
          // Send to server directly
          socketService.updateBoard(roomCode, currentState);
          console.log('[DrawingBoard] Sent canvas update to server');
        }
      }
    }, 500); // Update every 500ms while drawing

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

    const handleMouseDown = () => {
      setIsDrawing(true);
    };

    const handleMouseUp = () => {
      setIsDrawing(false);
      
      // Send final state when stopped drawing
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
        console.log('[DrawingBoard] Sent final canvas update to server after drawing stopped');
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

  // Set canvas interactivity based on disabled prop
  useEffect(() => {
    if (!canvas) return;
    
    // Set canvas interactivity - disable if disabled or answer already submitted
    canvas.isDrawingMode = !disabled && !submittedAnswer;
    canvas.selection = !disabled && !submittedAnswer;
    canvas.interactive = !disabled && !submittedAnswer;
    
    // Also loop through objects and set them as not selectable if disabled
    canvas.forEachObject((obj: fabric.Object) => {
      obj.selectable = !disabled && !submittedAnswer;
      obj.evented = !disabled && !submittedAnswer;
    });
    
    canvas.renderAll();
  }, [canvas, disabled, submittedAnswer]);

  // Load initial board data if provided
  useEffect(() => {
    if (canvas && initialBoardData && !boardRestored) {
      loadFromJSON(initialBoardData);
      setBoardRestored(true);
      console.log('[DrawingBoard] Loaded initial board data provided via props');
    }
  }, [canvas, initialBoardData, loadFromJSON, boardRestored]);

  // Try to restore drawing from server on reconnect or question change
  useEffect(() => {
    if (!canvas || !roomCode || !persistentPlayerId || boardRestored) {
      return;
    }
    
    // Find player's own board data from the playerBoards list in GameContext
    const mySocketId = socketService.getSocketId();
    if (!mySocketId) {
      console.log('[DrawingBoard] No socket ID yet, cannot restore board');
      return;
    }

    // Look for my board matching current round
    const myBoard = playerBoards.find(b => 
      b.playerId === mySocketId && 
      (b.roundIndex === undefined || b.roundIndex === currentQuestionIndex)
    );
    
    if (myBoard && myBoard.boardData && myBoard.boardData !== '') {
      console.log('[DrawingBoard] Restoring saved drawing from server for the current round:', currentQuestionIndex);
      loadFromJSON(myBoard.boardData);
      setLastSentState(myBoard.boardData);
      setBoardRestored(true);
    } else {
      console.log('[DrawingBoard] No saved drawing found on server for this round');
      // Start with a fresh canvas
      if (canvas) {
        canvas.clear();
        canvas.renderAll();
      }
    }
  }, [canvas, roomCode, persistentPlayerId, connectionStatus, playerBoards, currentQuestionIndex, loadFromJSON, boardRestored]);

  // Reset the board when question changes
  useEffect(() => {
    if (!canvas) return;
    
    setBoardRestored(false); // Allow restoring from server for the new question
    
    // The actual restore will happen in the previous useEffect
    console.log('[DrawingBoard] Question changed, will attempt to restore drawing for new question');
  }, [canvas, currentQuestionIndex]);

  // Add drawing tools
  const clearCanvas = useCallback(() => {
    if (canvas) {
      canvas.clear();
      canvas.renderAll();
      
      // Send empty board to server
      if (roomCode && !disabled && !submittedAnswer) {
        const emptyState = '{"objects":[]}';
        setLastSentState(emptyState);
        if (onUpdate) {
          onUpdate({
            data: emptyState,
            timestamp: Date.now()
          });
        }
        socketService.updateBoard(roomCode, emptyState);
        console.log('[DrawingBoard] Sent clear canvas to server');
      }
    }
  }, [canvas, roomCode, disabled, submittedAnswer, onUpdate]);

  const setStrokeColor = useCallback((color: string) => {
    if (canvas) {
      canvas.freeDrawingBrush.color = color;
    }
  }, [canvas]);

  const setStrokeWidth = useCallback((width: number) => {
    if (canvas) {
      canvas.freeDrawingBrush.width = width;
    }
  }, [canvas]);

  return (
    <div className="drawing-board-container">
      {boardLabel && <div className="board-label">{boardLabel}</div>}
      <div className="canvas-container mb-2" ref={canvasContainerRef} style={{ height, width }}></div>
      
      {/* Use custom controls if provided, otherwise show default controls */}
      {controls ? controls : (
        !disabled && !submittedAnswer && (
          <div className="drawing-tools d-flex gap-2 mb-3">
            <div className="btn-group">
              <button type="button" className="btn btn-sm btn-light" onClick={() => setStrokeColor('#000')}>
                Black
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setStrokeColor('#0d6efd')}>
                Blue
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setStrokeColor('#dc3545')}>
                Red
              </button>
              <button type="button" className="btn btn-sm btn-success" onClick={() => setStrokeColor('#198754')}>
                Green
              </button>
            </div>
            
            <div className="btn-group">
              <button type="button" className="btn btn-sm btn-light" onClick={() => setStrokeWidth(2)}>
                Thin
              </button>
              <button type="button" className="btn btn-sm btn-light" onClick={() => setStrokeWidth(5)}>
                Medium
              </button>
              <button type="button" className="btn btn-sm btn-light" onClick={() => setStrokeWidth(10)}>
                Thick
              </button>
            </div>
            
            <button type="button" className="btn btn-sm btn-warning" onClick={clearCanvas}>
              Clear
            </button>
          </div>
        )
      )}

      {submittedAnswer && (
        <div className="alert alert-info">
          Drawing submitted! You cannot make further changes.
        </div>
      )}
    </div>
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