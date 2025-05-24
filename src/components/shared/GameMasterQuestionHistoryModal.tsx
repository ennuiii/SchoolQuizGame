import React, { useState } from 'react';
import { Modal, Table, Button } from 'react-bootstrap';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa6';
import { t } from '../../i18n';
import PointsBreakdown from './PointsBreakdown';

interface PlayerAnswer {
  playerName: string;
  answer: string;
  isCorrect: boolean | null;
  submissionOrder?: number;  // Order in which the answer was submitted
  submissionTime?: number;   // Time taken to submit in milliseconds
  submissionTimestamp?: number; // When the answer was submitted
  pointsAwarded?: number;
  pointsBreakdown?: {
    base: number;
    time: number;
    position: number;
    streakMultiplier: number;
    total: number;
  };
  streak?: number;
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
  language: string;
}

/**
 * Modal for Game Master to view all questions asked, with all players' answers and correctness.
 */
const GameMasterQuestionHistoryModal: React.FC<GameMasterQuestionHistoryModalProps> = ({ show, onHide, history, language }) => {
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const [selectedPointsData, setSelectedPointsData] = useState<any>(null);

  // Helper function to format time taken
  const formatTimeTaken = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Function to show points breakdown
  const handleShowPointsBreakdown = (answer: PlayerAnswer, questionGrade: number | string) => {
    if (answer.pointsBreakdown) {
      setSelectedPointsData({
        ...answer.pointsBreakdown,
        questionGrade: questionGrade,
        answerTime: answer.submissionTime ? answer.submissionTime / 1000 : undefined,
        submissionOrder: answer.submissionOrder,
        streak: answer.streak,
        playerName: answer.playerName
      });
      setShowPointsBreakdown(true);
    }
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" centered className="player-management-modal">
        <Modal.Header closeButton className="modal-header">
          <Modal.Title className="modal-title">{t('gameMasterQuestionHistory.title', language)}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="modal-body">
          <div className="card p-3" style={{ background: 'inherit', border: 'none', boxShadow: 'none' }}>
            <Table striped bordered hover responsive className="admin-table" style={{ borderRadius: '14px', overflow: 'hidden', background: 'inherit' }}>
              <thead style={{ background: '#ffe066', color: '#2d4739' }}>
                <tr>
                  <th>#</th>
                  <th>{t('gameMasterQuestionHistory.question', language)}</th>
                  <th>{t('gameMasterQuestionHistory.subject', language)}</th>
                  <th>{t('gameMasterQuestionHistory.grade', language)}</th>
                  <th>{t('gameMasterQuestionHistory.player', language)}</th>
                  <th>{t('gameMasterQuestionHistory.answer', language)}</th>
                  <th>{t('gameMasterQuestionHistory.result', language)}</th>
                  <th>{t('gameMasterQuestionHistory.submissionOrder', language)}</th>
                  <th>{t('gameMasterQuestionHistory.timeTaken', language)}</th>
                  <th>{t('gameMasterQuestionHistory.points', language)}</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-muted">{t('gameMasterQuestionHistory.noQuestions', language)}</td>
                  </tr>
                ) : (
                  history.map((item, qIdx) => (
                    item.answers.length === 0 ? (
                      <tr key={qIdx} style={{ fontFamily: 'Patrick Hand, Schoolbell, cursive' }}>
                        <td colSpan={10} className="text-center text-muted">{t('gameMasterQuestionHistory.noAnswers', language)}</td>
                      </tr>
                    ) : (
                      item.answers.map((ans, aIdx) => (
                        <tr key={qIdx + '-' + aIdx} style={{ fontFamily: 'Patrick Hand, Schoolbell, cursive' }}>
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
                            {ans.isCorrect === true && <span className="badge bg-success align-middle" style={{ fontSize: '1.1em', verticalAlign: 'middle' }}>{FaThumbsUp({ style: { color: 'green', marginRight: 4, verticalAlign: 'middle' }, size: 18, title: 'Correct' })}</span>}
                            {ans.isCorrect === false && <span className="badge bg-danger align-middle" style={{ fontSize: '1.1em', verticalAlign: 'middle' }}>{FaThumbsDown({ style: { color: 'red', marginRight: 4, verticalAlign: 'middle' }, size: 18, title: 'Incorrect' })}</span>}
                            {ans.isCorrect === null && <span className="badge bg-secondary">{t('gameMasterQuestionHistory.pending', language)}</span>}
                          </td>
                          <td>
                            {ans.submissionOrder && (
                              <span className="badge bg-info" title={t('gameMasterQuestionHistory.submissionOrderTooltip', language)}>
                                #{ans.submissionOrder}
                              </span>
                            )}
                          </td>
                          <td>
                            {ans.submissionTime && (
                              <span className="text-muted" title={t('gameMasterQuestionHistory.timeTakenTooltip', language)}>
                                {formatTimeTaken(ans.submissionTime)}
                              </span>
                            )}
                          </td>
                          <td>
                            {ans.pointsAwarded !== undefined ? (
                              <div className="d-flex align-items-center gap-2">
                                <span className="fw-bold text-success">
                                  +{ans.pointsAwarded.toLocaleString()}
                                </span>
                                {ans.pointsBreakdown && (
                                  <Button 
                                    size="sm" 
                                    variant="outline-info"
                                    onClick={() => handleShowPointsBreakdown(ans, item.grade)}
                                    title="View points breakdown"
                                  >
                                    📊
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer className="modal-footer">
          <Button variant="secondary" onClick={onHide} className="btn btn-secondary">{t('gameMasterQuestionHistory.close', language)}</Button>
        </Modal.Footer>
      </Modal>

      {/* Points Breakdown Modal */}
      <PointsBreakdown
        isOpen={showPointsBreakdown}
        onClose={() => setShowPointsBreakdown(false)}
        pointsBreakdown={selectedPointsData}
        questionGrade={selectedPointsData?.questionGrade}
        answerTime={selectedPointsData?.answerTime}
        submissionOrder={selectedPointsData?.submissionOrder}
        streak={selectedPointsData?.streak}
        playerName={selectedPointsData?.playerName}
      />
    </>
  );
};

export default GameMasterQuestionHistoryModal; 