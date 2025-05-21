// Copy of PreviewOverlay for alternate design testing
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import type { Player } from '../../types/game';
import { useCanvas } from '../../contexts/CanvasContext';
import FabricJsonToSvg from '../shared/FabricJsonToSvg';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';
import { fabric } from 'fabric';
import { CHALKBOARD_BACKGROUND_COLOR } from '../../contexts/CanvasContext';

interface AnswerSubmission {
  persistentPlayerId: string;
  playerName: string;
  answer: string;
  timestamp?: number;
}

interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

interface PreviewOverlayProps {
  onFocus: (playerId: string) => void;
  onClose: () => void;
  isGameMaster: boolean;
  onEvaluate?: (playerId: string, isCorrect: boolean) => void;
}

const boardColors = [
  '#1976d2', // blue
  '#d32f2f', // red
  '#fbc02d', // yellow
  '#388e3c', // green
  '#7b1fa2', // purple
  '#f57c00', // orange
  '#0288d1', // cyan
  '#c2185b', // pink
  '#455a64', // gray
];

const tapeColors = [
  '#ffe066', '#ffd6e0', '#b5ead7', '#c7ceea', '#ffdac1', '#e2f0cb', '#f6dfeb', '#f7cac9', '#b5ead7', '#c9c9ff', '#f3ffe3', '#f7d6e0'
];

function getRandomTapeColor(idx: number) {
  // Deterministic per board idx for SSR/CSR consistency
  return tapeColors[idx % tapeColors.length];
}

