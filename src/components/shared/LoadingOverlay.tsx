import React, { useState, useEffect } from 'react';
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
  const [showForceButton, setShowForceButton] = useState(false);
  
  useEffect(() => {
    // Show force button after 8 seconds of loading
    let timerId: NodeJS.Timeout | null = null;
    
    if (isVisible) {
      timerId = setTimeout(() => {
        console.log('[LoadingOverlay] Showing force continue button after timeout');
        setShowForceButton(true);
      }, 8000);
    } else {
      setShowForceButton(false);
    }
    
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isVisible]);
  
  if (!isVisible) return null;

  const handleForceRefresh = () => {
    console.log('[LoadingOverlay] User force refreshed page');
    window.location.reload();
  };

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
      
      {showForceButton && (
        <div style={{ marginTop: '30px' }}>
          <p style={{ color: '#666', fontSize: '14px' }}>Stuck on loading? Try these options:</p>
          <button 
            className="btn btn-warning mt-2"
            onClick={handleForceRefresh}
            style={{ marginRight: '10px' }}
          >
            Refresh Page
          </button>
        </div>
      )}
    </div>
  );
}; 