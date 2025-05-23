import React, { useEffect, useState, useRef } from 'react';
import { t } from '../../i18n';

interface RoundStartOverlayProps {
  question: string;
  subject: string;
  grade: string | number;
  active: boolean;
  onFinish: () => void;
  language: string;
}

const COUNTDOWN_NUMBERS = [3, 2, 1];
const COUNTDOWN_INTERVAL = 1000; // ms
const QUESTION_REVEAL_TIME = 1500; // ms
const TITLE_BLINK_INTERVAL = 500; // ms - Faster blinking for more attention

const RoundStartOverlay: React.FC<RoundStartOverlayProps> = ({ question, subject, grade, active, onFinish, language }) => {
  const [countdownIdx, setCountdownIdx] = useState(0);
  const originalTitleRef = useRef(document.title);
  const titleBlinkIntervalRef = useRef<NodeJS.Timeout>();
  const [isTitleBlinking, setIsTitleBlinking] = useState(true);

  // Effect for countdown sequence
  useEffect(() => {
    if (!active) {
      // Restore original title when overlay is closed
      document.title = originalTitleRef.current;
      if (titleBlinkIntervalRef.current) {
        clearInterval(titleBlinkIntervalRef.current);
      }
      return;
    }

    // Store original title when overlay becomes active
    originalTitleRef.current = document.title;

    // Start countdown sequence
    let countdownTimeout: NodeJS.Timeout;
    setCountdownIdx(0);

    const startCountdown = (idx: number) => {
      if (idx < COUNTDOWN_NUMBERS.length - 1) {
        countdownTimeout = setTimeout(() => {
          setCountdownIdx(idx + 1);
          startCountdown(idx + 1);
        }, COUNTDOWN_INTERVAL);
      } else {
        // After last number, finish overlay
        countdownTimeout = setTimeout(() => {
          onFinish();
        }, COUNTDOWN_INTERVAL);
      }
    };
    startCountdown(0);

    return () => {
      clearTimeout(countdownTimeout);
      if (titleBlinkIntervalRef.current) {
        clearInterval(titleBlinkIntervalRef.current);
      }
      document.title = originalTitleRef.current;
    };
  }, [active, onFinish]);

  // Effect for title blinking
  useEffect(() => {
    if (!active) return;

    titleBlinkIntervalRef.current = setInterval(() => {
      setIsTitleBlinking(prev => !prev);
    }, TITLE_BLINK_INTERVAL);

    return () => {
      if (titleBlinkIntervalRef.current) {
        clearInterval(titleBlinkIntervalRef.current);
      }
    };
  }, [active]);

  // Effect for updating title
  useEffect(() => {
    if (!active) return;

    const countdownNumber = COUNTDOWN_NUMBERS[countdownIdx];
    document.title = isTitleBlinking
      ? `⚠️ ${countdownNumber} - ${t('roundStart.newQuestion', language) || 'New Question!'} ⚠️`
      : `${countdownNumber} - ${originalTitleRef.current}`;
  }, [active, countdownIdx, isTitleBlinking, language]);

  if (!active) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 3000,
      background: 'rgba(45,71,57,0.97) url(https://www.transparenttextures.com/patterns/green-dust-and-scratches.png)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      transition: 'background 0.3s',
    }}>
      <div style={{
        fontFamily: 'Schoolbell, Patrick Hand, cursive',
        fontSize: '8rem',
        color: '#ffe066',
        textShadow: '4px 4px 0 #2d4739, 8px 8px 0 #00000033',
        animation: 'pop 0.5s',
        userSelect: 'none',
        marginBottom: '1.5rem',
        marginTop: '-5rem', // Move countdown higher
      }}>
        {COUNTDOWN_NUMBERS[countdownIdx]}
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.92)',
        border: '2px dashed #ffe066',
        borderRadius: 16,
        boxShadow: '0 4px 16px #00000033',
        padding: '18px 20px',
        minWidth: 260,
        maxWidth: 600,
        textAlign: 'center',
        fontFamily: 'Patrick Hand, Schoolbell, cursive',
        color: '#2d4739',
        fontSize: '1.25rem',
        marginTop: 0,
      }}>
        <div style={{ fontSize: '1.1rem', color: '#388e3c', marginBottom: 8 }}>
          {t('questionCard.subject', language)}: <b>{subject}</b> &nbsp; | &nbsp; {t('questionCard.grade', language)}: <b>{grade}</b>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '8px 0 0 0', lineHeight: 1.2 }}>
          {question}
        </div>
      </div>
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.7); opacity: 0.2; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RoundStartOverlay; 