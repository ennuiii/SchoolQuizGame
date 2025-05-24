import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useRoom } from '../../contexts/RoomContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';
import Avatar from './Avatar';
import PlayerManagementModal from './PlayerManagementModal';
import socketService from '../../services/socketService';
import type { Player } from '../../types/game';

interface PlayerListProps {
  persistentPlayerId?: string;
  onPlayerSelect?: (playerId: string) => void;
  selectedPlayerId?: string;
  title?: string;
  onKickPlayer?: (playerId: string) => void;
  isGameMasterView?: boolean;
}

const PlayerList: React.FC<PlayerListProps> = ({
  persistentPlayerId: propPersistentPlayerId,
  onPlayerSelect,
  selectedPlayerId,
  title = t('players', 'en'),
  onKickPlayer,
  isGameMasterView = false
}) => {
  const { players, allAnswersThisRound, isCommunityVotingMode } = useGame();
  const { persistentPlayerId: contextPersistentPlayerId, roomCode } = useRoom();
  const { language } = useLanguage();
  const actualPersistentPlayerId = propPersistentPlayerId || contextPersistentPlayerId;
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [playerToKick, setPlayerToKick] = useState<Player | null>(null);

  // Effect to update selectedPlayer state if the player data changes in the context
  useEffect(() => {
    if (selectedPlayer && players.length > 0) {
      const updatedPlayerFromContext = players.find(p => p.persistentPlayerId === selectedPlayer.persistentPlayerId);
      if (updatedPlayerFromContext && 
          (updatedPlayerFromContext.lives !== selectedPlayer.lives || 
           updatedPlayerFromContext.isActive !== selectedPlayer.isActive ||
           updatedPlayerFromContext.isSpectator !== selectedPlayer.isSpectator
          )
         ) {
        console.log('[PlayerList] Selected player data updated in context. Updating local state:', updatedPlayerFromContext);
        setSelectedPlayer(updatedPlayerFromContext);
      }
    }
  }, [players, selectedPlayer]); // Re-run when players array or selectedPlayer (local) changes

  // Effect to ensure avatars are loaded for all players
  useEffect(() => {
    // Only run this effect if we have a stable room connection and players
    if (players.length === 0 || !roomCode || socketService.getConnectionState() !== 'connected') {
      return;
    }

    // Use a timeout to debounce this effect and prevent excessive calls
    const timeoutId = setTimeout(() => {
      let broadcastCount = 0;
      const maxBroadcasts = 3; // Limit broadcasts per effect run
      
      players.forEach(player => {
        // Only broadcast if player doesn't have an avatar in room context AND we haven't exceeded broadcast limit
        if (!player.avatarSvg && player.persistentPlayerId && broadcastCount < maxBroadcasts) {
          const localAvatar = localStorage.getItem(`avatar_${player.persistentPlayerId}`);
          if (localAvatar) {
            console.log('[PlayerList] Found missing avatar in localStorage for', player.persistentPlayerId, 'broadcasting to room');
            socketService.emit('update_avatar', { 
              roomCode, 
              persistentPlayerId: player.persistentPlayerId, 
              avatarSvg: localAvatar 
            });
            broadcastCount++;
          }
        }
      });
      
      if (broadcastCount > 0) {
        console.log(`[PlayerList] Broadcasted ${broadcastCount} missing avatars to room`);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [players.length, roomCode]); // Only depend on players.length and roomCode, not the entire players array

  const handlePlayerClick = (player: Player) => {
    if (isGameMasterView && !isCommunityVotingMode) {
      setSelectedPlayer(player);
      setShowManagementModal(true);
    } else if (onPlayerSelect) {
      onPlayerSelect(player.persistentPlayerId);
    }
  };

  const handleAdjustLives = async (playerId: string, adjustment: number) => {
    if (!roomCode) return;
    try {
      await socketService.adjustPlayerLives(roomCode, playerId, adjustment);
    } catch (error) {
      console.error('[PlayerList] Error adjusting player lives:', error);
    }
  };

  // Debug logging for kick button visibility conditions
  React.useEffect(() => {
    if (isGameMasterView && onKickPlayer) {
      console.log('[PlayerList] Conditions for kick buttons:', {
        isGameMasterView,
        hasKickFunction: !!onKickPlayer,
        playerCount: players.length,
        actualPersistentPlayerId,
        playersWithKickButtons: players.filter(p => p.persistentPlayerId !== actualPersistentPlayerId).length,
        players: players.map(p => ({ 
          id: p.id, 
          persistentId: p.persistentPlayerId, 
          name: p.name, 
          shouldHaveKickButton: p.persistentPlayerId !== actualPersistentPlayerId
        }))
      });
    }
  }, [players, isGameMasterView, onKickPlayer, actualPersistentPlayerId]);

  // Additional debugging in the render
  React.useEffect(() => {
    // Log any bootstrap icon visibility issues - the kick button uses bootstrap icon
    console.log('[PlayerList] Document body has bootstrap-icons class:', document.body.classList.contains('bootstrap-icons'));
  }, []);

  const handleKickClick = (e: React.MouseEvent, player: Player) => {
    e.stopPropagation();
    setPlayerToKick(player);
  };

  const handleConfirmKick = () => {
    if (playerToKick && onKickPlayer) {
      onKickPlayer(playerToKick.id);
    }
    setPlayerToKick(null);
  };

  const handleCancelKick = () => {
    setPlayerToKick(null);
  };

  return (
    <>
      <div className="card mb-3">
        <div className="card-header bg-light">
          <h6 className="mb-0">{title}</h6>
        </div>
        <div className="card-body p-0">
          <div className="list-group list-group-flush player-list">
            {players.length === 0 ? (
              <div className="list-group-item text-center text-muted py-3">
                {t('noPlayers', language)}
              </div>
            ) : (
              players.map(player => {
                const shouldShowKickButton = isGameMasterView && !!onKickPlayer;
                const hasSubmittedAnswer = Boolean(allAnswersThisRound[player.persistentPlayerId]);
                
                return (
                  <div
                    key={player.persistentPlayerId}
                    className={`list-group-item d-flex justify-content-between align-items-center py-3 ${
                      player.persistentPlayerId === actualPersistentPlayerId ? 'bg-highlight' : ''
                    } ${selectedPlayerId === player.persistentPlayerId ? 'active' : ''}`}
                    onClick={() => handlePlayerClick(player)}
                    style={{ cursor: onPlayerSelect || (isGameMasterView && !isCommunityVotingMode) ? 'pointer' : 'default' }}
                  >
                    <div className="d-flex align-items-center">
                      <div className="me-3">
                        <Avatar 
                          persistentPlayerId={player.persistentPlayerId} 
                          size={80} 
                        />
                      </div>
                      <div>
                        <div className="d-flex align-items-center">
                          <span className="me-2">{player.name}</span>
                          {player.persistentPlayerId === actualPersistentPlayerId && !isGameMasterView && (
                            <span className="badge bg-primary rounded-pill ms-1">{t('you', language)}</span>
                          )}
                          {player.isSpectator && (
                            <span className="badge bg-secondary rounded-pill ms-1">{t('spectator', language)}</span>
                          )}
                          {player.isEliminated && !player.isSpectator && (
                            <span className="badge bg-danger rounded-pill ms-1">{t('eliminated', language)}</span>
                          )}
                          {!player.isActive && !player.isEliminated && (
                            <span className="badge bg-warning rounded-pill ms-1">{t('disconnected', language)}</span>
                          )}
                          {hasSubmittedAnswer && !player.isSpectator && player.isActive && (
                            <span className="badge bg-success rounded-pill ms-1">{t('submitted', language)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="d-flex align-items-center">
                      {!player.isSpectator && (
                        <div className="lives-display me-2">
                          {[...Array(player.lives)].map((_, i) => (
                            <span key={i} className="life" role="img" aria-label="heart">❤</span>
                          ))}
                          {player.isEliminated && player.lives === 0 && (
                            <span className="text-muted">💀</span>
                          )}
                        </div>
                      )}
                      {shouldShowKickButton && (
                        <button 
                          className="btn btn-danger btn-sm ms-2 fw-bold" 
                          onClick={(e) => handleKickClick(e, player)}
                          title={t('kickPlayer', language).replace('{name}', player.name)}
                          aria-label={t('kickPlayer', language).replace('{name}', player.name)}
                          style={{minWidth: '60px'}}
                        >
                          {t('kick', language)}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Kick Confirmation Modal */}
      {playerToKick && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content player-management-modal">
              <div className="modal-header">
                <h5 className="modal-title warning-title">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {t('confirmKick', language)}
                </h5>
              </div>
              <div className="modal-body text-center">
                <div className="warning-message">
                  <p className="mb-4">
                    {t('kickConfirmation', language).replace('{name}', playerToKick.name)}
                  </p>
                  <div className="warning-heart">
                    <i className="bi bi-heart-fill"></i>
                  </div>
                </div>
              </div>
              <div className="modal-footer justify-content-center">
                <button 
                  className="btn btn-outline-danger me-2" 
                  onClick={handleConfirmKick}
                >
                  {t('yes', language)}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCancelKick}
                >
                  {t('no', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PlayerManagementModal
        show={showManagementModal}
        onHide={() => setShowManagementModal(false)}
        player={selectedPlayer}
        onAdjustLives={handleAdjustLives}
        isCommunityVotingMode={isCommunityVotingMode}
      />
    </>
  );
};

export default PlayerList; 