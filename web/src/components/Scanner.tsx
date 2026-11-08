import { useEffect, useRef, useState } from "preact/hooks";
import { strings } from "../strings.ts";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

export const canScan = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices;

/** Camera QR scanner using the browser's built-in BarcodeDetector (Android Chrome). */
export function Scanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector({
          formats: ["qr_code"],
        });
        timer = setInterval(async () => {
          if (!video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0] && !stopped) {
            stopped = true;
            onScan(codes[0].rawValue);
          }
        }, 300);
      } catch {
        setError(true);
      }
    })();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div class="scanner">
      {error ? <p class="error">{strings.send.cameraError}</p> : <video ref={video} playsInline muted />}
      <button type="button" class="btn btn--secondary" onClick={onClose}>
        {strings.send.stopScan}
      </button>
    </div>
  );
}
