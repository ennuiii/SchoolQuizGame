import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useRoom } from '../../contexts/RoomContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';
import Avatar from './Avatar';

interface Player {
  id: string;
  persistentPlayerId: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator?: boolean;
}

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
  const { players, allAnswersThisRound } = useGame();
  const { persistentPlayerId: contextPersistentPlayerId } = useRoom();
  const { language } = useLanguage();
  const actualPersistentPlayerId = propPersistentPlayerId || contextPersistentPlayerId;

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

  return (
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
              // Always show kick button for GameMaster view, regardless of other conditions
              const shouldShowKickButton = isGameMasterView && !!onKickPlayer;
              // Check if player has submitted an answer for the current question
              const hasSubmittedAnswer = Boolean(allAnswersThisRound[player.persistentPlayerId]);
              
              if (isGameMasterView && onKickPlayer) {
                console.log(`[PlayerList] Player ${player.name} (${player.persistentPlayerId}) kick button:`, {
                  shouldShow: shouldShowKickButton,
                  isGameMaster: isGameMasterView,
                  hasKickFn: !!onKickPlayer
                });
              }
              
              return (
                <div
                  key={player.persistentPlayerId}
                  className={`list-group-item d-flex justify-content-between align-items-center py-3 ${
                    player.persistentPlayerId === actualPersistentPlayerId ? 'bg-highlight' : ''
                  } ${selectedPlayerId === player.persistentPlayerId ? 'active' : ''}`}
                  onClick={() => onPlayerSelect?.(player.persistentPlayerId)}
                  style={{ cursor: onPlayerSelect ? 'pointer' : 'default' }}
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
                        {!player.isActive && (
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
                      </div>
                    )}
                    {shouldShowKickButton && (
                      <button 
                        className="btn btn-danger btn-sm ms-2 fw-bold" 
                        onClick={(e) => { 
                          e.stopPropagation();
                          console.log(`[PlayerList] Kick button clicked for ${player.name} - Socket ID: ${player.id}`, {
                            playerDetails: {
                              id: player.id,  // Socket ID
                              persistentId: player.persistentPlayerId,
                              name: player.name,
                              isSpectator: player.isSpectator
                            }
                          });
                          // Use socket ID (player.id) instead of persistentPlayerId for kicking
                          onKickPlayer(player.id); 
                        }}
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
  );
};

export default PlayerList; 