'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Radio, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'es-ES'; // Default Spanish, fallback English

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onTranscript(transcript);
      }
      setIsListening(false);
    };

    recognition.onerror = (err: any) => {
      console.warn('Speech recognition error:', err);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        // Fallback for re-start error
        recognitionRef.current.abort();
        setTimeout(() => recognitionRef.current.start(), 100);
      }
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        title={isListening ? "Listening... Speak clearly" : "Voice Query (Field-ready audio transcription)"}
        className={cn(
          "relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 border",
          isListening
            ? "bg-red-500/20 text-red-400 border-red-500 animate-pulse shadow-lg shadow-red-500/20"
            : "bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 border-zinc-700/60"
        )}
      >
        {isListening ? (
          <div className="relative flex items-center justify-center">
            <Mic className="h-4 w-4 text-red-400 animate-bounce" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </div>
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>

      {/* Floating active listening indicator badge */}
      {isListening && (
        <div className="absolute bottom-full right-0 mb-3 px-3 py-1.5 rounded-lg bg-zinc-950/95 border border-red-500/50 text-red-300 text-xs shadow-2xl flex items-center gap-2 whitespace-nowrap backdrop-blur-md">
          <Radio className="h-3.5 w-3.5 text-red-400 animate-pulse" />
          <span>Jobsite Mic Active • Speak now...</span>
        </div>
      )}
    </div>
  );
};
