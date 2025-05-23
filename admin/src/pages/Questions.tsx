import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

interface Question {
  id: number;
  text: string;
  answer: string;
  grade: string;
  subject: string;
  language: string;
}

const Questions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [open, setOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState<Partial<Question>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching questions:', error);
      return;
    }

    setQuestions(data || []);
  };

  const handleOpen = (question?: Question) => {
    if (question) {
      setEditingQuestion(question);
      setFormData(question);
    } else {
      setEditingQuestion(null);
      setFormData({});
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingQuestion(null);
    setFormData({});
  };

  const handleSubmit = async () => {
    if (editingQuestion) {
      const { error } = await supabase
        .from('questions')
        .update(formData)
        .eq('id', editingQuestion.id);

      if (error) {
        console.error('Error updating question:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('questions')
        .insert([formData]);

      if (error) {
        console.error('Error creating question:', error);
        return;
      }
    }

    handleClose();
    fetchQuestions();
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting question:', error);
        return;
      }

      fetchQuestions();
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <span className="dashboard-caption">Manage Questions</span>
        <Button variant="contained" color="primary" onClick={() => handleOpen()} className="btn">
          Add New Question
        </Button>
      </Box>

      <TableContainer component={Paper} className="card">
        <Table className="admin-table">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Text</TableCell>
              <TableCell>Answer</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Language</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {questions.map((question) => (
              <TableRow key={question.id} /* className="duplicate-row" for future duplicate highlighting */>
                <TableCell>{question.id}</TableCell>
                <TableCell>{question.text}</TableCell>
                <TableCell>{question.answer}</TableCell>
                <TableCell>{question.grade}</TableCell>
                <TableCell>{question.subject}</TableCell>
                <TableCell>{question.language}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(question)} color="primary">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(question.id)} color="secondary">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} className="admin-modal">
        <DialogTitle>
          {editingQuestion ? 'Edit Question' : 'Add New Question'}
        </DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Text"
            fullWidth
            value={formData.text || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, text: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Answer"
            fullWidth
            value={formData.answer || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, answer: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Grade"
            fullWidth
            value={formData.grade || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, grade: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Subject"
            fullWidth
            value={formData.subject || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, subject: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Language"
            fullWidth
            value={formData.language || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, language: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} className="cancel-btn">Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" className="confirm-btn">
            {editingQuestion ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Questions; 