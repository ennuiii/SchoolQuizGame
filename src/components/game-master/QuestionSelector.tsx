import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';

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
  const [randomCount, setRandomCount] = useState<number>(5);
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);

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
        // Filter out questions that are already selected
        const filteredQuestions = loadedQuestions.filter(
          question => !selectedQuestions.some(selected => selected.id === question.id)
        );
        
        if (filteredQuestions.length === 0) {
          setErrorMsg('All available questions are already selected');
        } else {
          setAvailableQuestions(filteredQuestions);
          setErrorMsg('');
        }
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

  const loadRandomQuestions = async () => {
    setIsLoadingRandom(true);
    setErrorMsg('');
    
    try {
      const options: {
        subject?: string;
        grade?: number;
        language?: string;
        limit?: number;
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
      
      // Get all questions matching the filters
      const allQuestions = await supabaseService.getQuestions(options);
      
      if (allQuestions && allQuestions.length > 0) {
        // Filter out questions that are already selected
        const availableQuestions = allQuestions.filter(
          question => !selectedQuestions.some(selected => selected.id === question.id)
        );
        
        if (availableQuestions.length === 0) {
          setErrorMsg('All available questions are already selected');
          return;
        }
        
        // Shuffle the questions and take the requested number
        const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
        const selectedCount = Math.min(randomCount, shuffled.length);
        const randomQuestions = shuffled.slice(0, selectedCount);
        
        // Add the random questions to the selected questions
        const newSelectedQuestions = [...selectedQuestions, ...randomQuestions];
        onSelectedQuestionsChange(newSelectedQuestions);
        onQuestionsSelected(newSelectedQuestions);
        
        // Update available questions list
        setAvailableQuestions(prev => 
          prev.filter(q => !randomQuestions.some(rq => rq.id === q.id))
        );
        
        setErrorMsg(`Added ${selectedCount} random questions to selection`);
      } else {
        setErrorMsg('No questions found with the selected filters');
      }
    } catch (error) {
      console.error('Error loading random questions:', error);
      setErrorMsg('Failed to load random questions. Please try again.');
    } finally {
      setIsLoadingRandom(false);
    }
  };

  const addQuestionToSelected = (question: Question) => {
    // Check if question is already selected
    if (selectedQuestions.some(q => q.id === question.id)) {
      setErrorMsg('This question is already selected');
      return;
    }
    
    const newSelectedQuestions = [...selectedQuestions, question];
    onSelectedQuestionsChange(newSelectedQuestions);
    onQuestionsSelected(newSelectedQuestions);
    setAvailableQuestions(prev => prev.filter(q => q.id !== question.id));
  };

  const removeSelectedQuestion = (questionId: number) => {
    const questionToRemove = selectedQuestions.find(q => q.id === questionId);
    if (questionToRemove) {
      const newSelectedQuestions = selectedQuestions.filter(q => q.id !== questionId);
      onSelectedQuestionsChange(newSelectedQuestions);
      onQuestionsSelected(newSelectedQuestions);
      setAvailableQuestions(prev => [...prev, questionToRemove].sort((a, b) => a.grade - b.grade));
    }
  };

  const clearAllSelectedQuestions = () => {
    if (selectedQuestions.length === 0) {
      setErrorMsg('No questions to clear');
      return;
    }
    
    // Add all selected questions back to available questions
    const updatedAvailableQuestions = [...availableQuestions, ...selectedQuestions].sort((a, b) => a.grade - b.grade);
    setAvailableQuestions(updatedAvailableQuestions);
    
    // Clear selected questions
    onSelectedQuestionsChange([]);
    onQuestionsSelected([]);
    setErrorMsg('All questions cleared');
    setTimeout(() => setErrorMsg(''), 3000);
  };

  const organizeSelectedQuestions = () => {
    const organized = [...selectedQuestions].sort((a, b) => a.grade - b.grade);
    onSelectedQuestionsChange(organized);
    onQuestionsSelected(organized);
  };

  const addCustomQuestion = () => {
    const text = prompt('Enter the question:');
    if (!text) return;
    
    const answerInput = prompt('Enter the answer:');
    const answer = answerInput || undefined;
    const subject = prompt('Enter the subject:') || 'General';
    const grade = parseInt(prompt('Enter the grade level (1-13):') || '5', 10);
    const language = prompt('Enter the language (e.g., de, en):') || 'de';
    
    // Validate inputs
    if (!text.trim()) {
      setErrorMsg('Question text cannot be empty');
      return;
    }
    
    if (isNaN(grade) || grade < 1 || grade > 13) {
      setErrorMsg('Grade must be between 1 and 13');
      return;
    }
    
    const newQuestion: Question = {
      id: Date.now(), // Use timestamp as temporary ID
      text: text.trim(),
      answer: answer?.trim(),
      subject: subject.trim(),
      grade: Math.min(13, Math.max(1, grade)),
      language: language.trim()
    };
    
    // Check for duplicate custom questions
    const isDuplicate = selectedQuestions.some(
      q => q.text.toLowerCase() === newQuestion.text.toLowerCase() &&
           q.subject.toLowerCase() === newQuestion.subject.toLowerCase()
    );
    
    if (isDuplicate) {
      setErrorMsg('A similar question already exists in the selection');
      return;
    }
    
    const newSelectedQuestions = [...selectedQuestions, newQuestion];
    onSelectedQuestionsChange(newSelectedQuestions);
    onQuestionsSelected(newSelectedQuestions);
    setErrorMsg('Custom question added to selection');
    setTimeout(() => setErrorMsg(''), 3000);
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
            <div className="d-flex gap-2">
              <button 
                className="btn btn-primary flex-grow-1"
                onClick={loadQuestionsFromSupabase}
                disabled={isLoadingQuestions}
              >
                {isLoadingQuestions ? 'Loading...' : 'Search Questions'}
              </button>
              <button 
                className="btn btn-success flex-grow-1"
                onClick={loadRandomQuestions}
                disabled={isLoadingRandom}
              >
                {isLoadingRandom ? 'Loading...' : 'Random'}
              </button>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <label htmlFor="randomCount" className="form-label">Number of Random Questions</label>
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
          <div className="col-md-9">
            <div className="form-check mt-4">
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
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-sm btn-outline-primary" 
                  onClick={organizeSelectedQuestions}
                  disabled={selectedQuestions.length < 2}
                  title="Sort by grade (lowest to highest)"
                >
                  Sort by Grade
                </button>
                <button 
                  className="btn btn-sm btn-outline-danger" 
                  onClick={clearAllSelectedQuestions}
                  disabled={selectedQuestions.length === 0}
                  title="Clear all selected questions"
                >
                  Clear All
                </button>
              </div>
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