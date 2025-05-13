import React, { useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

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
    loadRandomQuestions
  } = useGame();

  useEffect(() => {
    loadQuestions();
  }, [selectedSubject, selectedGrade, selectedLanguage, loadQuestions]);

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubject(e.target.value);
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGrade(e.target.value ? parseInt(e.target.value) : '');
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLanguage(e.target.value);
  };

  const handleRandomCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRandomCount(parseInt(e.target.value));
  };

  const handleAddQuestion = (question: Question) => {
    if (!selectedQuestions.find(q => q.id === question.id)) {
      onSelectedQuestionsChange([...selectedQuestions, question]);
    }
  };

  const handleRemoveQuestion = (questionId: number) => {
    onSelectedQuestionsChange(selectedQuestions.filter(q => q.id !== questionId));
  };

  const handleAddRandomQuestions = async () => {
    await loadRandomQuestions();
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="h5 mb-0">Select Questions</h3>
      </div>
      <div className="card-body">
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label">Subject</label>
            <select
              className="form-select"
              value={selectedSubject}
              onChange={handleSubjectChange}
            >
              <option value="">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Grade</label>
            <select
              className="form-select"
              value={selectedGrade}
              onChange={handleGradeChange}
            >
              <option value="">All Grades</option>
              {[1, 2, 3, 4, 5, 6].map(grade => (
                <option key={grade} value={grade}>
                  Grade {grade}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Language</label>
            <select
              className="form-select"
              value={selectedLanguage}
              onChange={handleLanguageChange}
            >
              {languages.map(lang => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="h6 mb-0">Available Questions</h4>
            <div className="d-flex gap-2">
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: '80px' }}
                min="1"
                max="20"
                value={randomCount}
                onChange={handleRandomCountChange}
              />
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={handleAddRandomQuestions}
                disabled={isLoadingRandom}
              >
                {isLoadingRandom ? 'Loading...' : 'Add Random'}
              </button>
            </div>
          </div>
          {questionErrorMsg && (
            <div className="alert alert-danger" role="alert">
              {questionErrorMsg}
            </div>
          )}
          {isLoadingQuestions ? (
            <div className="text-center py-3">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="list-group">
              {availableQuestions.map(question => (
                <div
                  key={question.id}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <p className="mb-1">{question.text}</p>
                    <small className="text-muted">
                      {question.subject} - Grade {question.grade}
                    </small>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handleAddQuestion(question)}
                    disabled={selectedQuestions.some(q => q.id === question.id)}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="h6 mb-3">Selected Questions</h4>
          <div className="list-group">
            {selectedQuestions.map(question => (
              <div
                key={question.id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div>
                  <p className="mb-1">{question.text}</p>
                  <small className="text-muted">
                    {question.subject} - Grade {question.grade}
                  </small>
                </div>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleRemoveQuestion(question.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionSelector; 