import React, { useState } from 'react';

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

interface QuestionSelectorProps {
  selectedQuestions: Question[];
  onQuestionsSelected: (questions: Question[]) => void;
  onSelectedQuestionsChange: (questions: Question[]) => void;
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({
  selectedQuestions,
  onQuestionsSelected,
  onSelectedQuestionsChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState<number | ''>('');
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);

  // Fetch available questions when component mounts
  React.useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch('/api/questions');
        const data = await response.json();
        setAvailableQuestions(data);
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };
    fetchQuestions();
  }, []);

  const grades = Array.from(new Set(availableQuestions.map(q => q.grade))).sort();
  const subjects = Array.from(new Set(availableQuestions.map(q => q.subject))).sort();

  const filteredQuestions = availableQuestions.filter(question => {
    const matchesSearch = question.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = !filterGrade || question.grade === filterGrade;
    const matchesSubject = !filterSubject || question.subject === filterSubject;
    return matchesSearch && matchesGrade && matchesSubject;
  });

  const handleQuestionSelect = (question: Question) => {
    const isSelected = selectedQuestions.some(q => q.id === question.id);
    let newSelectedQuestions: Question[];
    
    if (isSelected) {
      newSelectedQuestions = selectedQuestions.filter(q => q.id !== question.id);
    } else {
      newSelectedQuestions = [...selectedQuestions, question];
    }
    
    onSelectedQuestionsChange(newSelectedQuestions);
    onQuestionsSelected(newSelectedQuestions);
  };

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">Question Bank</h6>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <div className="row g-3">
            <div className="col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">All Grades</option>
                {grades.map(grade => (
                  <option key={grade} value={grade}>Grade {grade}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="list-group">
          {filteredQuestions.map(question => (
            <button
              key={question.id}
              className={`list-group-item list-group-item-action ${
                selectedQuestions.some(q => q.id === question.id) ? 'active' : ''
              }`}
              onClick={() => handleQuestionSelect(question)}
            >
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="mb-1">{question.text}</p>
                  <small>
                    Grade {question.grade} | {question.subject}
                    {question.language && ` | ${question.language}`}
                  </small>
                </div>
                {selectedQuestions.some(q => q.id === question.id) && (
                  <span className="badge bg-primary">Selected</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {filteredQuestions.length === 0 && (
          <p className="text-center text-muted mt-3">No questions match your filters</p>
        )}
      </div>
    </div>
  );
};

export default QuestionSelector; 