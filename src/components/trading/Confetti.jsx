import React, { useState, useEffect } from 'react';

export default function Confetti({ trigger }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!trigger) return;
    const colors = ['#2dd4bf', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: Date.now() + i, x: 50 + (Math.random() - 0.5) * 20, y: 40,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 300, vy: -100 - Math.random() * 200,
      size: 4 + Math.random() * 4,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 2000);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200]">
      {particles.map((p) => (
        <div key={p.id} className="absolute" style={{
          left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size,
          backgroundColor: p.color, borderRadius: Math.random() > 0.5 ? '50%' : '0',
          animation: 'confetti-fall 2s ease-out forwards',
          '--vx': `${p.vx}px`, '--vy': `${p.vy}px`,
        }} />
      ))}
      <style>{`@keyframes confetti-fall { 0% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(var(--vx, 100px), calc(var(--vy, -200px) + 500px)); opacity: 0; } }`}</style>
    </div>
  );
}
