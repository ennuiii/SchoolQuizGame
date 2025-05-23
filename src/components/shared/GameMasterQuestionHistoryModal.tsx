import React from 'react';
import { Modal, Table, Button } from 'react-bootstrap';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa6';

interface PlayerAnswer {
  playerName: string;
  answer: string;
  isCorrect: boolean | null;
}

interface QuestionHistoryItem {
  question: string;
  subject: string;
  grade: number | string;
  answers: PlayerAnswer[];
}

interface GameMasterQuestionHistoryModalProps {
  show: boolean;
  onHide: () => void;
  history: QuestionHistoryItem[];
}

/**
 * Modal for Game Master to view all questions asked, with all players' answers and correctness.
 */
const GameMasterQuestionHistoryModal: React.FC<GameMasterQuestionHistoryModalProps> = ({ show, onHide, history }) => {
  return (
    <Modal show={show} onHide={onHide} size="xl" centered className="gm-question-history-modal">
      <Modal.Header closeButton>
        <Modal.Title>Question History</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>#</th>
              <th>Question</th>
              <th>Subject</th>
              <th>Grade</th>
              <th>Player</th>
              <th>Answer</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted">No questions asked yet.</td>
              </tr>
            ) : (
              history.map((item, qIdx) => (
                item.answers.length === 0 ? (
                  <tr key={qIdx}>
                    <td>{qIdx + 1}</td>
                    <td>{item.question}</td>
                    <td>{item.subject}</td>
                    <td>{item.grade}</td>
                    <td colSpan={3} className="text-center text-muted">No answers</td>
                  </tr>
                ) : (
                  item.answers.map((ans, aIdx) => (
                    <tr key={qIdx + '-' + aIdx}>
                      {aIdx === 0 && (
                        <>
                          <td rowSpan={item.answers.length}>{qIdx + 1}</td>
                          <td rowSpan={item.answers.length}>{item.question}</td>
                          <td rowSpan={item.answers.length}>{item.subject}</td>
                          <td rowSpan={item.answers.length}>{item.grade}</td>
                        </>
                      )}
                      <td>{ans.playerName}</td>
                      <td>{ans.answer}</td>
                      <td className="text-center">
                        {ans.isCorrect === true && FaThumbsUp({ style: { color: 'green' }, title: 'Correct' })}
                        {ans.isCorrect === false && FaThumbsDown({ style: { color: 'red' }, title: 'Incorrect' })}
                        {ans.isCorrect === null && <span className="badge bg-secondary">Pending</span>}
                      </td>
                    </tr>
                  ))
                )
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

export default GameMasterQuestionHistoryModal; 