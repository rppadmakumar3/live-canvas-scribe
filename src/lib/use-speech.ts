import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  onSegment: (text: string) => void;
  onInterim?: (text: string) => void;
  pauseMs?: number;
};

/** Web Speech API wrapper: streams interim text and emits a segment on a pause. */
export function useSpeech({ onSegment, onInterim, pauseMs = 1600 }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef = useRef({ onSegment, onInterim });
  cbRef.current = { onSegment, onInterim };

  useEffect(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  const flush = useCallback(() => {
    const text = bufferRef.current.trim();
    bufferRef.current = "";
    if (text) cbRef.current.onSegment(text);
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop?.();
    recRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    setListening(false);
    flush();
  }, [flush]);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition is not available in this browser — use typed input.");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) bufferRef.current += `${r[0].transcript.trim()} `;
        else interim += r[0].transcript;
      }
      cbRef.current.onInterim?.((bufferRef.current + interim).trim());
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        flush();
        cbRef.current.onInterim?.("");
      }, pauseMs);
    };
    rec.onerror = (e: any) => setError(e?.error ?? "Speech recognition error");
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    rec.start();
    setListening(true);
  }, [flush, pauseMs]);

  useEffect(() => () => recRef.current?.stop?.(), []);

  return { supported, listening, error, start, stop };
}
