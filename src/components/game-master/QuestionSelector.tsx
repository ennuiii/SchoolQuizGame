import React, { useEffect, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';
import type { Question } from '../../contexts/GameContext';

interface QuestionSelectorProps {
  onQuestionsSelected: (questions: Question[]) => void;
  selectedQuestions: Question[];
  onSelectedQuestionsChange: (questions: Question[]) => void;
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({
  onQuestionsSelected,
  selectedQuestions,
  onSelectedQuestionsChange
}) => {
  const {
    languages,
    selectedLanguage,
    isLoadingQuestions,
    availableQuestions,
    questionErrorMsg,
    randomCount,
    isLoadingRandom,
    setSelectedLanguage,
    setRandomCount,
    loadQuestions,
    loadRandomQuestions,
    addQuestionToSelected,
    removeSelectedQuestion,
    clearAllSelectedQuestions,
    organizeSelectedQuestions,
    addCustomQuestion,
    // New filtering state and actions
    availableSubjects,
    availableGrades,
    selectedSubjects,
    selectedGrades,
    isLoadingMetadata,
    loadMetadataByLanguage,
    loadQuestionsWithFilters,
    toggleSubjectSelection,
    toggleGradeSelection,
    selectAllSubjects,
    selectAllGrades,
    clearAllSubjects,
    clearAllGrades
  } = useGame();
  const { language } = useLanguage();
  
  // State for distribution view toggle
  const [distributionView, setDistributionView] = useState<'grade' | 'subject'>('grade');

  // Load metadata when language changes
  useEffect(() => {
    if (selectedLanguage) {
      loadMetadataByLanguage(selectedLanguage);
    }
  }, [selectedLanguage, loadMetadataByLanguage]);

  // Define types for distribution items
  interface GradeDistributionItem {
    grade: number;
    count: number;
    percentage: number;
  }

  interface SubjectDistributionItem {
    subject: string;
    count: number;
    percentage: number;
  }
  
  // Always sort availableQuestions before rendering
  const sortedAvailableQuestions = [...availableQuestions].sort((a, b) => a.grade - b.grade);

  // Calculate grade distribution for selected questions
  const calculateGradeDistribution = (): GradeDistributionItem[] => {
    if (selectedQuestions.length === 0) return [];

    const gradeCount: Record<number, number> = {};
    selectedQuestions.forEach(q => {
      gradeCount[q.grade] = (gradeCount[q.grade] || 0) + 1;
    });

    const grades = Object.keys(gradeCount).map(Number).sort((a, b) => a - b);
    return grades.map(grade => ({
      grade,
      count: gradeCount[grade],
      percentage: Math.round((gradeCount[grade] / selectedQuestions.length) * 100)
    }));
  };

  // Calculate subject distribution for selected questions
  const calculateSubjectDistribution = (): SubjectDistributionItem[] => {
    if (selectedQuestions.length === 0) return [];

    const subjectCount: Record<string, number> = {};
    selectedQuestions.forEach(q => {
      subjectCount[q.subject] = (subjectCount[q.subject] || 0) + 1;
    });

    const sortedSubjects = Object.keys(subjectCount).sort();
    return sortedSubjects.map(subject => ({
      subject,
      count: subjectCount[subject],
      percentage: Math.round((subjectCount[subject] / selectedQuestions.length) * 100)
    }));
  };

  // Get distribution data based on current view
  const distributionData = distributionView === 'grade' 
    ? calculateGradeDistribution() 
    : calculateSubjectDistribution();
    
  // Render distribution item based on type
  const renderDistributionItem = (item: GradeDistributionItem | SubjectDistributionItem) => {
    const label = 'grade' in item ? `Grade ${item.grade}` : item.subject;
    
    return (
      <div key={'grade' in item ? item.grade : item.subject} className="mb-2">
        <div className="d-flex justify-content-between align-items-center">
          <span>{label}</span>
          <span className="text-muted small">{item.count} ({item.percentage}%)</span>
        </div>
        <div className="progress" style={{ height: '10px' }}>
          <div 
            className="progress-bar" 
            role="progressbar" 
            style={{ width: `${item.percentage}%` }}
            aria-valuenow={item.percentage} 
            aria-valuemin={0} 
            aria-valuemax={100}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="question-selector">
      <div className="mb-4">
        <h5>{t('questionSelector.title', language)}</h5>
        
        {/* Language Selection */}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label htmlFor="languageSelect" className="form-label">{t('questionSelector.language', language)}</label>
            <select 
              id="languageSelect" 
              className="form-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {languages.length > 0 ? (
                languages.map((lang, index) => (
                  <option key={index} value={lang}>{lang}</option>
                ))
              ) : (
                <option value="de">de</option>
              )}
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="randomCount" className="form-label">{t('questionSelector.randomQuestions', language)}</label>
            <input
              type="number"
              id="randomCount"
              className="form-control"
              min="1"
              max="50"
              value={randomCount}
              onChange={(e) => setRandomCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
        </div>

        {/* Dynamic Filtering Section */}
        {selectedLanguage && (
          <div className="card mb-4">
            <div className="card-header bg-light">
              <h6 className="mb-0">{t('questionSelector.filterQuestions', language)}</h6>
            </div>
            <div className="card-body">
              {isLoadingMetadata ? (
                <div className="text-center">
                  <div className="spinner-border spinner-border-sm me-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  Loading subjects and grades...
                </div>
              ) : (
                <div className="row">
                  {/* Subjects Section */}
                  <div className="col-md-6">
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label fw-bold">{t('questionSelector.subjects', language)}</label>
                        <div className="btn-group btn-group-sm">
                          <button 
                            type="button" 
                            className="btn btn-outline-primary btn-sm"
                            onClick={selectAllSubjects}
                            disabled={availableSubjects.length === 0}
                          >
                            {t('questionSelector.selectAll', language)}
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-outline-secondary btn-sm"
                            onClick={clearAllSubjects}
                            disabled={selectedSubjects.length === 0}
                          >
                            {t('questionSelector.clearAll', language)}
                          </button>
                        </div>
                      </div>
                      <div className="border rounded p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {availableSubjects.length === 0 ? (
                          <p className="text-muted mb-0 text-center">No subjects available for this language</p>
                        ) : (
                          availableSubjects.map((subject) => (
                            <div key={subject} className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`subject-${subject}`}
                                checked={selectedSubjects.includes(subject)}
                                onChange={() => toggleSubjectSelection(subject)}
                              />
                              <label className="form-check-label" htmlFor={`subject-${subject}`}>
                                {subject}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      <small className="text-muted">
                        {selectedSubjects.length} of {availableSubjects.length} subjects selected
                      </small>
                    </div>
                  </div>

                  {/* Grades Section */}
                  <div className="col-md-6">
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label fw-bold">{t('questionSelector.grades', language)}</label>
                        <div className="btn-group btn-group-sm">
                          <button 
                            type="button" 
                            className="btn btn-outline-primary btn-sm"
                            onClick={selectAllGrades}
                            disabled={availableGrades.length === 0}
                          >
                            {t('questionSelector.selectAll', language)}
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-outline-secondary btn-sm"
                            onClick={clearAllGrades}
                            disabled={selectedGrades.length === 0}
                          >
                            {t('questionSelector.clearAll', language)}
                          </button>
                        </div>
                      </div>
                      <div className="border rounded p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {availableGrades.length === 0 ? (
                          <p className="text-muted mb-0 text-center">No grades available for this language</p>
                        ) : (
                          availableGrades.map((grade) => (
                            <div key={grade} className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`grade-${grade}`}
                                checked={selectedGrades.includes(grade)}
                                onChange={() => toggleGradeSelection(grade)}
                              />
                              <label className="form-check-label" htmlFor={`grade-${grade}`}>
                                Grade {grade}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      <small className="text-muted">
                        {selectedGrades.length} of {availableGrades.length} grades selected
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="d-flex gap-2 mt-3">
                <button 
                  className="btn btn-primary"
                  onClick={loadQuestionsWithFilters}
                  disabled={isLoadingQuestions || selectedSubjects.length === 0 || selectedGrades.length === 0}
                >
                  {isLoadingQuestions ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </span>
                      {t('questionSelector.loading', language)}
                    </>
                  ) : (
                    t('questionSelector.searchQuestions', language)
                  )}
                </button>
                <button 
                  className="btn btn-success"
                  onClick={() => loadRandomQuestions()}
                  disabled={isLoadingRandom || availableQuestions.length === 0}
                >
                  {isLoadingRandom ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </span>
                      {t('questionSelector.loading', language)}
                    </>
                  ) : (
                    t('questionSelector.random', language)
                  )}
                </button>
              </div>

              {/* Error/Info Messages */}
              {questionErrorMsg && (
                <div className={`alert ${questionErrorMsg.includes('Failed') || questionErrorMsg.includes('Please select') ? 'alert-warning' : 'alert-info'} mt-3 mb-0`}>
                  {questionErrorMsg}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header bg-light">
              <h6 className="mb-0">{t('questionSelector.availableQuestions', language)} ({availableQuestions.length})</h6>
            </div>
            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
              {availableQuestions.length === 0 ? (
                <p className="text-center text-muted">{t('questionSelector.noQuestionsAvailable', language)}</p>
              ) : (
                <div className="list-group">
                  {sortedAvailableQuestions.map((question) => (
                    <div key={question.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                      <div>
                        <p className="mb-1 fw-bold">{question.text}</p>
                        <small>
                          {t('questionSelector.grade', language)}: {question.grade} | {question.subject} | {question.language || 'de'}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-success" 
                        onClick={() => addQuestionToSelected(question)}
                        title={t('questionSelector.addToSelected', language)}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h6 className="mb-0">{t('questionSelector.selectedQuestions', language)} ({selectedQuestions.length})</h6>
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-sm btn-outline-primary" 
                  onClick={organizeSelectedQuestions}
                  disabled={selectedQuestions.length < 2}
                  title={t('questionSelector.sortByGrade', language)}
                >
                  {t('questionSelector.sortByGrade', language)}
                </button>
                <button 
                  className="btn btn-sm btn-outline-danger" 
                  onClick={clearAllSelectedQuestions}
                  disabled={selectedQuestions.length === 0}
                  title={t('questionSelector.clearAll', language)}
                >
                  {t('questionSelector.clearAll', language)}
                </button>
              </div>
            </div>
            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
              {selectedQuestions.length === 0 ? (
                <p className="text-center text-muted">{t('questionSelector.noQuestionsSelected', language)}</p>
              ) : (
                <div className="list-group">
                  {selectedQuestions.map((question, index) => (
                    <div key={question.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                      <div>
                        <div className="d-flex align-items-center mb-1">
                          <span className="badge bg-primary me-2">{index + 1}</span>
                          <span className="fw-bold">{question.text}</span>
                        </div>
                        <small>
                          {t('questionSelector.grade', language)}: {question.grade} | {question.subject} | {question.language || 'de'}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-danger" 
                        onClick={() => removeSelectedQuestion(question.id)}
                        title={t('questionSelector.removeFromSelected', language)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <h6>{t('questionSelector.selectedQuestionSummary', language)}</h6>
        {selectedQuestions.length > 0 ? (
          <>
            <p>{t('questionSelector.totalQuestions', language)}: {selectedQuestions.length}</p>
            <p>{t('questionSelector.gradeRange', language)}: {Math.min(...selectedQuestions.map(q => q.grade))} - {Math.max(...selectedQuestions.map(q => q.grade))}</p>
            <p>{t('questionSelector.subjects', language)}: {Array.from(new Set(selectedQuestions.map(q => q.subject))).join(', ')}</p>
            
            {/* Distribution visualization */}
            <div className="mb-3">
              <div className="btn-group mb-2">
                <button 
                  className={`btn btn-sm ${distributionView === 'grade' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setDistributionView('grade')}
                >
                  Grade Distribution
                </button>
                <button 
                  className={`btn btn-sm ${distributionView === 'subject' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setDistributionView('subject')}
                >
                  Subject Distribution
                </button>
              </div>
              
              <div className="distribution-chart">
                {distributionData.map(renderDistributionItem)}
              </div>
            </div>
          </>
        ) : (
          <p className="text-muted">{t('questionSelector.noQuestionsSelectedYet', language)}</p>
        )}
      </div>

      <div className="mb-3">
        <button 
          className="btn btn-success btn-lg w-100"
          onClick={addCustomQuestion}
        >
          {t('questionSelector.addCustomQuestion', language)}
        </button>
      </div>
    </div>
  );
};

export default QuestionSelector; 