import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlayV2 from '../components/shared/PreviewOverlayV2';
import { useGame } from '../contexts/GameContext';
import { useRoom } from '../contexts/RoomContext';
import QuestionDisplayCard from '../components/shared/QuestionDisplayCard';
import RecapModal from '../components/shared/RecapModal';
import SettingsControl from '../components/shared/SettingsControl';
import { useAudio } from '../contexts/AudioContext';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n';

const Spectator: React.FC = () => {
  const navigate = useNavigate();
  const { playBackgroundMusic } = useAudio();
  const { language } = useLanguage();
  
  const {
    gameStarted,
    currentQuestion,
    players,
    playerBoards,
    visibleBoards,
    previewMode,
    previewOverlayVersion,
    toggleBoardVisibility,
    isGameConcluded,
    gameRecapData,
    recapSelectedRoundIndex,
    recapSelectedTabKey,
    hideRecap
  } = useGame();

  const {
    roomCode,
    playerName,
    connectionStatus,
  } = useRoom();

  useEffect(() => {
    playBackgroundMusic();
  }, [playBackgroundMusic]);

  // Handle reconnection
  useEffect(() => {
    if (connectionStatus === 'connected' && roomCode) {
      console.log('[Spectator] Connected with room code, attempting to rejoin:', roomCode);
      
      // Rejoin the room
      socketService.rejoinRoom(roomCode, false); // false = not GM
      
      // Request current state
      socketService.requestGameState(roomCode);
      socketService.requestPlayers(roomCode);
    }
  }, [connectionStatus, roomCode]);

  const handleJoinAsPlayer = useCallback(() => {
    if (!roomCode || !playerName) return;
    sessionStorage.setItem('isSpectator', 'false');
    socketService.setPlayerDetails(playerName);
    socketService.disconnect();
    navigate('/player');
  }, [roomCode, playerName, navigate]);

  const showAllBoards = useCallback(() => {
    const activePlayerIds = players
      .filter(p => !p.isSpectator && p.isActive)
      .map(p => p.id);
    toggleBoardVisibility(new Set(activePlayerIds));
  }, [players, toggleBoardVisibility]);

  const hideAllBoardsAction = useCallback(() => {
    toggleBoardVisibility(new Set());
  }, [toggleBoardVisibility]);

  if (isGameConcluded && !gameRecapData) {
    return (
      <div className="container text-center mt-5">
        <div className="card p-5">
          <h2 className="h4 mb-3">{t('spectatorPage.gameOver', language)}</h2>
          <p>{t('spectatorPage.waitingForRecap', language)}</p>
          <div className="spinner-border text-primary mx-auto mt-3" role="status">
            <span className="visually-hidden">{t('loading', language)}</span>
          </div>
          <button className="btn btn-outline-secondary mt-4" onClick={() => navigate('/')}>{t('spectatorPage.backToHome', language)}</button>
        </div>
      </div>
    );
  }

  if (gameRecapData && roomCode && hideRecap) {
    return (
      <RecapModal
        show={!!gameRecapData}
        onHide={() => hideRecap()}
        recap={gameRecapData}
        selectedRoundIndex={recapSelectedRoundIndex ?? 0}
        isControllable={false}
        activeTabKey={recapSelectedTabKey}
      />
    );
  }

  return (
    <>
      <SettingsControl />
      <div className="container-fluid px-2 px-md-4 py-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
          <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
            <span className="bi bi-eye section-icon" aria-label="Spectator"></span>
            {t('spectatorPage.spectatorView', language)} {roomCode && <small className="text-muted"> (Room: {roomCode})</small>}
          </div>
        </div>
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <PlayerList title={t('spectatorPage.players', language)} />
            <div className="d-grid gap-2 mt-3">
              <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>{t('spectatorPage.leaveGame', language)}</button>
              <button
                className="btn btn-success"
                onClick={handleJoinAsPlayer}
                disabled={gameStarted}
                title={gameStarted ? t('spectatorPage.joinAsPlayerInfo', language) : ''}
              >
                {t('spectatorPage.joinAsPlayer', language)}
              </button>
              {gameStarted && (
                <div className="text-muted small mt-1">
                  {t('spectatorPage.joinAsPlayerInfo', language)}
                </div>
              )}
            </div>
          </div>
          <div className="col-12 col-md-8">
            <QuestionDisplayCard question={currentQuestion} showAnswer={false} title={currentQuestion ? t('spectatorPage.currentQuestion', language) : t('spectatorPage.waitingForGame', language)} />
            {gameStarted && currentQuestion && (
              <div className="card mb-4">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">{t('spectatorPage.playerBoards', language)}</h5>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={showAllBoards}>{t('spectatorPage.showAll', language)}</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={hideAllBoardsAction}>{t('spectatorPage.hideAll', language)}</button>
                  </div>
                </div>
                <div className="card-body">
                  <div
                    className="board-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                      gap: '20px',
                      width: '100%',
                      overflowX: 'auto',
                      alignItems: 'stretch',
                    }}
                  >
                    {players
                      .filter(player => !player.isSpectator && player.isActive)
                      .map(player => {
                        const boardEntry = playerBoards.find(b => b.playerId === player.id);
                        if (!boardEntry) return null;
                        
                        return (
                          <PlayerBoardDisplay
                            key={player.id}
                            board={{
                              playerId: player.id,
                              playerName: player.name,
                              boardData: boardEntry.boardData
                            }}
                            isVisible={visibleBoards.has(player.id)}
                            onToggleVisibility={() => toggleBoardVisibility(player.id)}
                            transform={{ scale: 1, x: 0, y: 0 }}
                            onScale={() => {}}
                            onPan={() => {}}
                            onReset={() => {}}
                          />
                        );
                    })}
                  </div>
                </div>
              </div>
            )}
            {previewMode.isActive && (
              <PreviewOverlayV2 onClose={() => {}} onFocus={() => {}} isGameMaster={false} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Spectator; 