'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface CompletionOverlayProps {
  time: string;
  creatorName: string;
  shareUrl: string;
  onDismiss?: () => void;
}

export function CompletionOverlay({ time }: CompletionOverlayProps) {
  useEffect(() => {
    // Fire confetti for 3 seconds, z-index above the overlay
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        zIndex: 1001,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        zIndex: 1001,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="overlay">
      <div className="card overlay-card text-center">
        <h1>Congratulations!</h1>
        <p className="text-body">
          You solved it in <strong>{time}</strong>
        </p>
        <div className="overlay-actions">
          <a href="/">
            <button href="/" className="btn btn-secondary">        
            Create Your Own
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}
