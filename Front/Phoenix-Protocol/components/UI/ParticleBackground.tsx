import React from 'react';

export const ParticleBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#050505]">
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 z-[1] opacity-20" 
        style={{
            backgroundImage: `linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
        }}
      />
      
      {/* Scanline Animation */}
      <div className="absolute inset-0 z-[2] bg-scanlines opacity-10 animate-pulse" />
      
      {/* Large faint symbol in background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-primary/5 rounded-full z-0 opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-dashed border-primary/10 rounded-full z-0 opacity-20 animate-spin-slow" />
    </div>
  );
};