import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Container, Navbar, Nav } from 'react-bootstrap';
import QuestionList from './components/QuestionList';
import QuestionForm from './components/QuestionForm';
import JsonUpload from './components/JsonUpload';
import 'bootstrap/dist/css/bootstrap.min.css';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-vh-100 bg-light">
        <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
          <Container>
            <Navbar.Brand as={Link} to="/">School Quiz Admin</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                <Nav.Link as={Link} to="/">Questions</Nav.Link>
                <Nav.Link as={Link} to="/add">Add Question</Nav.Link>
                <Nav.Link as={Link} to="/upload">Upload JSON</Nav.Link>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>

        <Container>
          <Routes>
            <Route path="/" element={<QuestionList />} />
            <Route path="/add" element={<QuestionForm />} />
            <Route path="/edit/:id" element={<QuestionForm />} />
            <Route path="/upload" element={<JsonUpload />} />
          </Routes>
        </Container>
      </div>
    </Router>
  );
};

export default App; 