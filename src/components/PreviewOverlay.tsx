import React from 'react';

interface Player {
  id: string;
  name: string;
}
interface PlayerBoard {
  playerId: string;
  playerName?: string;
  boardData: string;
}
interface AnswerSubmission {
  answer: string;
  timestamp?: number;
}
interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

interface PreviewOverlayProps {
  players: Player[];
  playerBoards: PlayerBoard[];
  allAnswersThisRound: Record<string, AnswerSubmission>;
  evaluatedAnswers: Record<string, boolean | null>;
  previewMode: PreviewModeState;
  onFocus: (playerId: string) => void;
  onClose: () => void;
  isGameMaster?: boolean;
}

const PreviewOverlay: React.FC<PreviewOverlayProps> = ({
  players,
  playerBoards,
  allAnswersThisRound,
  evaluatedAnswers,
  previewMode,
  onFocus,
  onClose,
  isGameMaster = false,
}) => {
  if (!previewMode.isActive) return null;
  if (players.length === 0) {
    return (
      <div className="preview-mode-overlay" style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}>
        <div className="preview-content" style={{ background: '#fff', borderRadius: '8px', padding: '20px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', position: 'relative' }}>
          <h2 className="text-center mb-4">Round Preview</h2>
          <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-3">Waiting for players...</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="preview-mode-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="preview-content" style={{ background: '#fff', borderRadius: '8px', padding: '20px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', position: 'relative' }}>
        {/* Close button */}
        <button style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', fontSize: 32, cursor: 'pointer', zIndex: 10001 }} aria-label="Close Preview Mode" onClick={onClose}>×</button>
        <h2 className="text-center mb-4">Round Preview</h2>
        {previewMode.focusedPlayerId ? (
          // Focused view
          <div className="focused-submission">
            {(() => {
              const focusedPlayer = players.find(p => p.id === previewMode.focusedPlayerId);
              const focusedAnswer = allAnswersThisRound[previewMode.focusedPlayerId];
              const focusedBoard = playerBoards.find(b => b.playerId === previewMode.focusedPlayerId);
              const evalStatus = evaluatedAnswers?.[previewMode.focusedPlayerId];
              return (
                <>
                  <h3 className="text-center mb-3">{focusedPlayer?.name}</h3>
                  <div className="board-container" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', background: '#0C6A35', border: '8px solid #8B4513', borderRadius: '4px', overflow: 'hidden' }}>
                    {focusedBoard?.boardData ? (
                      <div dangerouslySetInnerHTML={{ __html: focusedBoard.boardData }} />
                    ) : (
                      <div className="text-center text-white p-4">No drawing submitted</div>
                    )}
                  </div>
                  <div className="answer-container mt-3 text-center">
                    <h4>Answer:</h4>
                    <p>{focusedAnswer?.answer || 'No answer submitted'}{' '}
                      {evalStatus === true && <span title="Correct" style={{ fontSize: '1.5em', color: 'green' }}>👍</span>}
                      {evalStatus === false && <span title="Incorrect" style={{ fontSize: '1.5em', color: 'red' }}>👎</span>}
                    </p>
                  </div>
                  <div className="navigation-controls mt-4" style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    {isGameMaster && (
                      <>
                        <button className="btn btn-outline-primary" onClick={() => {
                          const currentIndex = players.findIndex(p => p.id === previewMode.focusedPlayerId);
                          const prevIndex = (currentIndex - 1 + players.length) % players.length;
                          onFocus(players[prevIndex].id);
                        }}>Previous</button>
                        <button className="btn btn-outline-primary" onClick={() => {
                          const currentIndex = players.findIndex(p => p.id === previewMode.focusedPlayerId);
                          const nextIndex = (currentIndex + 1) % players.length;
                          onFocus(players[nextIndex].id);
                        }}>Next</button>
                        <button className="btn btn-outline-secondary" onClick={() => onFocus("")}>Back to Gallery</button>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          // Gallery view
          <div className="submissions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', padding: '20px' }}>
            {players.map(player => {
              const answer = allAnswersThisRound[player.id];
              const board = playerBoards.find(b => b.playerId === player.id);
              const evalStatus = evaluatedAnswers?.[player.id];
              return (
                <div key={player.id} className="submission-card" style={{ background: '#fff', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: isGameMaster ? 'pointer' : 'default' }} onClick={() => isGameMaster && onFocus(player.id)}>
                  <h4 className="text-center mb-3">{player.name}</h4>
                  <div className="board-preview" style={{ width: '100%', aspectRatio: '2/1', background: '#0C6A35', border: '4px solid #8B4513', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                    {board?.boardData ? (
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }} dangerouslySetInnerHTML={{ __html: board.boardData }} />
                    ) : (
                      <div className="text-center text-white p-4">No drawing submitted</div>
                    )}
                  </div>
                  <div className="answer-preview text-center">
                    <p className="mb-0">{answer?.answer || 'No answer submitted'}{' '}
                      {evalStatus === true && <span title="Correct" style={{ fontSize: '1.5em', color: 'green' }}>👍</span>}
                      {evalStatus === false && <span title="Incorrect" style={{ fontSize: '1.5em', color: 'red' }}>👎</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewOverlay; 