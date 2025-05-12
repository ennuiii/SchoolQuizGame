import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';

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
  const [subjects, setSubjects] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('de');
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [sortByGrade, setSortByGrade] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch available subjects and languages when component mounts
  useEffect(() => {
    const fetchData = async () => {
      const subjectList = await supabaseService.getSubjects();
      setSubjects(subjectList);
      
      const languageList = await supabaseService.getLanguages();
      setLanguages(languageList);
    };

    fetchData();
  }, []);

  const loadQuestionsFromSupabase = async () => {
    setIsLoadingQuestions(true);
    
    try {
      const options: {
        subject?: string;
        grade?: number;
        language?: string;
        limit?: number;
        sortByGrade?: boolean;
      } = {};
      
      if (selectedSubject) {
        options.subject = selectedSubject;
      }
      
      if (selectedGrade !== '') {
        options.grade = Number(selectedGrade);
      }
      
      if (selectedLanguage) {
        options.language = selectedLanguage;
      }
      
      options.sortByGrade = sortByGrade;
      
      const loadedQuestions = await supabaseService.getQuestions(options);
      
      if (loadedQuestions && loadedQuestions.length > 0) {
        setAvailableQuestions(loadedQuestions);
        setErrorMsg('');
      } else {
        setErrorMsg('No questions found with the selected filters');
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      setErrorMsg('Failed to load questions. Please try again.');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const addQuestionToSelected = (question: Question) => {
    const newSelectedQuestions = [...selectedQuestions, question];
    onSelectedQuestionsChange(newSelectedQuestions);
    setAvailableQuestions(prev => prev.filter(q => q.id !== question.id));
  };

  const removeSelectedQuestion = (questionId: number) => {
    const questionToRemove = selectedQuestions.find(q => q.id === questionId);
    if (questionToRemove) {
      const newSelectedQuestions = selectedQuestions.filter(q => q.id !== questionId);
      onSelectedQuestionsChange(newSelectedQuestions);
      setAvailableQuestions(prev => [...prev, questionToRemove].sort((a, b) => a.grade - b.grade));
    }
  };

  const organizeSelectedQuestions = () => {
    const organized = [...selectedQuestions].sort((a, b) => a.grade - b.grade);
    onSelectedQuestionsChange(organized);
  };

  const addCustomQuestion = () => {
    const text = prompt('Enter the question:');
    if (text) {
      const answerInput = prompt('Enter the answer:');
      const answer = answerInput || undefined;
      const subject = prompt('Enter the subject:') || 'General';
      const grade = parseInt(prompt('Enter the grade level (1-13):') || '5', 10);
      const language = prompt('Enter the language (e.g., de, en):') || 'de';
      
      const newQuestion: Question = {
        id: Date.now(), // Use timestamp as temporary ID
        text,
        answer,
        subject,
        grade: Math.min(13, Math.max(1, grade)),
        language
      };
      
      const newSelectedQuestions = [...selectedQuestions, newQuestion];
      onSelectedQuestionsChange(newSelectedQuestions);
      setErrorMsg('Custom question added to selection');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  return (
    <div className="question-selector">
      {errorMsg && (
        <div className="alert alert-info mb-3" role="alert">
          {errorMsg}
        </div>
      )}

      <div className="mb-4">
        <h5>Load Questions from Database:</h5>
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <label htmlFor="languageSelect" className="form-label">Language</label>
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
            <label htmlFor="subjectSelect" className="form-label">Subject</label>
            <select 
              id="subjectSelect" 
              className="form-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map((subject, index) => (
                <option key={index} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label htmlFor="gradeSelect" className="form-label">Grade</label>
            <select 
              id="gradeSelect" 
              className="form-select"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All Grades</option>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">&nbsp;</label>
            <button 
              className="btn btn-primary d-block w-100"
              onClick={loadQuestionsFromSupabase}
              disabled={isLoadingQuestions}
            >
              {isLoadingQuestions ? 'Loading...' : 'Search Questions'}
            </button>
          </div>
        </div>

        <div className="form-check mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="sortByGradeCheckbox"
            checked={sortByGrade}
            onChange={(e) => setSortByGrade(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="sortByGradeCheckbox">
            Sort questions by grade (lowest to highest)
          </label>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header bg-light">
              <h6 className="mb-0">Available Questions ({availableQuestions.length})</h6>
            </div>
            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
              {availableQuestions.length === 0 ? (
                <p className="text-center text-muted">No questions available. Use the filters above to search for questions.</p>
              ) : (
                <div className="list-group">
                  {availableQuestions.map((question) => (
                    <div key={question.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                      <div>
                        <p className="mb-1 fw-bold">{question.text}</p>
                        <small>
                          Grade: {question.grade} | {question.subject} | {question.language || 'de'}
                          {question.answer && <span> | Answer: {question.answer}</span>}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-success" 
                        onClick={() => addQuestionToSelected(question)}
                        title="Add to selected questions"
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
              <h6 className="mb-0">Selected Questions ({selectedQuestions.length})</h6>
              <button 
                className="btn btn-sm btn-outline-primary" 
                onClick={organizeSelectedQuestions}
                disabled={selectedQuestions.length < 2}
                title="Sort by grade (lowest to highest)"
              >
                Sort by Grade
              </button>
            </div>
            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
              {selectedQuestions.length === 0 ? (
                <p className="text-center text-muted">No questions selected yet. Add questions from the left panel.</p>
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
                          Grade: {question.grade} | {question.subject} | {question.language || 'de'}
                          {question.answer && <span> | Answer: {question.answer}</span>}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-danger" 
                        onClick={() => removeSelectedQuestion(question.id)}
                        title="Remove from selected questions"
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
        <h6>Selected Question Summary:</h6>
        {selectedQuestions.length > 0 ? (
          <>
            <p>Total questions: {selectedQuestions.length}</p>
            <p>Grade range: {Math.min(...selectedQuestions.map(q => q.grade))} - {Math.max(...selectedQuestions.map(q => q.grade))}</p>
            <p>Subjects: {Array.from(new Set(selectedQuestions.map(q => q.subject))).join(', ')}</p>
          </>
        ) : (
          <p className="text-muted">No questions selected yet</p>
        )}
      </div>

      <div className="mb-3">
        <button 
          className="btn btn-success btn-lg w-100"
          onClick={addCustomQuestion}
        >
          Add Custom Question
        </button>
      </div>
    </div>
  );
};

export default QuestionSelector; 