import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { supabaseService, Question } from '../services/supabaseService';

const QuestionForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [question, setQuestion] = useState<Partial<Question>>({
    text: '',
    answer: '',
    grade: 5,
    subject: '',
    language: 'de'
  });

  useEffect(() => {
    if (id) {
      loadQuestion();
    }
  }, [id]);

  const loadQuestion = async () => {
    try {
      setLoading(true);
      const questions = await supabaseService.getQuestions({});
      const foundQuestion = questions.find(q => q.id === Number(id));
      if (foundQuestion) {
        setQuestion(foundQuestion);
      } else {
        setError('Question not found');
      }
    } catch (err) {
      setError('Failed to load question');
      console.error('Error loading question:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      if (id) {
        await supabaseService.updateQuestion(Number(id), question);
        setSuccess('Question updated successfully');
      } else {
        await supabaseService.addQuestion(question as Omit<Question, 'id' | 'created_at'>);
        setSuccess('Question added successfully');
      }

      // Clear form after successful submission
      if (!id) {
        setQuestion({
          text: '',
          answer: '',
          grade: 5,
          subject: '',
          language: 'de'
        });
      }

      // Navigate back to list after a short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError('Failed to save question');
      console.error('Error saving question:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setQuestion(prev => ({
      ...prev,
      [name]: name === 'grade' ? Number(value) : value
    }));
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="mb-0">{id ? 'Edit Question' : 'Add New Question'}</h2>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
            {success}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Question Text</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="text"
              value={question.text}
              onChange={handleChange}
              required
              placeholder="Enter the question text"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Answer (Optional)</Form.Label>
            <Form.Control
              type="text"
              name="answer"
              value={question.answer}
              onChange={handleChange}
              placeholder="Enter the correct answer"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Grade Level</Form.Label>
            <Form.Select
              name="grade"
              value={question.grade}
              onChange={handleChange}
              required
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Subject</Form.Label>
            <Form.Control
              type="text"
              name="subject"
              value={question.subject}
              onChange={handleChange}
              required
              placeholder="Enter the subject"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Language</Form.Label>
            <Form.Select
              name="language"
              value={question.language}
              onChange={handleChange}
              required
            >
              <option value="de">German (de)</option>
              <option value="en">English (en)</option>
              <option value="fr">French (fr)</option>
              <option value="es">Spanish (es)</option>
            </Form.Select>
          </Form.Group>

          <div className="d-flex justify-content-between">
            <Button variant="secondary" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : id ? 'Update Question' : 'Add Question'}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default QuestionForm; 