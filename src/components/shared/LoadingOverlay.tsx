import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  isTransparent?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  isTransparent = false
}) => {
  if (!isVisible) return null;

  return (
    <div
      className="loading-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isTransparent ? 'rgba(255, 255, 255, 0.8)' : 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        transition: 'opacity 0.3s ease',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <LoadingSpinner
        size="large"
        color="#4a90e2"
        message={message}
      />
    </div>
  );
}; 