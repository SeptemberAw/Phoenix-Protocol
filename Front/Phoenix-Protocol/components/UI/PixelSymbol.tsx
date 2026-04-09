import React, { useEffect, useState, useRef } from 'react';

const GRID_SIZE = 15; // 15x15 grid for symmetry

// Helper to check if a point is part of the "Asterisk" shape
const isAsterisk = (x: number, y: number) => {
  const center = Math.floor(GRID_SIZE / 2);
  // Center point
  if (x === center && y === center) return true;
  // Cross +
  if (x === center || y === center) return true;
  // Diagonals X
  if (Math.abs(x - center) === Math.abs(y - center)) return true;
  return false;
};

// Helper for "Warning" box shape
const isBox = (x: number, y: number) => {
  return x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1;
}

interface PixelSymbolProps {
  isMining?: boolean;
}

export const PixelSymbol: React.FC<PixelSymbolProps> = ({ isMining = false }) => {
  const [grid, setGrid] = useState<number[][]>([]);
  const frameRef = useRef<number>(0);

  // Initialize Grid
  useEffect(() => {
    const initialGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    setGrid(initialGrid);
  }, []);

  // Animation Loop
  useEffect(() => {
    const animate = () => {
      setGrid(prevGrid => {
        const center = Math.floor(GRID_SIZE / 2);
        const newGrid = prevGrid.map(row => [...row]);
        const time = Date.now() / 1000;

        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            
            if (isMining) {
              // MINING STATE: Chaotic Noise + Scanning
              // Create a scanning bar
              const scanLine = Math.floor((time * 20) % GRID_SIZE);
              
              if (y === scanLine) {
                newGrid[y][x] = Math.random() > 0.3 ? 1 : 0;
              } else {
                 // Fading noise trail
                 if (Math.random() > 0.95) newGrid[y][x] = 1; 
                 else if (Math.random() > 0.7) newGrid[y][x] = 0; 
              }

              // Keep center stable-ish for anchor
              if (x === center && y === center) newGrid[y][x] = 1;

            } else {
              // IDLE STATE: Breathing Asterisk
              const isBaseShape = isAsterisk(x, y);
              
              // Rotate Logic (Simulated)
              // We just pulse the extremities
              if (isBaseShape) {
                const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
                const pulse = (Math.sin(time * 3) + 1) / 2; // 0 to 1
                
                // Cut off edges based on pulse
                if (dist < (GRID_SIZE / 2) * (0.5 + 0.5 * pulse)) {
                   newGrid[y][x] = 1;
                } else {
                   newGrid[y][x] = 0;
                }
              } else {
                newGrid[y][x] = 0;
              }
            }
          }
        }
        return newGrid;
      });
      
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isMining]);

  return (
    <div className="relative w-32 h-32 flex items-center justify-center bg-black/50 border border-primary/20 p-2">
      {/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

      <div 
        className="grid gap-[2px]"
        style={{ 
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` 
        }}
      >
        {grid.map((row, y) => (
          row.map((active, x) => (
            <div 
              key={`${x}-${y}`}
              className={`
                w-1.5 h-1.5 transition-colors duration-75
                ${active ? (isMining ? 'bg-white shadow-[0_0_5px_#fff]' : 'bg-primary') : 'bg-[#111]'}
              `}
            />
          ))
        ))}
      </div>
      
      {/* Glitch Overlay Text when Mining */}
      {isMining && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-[10px] font-mono font-bold text-primary bg-black px-1 animate-pulse border border-primary">
            HASHING
          </div>
        </div>
      )}
    </div>
  );
};