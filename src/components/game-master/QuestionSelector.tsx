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
    subjects,
    languages,
    selectedSubject,
    selectedGrade,
    selectedLanguage,
    isLoadingQuestions,
    availableQuestions,
    questionErrorMsg,
    randomCount,
    isLoadingRandom,
    setSelectedSubject,
    setSelectedGrade,
    setSelectedLanguage,
    setRandomCount,
    loadQuestions,
    loadRandomQuestions,
    addQuestionToSelected,
    removeSelectedQuestion,
    clearAllSelectedQuestions,
    organizeSelectedQuestions,
    addCustomQuestion
  } = useGame();
  const { language } = useLanguage();
  
  // State for distribution view toggle
  const [distributionView, setDistributionView] = useState<'grade' | 'subject'>('grade');

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
  
  // Load questions when filters change
  useEffect(() => {
    loadQuestions();
  }, [selectedSubject, selectedGrade, selectedLanguage, loadQuestions]);

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
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <label htmlFor="languageSelect" className="form-label">{t('questionSelector.language', language)}</label>
            <select 
              id="languageSelect" 
              className="form-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {languages.length > 0 ? (
                languages.map((language, index) => (
                  <option key={index} value={language}>{language}</option>
                ))
              ) : (
                <option value="de">de</option>
              )}
            </select>
          </div>
          <div className="col-md-3">
            <label htmlFor="subjectSelect" className="form-label">{t('questionSelector.subject', language)}</label>
            <select 
              id="subjectSelect" 
              className="form-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">{t('questionSelector.allSubjects', language)}</option>
              {subjects.map((subject, index) => (
                <option key={index} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label htmlFor="gradeSelect" className="form-label">{t('questionSelector.grade', language)}</label>
            <select 
              id="gradeSelect" 
              className="form-select"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">{t('questionSelector.allGrades', language)}</option>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">&nbsp;</label>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-primary flex-grow-1"
                onClick={loadQuestions}
                disabled={isLoadingQuestions}
              >
                {isLoadingQuestions ? t('questionSelector.loading', language) : t('questionSelector.searchQuestions', language)}
              </button>
              <button 
                className="btn btn-success flex-grow-1"
                onClick={() => loadRandomQuestions()}
                disabled={isLoadingRandom}
              >
                {isLoadingRandom ? t('questionSelector.loading', language) : t('questionSelector.random', language)}
              </button>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-3">
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
                          {question.answer && <span> | {t('questionSelector.answer', language)}: {question.answer}</span>}
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
                          {question.answer && <span> | {t('questionSelector.answer', language)}: {question.answer}</span>}
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