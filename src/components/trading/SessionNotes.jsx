import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';

export default function SessionNotes() {
  const { currentDate, setCurrentDate, saveSessionNote, getSessionNote, getToday } = useResearch();
  const [text, setText] = useState('');
  const [saveTimeout, setSaveTimeout] = useState(null);

  // Load note for current date
  useEffect(() => {
    const note = getSessionNote(currentDate);
    setText(note?.notes || '');
  }, [currentDate, getSessionNote]);

  // Auto-save with debounce
  const handleChange = (newText) => {
    setText(newText);
    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(() => {
      saveSessionNote(currentDate, newText);
    }, 800);
    setSaveTimeout(timeout);
  };

  // Navigate dates
  const navigateDate = (direction) => {
    const date = new Date(currentDate + 'T12:00:00');
    date.setDate(date.getDate() + direction);
    setCurrentDate(date.toLocaleDateString('en-CA'));
  };

  const isToday = currentDate === getToday();

  // Format display date
  const displayDate = new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={12} />
          <span>Session Notes</span>
        </div>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-bg/50">
        <button
          onClick={() => navigateDate(-1)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="text-center">
          <span className="text-xs text-slate-300">{displayDate}</span>
          {isToday && <span className="text-[9px] text-green-400 ml-1.5">(today)</span>}
        </div>
        <button
          onClick={() => navigateDate(1)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          disabled={isToday}
        >
          <ChevronRight size={14} className={isToday ? 'opacity-30' : ''} />
        </button>
      </div>

      {/* Notes Textarea */}
      <div className="flex-1 p-2">
        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`What happened today?\n\n• Which liquidity was swept?\n• What's left untouched?\n• New levels forming?\n• Tomorrow's thesis...`}
          className="w-full h-full resize-none bg-terminal-bg border border-terminal-border rounded p-2 text-xs text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-accent-blue/50"
        />
      </div>
    </div>
  );
}
