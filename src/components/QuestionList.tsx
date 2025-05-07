import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Form, Row, Col, Card, Alert } from 'react-bootstrap';
import { supabaseService, Question } from '../services/supabaseService';

const QuestionList: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    subject: '',
    grade: '',
    language: '',
    sortByGrade: true
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load questions with filters
      const questionsData = await supabaseService.getQuestions({
        subject: filters.subject || undefined,
        grade: filters.grade ? Number(filters.grade) : undefined,
        language: filters.language || undefined,
        sortByGrade: filters.sortByGrade
      });
      setQuestions(questionsData);

      // Load subjects and languages if not already loaded
      if (subjects.length === 0) {
        const subjectsData = await supabaseService.getSubjects();
        setSubjects(subjectsData);
      }
      if (languages.length === 0) {
        const languagesData = await supabaseService.getLanguages();
        setLanguages(languagesData);
      }
    } catch (err) {
      setError('Failed to load questions. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await supabaseService.deleteQuestion(id);
        setQuestions(questions.filter(q => q.id !== id));
      } catch (err) {
        setError('Failed to delete question. Please try again.');
        console.error('Error deleting question:', err);
      }
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <div>
      <Card className="mb-4">
        <Card.Header>
          <h2 className="mb-0">Question Management</h2>
        </Card.Header>
        <Card.Body>
          <Row className="mb-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label>Subject</Form.Label>
                <Form.Select
                  name="subject"
                  value={filters.subject}
                  onChange={handleFilterChange}
                >
                  <option value="">All Subjects</option>
                  {subjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Grade</Form.Label>
                <Form.Select
                  name="grade"
                  value={filters.grade}
                  onChange={handleFilterChange}
                >
                  <option value="">All Grades</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Language</Form.Label>
                <Form.Select
                  name="language"
                  value={filters.language}
                  onChange={handleFilterChange}
                >
                  <option value="">All Languages</option>
                  {languages.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mt-4">
                <Form.Check
                  type="checkbox"
                  name="sortByGrade"
                  label="Sort by Grade"
                  checked={filters.sortByGrade}
                  onChange={handleFilterChange}
                />
              </Form.Group>
            </Col>
          </Row>

          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className="mb-0">Questions ({questions.length})</h3>
            <Button variant="primary" onClick={() => navigate('/add')}>
              Add New Question
            </Button>
          </div>

          {loading ? (
            <div className="text-center">Loading...</div>
          ) : (
            <Table striped bordered hover responsive>
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
                {questions.map(question => (
                  <tr key={question.id}>
                    <td>{question.id}</td>
                    <td>{question.text}</td>
                    <td>{question.answer || '-'}</td>
                    <td>{question.grade}</td>
                    <td>{question.subject}</td>
                    <td>{question.language || 'de'}</td>
                    <td>
                      <Button
                        variant="primary"
                        size="sm"
                        className="me-2"
                        onClick={() => navigate(`/edit/${question.id}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(question.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default QuestionList; 