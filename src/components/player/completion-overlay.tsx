'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface CompletionOverlayProps {
  time: string;
  creatorName: string;
  shareUrl: string;
  onDismiss?: () => void;
}

export function CompletionOverlay({ time, creatorName, shareUrl, onDismiss }: CompletionOverlayProps) {
  useEffect(() => {
    // Fire confetti for 3 seconds
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const handleShareTime = async () => {
    const text = `I solved ${creatorName}'s crossword in ${time}! ${shareUrl}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback — select text
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(255,255,255,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="card text-center" style={{ maxWidth: 400, padding: '40px 32px' }}>
        <h1 style={{ marginBottom: 8 }}>Congratulations!</h1>
        <p className="text-body" style={{ margin: '16px 0' }}>
          You solved it in <strong>{time}</strong>
        </p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-export" onClick={handleShareTime}>
            Share Your Time
          </button>
          <a href="/" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            Play Another
          </a>
        </div>
      </div>
    </div>
  );
}
