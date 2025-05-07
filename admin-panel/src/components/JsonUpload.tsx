import React, { useState } from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import { supabaseService, QuestionUpload } from '../services/supabaseService';

const JsonUpload: React.FC = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validateJson = (json: string): QuestionUpload[] => {
    try {
      const questions = JSON.parse(json);
      if (!Array.isArray(questions)) {
        throw new Error('JSON must be an array of questions');
      }

      return questions.map((q, index) => {
        if (!q.text || typeof q.text !== 'string') {
          throw new Error(`Question at index ${index} is missing or has invalid 'text' field`);
        }
        if (!q.grade || typeof q.grade !== 'number') {
          throw new Error(`Question at index ${index} is missing or has invalid 'grade' field`);
        }
        if (!q.subject || typeof q.subject !== 'string') {
          throw new Error(`Question at index ${index} is missing or has invalid 'subject' field`);
        }
        return {
          text: q.text,
          answer: q.answer,
          grade: q.grade,
          subject: q.subject,
          language: q.language || 'de'
        };
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      throw new Error(`Invalid JSON format: ${errorMessage}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const questions = validateJson(jsonInput);
      const uploadedQuestions = await supabaseService.uploadQuestions(questions);
      
      setSuccess(`Successfully uploaded ${uploadedQuestions.length} questions`);
      setJsonInput('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sampleJson = `[
  {
    "text": "What is the capital of France?",
    "answer": "Paris",
    "grade": 5,
    "subject": "Geography",
    "language": "en"
  },
  {
    "text": "What is 2 + 2?",
    "answer": "4",
    "grade": 1,
    "subject": "Mathematics",
    "language": "de"
  }
]`;

  return (
    <Card>
      <Card.Header>
        <h2 className="mb-0">Upload Questions (JSON)</h2>
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
            <Form.Label>JSON Questions</Form.Label>
            <Form.Control
              as="textarea"
              rows={10}
              value={jsonInput}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJsonInput(e.target.value)}
              placeholder="Paste your JSON here"
              required
            />
            <Form.Text className="text-muted">
              Each question must have text, grade, and subject fields. Answer and language are optional.
            </Form.Text>
          </Form.Group>

          <div className="d-flex justify-content-between align-items-center">
            <Button
              variant="outline-secondary"
              onClick={() => setJsonInput(sampleJson)}
            >
              Load Sample JSON
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Uploading...' : 'Upload Questions'}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default JsonUpload; 