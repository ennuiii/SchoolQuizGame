import React, { useState, useEffect } from 'react';
import { useAudio } from '../../contexts/AudioContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { t } from '../../i18n';

const languageOptions = [
  { code: 'en', labelKey: 'english' },
  { code: 'de', labelKey: 'german' },
  { code: 'fr', labelKey: 'french' },
  { code: 'nl', labelKey: 'dutch' },
  { code: 'pl', labelKey: 'polish' },
  { code: 'zh', labelKey: 'chinese' },
];

const SettingsControl: React.FC = () => {
  const { isMuted, volume, toggleMute, setVolume } = useAudio();
  const { language, setLanguage } = useLanguage();
  const { 
    availableCameras, 
    selectedCameraId, 
    refreshDeviceList, 
    selectCamera,
    localStream,
    startLocalStream,
    stopLocalStream,
    isWebcamActive,
    availableMicrophones,
    selectedMicrophoneId,
    selectMicrophone,
    isMicrophoneActive,
    toggleMicrophone
  } = useWebRTC();
  const [isOpen, setIsOpen] = useState(false);

  // Refresh device list when the settings panel is opened
  useEffect(() => {
    if (isOpen) {
      // Force request permissions to get device list without starting the stream
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(tempStream => {
          // Immediately stop the stream - we just want permissions to get device list
          tempStream.getTracks().forEach(track => track.stop());
          refreshDeviceList();
        })
        .catch(err => {
          console.error("Failed to get camera permission for device list:", err);
          refreshDeviceList(); // Still try to refresh in case we get deviceId's without labels
        });
    }
  }, [isOpen, refreshDeviceList]);

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    if (deviceId) {
      selectCamera(deviceId);
    }
  };

  const handleMicrophoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    if (deviceId) {
      selectMicrophone(deviceId);
    }
  };

  const handleToggleMute = async () => {
    try {
      if (volume === 0) {
        setVolume(0.5); // Restore to default
      } else {
        setVolume(0); // Mute
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setVolume(parseFloat(e.target.value));
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  };

  const handleToggleCamera = () => {
    if (localStream) {
      stopLocalStream();
    } else {
      startLocalStream();
    }
  };

  // Get selected device name helper function
  const getDeviceName = (deviceId: string | null, deviceList: MediaDeviceInfo[]) => {
    if (!deviceId) return 'Default device';
    
    const device = deviceList.find(d => d.deviceId === deviceId);
    if (!device || !device.label) return `Device ${deviceId.substring(0, 6)}...`;
    
    return device.label.split('(')[0].trim();
  };

  return (
    <div className="settings-control" style={{ position: 'relative' }}>
      <button
        className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
        style={{
          position: 'fixed',
          top: 18,
          right: 18,
          zIndex: 2000,
          minWidth: 36,
          minHeight: 36,
          borderRadius: '50%',
          background: 'var(--panel-bg)',
          boxShadow: 'var(--button-shadow)',
          color: 'var(--text-color)',
          border: '2px solid var(--border-color)',
        }}
        onClick={() => setIsOpen(!isOpen)}
        title={t('settings', language)}
      >
        <i className="bi bi-gear-fill" style={{ fontSize: 20 }}></i>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 70,
            right: 18,
            zIndex: 2000,
            background: '#fef9c3',
            border: '1px dashed #e5d78c',
            borderRadius: '10px',
            width: '320px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <h5 style={{ marginBottom: '20px', color: '#5c4f2a', fontWeight: 600 }}>
            {t('settings', language)}
          </h5>
          
          {/* Camera selection */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5c4f2a', fontWeight: 500 }}>
              <i className="bi bi-camera-video-fill"></i>
              {t('camera', language) || 'Camera'}
            </label>
            
            {/* Camera dropdown wrapper with custom styling */}
            <div className="custom-select-wrapper" style={{ position: 'relative', marginBottom: '8px' }}>
              <select 
                className="form-select form-select-sm" 
                value={selectedCameraId || ''}
                onChange={handleCameraChange}
                style={{
                  backgroundColor: '#fffadb',
                  color: '#5c4f2a',
                  border: '1px solid #e5d78c',
                  borderRadius: '8px',
                  padding: '0.375rem 2.25rem 0.375rem 0.75rem',
                  width: '100%',
                  appearance: 'auto',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 2001
                }}
                title="Select a camera"
              >
                {availableCameras.length === 0 && (
                  <option value="" disabled>
                    {t('noCamerasFound', language) || 'No cameras found'}
                  </option>
                )}
                {availableCameras.map(camera => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${camera.deviceId.substring(0, 8)}...`}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="d-flex justify-content-between align-items-center">
              <button 
                className="btn btn-sm"
                onClick={() => {
                  refreshDeviceList();
                  // Force permission request if needed
                  if (availableCameras.length === 0 || !availableCameras.some(cam => cam.label)) {
                    navigator.mediaDevices.getUserMedia({ video: true })
                      .then(stream => {
                        stream.getTracks().forEach(track => track.stop());
                        refreshDeviceList();
                      })
                      .catch(err => console.error('Could not get camera permission:', err));
                  }
                }}
                style={{
                  background: '#57c4b8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.8rem'
                }}
              >
                <i className="bi bi-arrow-clockwise me-1"></i>
                {t('refreshDevices', language) || 'Refresh Devices'}
              </button>
              
              <button
                className={`btn btn-sm ${localStream ? 'btn-danger' : 'btn-success'}`}
                onClick={handleToggleCamera}
                title={localStream ? "Turn off camera" : "Turn on camera"}
                style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              >
                <i className={`bi bi-camera-video${localStream ? '-off' : ''} me-1`}></i>
                {localStream ? "Turn Off" : "Turn On"}
              </button>
            </div>
            
            <div className="mt-2">
              <div className="d-flex align-items-center">
                <div className={`status-indicator ${localStream ? 'active' : 'inactive'}`} 
                  style={{ 
                    width: '10px', 
                    height: '10px', 
                    borderRadius: '50%', 
                    backgroundColor: localStream ? '#28a745' : '#dc3545',
                    marginRight: '5px'
                  }}></div>
                <span className="small" style={{ color: '#5c4f2a' }}>
                  {localStream 
                    ? `Active camera: ${getDeviceName(selectedCameraId, availableCameras)}`
                    : 'Camera is off - select device before turning on'}
                </span>
              </div>
              <div className="small text-muted mt-1" style={{ color: '#5c4f2a' }}>
                {availableCameras.length} cameras available
              </div>
            </div>
          </div>
          
          {/* Microphone selection */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5c4f2a', fontWeight: 500 }}>
              <i className="bi bi-mic-fill"></i>
              {t('microphone', language) || 'Microphone'}
            </label>
            
            {/* Microphone dropdown wrapper with custom styling */}
            <div className="custom-select-wrapper" style={{ position: 'relative', marginBottom: '8px' }}>
              <select 
                className="form-select form-select-sm" 
                value={selectedMicrophoneId || ''}
                onChange={handleMicrophoneChange}
                style={{
                  backgroundColor: '#fffadb',
                  color: '#5c4f2a',
                  border: '1px solid #e5d78c',
                  borderRadius: '8px',
                  padding: '0.375rem 2.25rem 0.375rem 0.75rem',
                  width: '100%',
                  appearance: 'auto',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 2001
                }}
                title="Select a microphone"
              >
                {availableMicrophones.length === 0 && (
                  <option value="" disabled>
                    {t('noMicrophonesFound', language) || 'No microphones found'}
                  </option>
                )}
                {availableMicrophones.map(mic => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Mic ${mic.deviceId.substring(0, 8)}...`}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="d-flex justify-content-between align-items-center">
              {localStream && (
                <button
                  className={`btn btn-sm ${isMicrophoneActive ? 'btn-outline-success' : 'btn-outline-danger'}`}
                  onClick={toggleMicrophone}
                  title={isMicrophoneActive ? "Mute microphone" : "Unmute microphone"}
                  style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                >
                  <i className={`bi bi-mic${isMicrophoneActive ? '' : '-mute'} me-1`}></i>
                  {isMicrophoneActive ? "Mute" : "Unmute"}
                </button>
              )}
              
              <div className="status-indicator d-flex align-items-center ms-auto">
                <div style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  backgroundColor: localStream && isMicrophoneActive ? '#28a745' : '#dc3545',
                  marginRight: '5px'
                }}></div>
                <span className="small" style={{ color: '#5c4f2a' }}>
                  {localStream 
                    ? `${isMicrophoneActive ? 'Active' : 'Muted'}: ${getDeviceName(selectedMicrophoneId, availableMicrophones)}`
                    : 'Mic unavailable - enable camera first'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Audio controls */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5c4f2a', fontWeight: 500 }}>
              <i className="bi bi-volume-up-fill"></i>
              {t('audio', language)}
            </label>
            <div className="d-flex align-items-center gap-2 mb-2">
              <button
                className="btn btn-sm"
                style={{
                  minWidth: 40,
                  minHeight: 40,
                  borderRadius: '50%',
                  background: volume === 0 ? '#57c4b8' : '#57c4b8',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
                onClick={handleToggleMute}
                title={volume === 0 ? t('unmuteMusic', language) : t('muteMusic', language)}
              >
                {volume === 0 ? (
                  <i className="bi bi-volume-mute-fill" style={{ fontSize: 20 }}></i>
                ) : (
                  <i className="bi bi-volume-up-fill" style={{ fontSize: 20 }}></i>
                )}
              </button>
            </div>
            <input
              type="range"
              className="form-range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              style={{ width: '100%' }}
              aria-label={t('musicVolume', language)}
            />
          </div>

          {/* Language selection */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5c4f2a', fontWeight: 500 }}>
              <i className="bi bi-translate"></i>
              {t('language', language)}
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                marginTop: '10px',
              }}
            >
              {languageOptions.map(opt => (
                <button
                  key={opt.code}
                  className="btn"
                  onClick={() => setLanguage(opt.code)}
                  aria-pressed={language === opt.code}
                  style={{
                    padding: '8px 12px',
                    background: language === opt.code ? '#57c4b8' : '#fffadb',
                    color: language === opt.code ? '#fff' : '#5c4f2a',
                    border: '1px solid #e5d78c',
                    borderRadius: '8px',
                    fontWeight: language === opt.code ? '600' : '400',
                    textAlign: 'center',
                    boxShadow: language === opt.code ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {t(opt.labelKey, language)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsControl; 