import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';
import TabNavigation from './settings/TabNavigation';
import GamemodesTab from './settings/GamemodesTab';
import QuestionConfigTab from './settings/QuestionConfigTab';
import TimerSettingsTab from './settings/TimerSettingsTab';
import PreviewmodeTab from './settings/PreviewmodeTab';
import PointsLivesTab from './settings/PointsLivesTab';
import CommunityVotingTab from './settings/CommunityVotingTab';
import PlayerAnsweringTab from './settings/PlayerAnsweringTab';
import JokerTab from './settings/JokerTab';

export type TabType = 'gamemodes' | 'questions' | 'timer' | 'preview' | 'points' | 'voting' | 'answering' | 'joker';

export interface GameSettingsState {
  // Gamemode settings
  isPointsMode: boolean;
  isCommunityVotingMode: boolean;
  isStreamerMode: boolean;
  
  // Timer settings
  timeLimit: number | null;
  questionTimeLimit: number | null;
  
  // Points and Lives settings
  initialLives: number;
  pointsPerCorrectAnswer: number;
  bonusPointsForSpeed: boolean;
  
  // Community Voting settings
  votingTimeLimit: number;
  allowMultipleVotes: boolean;
  
  // Player Answering settings
  allowDrawingAnswers: boolean;
  allowTextAnswers: boolean;
  maxAnswerLength: number;
  
  // Joker settings
  enableJokers: boolean;
  jokersPerPlayer: number;
  
  // Preview settings
  enablePreviewMode: boolean;
  autoSwitchPlayers: boolean;
}

const defaultSettings: GameSettingsState = {
  isPointsMode: false,
  isCommunityVotingMode: false,
  isStreamerMode: false,
  timeLimit: null,
  questionTimeLimit: null,
  initialLives: 3,
  pointsPerCorrectAnswer: 100,
  bonusPointsForSpeed: true,
  votingTimeLimit: 30,
  allowMultipleVotes: false,
  allowDrawingAnswers: true,
  allowTextAnswers: true,
  maxAnswerLength: 100,
  enableJokers: false,
  jokersPerPlayer: 2,
  enablePreviewMode: false,
  autoSwitchPlayers: true,
};

interface GameSettingsProps {
  onSettingsChange: (settings: GameSettingsState) => void;
  onStartGame: () => void;
  initialSettings?: Partial<GameSettingsState>;
}

/**
 * Main GameSettings component that manages all game configuration options
 * Displayed before the game starts, replaced by game controls once game begins
 */
const GameSettings: React.FC<GameSettingsProps> = ({ 
  onSettingsChange, 
  onStartGame, 
  initialSettings = {} 
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('gamemodes');
  const [settings, setSettings] = useState<GameSettingsState>({
    ...defaultSettings,
    ...initialSettings
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /**
   * Handle settings update from any tab
   */
  const handleSettingsUpdate = (partialSettings: Partial<GameSettingsState>) => {
    const newSettings = { ...settings, ...partialSettings };
    setSettings(newSettings);
    setHasUnsavedChanges(true);
    onSettingsChange(newSettings);
  };

  /**
   * Apply settings and start the game
   */
  const handleStartGame = () => {
    onStartGame();
    setHasUnsavedChanges(false);
  };

  /**
   * Reset all settings to defaults
   */
  const handleResetToDefaults = () => {
    if (window.confirm(t('gameSettings.confirmReset', language))) {
      setSettings(defaultSettings);
      setHasUnsavedChanges(true);
      onSettingsChange(defaultSettings);
    }
  };

  /**
   * Render the content of the currently active tab
   */
  const renderTabContent = () => {
    const commonProps = {
      settings,
      onSettingsChange: handleSettingsUpdate,
      language
    };

    switch (activeTab) {
      case 'gamemodes':
        return <GamemodesTab {...commonProps} />;
      case 'questions':
        return <QuestionConfigTab {...commonProps} />;
      case 'timer':
        return <TimerSettingsTab {...commonProps} />;
      case 'preview':
        return <PreviewmodeTab {...commonProps} />;
      case 'points':
        return <PointsLivesTab {...commonProps} />;
      case 'voting':
        return <CommunityVotingTab {...commonProps} />;
      case 'answering':
        return <PlayerAnsweringTab {...commonProps} />;
      case 'joker':
        return <JokerTab {...commonProps} />;
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <div className="game-settings">
      {/* Enhanced Header */}
      <div className="card border-0 shadow-lg mb-4" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="card-body text-white">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1 className="mb-1 fw-bold">
                <i className="bi bi-gear-fill me-3"></i>
                {t('gameSettings.title', language)}
              </h1>
              <p className="mb-0 opacity-75">
                Configure your game settings and start when ready
              </p>
            </div>
            <div className="col-md-4 text-md-end">
              <div className="d-flex flex-column flex-md-row gap-2 justify-content-md-end">
                <button 
                  className="btn btn-light btn-sm"
                  onClick={handleResetToDefaults}
                  title={t('gameSettings.resetToDefaults', language)}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Reset
                </button>
                <button 
                  className="btn btn-success btn-lg fw-bold"
                  onClick={handleStartGame}
                  style={{ minWidth: '150px' }}
                >
                  <i className="bi bi-play-circle-fill me-2"></i>
                  {t('gameSettings.startGame', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Tab Navigation */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-0">
          <TabNavigation 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            language={language}
          />
        </div>
      </div>

      {/* Enhanced Tab Content */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="tab-content">
            <div className="tab-pane active">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="alert alert-warning border-0 shadow-sm mt-3 d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <small className="mb-0">{t('gameSettings.unsavedChanges', language)}</small>
        </div>
      )}
    </div>
  );
};

export default GameSettings; 