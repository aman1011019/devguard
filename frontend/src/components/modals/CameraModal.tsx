import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImageUp, ScanLine as ScanIcon, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { api } from "@/lib/api";
import { confidencePct } from "@/lib/utils";
import type { ImageAnalysis } from "@/lib/types";

/**
 * Screenshot / camera triage. A live camera stream is offered when the device
 * has one (phones point at a dashboard on a monitor); otherwise the file picker
 * covers it. Streams are stopped on every exit path so the camera light never
 * stays on.
 */
export function CameraModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageAnalysis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const analyze = useMutation({
    mutationFn: () => api.analyzeImage(file),
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries();
    },
  });

  useEffect(() => {
    if (!open) {
      stopStream();
      setResult(null);
      setCamError(null);
      setPreview((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
      setFile(null);
    }
  }, [open, stopStream]);

  useEffect(() => stopStream, [stopStream]);

  const startCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setStreaming(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCamError("No camera available or permission denied — upload a screenshot instead.");
      setStreaming(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const captured = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setFile(captured);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(captured);
      });
      stopStream();
    }, "image/jpeg", 0.9);
  };

  const pick = (picked: File | null | undefined) => {
    if (!picked) return;
    setFile(picked);
    setResult(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(picked);
    });
    stopStream();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Analyze a screenshot"
      subtitle="Point the camera at a dashboard or upload an error screenshot — DevGuard extracts the service, error code and metrics."
      icon={<Camera className="h-4 w-4" aria-hidden />}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={analyze.isPending}
            onClick={() => analyze.mutate()}
            icon={<ScanIcon className="h-3.5 w-3.5" />}
          >
            Analyze
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-elevated">
          {streaming ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              aria-label="Camera preview"
            />
          ) : preview ? (
            <img src={preview} alt="Selected screenshot" className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <p className="text-xs leading-relaxed text-faint">
                No image yet. Start the camera or upload a screenshot.
                <br />
                Analysis also works with no image at all, using live telemetry.
              </p>
            </div>
          )}
        </div>

        {camError ? <p className="text-xs text-warn">{camError}</p> : null}

        <div className="flex flex-wrap gap-2">
          {streaming ? (
            <>
              <Button size="sm" variant="primary" onClick={capture} icon={<Camera className="h-3.5 w-3.5" />}>
                Capture
              </Button>
              <Button size="sm" variant="ghost" onClick={stopStream} icon={<VideoOff className="h-3.5 w-3.5" />}>
                Stop camera
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={startCamera}
              icon={<Video className="h-3.5 w-3.5" />}
            >
              Start camera
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            icon={<ImageUp className="h-3.5 w-3.5" />}
          >
            Upload image
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        {analyze.isError ? (
          <p className="text-xs text-bad">
            {(analyze.error as Error)?.message ?? "Image analysis failed."}
          </p>
        ) : null}

        {result ? (
          <div className="rounded-2xl border border-accent/30 bg-accent/8 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-accent/40 text-accent">{result.detected_service}</span>
              <span className="chip font-mono">{result.error_code}</span>
              <span className="chip">{confidencePct(result.confidence)} confidence</span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-ink">{result.message}</p>
            {Object.keys(result.detected_metrics).length ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(result.detected_metrics).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-line bg-surface/70 p-2.5">
                    <dt className="text-2xs uppercase tracking-[0.08em] text-faint">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="mt-0.5 font-mono text-xs font-semibold text-ink">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {result.suggested_incident ? (
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigate(`/incidents/${result.suggested_incident}`);
                  onClose();
                }}
              >
                Open incident #{result.suggested_incident}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
