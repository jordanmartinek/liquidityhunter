import React, { useState, useEffect } from 'react';

const PHRASES = [
  "Process over profits.", "One trade at a time.", "Trust your rules.",
  "Patience is edge.", "Discipline = Freedom.", "Trade the plan.",
  "Less is more.", "Quality over quantity.", "Protect your capital.",
  "Wait for your pitch.", "Emotions are data.",
];

export default function MotivationalPhrase({ hidden }) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (hidden) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIndex(prev => (prev + 1) % PHRASES.length); setFade(true); }, 300);
    }, 8000);
    return () => clearInterval(interval);
  }, [hidden]);

  if (hidden) return null;
  return <div className={`text-xs text-zinc-600 italic transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>{PHRASES[index]}</div>;
}
