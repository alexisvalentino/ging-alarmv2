/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Image as ImageIcon, RefreshCw, CheckCircle, ChevronRight, AlertCircle, ScanLine
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { GingAndroid } from '../native/GingAndroid';
import QRCodeTestScanner from './QRCodeTestScanner';

const loadPngDataUrl = (src: string) => new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not prepare the mascot image.'));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
    } catch (error) {
      reject(error);
    }
  };
  image.onerror = () => reject(new Error('Could not load the mascot image.'));
  image.src = src;
});

interface QRCodeManagerProps {
  userQRSecret: string;
  hasAlarms: boolean;
  onRegenerateSecret: () => void;
  onComplete: () => void;
}

export default function QRCodeManager({ userQRSecret, hasAlarms, onRegenerateSecret, onComplete }: QRCodeManagerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const regenerateButtonRef = useRef<HTMLButtonElement>(null);
  const cancelRegenerateRef = useRef<HTMLButtonElement>(null);
  const regenerateDialogRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const testScanButtonRef = useRef<HTMLButtonElement>(null);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const closeScanner = useCallback(() => setShowScanner(false), []);

  // Generate QR code and paint on Canvas
  useEffect(() => {
    if (!canvasRef.current || !userQRSecret) return;

    setIsGenerating(true);
    setQrError(null);
    QRCode.toCanvas(
      canvasRef.current,
      userQRSecret,
      {
        width: 640,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H'
      },
      (error) => {
        setIsGenerating(false);
        if (error) {
          console.error('Error generating QR Canvas', error);
          setQrError('Could not create the QR code. Regenerate it and try again.');
        }
      }
    );
  }, [userQRSecret]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  useEffect(() => {
    if (!showScanner) return;
    return () => testScanButtonRef.current?.focus();
  }, [showScanner]);

  useEffect(() => {
    if (!showRegenerateConfirm) return;

    cancelRegenerateRef.current?.focus();

    const closeConfirmation = () => setShowRegenerateConfirm(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirmation();
        return;
      }

      if (event.key !== 'Tab' || !regenerateDialogRef.current) return;
      const controls = Array.from(regenerateDialogRef.current.querySelectorAll(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>);
      if (controls.length === 0) return;

      const first = controls[0];
      const last = controls[controls.length - 1];
      const focusIsInside = regenerateDialogRef.current.contains(document.activeElement);
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
      closeConfirmation();
    };

    document.addEventListener('keydown', handleKeyDown);
    // Capture first so the app-level back handler knows this dialog consumed the action.
    window.addEventListener('ging:back', handleNativeBack, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('ging:back', handleNativeBack, true);
      regenerateButtonRef.current?.focus();
    };
  }, [showRegenerateConfirm]);

  // Download QR Code as a high-res PNG image
  const downloadPNG = async () => {
    if (!canvasRef.current || isGenerating || qrError) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const base64Part = dataUrl.split(',')[1];

      if (Capacitor.getPlatform() === 'android') {
        try {
          await GingAndroid.saveBase64File({
            base64Data: base64Part,
            filename: 'ging-wake-up-qr.png',
            mimeType: 'image/png'
          });
          triggerToast('Saved to Photos.');
          return;
        } catch (nativeErr) {
          console.error("Native PNG save failed, falling back to share sheet:", nativeErr);
        }
      }

      // Native Mobile Fallback: Attempt Web Share API to easily send or print QR Code
      if (navigator.share && navigator.canShare) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], 'ging-wake-up-qr.png', { type: 'image/png' });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Ging wake-up QR code',
              text: 'Place this QR code somewhere you need to stand up to reach.'
            });
            triggerToast('Share sheet opened.');
            return;
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          console.warn("Share API fallback failed, trying direct download:", e);
        }
      }

      const link = document.createElement('a');
      link.download = `ging-wake-up-qr.png`;
      link.href = dataUrl;
      link.click();
      triggerToast('Image downloaded.');
    } catch (e) {
      console.error(e);
      triggerToast('Could not save the QR image. Try again.', true);
    }
  };

  // Download high-resolution print PDF using jsPDF
  const downloadPDF = async () => {
    if (!canvasRef.current || isGenerating || qrError) return;
    try {
      const { jsPDF } = await import('jspdf');
      const qrDataUrl = canvasRef.current.toDataURL('image/png');
      const mascotImage = await loadPngDataUrl('/gingy-mascot-cutout.webp');
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      // A4 page in Ging's warm ivory palette.
      doc.setFillColor(253, 247, 244);
      doc.rect(0, 0, 210, 297, 'F');

      // Mascot lockup, using the same artwork as the app.
      doc.setFillColor(255, 233, 226);
      doc.circle(105, 41, 28, 'F');
      const mascotHeight = 52;
      const mascotWidth = mascotHeight * (mascotImage.width / mascotImage.height);
      doc.addImage(mascotImage.dataUrl, 'PNG', 105 - mascotWidth / 2, 15, mascotWidth, mascotHeight);

      doc.setTextColor(38, 24, 19);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Wake-up code', 105, 80, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(90, 65, 55);
      // Keep the QR itself on a clean white surface for reliable scanning.
      const cardSize = 148;
      const cardX = (210 - cardSize) / 2;
      const cardY = 95;
      const qrSize = 128;
      const qrX = (210 - qrSize) / 2;
      const qrY = cardY + (cardSize - qrSize) / 2;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 191, 178);
      doc.setLineWidth(0.5);
      doc.roundedRect(cardX, cardY, cardSize, cardSize, 7, 7, 'FD');
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(90, 65, 55);
      doc.text('Place away from your bed. Scan to stop the alarm.', 105, 264, { align: 'center' });

      // Native Mobile: Save directly to device storage
      if (Capacitor.getPlatform() === 'android') {
        try {
          const pdfBase64 = doc.output('datauristring').split(',')[1];
          await GingAndroid.saveBase64File({
            base64Data: pdfBase64,
            filename: 'ging-wake-up-sheet.pdf',
            mimeType: 'application/pdf'
          });
          triggerToast('PDF saved to Downloads.');
          return;
        } catch (nativeErr) {
          console.error("Native PDF save failed, falling back to share sheet:", nativeErr);
        }
      }

      // Web Share API fallback
      if (navigator.share && navigator.canShare) {
        try {
          const pdfBlob = doc.output('blob');
          const file = new File([pdfBlob], 'ging-wake-up-sheet.pdf', { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Ging wake-up sheet',
              text: 'Place this QR somewhere you need to stand up to reach.'
            });
            triggerToast('Share sheet opened.');
            return;
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          console.warn("Share API PDF fallback failed, trying direct save:", e);
        }
      }

      // Save PDF
      doc.save(`ging-wake-up-sheet.pdf`);
      triggerToast('PDF downloaded.');
    } catch (e) {
      console.error(e);
      triggerToast('Could not create the print sheet. Try again.', true);
    }
  };

  const triggerToast = (msg: string, isError = false) => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    setFeedback({ message: msg, isError });
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 5500);
  };

  return (
    <div className="relative min-h-dvh ambient-glow-bg ging-screen ging-screen--qr text-white flex flex-col overflow-x-hidden font-sans">
      {/* Ambient haze */}
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      {/* Header */}
      <div className="max-w-md w-full mx-auto py-2 z-10 qr-header">
        <div className="flex items-center justify-between gap-4 qr-heading">
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold tracking-tight text-white">Wake-up code</h1>
            <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
              Place it somewhere you must stand up to reach.
            </p>
          </div>
          <img key={userQRSecret} src="/gingy-mascot-cutout.webp" alt="" aria-hidden="true" className="qr-mascot" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-md w-full mx-auto flex flex-col items-center z-10 mt-6 space-y-6 qr-content">

        {/* Keep the code on a clean square surface for reliable scanning. */}
        <div className="qr-code-stage flex-col gap-2">
          <div className="qr-code-frame relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-white/95 flex items-center justify-center rounded-[20px] z-10">
                <RefreshCw className="w-6 h-6 text-ging-orange animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef} role="img" aria-label="Wake-up QR code" className="qr-code-canvas block" />
          </div>
          <button
            type="button"
            ref={testScanButtonRef}
            onClick={() => setShowScanner(true)}
            disabled={isGenerating || !!qrError}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-[13px] font-medium text-zinc-400 transition-colors hover:text-ging-burnt active:bg-ging-orange/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            <span>Try a scan</span>
          </button>
        </div>

        {qrError && (
          <div className="qr-error w-full rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-300" role="alert">
            {qrError}
          </div>
        )}

        {/* Actions grouped list */}
        <div className="glass-card rounded-2xl w-full divide-y divide-white/[0.06] overflow-hidden qr-actions">
          <button
            ref={regenerateButtonRef}
            onClick={() => setShowRegenerateConfirm(true)}
            disabled={isGenerating}
            className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 qr-action"
          >
            <RefreshCw className="w-5 h-5 text-ging-burnt shrink-0" />
            <span className="text-[15px] text-white font-medium flex-1 text-left">Regenerate code</span>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>

          <button
            onClick={downloadPNG}
            disabled={isGenerating || !!qrError}
            className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 qr-action"
          >
            <ImageIcon className="w-5 h-5 text-ging-burnt shrink-0" />
            <div className="flex-1 text-left">
              <span className="text-[15px] text-white font-medium block">Save image</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>

          <button
            onClick={downloadPDF}
            disabled={isGenerating || !!qrError}
            className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 qr-action"
          >
            <FileText className="w-5 h-5 text-ging-burnt shrink-0" />
            <div className="flex-1 text-left">
              <span className="text-[15px] text-white font-medium block">Print sheet</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Success toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              role={feedback.isError ? 'alert' : 'status'}
              className={`qr-feedback w-full glass-card p-3.5 rounded-2xl text-[13px] flex items-start gap-2.5 font-medium ${feedback.isError ? 'border-red-500/25 text-red-300' : 'border-emerald-500/25 text-emerald-300'}`}
            >
              {feedback.isError
                ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                : <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
              <span>{feedback.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showRegenerateConfirm && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center px-5 py-8 qr-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={event => {
              if (event.target === event.currentTarget) setShowRegenerateConfirm(false);
            }}
          >
            <motion.div
              ref={regenerateDialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="regenerate-code-title"
              aria-describedby="regenerate-code-description"
              className="qr-confirm-card w-full max-w-sm rounded-[28px] p-6"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={event => event.stopPropagation()}
            >
              <h2 id="regenerate-code-title" className="text-[21px] leading-tight font-semibold text-[#261711]">
                Replace wake-up code?
              </h2>
              <p id="regenerate-code-description" className="mt-3 text-[15px] leading-relaxed text-[#674d42]">
                {hasAlarms
                  ? 'Your current printed code will stop working, and every alarm will switch to the new code. Print and place the replacement before your next alarm.'
                  : 'Your current printed code will stop working. Save or print the replacement before relying on it.'}
              </p>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  ref={cancelRegenerateRef}
                  type="button"
                  onClick={() => setShowRegenerateConfirm(false)}
                  className="min-h-12 rounded-full px-5 text-[15px] font-medium text-[#674d42] transition-colors active:bg-[#6c3a22]/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ging-orange"
                >
                  Keep current code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRegenerateConfirm(false);
                    onRegenerateSecret();
                  }}
                  className="glass-button-glow min-h-12 rounded-full px-5 text-[15px] font-semibold text-white active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ging-orange"
                >
                  Replace code
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue CTA */}
      <div className="max-w-md w-full mx-auto mt-6 z-10 qr-footer">
        <button
          onClick={onComplete}
          disabled={isGenerating || !!qrError}
          className="w-full py-4 rounded-2xl glass-button-glow font-sans font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer transition-transform disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Done</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {showScanner && (
        <QRCodeTestScanner expectedSecret={userQRSecret} onClose={closeScanner} />
      )}
    </div>
  );
}
