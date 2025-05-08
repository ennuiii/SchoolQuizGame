import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

interface Question {
  text: string;
  answer: string;
  grade: string;
  subject: string;
  language: string;
}

interface UploadResponse {
  success: boolean;
  message: string;
  errors?: string[];
}

const BulkUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<UploadResponse | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setResponse(null);
    }
  };

  const validateQuestions = (questions: Question[]): string[] => {
    const errors: string[] = [];
    questions.forEach((question, index) => {
      if (!question.text) errors.push(`Question ${index + 1}: Missing text`);
      if (!question.answer) errors.push(`Question ${index + 1}: Missing answer`);
      if (!question.grade) errors.push(`Question ${index + 1}: Missing grade`);
      if (!question.subject) errors.push(`Question ${index + 1}: Missing subject`);
      if (!question.language) errors.push(`Question ${index + 1}: Missing language`);
    });
    return errors;
  };

  const handleUpload = async () => {
    if (!file) {
      setResponse({
        success: false,
        message: 'Please select a file first',
      });
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data.questions)) {
        throw new Error('Invalid JSON format. Expected { "questions": [...] }');
      }

      const errors = validateQuestions(data.questions);
      if (errors.length > 0) {
        setResponse({
          success: false,
          message: 'Validation failed',
          errors,
        });
        return;
      }

      const { error } = await supabase
        .from('questions')
        .insert(data.questions);

      if (error) {
        throw error;
      }

      setResponse({
        success: true,
        message: `Successfully uploaded ${data.questions.length} questions`,
      });
      setFile(null);
    } catch (error) {
      setResponse({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Bulk Upload Questions
        </Typography>

        <Typography variant="body1" paragraph>
          Upload a JSON file containing multiple questions. The file should follow this format:
        </Typography>

        <Paper
          variant="outlined"
          sx={{ p: 2, mb: 3, backgroundColor: '#f5f5f5' }}
        >
          <pre>
            {JSON.stringify(
              {
                questions: [
                  {
                    text: "Question text",
                    answer: "Correct answer",
                    grade: "Grade level",
                    subject: "Subject name",
                    language: "Language code"
                  }
                ]
              },
              null,
              2
            )}
          </pre>
        </Paper>

        <Box sx={{ mb: 3 }}>
          <input
            accept=".json"
            style={{ display: 'none' }}
            id="raised-button-file"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="raised-button-file">
            <Button variant="contained" component="span">
              Select JSON File
            </Button>
          </label>
          {file && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Selected file: {file.name}
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          disabled={!file || loading}
          sx={{ mr: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Upload'}
        </Button>

        {response && (
          <Alert
            severity={response.success ? 'success' : 'error'}
            sx={{ mt: 2 }}
          >
            <Typography variant="body1">{response.message}</Typography>
            {response.errors && (
              <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                {response.errors.map((error, index) => (
                  <Typography component="li" key={index} variant="body2">
                    {error}
                  </Typography>
                ))}
              </Box>
            )}
          </Alert>
        )}
      </Paper>
    </Container>
  );
};

export default BulkUpload; 