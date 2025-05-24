import React from 'react';
import { TabType } from '../GameSettings';
import { t } from '../../../i18n';

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  description: string;
}

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  language: string;
}

/**
 * Tab navigation component with icons and accessibility support
 */
const TabNavigation: React.FC<TabNavigationProps> = ({ 
  activeTab, 
  onTabChange, 
  language 
}) => {
  
  const tabs: TabConfig[] = [
    {
      id: 'gamemodes',
      label: t('gameSettings.tabs.gamemodes', language),
      icon: '🎮',
      description: t('gameSettings.tabs.gamemodesDesc', language)
    },
    {
      id: 'questions',
      label: t('gameSettings.tabs.questions', language),
      icon: '❓',
      description: t('gameSettings.tabs.questionsDesc', language)
    },
    {
      id: 'timer',
      label: t('gameSettings.tabs.timer', language),
      icon: '⏰',
      description: t('gameSettings.tabs.timerDesc', language)
    },
    {
      id: 'preview',
      label: t('gameSettings.tabs.preview', language),
      icon: '👁️',
      description: t('gameSettings.tabs.previewDesc', language)
    },
    {
      id: 'points',
      label: t('gameSettings.tabs.points', language),
      icon: '⭐',
      description: t('gameSettings.tabs.pointsDesc', language)
    },
    {
      id: 'voting',
      label: t('gameSettings.tabs.voting', language),
      icon: '🗳️',
      description: t('gameSettings.tabs.votingDesc', language)
    },
    {
      id: 'answering',
      label: t('gameSettings.tabs.answering', language),
      icon: '💬',
      description: t('gameSettings.tabs.answeringDesc', language)
    },
    {
      id: 'joker',
      label: t('gameSettings.tabs.joker', language),
      icon: '🃏',
      description: t('gameSettings.tabs.jokerDesc', language)
    }
  ];

  /**
   * Handle keyboard navigation for accessibility
   */
  const handleKeyDown = (event: React.KeyboardEvent, tabId: TabType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTabChange(tabId);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      let nextIndex;
      
      if (event.key === 'ArrowLeft') {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      } else {
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      }
      
      onTabChange(tabs[nextIndex].id);
    }
  };

  return (
    <div className="tab-navigation">
      {/* Mobile dropdown for smaller screens */}
      <div className="d-md-none p-3">
        <select 
          className="form-select form-select-lg"
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value as TabType)}
          aria-label={t('gameSettings.selectTab', language)}
        >
          {tabs.map(tab => (
            <option key={tab.id} value={tab.id}>
              {tab.icon} {tab.label}
            </option>
          ))}
        </select>
        
        {/* Tab description for mobile */}
        <div className="mt-2 p-2 bg-light rounded">
          <small className="text-muted">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </small>
        </div>
      </div>

      {/* Desktop tab navigation - Enhanced */}
      <div className="d-none d-md-block">
        <div className="row g-2 p-3">
          {tabs.map(tab => (
            <div key={tab.id} className="col-md-3 col-lg-3">
              <button
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tab-content-${tab.id}`}
                className={`
                  btn w-100 h-100 p-3 border-0 shadow-sm position-relative transition-all
                  ${activeTab === tab.id 
                    ? 'btn-primary shadow-lg text-white transform-scale-105' 
                    : 'btn-light text-dark hover-lift'
                  }
                `}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                title={tab.description}
                tabIndex={activeTab === tab.id ? 0 : -1}
                style={{
                  minHeight: '80px',
                  transition: 'all 0.2s ease-in-out',
                  transform: activeTab === tab.id ? 'scale(1.02)' : 'scale(1)',
                  background: activeTab === tab.id 
                    ? 'linear-gradient(135deg, #0d6efd 0%, #6610f2 100%)'
                    : undefined
                }}
              >
                <div className="d-flex flex-column align-items-center text-center">
                  <span 
                    className="tab-icon mb-2" 
                    role="img" 
                    aria-label={tab.label}
                    style={{ fontSize: '1.5rem' }}
                  >
                    {tab.icon}
                  </span>
                  <span className="tab-label fw-semibold small">
                    {tab.label}
                  </span>
                </div>
                
                {/* Active indicator */}
                {activeTab === tab.id && (
                  <div 
                    className="position-absolute bottom-0 start-50 translate-middle-x"
                    style={{
                      width: '60%',
                      height: '3px',
                      background: 'rgba(255,255,255,0.9)',
                      borderRadius: '2px 2px 0 0'
                    }}
                  />
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Tab description for desktop - Enhanced */}
        <div className="px-3 pb-3">
          <div className="alert alert-info border-0 mb-0 d-flex align-items-center" style={{ background: 'rgba(13, 110, 253, 0.1)' }}>
            <i className="bi bi-info-circle me-2 text-primary"></i>
            <small className="mb-0 text-primary fw-medium">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabNavigation; 