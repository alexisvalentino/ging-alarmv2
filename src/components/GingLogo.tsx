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
        src="/logo.png"
        alt="Ging Logo"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain"
        id="ging-logo-img"
        onError={(e) => {
          console.warn("Ging logo.png load warning; verifying source in public directory.", e);
        }}
      />
    </div>
  );
}
