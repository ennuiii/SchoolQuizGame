import React, { useState, useEffect } from 'react';
import supabaseService from '../services/supabaseService';

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language: string;
}

const QuestionManager: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [filters, setFilters] = useState({
    subject: '',
    grade: '',
    language: 'de'
  });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);

  // Load questions and metadata on component mount
  useEffect(() => {
    loadQuestions();
    loadMetadata();
  }, [filters]);

  const loadMetadata = async () => {
    try {
      const subjectList = await supabaseService.getSubjects();
      setSubjects(subjectList);
      
      const languageList = await supabaseService.getLanguages();
      setLanguages(languageList);
    } catch (error) {
      console.error('Error loading metadata:', error);
      setError('Failed to load subjects and languages');
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const options: {
        subject?: string;
        grade?: number;
        language?: string;
      } = {};

      if (filters.subject) options.subject = filters.subject;
      if (filters.grade) options.grade = Number(filters.grade);
      if (filters.language) options.language = filters.language;

      const loadedQuestions = await supabaseService.getQuestions(options);
      setQuestions(loadedQuestions);
    } catch (error) {
      console.error('Error loading questions:', error);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion({ ...question });
  };

  const handleSave = async () => {
    if (!editingQuestion) return;

    try {
      setLoading(true);
      setError('');

      // Update the question in the database
      await supabaseService.updateQuestion(editingQuestion);

      // Update the local state
      setQuestions(prevQuestions =>
        prevQuestions.map(q =>
          q.id === editingQuestion.id ? editingQuestion : q
        )
      );

      setEditingQuestion(null);
    } catch (error) {
      console.error('Error updating question:', error);
      setError('Failed to update question');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId: number) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      setLoading(true);
      setError('');

      // Delete the question from the database
      await supabaseService.deleteQuestion(questionId);

      // Update the local state
      setQuestions(prevQuestions =>
        prevQuestions.filter(q => q.id !== questionId)
      );
    } catch (error) {
      console.error('Error deleting question:', error);
      setError('Failed to delete question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h2>Question Management</h2>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          <button
            type="button"
            className="btn-close float-end"
            onClick={() => setError('')}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Filters</h5>
          <div className="row g-3">
            <div className="col-md-4">
              <label htmlFor="subjectFilter" className="form-label">Subject</label>
              <select
                id="subjectFilter"
                className="form-select"
                value={filters.subject}
                onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
              >
                <option value="">All Subjects</option>
                {subjects.map((subject, index) => (
                  <option key={index} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label htmlFor="gradeFilter" className="form-label">Grade</label>
              <select
                id="gradeFilter"
                className="form-select"
                value={filters.grade}
                onChange={(e) => setFilters(prev => ({ ...prev, grade: e.target.value }))}
              >
                <option value="">All Grades</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label htmlFor="languageFilter" className="form-label">Language</label>
              <select
                id="languageFilter"
                className="form-select"
                value={filters.language}
                onChange={(e) => setFilters(prev => ({ ...prev, language: e.target.value }))}
              >
                {languages.map((language, index) => (
                  <option key={index} value={language}>{language}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Questions ({questions.length})</h5>
          {loading ? (
            <div className="text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Question</th>
                    <th>Answer</th>
                    <th>Grade</th>
                    <th>Subject</th>
                    <th>Language</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question) => (
                    <tr key={question.id}>
                      <td>{question.id}</td>
                      <td>
                        {editingQuestion?.id === question.id ? (
                          <input
                            type="text"
                            className="form-control"
                            value={editingQuestion.text}
                            onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, text: e.target.value } : null)}
                          />
                        ) : (
                          question.text
                        )}
                      </td>
                      <td>
                        {editingQuestion?.id === question.id ? (
                          <input
                            type="text"
                            className="form-control"
                            value={editingQuestion.answer || ''}
                            onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, answer: e.target.value } : null)}
                          />
                        ) : (
                          question.answer || '-'
                        )}
                      </td>
                      <td>
                        {editingQuestion?.id === question.id ? (
                          <select
                            className="form-select"
                            value={editingQuestion.grade}
                            onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, grade: Number(e.target.value) } : null)}
                          >
                            {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(grade => (
                              <option key={grade} value={grade}>{grade}</option>
                            ))}
                          </select>
                        ) : (
                          question.grade
                        )}
                      </td>
                      <td>
                        {editingQuestion?.id === question.id ? (
                          <select
                            className="form-select"
                            value={editingQuestion.subject}
                            onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, subject: e.target.value } : null)}
                          >
                            {subjects.map((subject, index) => (
                              <option key={index} value={subject}>{subject}</option>
                            ))}
                          </select>
                        ) : (
                          question.subject
                        )}
                      </td>
                      <td>
                        {editingQuestion?.id === question.id ? (
                          <select
                            className="form-select"
                            value={editingQuestion.language}
                            onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, language: e.target.value } : null)}
                          >
                            {languages.map((language, index) => (
                              <option key={index} value={language}>{language}</option>
                            ))}
                          </select>
                        ) : (
                          question.language
                        )}
                      </td>
                      <td>
                        {editingQuestion?.id === question.id ? (
                          <>
                            <button
                              className="btn btn-success btn-sm me-2"
                              onClick={handleSave}
                              disabled={loading}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditingQuestion(null)}
                              disabled={loading}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-primary btn-sm me-2"
                              onClick={() => handleEdit(question)}
                              disabled={loading}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(question.id)}
                              disabled={loading}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionManager; 