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

interface DuplicateSet {
  normalized: string;
  questions: Question[];
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
  const [duplicates, setDuplicates] = useState<DuplicateSet[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const scanForDuplicates = async () => {
    setLoading(true);
    setDuplicates([]);
    setSelectedIds([]);
    try {
      const { data, error } = await supabase.from('questions').select('*');
      if (error) throw error;
      const byNorm: Record<string, Question[]> = {};
      (data as Question[]).forEach(q => {
        const norm = normalize(q.text);
        if (!byNorm[norm]) byNorm[norm] = [];
        byNorm[norm].push(q);
      });
      const dups: DuplicateSet[] = Object.entries(byNorm)
        .filter(([_, arr]) => arr.length > 1)
        .map(([norm, arr]) => ({
          normalized: norm,
          questions: arr,
          score: arr.length > 1 ? getMatchScore(normalize(arr[0].text), normalize(arr[1].text)) : 100,
        }));
      setDuplicates(dups);
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
      setDuplicates(dups => dups.map(set => ({
        ...set,
        questions: set.questions.filter(q => !selectedIds.includes(q.id)),
      })).filter(set => set.questions.length > 1));
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
          Scan for duplicate questions in the database. Select duplicates to remove, then click Remove Duplicates.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={scanForDuplicates}
          disabled={loading}
          className="confirm-btn"
        >
          {loading ? <CircularProgress size={24} /> : 'Scan for Duplicates'}
        </Button>
        {duplicates.length > 0 && (
          <TableContainer sx={{ mt: 4 }}>
            <Table className="admin-table">
              <TableHead>
                <TableRow>
                  <TableCell>Match Score</TableCell>
                  <TableCell>Question Text</TableCell>
                  <TableCell>Answer</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Language</TableCell>
                  <TableCell>Select</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {duplicates.map((set, i) => (
                  set.questions.map((q, j) => (
                    <TableRow key={q.id} className="duplicate-row">
                      <TableCell className="duplicate-score">{set.score}%</TableCell>
                      <TableCell>{q.text}</TableCell>
                      <TableCell>{q.answer}</TableCell>
                      <TableCell>{q.grade}</TableCell>
                      <TableCell>{q.subject}</TableCell>
                      <TableCell>{q.language}</TableCell>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(q.id)}
                          onChange={() => handleSelect(q.id)}
                          color="primary"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {duplicates.length > 0 && (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={selectedIds.length === 0 || removing}
            sx={{ mt: 3 }}
            className="confirm-btn"
          >
            Remove Duplicates
          </Button>
        )}
      </Paper>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} className="admin-modal">
        <DialogTitle>Confirm Removal</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to remove the selected duplicates?</Typography>
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