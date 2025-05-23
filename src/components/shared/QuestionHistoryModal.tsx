import React from 'react';
import { Modal, Table, Button } from 'react-bootstrap';

interface QuestionHistoryItem {
  question: string;
  yourAnswer: string;
  correctAnswer?: string;
  subject: string;
  grade: number | string;
  isCorrect: boolean | null;
}

interface QuestionHistoryModalProps {
  show: boolean;
  onHide: () => void;
  history: QuestionHistoryItem[];
}

const QuestionHistoryModal: React.FC<QuestionHistoryModalProps> = ({ show, onHide, history }) => {
  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="player-management-modal">
      <Modal.Header closeButton>
        <Modal.Title>Question History</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>#</th>
              <th>Question</th>
              <th>Your Answer</th>
              <th>Correct Answer</th>
              <th>Subject</th>
              <th>Grade</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted">No questions answered yet.</td>
              </tr>
            ) : (
              history.map((item, idx) => (
                <tr key={idx} className={item.isCorrect === true ? 'table-success' : item.isCorrect === false ? 'table-danger' : ''}>
                  <td>{idx + 1}</td>
                  <td>{item.question}</td>
                  <td>{item.yourAnswer}</td>
                  <td>{item.correctAnswer || '-'}</td>
                  <td>{item.subject}</td>
                  <td>{item.grade}</td>
                  <td>
                    {item.isCorrect === true && <span className="badge bg-success">Correct</span>}
                    {item.isCorrect === false && <span className="badge bg-danger">Incorrect</span>}
                    {item.isCorrect === null && <span className="badge bg-secondary">Pending</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default QuestionHistoryModal; 