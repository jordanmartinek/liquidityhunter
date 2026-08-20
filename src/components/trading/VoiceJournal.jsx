import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function VoiceJournal({ entries = [], onNewEntry }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => { return () => { recognitionRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const startRecording = () => {
    if (!SpeechRecognition) return;
    setTranscript(''); setDuration(0);
    startTimeRef.current = Date.now();
    const recognition = new SpeechRecognition();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US';
    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript + interim);
    };
    recognition.onerror = () => stopRecording();
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    recognitionRef.current?.stop(); recognitionRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const finalText = transcript.trim();
    if (finalText && onNewEntry) onNewEntry({ text: finalText, time: new Date().toISOString(), duration });
    setTranscript(''); setDuration(0);
  };

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={isRecording ? stopRecording : startRecording}
          className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            isRecording ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'bg-zinc-800/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200')}>
          {isRecording ? <><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Stop ({fmt(duration)})</> :
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>Journal</>}
        </button>
        {entries.length > 0 && <span className="text-[10px] text-zinc-600">{entries.length} note{entries.length !== 1 ? 's' : ''}</span>}
      </div>
      {isRecording && transcript && <div className="px-3 py-2 rounded-md bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300 max-h-20 overflow-y-auto">{transcript}</div>}
      {entries.length > 0 && !isRecording && (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {entries.slice(-3).map((entry, idx) => (
            <div key={idx} className="px-2 py-1 rounded bg-zinc-800/30 border border-zinc-800">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-zinc-600">{new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[9px] text-zinc-600">{fmt(entry.duration)}</span>
              </div>
              <p className="text-[10px] text-zinc-400 line-clamp-2">{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
