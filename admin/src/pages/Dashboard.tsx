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
      <div className="admin-header">Admin Dashboard</div>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <span className="dashboard-caption">Welcome, Admin!</span>
            <Button variant="outlined" color="primary" onClick={handleLogout} className="btn">
              Logout
            </Button>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper
            className="card"
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

        <Grid xs={12} md={4} component="div">
          <Paper
            className="card"
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

        <Grid xs={12} md={4} component="div">
          <Paper
            className="card"
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 240,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/duplicates')}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Duplicate Detection
            </Typography>
            <Typography>
              Scan for and remove duplicate questions in the database.
            </Typography>
          </Paper>
        </Grid>

        {/* <Grid xs={12} md={4} component="div">
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 240,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/server-stats')}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Server Stats
            </Typography>
            <Typography>
              View active game rooms and server statistics.
            </Typography>
          </Paper>
        </Grid> */}
      </Grid>
    </Container>
  );
};

export default Dashboard; 