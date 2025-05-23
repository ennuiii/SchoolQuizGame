import React, { useState, memo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';
import Avatar from './Avatar';

interface PlayerManagementModalProps {
  show: boolean;
  onHide: () => void;
  player: {
    id: string;
    persistentPlayerId: string;
    name: string;
    lives: number;
    isActive: boolean;
    isSpectator: boolean;
    avatarSvg?: string;
  } | null;
  onAdjustLives: (playerId: string, adjustment: number) => void;
  isCommunityVotingMode: boolean;
}

const PlayerManagementModal: React.FC<PlayerManagementModalProps> = memo(({
  show,
  onHide,
  player,
  onAdjustLives,
  isCommunityVotingMode
}) => {
  const { language } = useLanguage();
  const [showRemoveLastLifeConfirm, setShowRemoveLastLifeConfirm] = useState(false);

  // Only log when modal is actually shown to reduce console spam
  if (show && player) {
    console.log('[PlayerManagementModal] Modal opened for player:', player.name, 'lives:', player.lives);
  }

  if (!show || !player) return null;

  const handleRemoveLife = () => {
    if (player.lives <= 1) {
      setShowRemoveLastLifeConfirm(true);
    } else {
      onAdjustLives(player.id, -1);
    }
  };

  const handleAddLife = () => {
    onAdjustLives(player.id, 1);
  };

  const confirmRemoveLastLife = () => {
    onAdjustLives(player.id, -1);
    setShowRemoveLastLifeConfirm(false);
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content player-management-modal">
          <div className="modal-header">
            <h5 className="modal-title">{t('playerManagement.title', language)}</h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          <div className="modal-body">
            <div className="d-flex align-items-center mb-4">
              <div className="me-3">
                <Avatar 
                  persistentPlayerId={player.persistentPlayerId} 
                  size={80} 
                />
              </div>
              <div>
                <h6 className="mb-1 player-name">{player.name}</h6>
                {player.isSpectator && (
                  <span className="badge bg-secondary rounded-pill">{t('spectator', language)}</span>
                )}
                {!player.isActive && (
                  <span className="badge bg-warning rounded-pill">{t('disconnected', language)}</span>
                )}
              </div>
            </div>

            {!isCommunityVotingMode && (
              <div className="lives-management">
                <h6 className="mb-3 lives-title">{t('playerManagement.lives', language)}</h6>
                <div className="d-flex align-items-center mb-3">
                  <div className="lives-display me-3">
                    {[...Array(player.lives)].map((_, i) => (
                      <span key={i} className="life animated-heart" role="img" aria-label="heart">❤</span>
                    ))}
                  </div>
                  <div className="btn-group">
                    <button 
                      className="btn btn-outline-danger"
                      onClick={handleRemoveLife}
                      disabled={player.lives <= 0}
                    >
                      {t('playerManagement.removeLife', language)}
                    </button>
                    <button 
                      className="btn btn-outline-success"
                      onClick={handleAddLife}
                    >
                      {t('playerManagement.addLife', language)}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              {t('close', language)}
            </button>
          </div>
        </div>
      </div>

      {/* Remove Last Life Confirmation Modal */}
      {showRemoveLastLifeConfirm && (
        <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content player-management-modal">
              <div className="modal-header">
                <h5 className="modal-title warning-title">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {t('playerManagement.confirmRemoveLastLife', language)}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowRemoveLastLifeConfirm(false)}></button>
              </div>
              <div className="modal-body">
                <div className="warning-message">
                  <p>{t('playerManagement.confirmRemoveLastLifeMessage', language)}</p>
                  <div className="warning-heart">
                    <span className="animated-heart" role="img" aria-label="heart">❤</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRemoveLastLifeConfirm(false)}>
                  {t('cancel', language)}
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmRemoveLastLife}>
                  {t('confirm', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PlayerManagementModal; 