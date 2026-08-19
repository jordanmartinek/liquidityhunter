import { useState, useCallback, useRef } from 'react';

/**
 * useVoiceInput — browser Speech Recognition hook
 * Uses the Web Speech API (Chrome/Edge). Falls back gracefully.
 *
 * Returns:
 *   isListening: boolean
 *   transcript: string (latest result)
 *   startListening: (onResult?: (text) => void) => void
 *   stopListening: () => void
 *   isSupported: boolean
 */

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const callbackRef = useRef(null);

  const isSupported = !!SpeechRecognition;

  const startListening = useCallback((onResult) => {
    if (!SpeechRecognition) return;

    // Stop any existing session
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    callbackRef.current = onResult || null;
    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      finalTranscript = '';
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      const combined = (finalTranscript + interim).trim();
      setTranscript(combined);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      const final = finalTranscript.trim();
      if (final && callbackRef.current) {
        callbackRef.current(final);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
  };
}
