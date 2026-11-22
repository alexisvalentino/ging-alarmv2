import React from 'react';

interface GingLogoProps {
  className?: string;
  size?: number;
}

export default function GingLogo({ className = '', size = 160 }: GingLogoProps) {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      id="ging-logo-container"
    >
      <img
        src="/gingy-face-cutout.webp"
        alt="Ging mascot"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain"
        id="ging-logo-img"
        onError={(e) => {
          console.warn("Ging face asset failed to load; checking the public image path.", e);
        }}
      />
    </div>
  );
}
