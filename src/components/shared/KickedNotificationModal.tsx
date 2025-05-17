import React from 'react';

interface KickedNotificationModalProps {
  isOpen: boolean;
  reason: string;
  onAcknowledge: () => void;
}

const KickedNotificationModal: React.FC<KickedNotificationModalProps> = ({ 
  isOpen, 
  reason, 
  onAcknowledge 
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="modal fade show d-block" 
      tabIndex={-1} 
      role="dialog" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} // Backdrop style
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Notification</h5>
            {/* No close button in header, force acknowledgement */}
          </div>
          <div className="modal-body">
            <p>You have been removed from the room.</p>
            <p><strong>Reason:</strong> {reason || 'No reason provided.'}</p>
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={onAcknowledge}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KickedNotificationModal; 