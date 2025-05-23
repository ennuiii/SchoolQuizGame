import React, { useState } from 'react';
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
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  CircularProgress,
} from '@mui/material';
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

interface QuestionPair {
  question1: Question;
  question2: Question;
  score: number;
}

function normalize(str: string): string {
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // Remove special chars
    .replace(/\s+/g, '');
}

function getMatchScore(a: string, b: string): number {
  // Simple similarity: percent of matching chars after normalization
  if (!a || !b) return 0;
  if (a === b) return 100;
  let matches = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }
  return Math.round((matches / Math.max(a.length, b.length)) * 100);
}

const DuplicateDetection: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [questionPairs, setQuestionPairs] = useState<QuestionPair[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const scanForDuplicates = async () => {
    setLoading(true);
    setQuestionPairs([]);
    setSelectedIds([]);
    try {
      const { data, error } = await supabase.from('questions').select('*');
      if (error) throw error;
      
      const questions = data as Question[];
      const pairs: QuestionPair[] = [];
      
      // Compare each question with every other question
      for (let i = 0; i < questions.length; i++) {
        for (let j = i + 1; j < questions.length; j++) {
          const score = getMatchScore(
            normalize(questions[i].text),
            normalize(questions[j].text)
          );
          pairs.push({
            question1: questions[i],
            question2: questions[j],
            score
          });
        }
      }
      
      // Sort pairs by score in descending order
      pairs.sort((a, b) => b.score - a.score);
      
      setQuestionPairs(pairs);
    } catch (e) {
      alert('Error scanning for duplicates');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id: number) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await supabase.from('questions').delete().in('id', selectedIds);
      setQuestionPairs(pairs => pairs.filter(pair => 
        !selectedIds.includes(pair.question1.id) && !selectedIds.includes(pair.question2.id)
      ));
      setSelectedIds([]);
      setConfirmOpen(false);
    } catch (e) {
      alert('Error removing duplicates');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper className="card" sx={{ p: 3 }}>
        <span className="dashboard-caption">Duplicate Detection</span>
        <Typography variant="body1" paragraph>
          Scan for similar questions in the database. Select duplicates to remove, then click Remove Duplicates.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={scanForDuplicates}
          disabled={loading}
          className="confirm-btn"
        >
          {loading ? <CircularProgress size={24} /> : 'Scan for Similar Questions'}
        </Button>
        {questionPairs.length > 0 && (
          <TableContainer sx={{ mt: 4 }}>
            <Table className="admin-table">
              <TableHead>
                <TableRow>
                  <TableCell>Similarity Score</TableCell>
                  <TableCell>Question 1</TableCell>
                  <TableCell>Answer 1</TableCell>
                  <TableCell>Grade 1</TableCell>
                  <TableCell>Subject 1</TableCell>
                  <TableCell>Question 2</TableCell>
                  <TableCell>Answer 2</TableCell>
                  <TableCell>Grade 2</TableCell>
                  <TableCell>Subject 2</TableCell>
                  <TableCell>Select</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {questionPairs.map((pair, index) => (
                  <TableRow key={`${pair.question1.id}-${pair.question2.id}`} className="duplicate-row">
                    <TableCell className="duplicate-score">{pair.score}%</TableCell>
                    <TableCell>{pair.question1.text}</TableCell>
                    <TableCell>{pair.question1.answer}</TableCell>
                    <TableCell>{pair.question1.grade}</TableCell>
                    <TableCell>{pair.question1.subject}</TableCell>
                    <TableCell>{pair.question2.text}</TableCell>
                    <TableCell>{pair.question2.answer}</TableCell>
                    <TableCell>{pair.question2.grade}</TableCell>
                    <TableCell>{pair.question2.subject}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(pair.question1.id) || selectedIds.includes(pair.question2.id)}
                        onChange={() => {
                          handleSelect(pair.question1.id);
                          handleSelect(pair.question2.id);
                        }}
                        color="primary"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {questionPairs.length > 0 && (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={selectedIds.length === 0 || removing}
            sx={{ mt: 3 }}
            className="confirm-btn"
          >
            Remove Selected Questions
          </Button>
        )}
      </Paper>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} className="admin-modal">
        <DialogTitle>Confirm Removal</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to remove the selected questions?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} className="cancel-btn">Cancel</Button>
          <Button onClick={handleRemove} color="secondary" variant="contained" className="confirm-btn" disabled={removing}>
            {removing ? <CircularProgress size={20} /> : 'Yes, Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DuplicateDetection; 