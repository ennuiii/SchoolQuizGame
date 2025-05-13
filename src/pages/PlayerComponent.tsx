import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import { throttle } from 'lodash';
import socketService from '../services/socketService';
import { useGame } from '../context/GameContext';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import ReviewNotification from '../components/shared/ReviewNotification';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import type { PreviewModeState, ReviewNotificationProps, Player, PlayerBoard } from '../types/game';

const Player: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  const [canvasKey, setCanvasKey] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [showReviewNotification, setShowReviewNotification] = useState<ReviewNotificationProps | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [playerId, setPlayerId] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<PreviewModeState>({
    isActive: false,
    focusedPlayerId: null
  });
  const [visibleBoards, setVisibleBoards] = useState(new Set<string>());
  const submittedAnswerRef = useRef(false);
  const answerRef = useRef<string>('');
  const timerUpdateRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ... rest of the component code ...

  return (
    <div className="player-container">
      {/* ... existing JSX ... */}
    </div>
  );
};

export default Player; 