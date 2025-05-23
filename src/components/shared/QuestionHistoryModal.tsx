import React from 'react';
import { Modal, Table, Button } from 'react-bootstrap';
import { t } from '../../i18n';

interface QuestionHistoryItem {
  question: string;
  yourAnswer: string;
  correctAnswer?: string;
  subject: string;
  grade: number | string;
  isCorrect: boolean | null;
  submissionOrder?: number;  // Order in which the answer was submitted
  submissionTime?: number;   // Time taken to submit in milliseconds
  submissionTimestamp?: number; // When the answer was submitted
}

interface QuestionHistoryModalProps {
  show: boolean;
  onHide: () => void;
  history: QuestionHistoryItem[];
  language: string;
}

const QuestionHistoryModal: React.FC<QuestionHistoryModalProps> = ({ show, onHide, history, language }) => {
  // Helper function to format time taken
  const formatTimeTaken = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="player-management-modal">
      <Modal.Header closeButton className="modal-header">
        <Modal.Title className="modal-title">{t('questionHistory.title', language)}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="modal-body">
        <div className="card p-3" style={{ background: 'inherit', border: 'none', boxShadow: 'none' }}>
          <Table striped bordered hover responsive className="admin-table" style={{ borderRadius: '14px', overflow: 'hidden', background: 'inherit' }}>
            <thead style={{ background: '#ffe066', color: '#2d4739' }}>
              <tr>
                <th>#</th>
                <th>{t('questionHistory.question', language)}</th>
                <th>{t('questionHistory.yourAnswer', language)}</th>
                <th>{t('questionHistory.correctAnswer', language)}</th>
                <th>{t('questionHistory.subject', language)}</th>
                <th>{t('questionHistory.grade', language)}</th>
                <th>{t('questionHistory.result', language)}</th>
                <th>{t('questionHistory.submissionOrder', language)}</th>
                <th>{t('questionHistory.timeTaken', language)}</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted">{t('questionHistory.noQuestions', language)}</td>
                </tr>
              ) : (
                history.map((item, idx) => (
                  <tr key={idx} className={item.isCorrect === true ? 'table-success' : item.isCorrect === false ? 'table-danger' : ''} style={{ fontFamily: 'Patrick Hand, Schoolbell, cursive' }}>
                    <td>{idx + 1}</td>
                    <td>{item.question}</td>
                    <td>{item.yourAnswer}</td>
                    <td>{item.correctAnswer || '-'}</td>
                    <td>{item.subject}</td>
                    <td>{item.grade}</td>
                    <td>
                      {item.isCorrect === true && <span className="badge bg-success">{t('questionHistory.correct', language)}</span>}
                      {item.isCorrect === false && <span className="badge bg-danger">{t('questionHistory.incorrect', language)}</span>}
                      {item.isCorrect === null && <span className="badge bg-secondary">{t('questionHistory.pending', language)}</span>}
                    </td>
                    <td>
                      {item.submissionOrder && (
                        <span className="badge bg-info" title={t('questionHistory.submissionOrderTooltip', language)}>
                          #{item.submissionOrder}
                        </span>
                      )}
                    </td>
                    <td>
                      {item.submissionTime && (
                        <span className="text-muted" title={t('questionHistory.timeTakenTooltip', language)}>
                          {formatTimeTaken(item.submissionTime)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
      <Modal.Footer className="modal-footer">
        <Button variant="secondary" onClick={onHide} className="btn btn-secondary">{t('questionHistory.close', language)}</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default QuestionHistoryModal; 