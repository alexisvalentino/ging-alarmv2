/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, X } from 'lucide-react';
import jsQR from 'jsqr';
import { matchesWakeUpCode } from '../utils/qrValidation';

type ScanState = 'starting' | 'scanning' | 'wrong-code' | 'matched' | 'error';

interface QRCodeTestScannerProps {
  expectedSecret: string;
  onClose: () => void;
}

export default function QRCodeTestScanner({ expectedSecret, onClose }: QRCodeTestScannerProps) {
  const [scanState, setScanState] = useState<ScanState>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scanStateRef = useRef<ScanState>('starting');

  const updateScanState = (nextState: ScanState) => {
    scanStateRef.current = nextState;
    setScanState(nextState);
  };

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>);
      if (controls.length === 0) return;

      const first = controls[0];
      const last = controls[controls.length - 1];
      const focusIsInside = dialogRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !focusIsInside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !focusIsInside)) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleNativeBack = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('ging:back', handleNativeBack, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('ging:back', handleNativeBack, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (scanState === 'matched') closeButtonRef.current?.focus();
  }, [scanState]);

  useEffect(() => {
    let isCurrentRequest = true;
    let stream: MediaStream | null = null;
    let animationFrame: number | null = null;
    let wrongCodeTimer: number | null = null;
    let trackEndedListener: (() => void) | null = null;

    const stopCamera = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      if (wrongCodeTimer !== null) {
        window.clearTimeout(wrongCodeTimer);
        wrongCodeTimer = null;
      }

      if (stream) {
        if (trackEndedListener) {
          stream.getVideoTracks()[0]?.removeEventListener('ended', trackEndedListener);
          trackEndedListener = null;
        }
        stream.getTracks().forEach(track => track.stop());
        if (videoRef.current?.srcObject === stream) {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
        }
        stream = null;
      }
    };

    const scheduleScan = () => {
      if (!isCurrentRequest || animationFrame !== null
        || scanStateRef.current === 'matched' || scanStateRef.current === 'error') return;
      animationFrame = window.requestAnimationFrame(scanFrame);
    };

    const scanFrame = () => {
      animationFrame = null;
      if (!isCurrentRequest || scanStateRef.current === 'matched' || scanStateRef.current === 'error') return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d', { willReadFrequently: true });
      if (video && canvas && context && video.readyState >= 2
        && video.videoWidth > 0 && video.videoHeight > 0
        && scanStateRef.current !== 'wrong-code') {
        try {
          const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const decodedCode = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'dontInvert',
          });

          if (decodedCode && matchesWakeUpCode(decodedCode.data, expectedSecret)) {
            updateScanState('matched');
            stopCamera();
            return;
          }

          if (decodedCode && scanStateRef.current === 'scanning') {
            updateScanState('wrong-code');
            wrongCodeTimer = window.setTimeout(() => {
              wrongCodeTimer = null;
              if (isCurrentRequest && scanStateRef.current === 'wrong-code') {
                updateScanState('scanning');
              }
            }, 1600);
          }
        } catch {
          stopCamera();
          setCameraError('The camera could not read this frame. Close and try again.');
          updateScanState('error');
          return;
        }
      }

      scheduleScan();
    };

    const showCameraError = (error: unknown) => {
      stopCamera();
      const errorName = error instanceof Error ? error.name : '';
      setCameraError(errorName === 'NotAllowedError' || errorName === 'SecurityError'
        ? 'Camera access is blocked. Allow it for Ging, then try again.'
        : errorName === 'NotFoundError'
          ? 'No camera was found on this device.'
          : "Couldn't start the camera. Check camera access or close another app using it, then try again.");
      updateScanState('error');
    };

    const startCamera = async () => {
      setCameraError(null);
      updateScanState('starting');

      if (!navigator.mediaDevices?.getUserMedia) {
        showCameraError(new Error('Camera API unavailable'));
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isCurrentRequest) {
          stopCamera();
          return;
        }

        const video = videoRef.current;
        const videoTrack = stream.getVideoTracks()[0];
        if (!video || !videoTrack) throw new Error('Camera feed is unavailable.');

        trackEndedListener = () => {
          if (!isCurrentRequest) return;
          showCameraError(new Error('Camera feed stopped.'));
        };
        videoTrack.addEventListener('ended', trackEndedListener);
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();

        if (!isCurrentRequest) {
          stopCamera();
          return;
        }

        updateScanState('scanning');
        scheduleScan();
      } catch (error) {
        showCameraError(error);
      }
    };

    void startCamera();
    return () => {
      isCurrentRequest = false;
      stopCamera();
    };
  }, [expectedSecret, retryCount]);

  const retryCamera = () => {
    closeButtonRef.current?.focus();
    setCameraError(null);
    setRetryCount(count => count + 1);
  };

  return (
    <div className={`qr-test-fullscreen ${scanState === 'matched' ? 'qr-test-fullscreen--matched' : ''}`}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-test-title"
        aria-describedby={scanState === 'matched' ? 'qr-test-result-copy' : 'qr-test-description'}
        className="qr-test-screen"
      >
        {scanState === 'matched' ? (
          <>
            <main className="qr-test-success" role="status" aria-live="polite">
              <CheckCircle className="h-14 w-14 text-emerald-600" aria-hidden="true" />
              <h1 id="qr-test-title" className="mt-5 text-2xl font-semibold leading-tight">
                That&apos;s your wake-up code
              </h1>
              <p id="qr-test-result-copy" className="mt-3 max-w-sm text-base leading-relaxed text-[#674d42]">
                It matches this alarm. Save or print it before your next alarm.
              </p>
            </main>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="glass-button-glow min-h-12 w-full rounded-2xl text-base font-semibold active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ging-orange"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <header className="qr-test-header">
              <div className="min-w-0">
                <h1 id="qr-test-title" className="text-xl font-semibold leading-tight">Try a scan</h1>
                <p id="qr-test-description" className="mt-1 text-sm leading-relaxed text-white/75">
                  Point at a printed code or another screen. This won&apos;t stop an alarm.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ging-orange"
                aria-label="Close scanner"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </header>

            <div className="qr-test-camera" style={{ containerType: 'inline-size' }}>
              <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted aria-hidden="true" />
              <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

              {scanState === 'starting' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#211a17] p-5 text-center text-white" role="status" aria-live="polite">
                  <RefreshCw className="h-7 w-7 animate-spin motion-reduce:animate-none text-ging-orange" aria-hidden="true" />
                  <span className="text-sm font-medium">Starting camera…</span>
                </div>
              )}

              {scanState === 'error' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#211a17]/95 p-6 text-center text-white" role="alert">
                  <AlertCircle className="h-8 w-8 text-red-300" aria-hidden="true" />
                  <p className="max-w-xs text-sm leading-relaxed text-white/85">{cameraError}</p>
                  <button
                    type="button"
                    onClick={retryCamera}
                    className="glass-button min-h-12 rounded-full px-5 text-sm font-semibold active:scale-[0.99]"
                  >
                    Try camera again
                  </button>
                </div>
              )}

              {(scanState === 'scanning' || scanState === 'wrong-code') && (
                <div className={`qr-test-scan-overlay absolute inset-0 flex items-center justify-center ${scanState === 'wrong-code' ? 'text-red-200' : ''}`} aria-hidden="true">
                  <div className="qr-test-scan-frame relative">
                    <div className="scanner-corner absolute -top-px -left-px h-10 w-10 border-t-2 border-l-2 rounded-tl-2xl" />
                    <div className="scanner-corner absolute -top-px -right-px h-10 w-10 border-t-2 border-r-2 rounded-tr-2xl" />
                    <div className="scanner-corner absolute -bottom-px -left-px h-10 w-10 border-b-2 border-l-2 rounded-bl-2xl" />
                    <div className="scanner-corner absolute -bottom-px -right-px h-10 w-10 border-b-2 border-r-2 rounded-br-2xl" />
                  </div>
                </div>
              )}
            </div>

            {(scanState === 'scanning' || scanState === 'wrong-code') && (
              <p className={`qr-test-status ${scanState === 'wrong-code' ? 'qr-test-status--error' : ''}`} role="status" aria-live="polite">
                {scanState === 'wrong-code' ? 'That’s a different code. Keep scanning your wake-up code.' : 'Center the code in the frame.'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
