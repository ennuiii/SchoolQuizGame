import React, { useState, useEffect } from 'react';
import supabaseService from '../services/supabaseService';

interface AdminCredentials {
  username: string;
  password: string;
}

const AdminPanel: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [credentials, setCredentials] = useState<AdminCredentials>({ username: '', password: '' });
  const [jsonData, setJsonData] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Check if already logged in on mount
  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      // Verify token validity with Supabase
      verifyAdminToken(token);
    }
  }, []);

  const verifyAdminToken = async (token: string) => {
    try {
      const isValid = await supabaseService.verifyAdminToken(token);
      setIsAuthenticated(isValid);
    } catch (error) {
      console.error('Error verifying token:', error);
      sessionStorage.removeItem('adminToken');
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: 'Authenticating...', type: 'info' });
    
    try {
      const { token, success } = await supabaseService.authenticateAdmin(
        credentials.username, 
        credentials.password
      );
      
      if (success && token) {
        setIsAuthenticated(true);
        sessionStorage.setItem('adminToken', token);
        setMessage({ text: 'Authentication successful!', type: 'success' });
      } else {
        setMessage({ text: 'Invalid credentials', type: 'error' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage({ text: 'Authentication failed. Please try again.', type: 'error' });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setCredentials({ username: '', password: '' });
    setMessage(null);
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonData(e.target.value);
  };

  const validateJson = (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      
      if (!Array.isArray(data)) {
        setMessage({ text: 'JSON must be an array of question objects', type: 'error' });
        return false;
      }
      
      // Validate each question object
      for (const question of data) {
        if (!question.text || typeof question.text !== 'string') {
          setMessage({ text: 'Each question must have a "text" field (string)', type: 'error' });
          return false;
        }
        
        if (!question.subject || typeof question.subject !== 'string') {
          setMessage({ text: 'Each question must have a "subject" field (string)', type: 'error' });
          return false;
        }
        
        if (!question.grade || typeof question.grade !== 'number') {
          setMessage({ text: 'Each question must have a "grade" field (number)', type: 'error' });
          return false;
        }
        
        if (!question.language || typeof question.language !== 'string') {
          setMessage({ text: 'Each question must have a "language" field (string)', type: 'error' });
          return false;
        }
      }
      
      return true;
    } catch (error) {
      setMessage({ text: 'Invalid JSON format: ' + (error as Error).message, type: 'error' });
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateJson(jsonData)) {
      return;
    }
    
    setIsUploading(true);
    setMessage({ text: 'Uploading questions to database...', type: 'info' });
    
    try {
      const questions = JSON.parse(jsonData);
      const token = sessionStorage.getItem('adminToken');
      
      if (!token) {
        setMessage({ text: 'Authentication token missing. Please log in again.', type: 'error' });
        setIsAuthenticated(false);
        setIsUploading(false);
        return;
      }
      
      const result = await supabaseService.bulkInsertQuestions(questions, token);
      
      if (result.success) {
        setMessage({ 
          text: `Successfully added ${result.count} questions to the database!`, 
          type: 'success' 
        });
        setJsonData(''); // Clear the form
      } else {
        setMessage({ text: result.error || 'Error adding questions', type: 'error' });
      }
    } catch (error) {
      console.error('Error uploading questions:', error);
      setMessage({ text: 'Error uploading questions: ' + (error as Error).message, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h2 className="mb-0">Question Database Admin</h2>
            </div>
            
            <div className="card-body">
              {message && (
                <div className={`alert alert-${message.type === 'success' ? 'success' : message.type === 'info' ? 'info' : 'danger'} mb-4`}>
                  {message.text}
                </div>
              )}
              
              {!isAuthenticated ? (
                <form onSubmit={handleLogin}>
                  <div className="mb-3">
                    <label htmlFor="username" className="form-label">Admin Username</label>
                    <input
                      type="text"
                      id="username"
                      className="form-control"
                      value={credentials.username}
                      onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">Admin Password</label>
                    <input
                      type="password"
                      id="password"
                      className="form-control"
                      value={credentials.password}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                      required
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary">Login</button>
                </form>
              ) : (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h3>Upload Questions</h3>
                    <button 
                      className="btn btn-outline-danger"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                  
                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label htmlFor="jsonData" className="form-label">
                        Questions JSON
                        <span className="ms-2 text-muted small">
                          (Array of question objects with text, answer, subject, grade, and language fields)
                        </span>
                      </label>
                      <textarea
                        id="jsonData"
                        className="form-control font-monospace"
                        rows={15}
                        value={jsonData}
                        onChange={handleJsonChange}
                        placeholder='[
  {
    "text": "What is the capital of Germany?",
    "answer": "Berlin",
    "subject": "Geography",
    "grade": 5,
    "language": "de"
  },
  {
    "text": "What is the largest planet in our solar system?",
    "answer": "Jupiter",
    "subject": "Science",
    "grade": 6,
    "language": "de"
  }
]'
                        required
                      />
                    </div>
                    
                    <button 
                      type="submit" 
                      className="btn btn-success"
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : 'Upload Questions'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 