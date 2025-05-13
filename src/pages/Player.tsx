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
  // ... existing component code ...
};

export default Player; 