import React, { useState, useEffect } from 'react';
import { useRoom } from '../../contexts/RoomContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

const RoomCode: React.FC = () => {
  const { roomCode, isStreamerMode } = useRoom();
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('[RoomCode] Component rendered with:', {
      roomCode,
      isStreamerMode,
      timestamp: new Date().toISOString()
    });
  }, [roomCode, isStreamerMode]);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInviteLink = () => {
    if (!roomCode) return;
    const inviteLink = `${window.location.origin}/join?room=${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reset copied state when room code changes
  useEffect(() => {
    setCopied(false);
  }, [roomCode]);

  if (!roomCode) return null;

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">{t('roomCode', language)}</h6>
      </div>
      <div className="card-body">
        <div className="d-flex flex-column gap-2">
          <div className="room-code-display p-2 bg-light rounded text-center">
            <h3 className="mb-0">
              {isStreamerMode ? '••••••' : roomCode}
            </h3>
          </div>
          <div className="d-flex gap-2">
            <button 
              className="btn btn-primary flex-grow-1"
              onClick={handleCopyCode}
              disabled={!roomCode}
            >
              {copied ? t('copied', language) : t('copyCode', language)}
            </button>
            <button 
              className="btn btn-outline-primary flex-grow-1"
              onClick={handleCopyInviteLink}
              disabled={!roomCode}
            >
              {copied ? t('copied', language) : t('copyInviteLink', language)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCode; 