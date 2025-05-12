import React from 'react';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
}

interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

interface AnswerSubmission {
  playerId: string;
  playerName: string;
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
  isGameMaster: boolean;
}

const PreviewOverlay: React.FC<PreviewOverlayProps> = ({
  players,
  playerBoards,
  allAnswersThisRound,
  evaluatedAnswers,
  previewMode,
  onFocus,
  onClose,
  isGameMaster
}) => {
  if (!previewMode.isActive) return null;

  const currentIndex = previewMode.focusedPlayerId 
    ? playerBoards.findIndex(board => board.playerId === previewMode.focusedPlayerId)
    : -1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onFocus(playerBoards[currentIndex - 1].playerId);
    }
  };

  const handleNext = () => {
    if (currentIndex < playerBoards.length - 1) {
      onFocus(playerBoards[currentIndex + 1].playerId);
    }
  };

  return (
    <div className="preview-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      zIndex: 1000,
      padding: '20px',
      overflow: 'auto'
    }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Preview Mode</h2>
        <button className="btn btn-primary" onClick={onClose}>
          Close Preview
        </button>
      </div>

      {previewMode.focusedPlayerId ? (
        <div className="focused-submission">
          {playerBoards
            .filter(board => board.playerId === previewMode.focusedPlayerId)
            .map(board => {
              const player = players.find(p => p.id === board.playerId);
              const answer = allAnswersThisRound[board.playerId];
              const evaluation = evaluatedAnswers[board.playerId];
              
              return (
                <div key={board.playerId} className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <button 
                        className="btn btn-outline-primary me-3"
                        onClick={handlePrevious}
                        disabled={currentIndex <= 0}
                      >
                        ← Previous
                      </button>
                      <h3 className="mb-0">{board.playerName}</h3>
                      <button 
                        className="btn btn-outline-primary ms-3"
                        onClick={handleNext}
                        disabled={currentIndex >= playerBoards.length - 1}
                      >
                        Next →
                      </button>
                    </div>
                    <div>
                      <span className="me-3">
                        {Array.from({length: player?.lives || 0}, (_, i) => (
                          <span key={i} className="text-danger me-1">❤</span>
                        ))}
                      </span>
                      {evaluation !== undefined && (
                        <span className={`badge ${evaluation ? 'bg-success' : 'bg-danger'}`}>
                          {evaluation ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="card-body">
                    {answer && (
                      <div className="mb-4">
                        <h4>Answer:</h4>
                        <p className="lead">{answer.answer}</p>
                      </div>
                    )}
                    <div
                      className="board-container d-flex justify-content-center align-items-center preview-board-clickable"
                      style={{
                        width: '100%',
                        maxWidth: '800px',
                        height: 'auto',
                        maxHeight: '400px',
                        aspectRatio: '2/1',
                        backgroundColor: '#0C6A35',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '12px solid #8B4513',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                        margin: '0 auto',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s, border-color 0.2s'
                      }}
                      onClick={() => onFocus(board.playerId)}
                      title="Click to enlarge"
                    >
                      <div
                        className="drawing-board"
                        dangerouslySetInnerHTML={{ __html: board.boardData || '' }}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: 0,
                          minWidth: 0,
                          objectFit: 'contain',
                          transform: 'scale(1)',
                          transformOrigin: 'top left'
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="row">
          {playerBoards.map(board => {
            const player = players.find(p => p.id === board.playerId);
            const answer = allAnswersThisRound[board.playerId];
            const evaluation = evaluatedAnswers[board.playerId];
            
            return (
              <div key={board.playerId} className="col-md-6 mb-4">
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h4 className="mb-0">{board.playerName}</h4>
                    <div>
                      <span className="me-3">
                        {Array.from({length: player?.lives || 0}, (_, i) => (
                          <span key={i} className="text-danger me-1">❤</span>
                        ))}
                      </span>
                      {evaluation !== undefined && (
                        <span className={`badge ${evaluation ? 'bg-success' : 'bg-danger'}`}>
                          {evaluation ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="card-body">
                    {answer && (
                      <div className="mb-3">
                        <p className="mb-1"><strong>Answer:</strong> {answer.answer}</p>
                      </div>
                    )}
                    <div
                      className="board-container d-flex justify-content-center align-items-center preview-board-clickable"
                      style={{
                        width: '100%',
                        maxWidth: '800px',
                        height: 'auto',
                        maxHeight: '400px',
                        aspectRatio: '2/1',
                        backgroundColor: '#0C6A35',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '12px solid #8B4513',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                        margin: '0 auto',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s, border-color 0.2s'
                      }}
                      onClick={() => onFocus(board.playerId)}
                      title="Click to enlarge"
                    >
                      <div
                        className="drawing-board"
                        dangerouslySetInnerHTML={{ __html: board.boardData || '' }}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: 0,
                          minWidth: 0,
                          objectFit: 'contain',
                          transform: 'scale(1)',
                          transformOrigin: 'top left'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PreviewOverlay; 