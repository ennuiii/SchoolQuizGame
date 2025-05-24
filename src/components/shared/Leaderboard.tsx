import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface LeaderboardPlayer {
  id: string;
  persistentPlayerId: string;
  name: string;
  score: number;
  streak: number;
  lives: number;
  lastPointsEarned: number | null;
  isActive: boolean;
  isSpectator: boolean;
}

interface LeaderboardProps {
  players: LeaderboardPlayer[];
  currentPlayerPersistentId?: string;
  showLives?: boolean;
  compact?: boolean;
  maxPlayers?: number;
  onScoreClick?: (playerId: string) => void;
  showAnimation?: boolean;
  isPointsMode?: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  players,
  currentPlayerPersistentId,
  showLives = true,
  compact = false,
  maxPlayers,
  onScoreClick,
  showAnimation = true,
  isPointsMode = false
}) => {
  const { language } = useLanguage();

  console.log(`[LEADERBOARD DEBUG] Component rendered with:`, {
    playersCount: players.length,
    currentPlayerPersistentId,
    showLives,
    compact,
    maxPlayers,
    hasScoreClickHandler: !!onScoreClick,
    players: players.map(p => ({
      name: p.name,
      score: p.score,
      streak: p.streak,
      lives: p.lives,
      persistentId: p.persistentPlayerId,
      isSpectator: p.isSpectator,
      isActive: p.isActive
    }))
  });

  // Sort players by score (descending), then by streak (descending)
  const sortedPlayers = [...players]
    .filter(player => !player.isSpectator) // Exclude spectators
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.streak - a.streak;
    })
    .slice(0, maxPlayers);

  console.log(`[LEADERBOARD DEBUG] After sorting and filtering:`, {
    sortedPlayersCount: sortedPlayers.length,
    sortedPlayers: sortedPlayers.map(p => ({
      name: p.name,
      score: p.score,
      streak: p.streak,
      rank: sortedPlayers.indexOf(p) + 1
    }))
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  const getRankBadgeClass = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-warning text-dark'; // Gold
      case 2: return 'bg-secondary text-white'; // Silver
      case 3: return 'bg-info text-dark'; // Bronze
      default: return 'bg-light text-dark';
    }
  };

  const getStreakDisplay = (streak: number) => {
    if (streak >= 5) return { text: streak, icon: '🔥', class: 'text-danger fw-bold' };
    if (streak >= 3) return { text: streak, icon: '⚡', class: 'text-warning fw-bold' };
    if (streak >= 1) return { text: streak, icon: '✅', class: 'text-success fw-bold' };
    return { text: streak, icon: '', class: 'text-muted' };
  };

  const getStreakMultiplier = (streak: number) => {
    if (streak >= 2) {
      return (1 + Math.min(streak, 5) * 0.5).toFixed(1);
    }
    return null;
  };

  const isCurrentPlayer = (persistentPlayerId: string) => {
    return persistentPlayerId === currentPlayerPersistentId;
  };

  if (sortedPlayers.length === 0) {
    return (
      <div className="card mb-3">
        <div className="card-header bg-light">
          <h6 className="mb-0">
            <span className="text-warning">🏆</span> {t('leaderboard.title', language)}
          </h6>
        </div>
        <div className="card-body text-center text-muted py-4">
          <p>{t('leaderboard.noPlayers', language)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard mb-3">
      <div className="card">
        <div className="card-header bg-light d-flex align-items-center justify-content-between">
          <h6 className="mb-0 fw-bold">
            <span className="text-warning">🏆</span> {t('leaderboard.title', language)}
          </h6>
          <small className="text-muted">
            {sortedPlayers.length} {t('leaderboard.players', language)}
          </small>
        </div>

        <div className="card-body p-0">
          <div className="list-group list-group-flush">
            {sortedPlayers.map((player, index) => {
              const rank = index + 1;
              const rankIcon = getRankIcon(rank);
              const streakDisplay = getStreakDisplay(player.streak);
              const streakMultiplier = getStreakMultiplier(player.streak);
              const isCurrent = isCurrentPlayer(player.persistentPlayerId);

              return (
                <div
                  key={player.persistentPlayerId}
                  className={`list-group-item d-flex align-items-center ${
                    isCurrent ? 'bg-primary bg-opacity-10 border-primary border-2' : ''
                  } ${!player.isActive ? 'opacity-50' : ''}`}
                  style={{ 
                    minHeight: compact ? '60px' : '80px',
                    cursor: onScoreClick ? 'pointer' : 'default'
                  }}
                  onClick={() => onScoreClick && onScoreClick(player.persistentPlayerId)}
                  title={onScoreClick ? 'Click to see points breakdown' : undefined}
                >
                  {/* Rank */}
                  <div className="me-3 text-center" style={{ minWidth: '50px' }}>
                    {rankIcon ? (
                      <span className="h4 mb-0">{rankIcon}</span>
                    ) : (
                      <span className={`badge ${getRankBadgeClass(rank)} fs-6 fw-bold`}>
                        #{rank}
                      </span>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <h6 className={`mb-1 ${isCurrent ? 'text-primary fw-bold' : 'text-dark'}`}>
                          {player.name}
                          {isCurrent && <span className="small text-primary ms-2 opacity-75">({t('leaderboard.you', language)})</span>}
                        </h6>
                        
                        {!compact && (
                          <div className="d-flex align-items-center gap-3 flex-wrap">
                            {/* Streak */}
                            <div className={`d-flex align-items-center gap-1 ${streakDisplay.class}`}>
                              <small className="fw-semibold text-muted">{t('points.streak', language)}:</small>
                              <span className="fw-bold">{streakDisplay.text}</span>
                              {streakDisplay.icon && <span>{streakDisplay.icon}</span>}
                              {streakMultiplier && (
                                <span className="badge bg-info text-dark ms-1 small">
                                  {streakMultiplier}x
                                </span>
                              )}
                            </div>
                            
                            {/* Lives - Hide in points mode */}
                            {showLives && !isPointsMode && (
                              <div className="d-flex align-items-center gap-1">
                                <small className="text-muted">{t('leaderboard.lives', language)}:</small>
                                <span className={`fw-semibold ${player.lives > 0 ? 'text-success' : 'text-danger'}`}>
                                  {player.lives}
                                  {player.lives > 0 && <span className="ms-1">💚</span>}
                                  {player.lives === 0 && <span className="ms-1">💀</span>}
                                </span>
                              </div>
                            )}

                            {/* Last Points Animation */}
                            {showAnimation && player.lastPointsEarned && player.lastPointsEarned > 0 && (
                              <div className="d-flex align-items-center">
                                <span className="badge bg-success text-white fw-bold animate__animated animate__pulse animate__infinite">
                                  +{player.lastPointsEarned.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Score Display */}
                      <div className="text-end">
                        <div className="d-flex flex-column align-items-end">
                          <h4 className={`mb-0 fw-bold ${isCurrent ? 'text-primary' : 'text-success'}`}>
                            {player.score.toLocaleString()}
                          </h4>
                          <small className="text-muted">{t('points.points', language)}</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="ms-2">
                    {!player.isActive && (
                      <span className="badge bg-secondary small">
                        {t('leaderboard.offline', language)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          {!compact && sortedPlayers.length > 0 && (
            <div className="card-footer bg-light">
              <div className="row text-center small">
                <div className="col-4">
                  <div className="text-muted">{t('leaderboard.topScore', language)}</div>
                  <div className="fw-bold text-success h6 mb-0">
                    {sortedPlayers[0].score.toLocaleString()}
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-muted">{t('leaderboard.avgScore', language)}</div>
                  <div className="fw-bold text-info h6 mb-0">
                    {Math.round(
                      sortedPlayers.reduce((sum, p) => sum + p.score, 0) / sortedPlayers.length
                    ).toLocaleString()}
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-muted">{t('leaderboard.activePlayers', language)}</div>
                  <div className="fw-bold text-primary h6 mb-0">
                    {sortedPlayers.filter(p => p.isActive).length}/{sortedPlayers.length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard; 