const PreviewOverlayV2: React.FC<PreviewOverlayProps> = ({
  onFocus,
  onClose,
  isGameMaster,
  onEvaluate
}) => {
  const context = useGame();
  const { setDrawingEnabled } = useCanvas();
  const { language } = useLanguage();
  // Add state to store SVG strings for each player's board
  const [boardSvgs, setBoardSvgs] = useState<Record<string, string>>({});

  if (!context.previewMode.isActive) return null;

  // Iterate over active players, not just those with boards
  const displayablePlayers = context.players.filter(p => p.isActive && !p.isSpectator);

  useEffect(() => {
    setDrawingEnabled(false);
    return () => setDrawingEnabled(true);
  }, [setDrawingEnabled]);

  // Effect to generate SVG for each player's board data
  useEffect(() => {
    // Create a function to generate SVG from Fabric JSON data
    const generateSvg = async (boardData: string | undefined | null, playerId: string) => {
      if (!boardData) {
        // No board data, set empty SVG
        setBoardSvgs(prev => ({
          ...prev,
          [playerId]: ''
        }));
        return;
      }

      try {
        let tempCanvas: fabric.Canvas | null = null;
        const fabricJSON = JSON.parse(boardData);
          
        // Check if the board data is empty
        if (!fabricJSON.objects || fabricJSON.objects.length === 0) {
          console.log('[PreviewOverlayV2] Board data contains no objects, rendering empty SVG');
          setBoardSvgs(prev => ({
            ...prev,
            [playerId]: `<svg viewBox="0 0 800 400"><rect width="100%" height="100%" fill="${CHALKBOARD_BACKGROUND_COLOR}" /></svg>`
          }));
          return;
        }
          
        // Determine dimensions from JSON or use defaults
        const jsonWidth = fabricJSON.canvas?.width || fabricJSON.width;
        const jsonHeight = fabricJSON.canvas?.height || fabricJSON.height;

        const viewBoxWidth = jsonWidth || 800;
        const viewBoxHeight = jsonHeight || 400;

        const tempCanvasEl = document.createElement('canvas');
        tempCanvas = new fabric.Canvas(tempCanvasEl, {
          width: viewBoxWidth,
          height: viewBoxHeight,
          backgroundColor: CHALKBOARD_BACKGROUND_COLOR,
        });

        await new Promise<void>((resolve, reject) => {
          if (!tempCanvas) {
            reject(new Error("Temporary canvas not initialized"));
            return;
          }
          tempCanvas.loadFromJSON(fabricJSON, () => {
            if (!tempCanvas) {
              reject(new Error("Temporary canvas disposed during callback"));
              return;
            }
            
            tempCanvas.renderAll();
            tempCanvas.forEachObject(obj => {
              obj.selectable = false;
              obj.evented = false;
              
              // Removed eraser stroke detection and processing
            });

            const svg = tempCanvas.toSVG({
              viewBox: { x: 0, y: 0, width: viewBoxWidth, height: viewBoxHeight }
            });
            
            // Add chalkboard class to SVG
            const enhancedSvg = svg.replace('<svg ', '<svg class="chalkboard-drawing-svg" ');
            
            // Store the SVG string in state
            setBoardSvgs(prev => ({
              ...prev,
              [playerId]: enhancedSvg
            }));
            
            resolve();
          });
        }).catch(error => {
          console.error('[PreviewOverlayV2] Error generating SVG:', error);
          setBoardSvgs(prev => ({
            ...prev,
            [playerId]: `<svg viewBox="0 0 800 400"><text x="50%" y="50%" text-anchor="middle" fill="#ff0000">Error: ${error.message}</text></svg>`
          }));
        });

        // Clean up
        if (tempCanvas) {
          tempCanvas.dispose();
        }
      } catch (error: any) {
        console.error('[PreviewOverlayV2] Error parsing board data:', error);
        setBoardSvgs(prev => ({
          ...prev,
          [playerId]: `<svg viewBox="0 0 800 400"><text x="50%" y="50%" text-anchor="middle" fill="#ff0000">Error: ${error.message}</text></svg>`
        }));
      }
    };

    // Process each player's board data
    displayablePlayers.forEach(player => {
      const boardSubmission = context.playerBoards.find(b => b.playerId === player.id);
      if (boardSubmission) {
        generateSvg(boardSubmission.boardData, player.persistentPlayerId);
      }
    });
  }, [context.playerBoards, displayablePlayers]);

  const currentQuestion = context.currentQuestion;

  return (
    <div className="preview-overlay-v2 classroom-preview-overlay">
      {/* Close button overlays music button */}
      <button className="btn btn-danger classroom-preview-close-btn" onClick={onClose}>
        <i className="bi bi-x-lg"></i>
      </button>
      {/* Chalkboard question at the top, not absolutely positioned */}
      <div className="classroom-chalkboard" style={{ position: 'static', margin: '0 auto', left: 'unset', top: 'unset', width: '100%', maxWidth: 900, marginBottom: 48 }}>
        <div className="classroom-chalkboard-content">
          <div className="classroom-chalkboard-grade">
            {currentQuestion ? <><i className="bi bi-easel me-2"></i>{`${currentQuestion.grade}. ${t('class', language)} – ${currentQuestion.subject}`}</> : ''}
          </div>
          <div className="classroom-chalkboard-question">
            {currentQuestion ? <><i className="bi bi-chat-square-quote me-2"></i>{currentQuestion.text}</> : t('noQuestion', language)}
          </div>
        </div>
        {/* Removed sponge */}
      </div>
      {/* Player boards grid below chalkboard */}
      <div
        className="classroom-whiteboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${displayablePlayers.length <= 3 ? 380 : 320}px, 1fr))`,
          gap: displayablePlayers.length <= 3 ? 48 : 36,
          marginTop: 0,
          justifyItems: 'center',
          width: '100%',
          maxWidth: 1400,
        }}
      >
        {displayablePlayers.map((player, idx) => { // Iterate over displayablePlayers
          // Use player.id (which is the socket.id) to match PlayerBoard.playerId
          const boardSubmission = context.playerBoards.find(b => b.playerId === player.id);
          const actualBoardData = boardSubmission?.boardData;
          const answer = context.allAnswersThisRound[player.persistentPlayerId]; // Answers are keyed by persistentPlayerId
          const evaluation = context.evaluatedAnswers[player.persistentPlayerId]; // Evaluations are keyed by persistentPlayerId
          const borderColor = boardColors[idx % boardColors.length];
          const tapeColor = getRandomTapeColor(idx);
          return (
            <div
              key={player.persistentPlayerId} // Use player.persistentPlayerId as key
              className="classroom-whiteboard-card"
              style={{ borderColor, minWidth: displayablePlayers.length <= 3 ? 340 : 300, maxWidth: displayablePlayers.length <= 3 ? 420 : 400, minHeight: 260 }}
            >
              <div className="classroom-whiteboard-content">
                {/* Player lives - ensure this is visually separated and above drawing */}
                <div style={{
                  marginBottom: 8, 
                  textAlign: 'left', // Align hearts to the left within their own row
                  width: '100%', // Ensure it takes width for alignment
                  paddingLeft: '5px' // Small padding from left edge of card content
                }}>
                  {[...Array(player?.lives || 0)].map((_, i) => (
                    <span key={i} className="animated-heart" style={{ color: '#ff6b6b', fontSize: '1.3rem', marginRight: 3 }}>❤</span>
                  ))}
                </div>
                
                {/* Drawing Area with Chalkboard Background */}
                <div
                  className="classroom-whiteboard-svg" 
                  style={{
                    width: '100%',
                    aspectRatio: '2/1',
                    minHeight: '180px',
                    backgroundColor: CHALKBOARD_BACKGROUND_COLOR,
                    border: '4px solid #8B4513',
                    borderRadius: '8px',
                    boxShadow: 'inset 0 0 15px rgba(0,0,0,0.25)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {/* Direct SVG rendering instead of FabricJsonToSvg */}
                  <div 
                    className="svg-display-wrapper" 
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: boardSvgs[player.persistentPlayerId] || 
                        `<svg viewBox="0 0 800 400"><rect width="100%" height="100%" fill="${CHALKBOARD_BACKGROUND_COLOR}" /></svg>` 
                    }}
                  />
                </div>
                
                {/* Answer with notepad effect - Show if an answer submission exists, even if text is empty */}
                {answer !== undefined && (
                  <div className="notepad-answer mt-2 mb-2">
                    <span className="notepad-label">
                      <i className="bi bi-card-text me-1"></i>{t('answer', language)}:
                    </span>
                    <span className="notepad-text ms-2">
                      {answer.hasDrawing && !answer.answer ? t('drawingOnly', language) : (answer.answer || "-")}
                    </span>
                  </div>
                )}
                {/* Correct/Incorrect buttons for GameMaster - Show if a submission exists and is pending evaluation */}
                {isGameMaster && answer !== undefined && evaluation === undefined && onEvaluate && (
                  <div className="d-flex gap-2 justify-content-center mt-2">
                    <button 
                        className="btn btn-success btn-sm" 
                        onClick={() => onEvaluate(player.persistentPlayerId, true)} 
                        title={t('markAsCorrect', language)}
                    >
                        <i className="bi bi-check-circle-fill me-1"></i>{t('correct', language)}
                    </button>
                    <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => onEvaluate(player.persistentPlayerId, false)} 
                        title={t('markAsIncorrect', language)}
                    >
                        <i className="bi bi-x-circle-fill me-1"></i>{t('incorrect', language)}
                    </button>
                  </div>
                )}
                {/* Show badge if evaluated */}
                {evaluation !== undefined && (
                  <span 
                    className={`classroom-whiteboard-badge ${evaluation ? 'correct' : 'incorrect'}`}
                    style={{ 
                      animation: 'fadeInScale 0.3s ease-out'
                    }}
                  >
                    {evaluation ? 
                      <><i className="bi bi-patch-check-fill me-1"></i>{t('correct', language)}</> : 
                      <><i className="bi bi-patch-exclamation-fill me-1"></i>{t('incorrect', language)}</>
                    }
                  </span>
                )}
              </div>
              <div className="classroom-whiteboard-label">
                <span className="classroom-whiteboard-name"><i className="bi bi-person-fill me-2"></i>{player?.name || ''}</span>
                <span className="classroom-whiteboard-tape classroom-whiteboard-tape-left" style={{ background: tapeColor }} />
                <span className="classroom-whiteboard-tape classroom-whiteboard-tape-right" style={{ background: tapeColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PreviewOverlayV2; 