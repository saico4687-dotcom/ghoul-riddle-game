import { useRef, useState } from "react";
import { Paperclip, Mic, Square, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface Props {
  disabled?: boolean;
  onPickFile: (file: File, viewOnce: boolean) => Promise<void> | void;
  onRecordedAudio: (blob: Blob, mime: string, durationSeconds: number) => Promise<void> | void;
}

const MAX_RECORD_MS = 2 * 60 * 1000; // دقيقتين كحد أقصى

export default function MediaComposerButtons({ disabled, onPickFile, onRecordedAudio }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewOnceArmed, setViewOnceArmed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const viewOnce = viewOnceArmed;
    setViewOnceArmed(false);
    try {
      await onPickFile(file, viewOnce);
    } catch (err: any) {
      toast.error(err?.message ?? "تعذر إرسال الملف");
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationSeconds = Math.round((Date.now() - startRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: mime });
        setRecording(false);
        setRecordMs(0);
        if (durationSeconds >= 1) {
          setUploading(true);
          try {
            await onRecordedAudio(blob, mime, durationSeconds);
          } catch (err: any) {
            toast.error(err?.message ?? "تعذر إرسال الرسالة الصوتية");
          } finally {
            setUploading(false);
          }
        }
      };
      recorderRef.current = recorder;
      startRef.current = Date.now();
      recorder.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        setRecordMs(elapsed);
        if (elapsed >= MAX_RECORD_MS) stopRecording();
      }, 200);
    } catch {
      toast.error("تعذر الوصول للميكروفون");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stop();
  };

  if (recording) {
    const seconds = Math.floor(recordMs / 1000);
    const mm = Math.floor(seconds / 60);
    const ss = (seconds % 60).toString().padStart(2, "0");
    return (
      <button
        onClick={stopRecording}
        className="flex items-center gap-2 px-3 h-10 rounded-full bg-destructive/20 text-destructive text-xs shrink-0"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
        {mm}:{ss}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => fileInputRef.current?.click()}
        className="p-2 text-white/70 hover:text-white disabled:opacity-50"
        aria-label="إرفاق صورة أو فيديو"
      >
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
      </button>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => setViewOnceArmed((v) => !v)}
        className={`p-2 disabled:opacity-50 ${viewOnceArmed ? "text-primary" : "text-white/70 hover:text-white"}`}
        aria-label="إرسال الوسائط القادمة كـ مشاهدة مرة واحدة"
        title="شاهدها مرة واحدة"
      >
        {viewOnceArmed ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
      </button>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={startRecording}
        className="p-2 text-white/70 hover:text-white disabled:opacity-50"
        aria-label="تسجيل رسالة صوتية"
      >
        <Mic className="w-5 h-5" />
      </button>
    </div>
  );
}
