/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download, FileText, Image, RefreshCw, Printer, AlertOctagon,
  CheckCircle, ShieldCheck, Dumbbell, Sparkles, AlertTriangle
} from 'lucide-react';
import GingLogo from './GingLogo';
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
          triggerToast('PNG Image saved to your Photos/Gallery folder! Print or scan it now!');
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
              title: 'GING Wake Up QR Code',
              text: 'Print this QR code and paste it in your bathroom to shut off GING alarm!'
            });
            triggerToast('Share sheet opened successfully!');
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
      triggerToast('PNG Image Downloaded! Now send it to your computer or print it!');
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

      // Top Border Accent using Ging Gradient feel
      doc.setFillColor(255, 108, 53); // orange
      doc.rect(0, 0, 210, 8, 'F');

      doc.setFillColor(255, 61, 76); // red
      doc.rect(0, 8, 210, 4, 'F');

      // Title & Branding
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.text('GING: ANTI-SLEEP ALARM SYSTEM', 105, 30, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Official Wake Up Manifest & Persistent QR Code sheet', 105, 37, { align: 'center' });

      // Solid Divider
      doc.setDrawColor(220, 220, 220);
      doc.line(20, 45, 190, 45);

      // Warning Box
      doc.setFillColor(255, 237, 230); // light cream-orange background
      doc.rect(20, 52, 170, 32, 'F');

      doc.setDrawColor(255, 108, 53);
      doc.setLineWidth(0.8);
      doc.rect(20, 52, 170, 32);

      // Warning content
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(230, 60, 40);
      doc.text('CRITICAL WARNING: DO NOT LEAVE ON YOUR NIGHTSTAND', 105, 59, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);
      doc.text('This QR image is your ONLY way out of the alarm. If you leave this sheet next to your bed,', 105, 67, { align: 'center' });
      doc.text('you will fall into the snooze trap and fail. Stick it inside your bathroom, on your fridge,', 105, 72, { align: 'center' });
      doc.text('or at least 10 meters away from your sleeping zone. Force yourself to walk to be set free.', 105, 77, { align: 'center' });

      // QR Code Position (90mm size, centered on page)
      const qrW = 92;
      const qrH = 92;
      const qrX = (210 - qrW) / 2;
      const qrY = 96;

      // Draw QR Border
      doc.setDrawColor(30, 30, 30);
      doc.setLineWidth(1.5);
      doc.rect(qrX - 4, qrY - 4, qrW + 8, qrH + 8);

      // Inject QR Code Image
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrW, qrH);

      // Labels below QR Code
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`SECURITY_KEY: ${userQRSecret}`, 105, 202, { align: 'center' });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text('Verification Code generated by Ging OS Cryptography module', 105, 207, { align: 'center' });

      // Footer divider
      doc.setDrawColor(240, 240, 240);
      doc.line(30, 240, 180, 240);

      // Step by Step printing guides
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text('HOW TO CONFIGURE:', 30, 248);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text('1. Print this A4 PDF directly on paper (use black or color ink).', 30, 254);
      doc.text('2. Clip or stick it on your bathroom mirror, refrigerator, or outer kitchen cabinet.', 30, 259);
      doc.text('3. Set an alarm in the Ging App. In the morning, you must carry your phone to this paper to stop it.', 30, 264);

      // Branding stamp on side
      doc.setFillColor(30, 30, 30);
      doc.rect(0, 280, 210, 17, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('GING APP — GISISING KA KAHIT AYAW MO PA', 105, 290, { align: 'center' });

      // Native Mobile Fallback: Save directly to device storage if on native platform
      if (Capacitor.isNativePlatform()) {
        try {
          const pdfBase64 = doc.output('datauristring').split(',')[1];
          await GingAndroid.saveBase64File({
            base64Data: pdfBase64,
            filename: 'ging-wake-up-sheet.pdf',
            mimeType: 'application/pdf'
          });
          triggerToast('PDF Sheet saved to your Downloads/Ging/ folder! Send to printer now!');
          return;
        } catch (nativeErr) {
          console.error("Native PDF save failed, falling back to share sheet:", nativeErr);
        }
      }

      // Native Mobile Fallback: Attempt Web Share API to easily send or print PDF document
      if (navigator.share && navigator.canShare) {
        try {
          const pdfBlob = doc.output('blob');
          const file = new File([pdfBlob], 'ging-wake-up-sheet.pdf', { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'GING Wake Up Sheet PDF',
              text: 'Print this A4 PDF sheet and paste it in your bathroom!'
            });
            triggerToast('Share sheet opened successfully!');
            return;
          }
        } catch (e) {
          console.warn("Share API PDF fallback failed, trying direct save:", e);
        }
      }

      // Save PDF
      doc.save(`ging-wake-up-sheet.pdf`);
      triggerToast('PDF Sheet Downloaded! Perfect for clean high-res paper printing!');
    } catch (e) {
      console.error(e);
    }
  };

  const triggerToast = (msg: string) => {
    setDownloadSuccess(msg);
    setTimeout(() => setDownloadSuccess(null), 5500);
  };

  return (
    <div className="relative min-h-screen bg-gray-50 text-black flex flex-col justify-between p-6 overflow-x-hidden font-sans">

      {/* Upper Brand Badge */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-3 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <GingLogo size={36} />
          <span className="font-sans font-black text-xl tracking-wider text-black uppercase">Ging Code</span>
        </div>
        <span className="text-[10px] font-mono font-black text-emerald-800 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded border-2 border-black polish-shadow-sm">
          COMPILER READY
        </span>
      </div>

      {/* Main Core View */}
      <div className="flex-1 max-w-md w-full mx-auto py-8 flex flex-col items-center justify-center">

        <div className="text-center mb-6">
          <h2 className="text-xl font-black tracking-tight text-black flex items-center justify-center gap-2 uppercase">
            2. Your Wake-Up Shield
            <Dumbbell className="w-5 h-5 text-red-600" />
          </h2>
          <p className="text-zinc-600 text-xs mt-2 leading-relaxed font-semibold">
            This QR verification key is randomized for ultimate anti-sleep override. Print this out right now to secure your escape:
          </p>
        </div>

        {/* QR Code Container styled with crisp flat borders and solid black shadow */}
        <div className="p-6 bg-white border-2 border-black rounded-3xl flex flex-col items-center relative w-full max-w-[290px] mx-auto overflow-hidden polish-shadow">
          {/* Retro corner accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-black" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-black" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-black" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-black" />

          {/* Canvas container */}
          <div className="p-3 bg-white rounded-2xl border-2 border-black relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-white/95 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-orange-600 animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef} className="w-48 h-48 block" />
          </div>

          <div className="mt-4 flex flex-col items-center text-center">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-black">
              System Cryptography Signature
            </span>
            <span className="text-xs font-mono font-black text-orange-600 tracking-wider mt-1 break-all max-w-[240px]">
              {userQRSecret}
            </span>
          </div>
        </div>

        {/* Regenerator key button */}
        <button
          onClick={onRegenerateSecret}
          className="mt-4 flex items-center gap-1.5 text-xs text-black font-black uppercase tracking-wider bg-white hover:bg-zinc-100 px-3.5 py-2 rounded-full border-2 border-black polish-shadow-sm active:translate-y-[1px] active:shadow-none"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Regenerate Key</span>
        </button>

        {/* Informative advice warning block */}
        <div className="mt-6 w-full p-4 bg-white border-2 border-black rounded-2xl flex gap-3 polish-shadow">
          <AlertOctagon className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-800 space-y-1">
            <span className="font-black text-black block uppercase tracking-tight">RUTHLESS RULE #1: DO NOT TAMPER</span>
            <p className="font-semibold leading-relaxed">Do NOT save this on your local laptop screen or photo gallery. Download and PRINT it, then paste it on your <span className="text-orange-600 underline">bathroom cabinet mirror</span>. Moving physically turns on biological alarm overrides.</p>
          </div>
        </div>

        {/* Download Action Matrix with robust retro design parameters */}
        <div className="w-full mt-6 grid grid-cols-2 gap-4">
          <button
            onClick={downloadPNG}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border-2 border-black hover:bg-orange-50 hover:text-black transition-colors text-center group cursor-pointer polish-shadow"
          >
            <Image className="w-6 h-6 text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black text-black">Download PNG</span>
            <span className="text-[9px] text-zinc-500 font-bold mt-1 uppercase">Image for backup</span>
          </button>

          <button
            onClick={downloadPDF}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border-2 border-black hover:bg-orange-50 hover:text-black transition-colors text-center group cursor-pointer polish-shadow"
          >
            <FileText className="w-6 h-6 text-red-650 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black text-black">Download PDF</span>
            <span className="text-[9px] text-zinc-500 font-bold mt-1 uppercase">Print Sheet (A4)</span>
          </button>
        </div>

        {/* Success toast notification panel */}
        <AnimatePresence>
          {downloadSuccess && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="mt-4 p-3 bg-green-50 border-2 border-green-600 rounded-xl text-xs text-green-950 flex items-start gap-2 max-w-sm w-full font-bold"
            >
              <CheckCircle className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
              <span>{downloadSuccess}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Primary Proceed CTA Footer */}
      <div className="max-w-md w-full mx-auto mt-6">
        <button
          onClick={onComplete}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 via-orange-600 to-red-700 text-white font-sans font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border-2 border-black polish-shadow active:translate-y-1 active:shadow-none"
        >
          <span>Complete Alarm Setup & Open Ging Panel</span>
          <ShieldCheck className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
