/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Image as ImageIcon, RefreshCw, CheckCircle, ChevronRight
} from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface GingAndroidPlugin {
  saveBase64File(options: { base64Data: string, filename: string, mimeType: string }): Promise<{ success: boolean; path: string }>;
}

const GingAndroid = registerPlugin<GingAndroidPlugin>('GingAndroid');

interface QRCodeManagerProps {
  userQRSecret: string;
  onRegenerateSecret: () => void;
  onComplete: () => void;
}

export default function QRCodeManager({ userQRSecret, onRegenerateSecret, onComplete }: QRCodeManagerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate QR code and paint on Canvas
  useEffect(() => {
    if (!canvasRef.current || !userQRSecret) return;

    setIsGenerating(true);
    QRCode.toCanvas(
      canvasRef.current,
      userQRSecret,
      {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H'
      },
      (error) => {
        setIsGenerating(false);
        if (error) console.error('Error generating QR Canvas', error);
      }
    );
  }, [userQRSecret]);

  // Download QR Code as a high-res PNG image
  const downloadPNG = async () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const base64Part = dataUrl.split(',')[1];

      if (Capacitor.isNativePlatform()) {
        try {
          await GingAndroid.saveBase64File({
            base64Data: base64Part,
            filename: 'ging-wake-up-qr.png',
            mimeType: 'image/png'
          });
          triggerToast('Saved to Photos. Print it and place it far from your bed.');
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
              text: 'Print this QR code and place it far from your bed.'
            });
            triggerToast('Share sheet opened.');
            return;
          }
        } catch (e) {
          console.warn("Share API fallback failed, trying direct download:", e);
        }
      }

      const link = document.createElement('a');
      link.download = `ging-wake-up-qr.png`;
      link.href = dataUrl;
      link.click();
      triggerToast('PNG downloaded. Print it to use.');
    } catch (e) {
      console.error(e);
    }
  };

  // Download high-resolution print PDF using jsPDF
  const downloadPDF = async () => {
    if (!canvasRef.current) return;
    try {
      const qrDataUrl = canvasRef.current.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      // A4 is 210 x 297 mm

      // Top accent bar (muted Ging orange)
      doc.setFillColor(255, 138, 66);
      doc.rect(0, 0, 210, 6, 'F');

      // Title & Branding
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.text('Ging', 105, 28, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      doc.text('Your wake-up code — print this and place it far from your bed.', 105, 36, { align: 'center' });

      // Solid Divider
      doc.setDrawColor(225, 225, 225);
      doc.line(20, 44, 190, 44);

      // QR Code (centered)
      const qrW = 92;
      const qrH = 92;
      const qrX = (210 - qrW) / 2;
      const qrY = 60;

      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.6);
      doc.roundedRect(qrX - 5, qrY - 5, qrW + 10, qrH + 10, 2, 2);

      // Inject QR Code Image
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrW, qrH);

      // Secret label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(userQRSecret, 105, qrY + qrH + 14, { align: 'center' });

      // How-to box
      const boxY = qrY + qrH + 28;
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(20, boxY, 170, 46, 2, 2, 'F');
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(20, boxY, 170, 46, 2, 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text('How to set up', 28, boxY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(90, 90, 90);
      doc.text('1.  Print this PDF.', 28, boxY + 20);
      doc.text('2.  Stick it on your bathroom mirror, fridge, or anywhere far from bed.', 28, boxY + 27);
      doc.text('3.  Set an alarm in Ging. To turn it off, walk to this paper and scan it.', 28, boxY + 34);

      // Footer
      doc.setFillColor(20, 20, 20);
      doc.rect(0, 280, 210, 17, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Ging — the alarm that makes you get up.', 105, 290, { align: 'center' });

      // Native Mobile: Save directly to device storage
      if (Capacitor.isNativePlatform()) {
        try {
          const pdfBase64 = doc.output('datauristring').split(',')[1];
          await GingAndroid.saveBase64File({
            base64Data: pdfBase64,
            filename: 'ging-wake-up-sheet.pdf',
            mimeType: 'application/pdf'
          });
          triggerToast('PDF saved to Downloads. Send it to a printer.');
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
              text: 'Print this sheet and place it far from your bed.'
            });
            triggerToast('Share sheet opened.');
            return;
          }
        } catch (e) {
          console.warn("Share API PDF fallback failed, trying direct save:", e);
        }
      }

      // Save PDF
      doc.save(`ging-wake-up-sheet.pdf`);
      triggerToast('PDF downloaded. Print it to use.');
    } catch (e) {
      console.error(e);
    }
  };

  const triggerToast = (msg: string) => {
    setDownloadSuccess(msg);
    setTimeout(() => setDownloadSuccess(null), 5500);
  };

  return (
    <div className="relative min-h-screen ambient-glow-bg text-white flex flex-col p-6 overflow-x-hidden font-sans">
      {/* Ambient haze */}
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      {/* Header */}
      <div className="max-w-md w-full mx-auto py-2 z-10">
        <h1 className="text-[28px] font-bold tracking-tight text-white">Wake-up code</h1>
        <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
          Print this and place it far from your bed — it's the only way to turn an alarm off.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-md w-full mx-auto flex flex-col items-center z-10 mt-6 space-y-6">

        {/* QR Code card */}
        <div className="glass-card rounded-2xl p-6 w-full flex flex-col items-center">
          <div className="p-3 bg-white rounded-xl relative shadow-lg">
            {isGenerating && (
              <div className="absolute inset-0 bg-white/95 flex items-center justify-center rounded-xl">
                <RefreshCw className="w-6 h-6 text-[#FF8A42] animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef} className="w-44 h-44 block rounded-lg" />
          </div>

          <div className="mt-4 flex flex-col items-center text-center">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wide">Your code</span>
            <span className="text-[13px] font-mono font-semibold text-[#FFB37A] tracking-wider mt-1 break-all max-w-[240px]">
              {userQRSecret}
            </span>
          </div>
        </div>

        {/* Actions grouped list */}
        <div className="glass-card rounded-2xl w-full divide-y divide-white/[0.06] overflow-hidden">
          <button
            onClick={onRegenerateSecret}
            className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
          >
            <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5 text-[#FF8A42]" />
            </div>
            <span className="text-[15px] text-white font-medium flex-1 text-left">Regenerate code</span>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>

          <button
            onClick={downloadPNG}
            className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
          >
            <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center">
              <ImageIcon className="w-3.5 h-3.5 text-[#FF8A42]" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-[15px] text-white font-medium block">Save image</span>
              <span className="text-[11px] text-zinc-500">PNG — save to Photos</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>

          <button
            onClick={downloadPDF}
            className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
          >
            <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-[#FF8A42]" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-[15px] text-white font-medium block">Print sheet</span>
              <span className="text-[11px] text-zinc-500">A4 PDF — ready to print</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Success toast */}
        <AnimatePresence>
          {downloadSuccess && (
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="w-full glass-card border-emerald-500/25 p-3.5 rounded-2xl text-[13px] text-emerald-300 flex items-start gap-2.5 font-medium"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{downloadSuccess}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Continue CTA */}
      <div className="max-w-md w-full mx-auto mt-6 z-10">
        <button
          onClick={onComplete}
          className="w-full py-4 rounded-2xl glass-button-glow font-sans font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <span>Done</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
