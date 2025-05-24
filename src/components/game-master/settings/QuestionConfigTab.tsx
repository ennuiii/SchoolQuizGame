import React from 'react';
import { GameSettingsState } from '../GameSettings';
import { t } from '../../../i18n';
import QuestionSelector from '../QuestionSelector';
import { useGame } from '../../../contexts/GameContext';
import type { Question } from '../../../contexts/GameContext';

interface QuestionConfigTabProps {
  settings: GameSettingsState;
  onSettingsChange: (settings: Partial<GameSettingsState>) => void;
  language: string;
}

/**
 * Question configuration tab for managing question selection and setup
 */
const QuestionConfigTab: React.FC<QuestionConfigTabProps> = ({ 
  settings, 
  onSettingsChange, 
  language 
}) => {
  const { questions } = useGame();

  /**
   * Handle questions selected from QuestionSelector
   */
  const handleQuestionsSelected = (selectedQuestions: Question[]) => {
    // This would typically update the game context or settings
    // For now, we'll just log it as the QuestionSelector already handles this
    console.log('Questions selected:', selectedQuestions.length);
  };

  /**
   * Handle changes to selected questions
   */
  const handleSelectedQuestionsChange = (selectedQuestions: Question[]) => {
    // This would typically update the game context or settings
    console.log('Selected questions changed:', selectedQuestions.length);
  };

  return (
    <div className="question-config-tab">
      <h4>{t('gameSettings.tabs.questions', language)}</h4>
      <p className="text-muted mb-4">
        {t('gameSettings.questions.description', language)}
      </p>

      {/* Question Selection Statistics */}
      {questions.length > 0 && (
        <div className="alert alert-info mb-4">
          <div className="row">
            <div className="col-md-3">
              <strong>{t('gameSettings.questions.totalSelected', language)}</strong><br />
              <span className="fs-4">{questions.length}</span>
            </div>
            <div className="col-md-3">
              <strong>{t('gameSettings.questions.gradeRange', language)}</strong><br />
              <span>{questions.length > 0 ? `${Math.min(...questions.map(q => q.grade))} - ${Math.max(...questions.map(q => q.grade))}` : '-'}</span>
            </div>
            <div className="col-md-3">
              <strong>{t('gameSettings.questions.subjects', language)}</strong><br />
              <span>{questions.length > 0 ? Array.from(new Set(questions.map(q => q.subject))).length : 0}</span>
            </div>
            <div className="col-md-3">
              <strong>{t('gameSettings.questions.estimatedTime', language)}</strong><br />
              <span>{Math.round((questions.length * (settings.timeLimit || 60)) / 60)} {t('gameSettings.questions.minutes', language)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Question Selector Component */}
      <div className="question-selector-container">
        <QuestionSelector 
          onQuestionsSelected={handleQuestionsSelected}
          selectedQuestions={questions}
          onSelectedQuestionsChange={handleSelectedQuestionsChange}
        />
      </div>

      {/* Quick Settings for Questions */}
      <div className="mt-4">
        <h5>{t('gameSettings.questions.quickSettings', language)}</h5>
        <div className="row">
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">
                  {t('gameSettings.questions.difficulty', language)}
                </h6>
                <div className="form-check">
                  <input 
                    className="form-check-input" 
                    type="radio" 
                    name="difficulty" 
                    id="difficultyEasy"
                    disabled
                  />
                  <label className="form-check-label" htmlFor="difficultyEasy">
                    {t('gameSettings.questions.easy', language)} (1-4 {t('gameSettings.questions.grade', language)})
                  </label>
                </div>
                <div className="form-check">
                  <input 
                    className="form-check-input" 
                    type="radio" 
                    name="difficulty" 
                    id="difficultyMedium"
                    disabled
                  />
                  <label className="form-check-label" htmlFor="difficultyMedium">
                    {t('gameSettings.questions.medium', language)} (5-8 {t('gameSettings.questions.grade', language)})
                  </label>
                </div>
                <div className="form-check">
                  <input 
                    className="form-check-input" 
                    type="radio" 
                    name="difficulty" 
                    id="difficultyHard"
                    disabled
                  />
                  <label className="form-check-label" htmlFor="difficultyHard">
                    {t('gameSettings.questions.hard', language)} (9-13 {t('gameSettings.questions.grade', language)})
                  </label>
                </div>
                <small className="text-muted">
                  {t('gameSettings.questions.difficultyNote', language)}
                </small>
              </div>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">
                  {t('gameSettings.questions.validation', language)}
                </h6>
                
                {questions.length === 0 && (
                  <div className="alert alert-warning py-2 mb-2">
                    <small>
                      <strong>{t('gameSettings.questions.noQuestions', language)}</strong><br />
                      {t('gameSettings.questions.noQuestionsDesc', language)}
                    </small>
                  </div>
                )}
                
                {questions.length > 0 && questions.length < 5 && (
                  <div className="alert alert-info py-2 mb-2">
                    <small>
                      <strong>{t('gameSettings.questions.fewQuestions', language)}</strong><br />
                      {t('gameSettings.questions.fewQuestionsDesc', language)}
                    </small>
                  </div>
                )}
                
                {questions.length >= 5 && (
                  <div className="alert alert-success py-2 mb-2">
                    <small>
                      <strong>{t('gameSettings.questions.goodSelection', language)}</strong><br />
                      {t('gameSettings.questions.goodSelectionDesc', language)}
                    </small>
                  </div>
                )}
                
                <div className="mt-2">
                  <small className="text-muted">
                    {t('gameSettings.questions.recommendedMin', language)}: 5-10 {t('gameSettings.questions.questionsText', language)}
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionConfigTab; 