import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Container, Segment, Header, Message, Image } from 'semantic-ui-react';

const isLocalhost = hostname =>
  hostname === 'localhost' ||
  hostname === '[::1]' ||
  /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/.test(hostname);

const MAX_CAPTURE_DIMENSION = 480;
const PHOTO_QUALITY = 0.6;
const MAX_PHOTO_DATA_URL_LENGTH = 240 * 1024;

const compressPhotoDataUrl = (canvas, quality = PHOTO_QUALITY) => {
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let currentQuality = quality;

  while (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH && currentQuality > 0.3) {
    currentQuality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
  }

  return dataUrl;
};

const CameraCapture = ({ onCapture }) => {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoCaptureStarted, setAutoCaptureStarted] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [hasStartedCamera, setHasStartedCamera] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);

  const isSecureCameraAccess = () => {
    if (typeof window === 'undefined') return false;
    if (window.isSecureContext) return true;
    return isLocalhost(window.location.hostname);
  };

  const openFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getUserMedia = async constraints => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints);
    }

    const legacyGetUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (!legacyGetUserMedia) {
      throw new Error('getUserMedia is not supported');
    }

    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject);
    });
  };

  useEffect(() => {
    if (!hasStartedCamera) return undefined;

    let active = true;
    setIsLoading(true);
    setError(null);

    const hasGetUserMediaSupport =
      (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ||
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (!isSecureCameraAccess()) {
      setCameraSupported(false);
      setError(
        'Camera access requires a secure connection. Use https or localhost, or pick a photo manually with the file upload control.'
      );
      setIsLoading(false);
      return undefined;
    }

    if (!hasGetUserMediaSupport) {
      setCameraSupported(false);
      setIsLoading(false);
      return undefined;
    }

    const getCameraStream = async () => {
      try {
        return await getUserMedia({
          // prefer the front-facing camera for taking user selfies
          video: { facingMode: { ideal: 'user' } },
        });
      } catch (error) {
        console.warn('No user-facing camera available, falling back to default camera', error);
        return await getUserMedia({ video: true });
      }
    };

    const startCamera = async () => {
      try {
        const mediaStream = await getCameraStream();
        if (!active) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        setStream(mediaStream);
        setShowManualFallback(false);
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.setAttribute('playsinline', '');
          videoRef.current.setAttribute('muted', '');
          videoRef.current.setAttribute('autoplay', '');

          if ('srcObject' in videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          } else if (window.URL && window.URL.createObjectURL) {
            videoRef.current.src = window.URL.createObjectURL(mediaStream);
          } else {
            videoRef.current.srcObject = mediaStream;
          }

          const setReady = () => {
            setIsVideoReady(true);
            videoRef.current.play().catch(() => {});
          };

          if (videoRef.current.readyState >= 2) {
            setReady();
          }

          videoRef.current.addEventListener(
            'loadedmetadata',
            setReady,
            { once: true },
          );

          videoRef.current.addEventListener(
            'loadeddata',
            setReady,
            { once: true },
          );

          videoRef.current.addEventListener(
            'canplay',
            setReady,
            { once: true },
          );
        }
      } catch (err) {
        console.error('Camera capture error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError') {
          setError('Camera permission denied. Please allow webcam access and try again, or use file upload if needed.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found. Please connect a webcam or use the file upload option.');
        } else {
          setError('Could not open the camera. Please allow camera permission or use the file upload fallback.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    startCamera();

    return () => {
      active = false;
    };
  }, [hasStartedCamera]);

  const stopCurrentStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
    }
  }, [stream]);

  const handleCapture = useCallback((autoConfirm = false) => {
    if (!videoRef.current) return;

    let width = videoRef.current.videoWidth || videoRef.current.clientWidth || 640;
    let height = videoRef.current.videoHeight || videoRef.current.clientHeight || Math.round((width * 3) / 4);
    const maxDimension = MAX_CAPTURE_DIMENSION;

    if (width > maxDimension || height > maxDimension) {
      const aspectRatio = width / height;
      if (width > height) {
        width = maxDimension;
        height = Math.round(maxDimension / aspectRatio);
      } else {
        height = maxDimension;
        width = Math.round(maxDimension * aspectRatio);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Camera capture error: unable to get canvas context');
      setError('Unable to capture the photo from the camera. Please try again or use file upload.');
      return;
    }

    ctx.drawImage(videoRef.current, 0, 0, width, height);
    const photoUrl = compressPhotoDataUrl(canvas);
    setCapturedPhoto(photoUrl);

    if (autoConfirm) {
      stopCurrentStream();
      onCapture(photoUrl);
    }

    canvas.width = 0;
    canvas.height = 0;
  }, [onCapture, stopCurrentStream]);

  useEffect(() => {
    if (!stream || !isVideoReady || capturedPhoto || autoCaptureStarted) return undefined;

    setAutoCaptureStarted(true);
    const timer = window.setTimeout(() => {
      handleCapture(true);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [stream, isVideoReady, capturedPhoto, autoCaptureStarted, handleCapture]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (!hasStartedCamera || isVideoReady || error) return undefined;

    const timer = window.setTimeout(() => {
      setShowManualFallback(true);
      if (!error) {
        setError('Camera is taking too long to initialize. Please use the file picker below.');
      }
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasStartedCamera, isVideoReady, error]);

  const handleStartCapture = () => {
    stopCurrentStream();
    setHasStartedCamera(true);
    setAutoCaptureStarted(false);
    setIsVideoReady(false);
    setCapturedPhoto(null);
    setError(null);
  };

  const handleFileInputChange = event => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopCurrentStream();
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const photoData = reader.result;
      setCapturedPhoto(photoData);
      setIsLoading(false);
      onCapture(photoData);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleConfirm = () => {
    if (!capturedPhoto) return;
    stopCurrentStream();
    onCapture(capturedPhoto);
  };

  const handleRetake = () => {
    stopCurrentStream();
    setCapturedPhoto(null);
    setAutoCaptureStarted(false);
    setIsVideoReady(false);
    setError(null);
    setShowManualFallback(false);
    setHasStartedCamera(true);
  };

  return (
    <Container>
      <Segment>
        <Header as="h1">Capture your photo</Header>
        <p>This photo will be taken before the quiz and shown during the quiz.</p>

        {error && (
          <Message negative>
            <Message.Header>Camera unavailable</Message.Header>
            <p>{error}</p>
          </Message>
        )}

        {!hasStartedCamera && !capturedPhoto && (
          <Segment>
            <Message info>
              We need to take your photo automatically before the quiz. Please press Start below and allow camera access when prompted.
            </Message>
            <Button
              primary
              onClick={handleStartCapture}
              icon="camera"
              labelPosition="left"
              content="Start automatic photo capture"
            />
          </Segment>
        )}

        {hasStartedCamera && !error && !capturedPhoto && cameraSupported && (
          <>
            <div style={{ textAlign: 'center' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  maxWidth: '640px',
                  height: 'auto',
                  borderRadius: '8px',
                  backgroundColor: '#000',
                }}
              />
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <Message warning>
                <strong>Note:</strong> Take photo from front camera only.
              </Message>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Message info>
                {isLoading
                  ? 'Initializing camera…'
                  : autoCaptureStarted
                  ? 'Camera ready. Capturing your photo shortly...'
                  : 'Camera ready. Click capture if the photo does not appear automatically.'}
              </Message>
              <Button
                primary
                onClick={() => handleCapture(false)}
                loading={isLoading}
                disabled={isLoading || !stream}
                icon="camera"
                labelPosition="left"
                content="Capture photo"
              />
              <Button
                secondary
                onClick={openFileInput}
                icon="camera"
                labelPosition="left"
                content="Use file picker"
                style={{ marginLeft: '1rem' }}
              />
              {showManualFallback && (
                <Message warning style={{ marginTop: '1rem' }}>
                  Camera initialization is slow or unsupported. Use the file picker above.
                </Message>
              )}
            </div>
          </>
        )}

        {!capturedPhoto && (!cameraSupported || error) && (
          <Segment>
            <Message info>
              {error ? (
                <>
                  {error} Use the file upload below to take or select a photo.
                </>
              ) : (
                'Camera access is not supported in this browser. Use the file upload below to take or select a photo.'
              )}
            </Message>
            <div style={{ marginBottom: '1rem' }}>
              <Button
                primary
                onClick={handleStartCapture}
                icon="redo"
                labelPosition="left"
                content="Retry camera access"
              />
              <Button
                secondary
                onClick={openFileInput}
                icon="camera"
                labelPosition="left"
                content="Use phone / Edge picker"
                style={{ marginLeft: '1rem' }}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </Segment>
        )}

        {capturedPhoto && (
          <Segment secondary>
            <Header as="h3">Captured photo</Header>
            <Image src={capturedPhoto} size="medium" rounded centered />
            <div style={{ marginTop: '1rem' }}>
              <Button primary onClick={handleConfirm} icon="check" labelPosition="left" content="Use this photo" />
              <Button secondary onClick={handleRetake} style={{ marginLeft: '1rem' }} content="Retake photo" />
            </div>
          </Segment>
        )}

      </Segment>
    </Container>
  );
};

CameraCapture.propTypes = {
  onCapture: PropTypes.func.isRequired,
};

export default CameraCapture;
