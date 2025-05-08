import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Box,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography component="h1" variant="h4">
              Admin Dashboard
            </Typography>
            <Button variant="outlined" color="primary" onClick={handleLogout}>
              Logout
            </Button>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 240,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/questions')}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Manage Questions
            </Typography>
            <Typography>
              Add, edit, or delete individual questions in the database.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 240,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/bulk-upload')}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Bulk Upload
            </Typography>
            <Typography>
              Upload multiple questions at once using a JSON file.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard; 