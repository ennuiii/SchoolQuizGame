import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Questions from './pages/Questions';
import BulkUpload from './pages/BulkUpload';
import DuplicateDetection from './pages/DuplicateDetection';
// import ServerStats from './pages/ServerStats';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css'; // Import the new theme

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#ffe066', // Chalk yellow
      contrastText: '#2d4739',
    },
    secondary: {
      main: '#4ecdc4', // Teal
      contrastText: '#fffbe7',
    },
    background: {
      default: '#2d4739',
      paper: '#fffbe7',
    },
    text: {
      primary: '#2d4739',
      secondary: '#4ecdc4',
    },
  },
  typography: {
    fontFamily: [
      'Schoolbell',
      'Patrick Hand',
      'Comic Sans MS',
      'Chalkboard SE',
      'sans-serif',
    ].join(','),
  },
});

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/questions"
            element={
              <PrivateRoute>
                <Questions />
              </PrivateRoute>
            }
          />
          <Route
            path="/bulk-upload"
            element={
              <PrivateRoute>
                <BulkUpload />
              </PrivateRoute>
            }
          />
          <Route
            path="/duplicates"
            element={
              <PrivateRoute>
                <DuplicateDetection />
              </PrivateRoute>
            }
          />
          {/* <Route
            path="/server-stats"
            element={
              <PrivateRoute>
                <ServerStats />
              </PrivateRoute>
            }
          /> */}
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App; 