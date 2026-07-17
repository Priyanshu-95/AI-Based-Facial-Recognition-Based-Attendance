import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Camera, RefreshCw, Scan, CheckCircle2, XCircle, Loader2, Sun } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FaceScanAttendanceProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScanStatus = 'idle' | 'camera' | 'scanning' | 'success' | 'error';

interface ScanResult {
  status: 'success' | 'failed' | 'already_marked';
  message: string;
  student?: {
    name: string;
    enroll: string;
  };
  reason?: string;
  confidence?: number;
}

const FaceScanAttendance = ({ isOpen, onClose }: FaceScanAttendanceProps) => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [lightingOk, setLightingOk] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = async () => {
    try {
      setStatus('camera');
      setError('');
      setResult(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please grant camera permissions.');
      setStatus('error');
    }
  };

  // Check lighting conditions
  useEffect(() => {
    if (status !== 'camera') return;

    const checkLighting = () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let totalBrightness = 0;
      let sampleCount = 0;
      for (let i = 0; i < data.length; i += 80) { // check every 20th pixel
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (r + g + b) / 3;
        sampleCount++;
      }
      
      const avgBrightness = totalBrightness / sampleCount;
      setLightingOk(avgBrightness > 50 && avgBrightness < 230);
    };

    const interval = setInterval(checkLighting, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      setStatus('scanning');
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0);

      // Convert to base64
      const capturedImage = canvas.toDataURL('image/jpeg', 0.8);

      console.log('Sending face scan request...');

      // Call the edge function
      const { data, error: invokeError } = await supabase.functions.invoke('face-scan-attendance', {
        body: { capturedImage }
      });

      if (invokeError) {
        console.error('Edge function error:', invokeError);
        throw new Error(invokeError.message || 'Failed to process face scan');
      }

      console.log('Face scan response:', data);

      setResult(data);
      
      if (data.status === 'success') {
        setStatus('success');
        toast.success(`Present – ${data.student?.name} (Enroll: ${data.student?.enroll})`);
      } else if (data.status === 'already_marked') {
        setStatus('success');
        toast.info(`Attendance already marked for ${data.student?.name}`);
      } else {
        setStatus('error');
        setError(getErrorMessage(data.reason));
      }
    } catch (err) {
      console.error('Scan error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to process face scan');
    }
  };

  const getErrorMessage = (reason?: string): string => {
    switch (reason) {
      case 'no_image':
        return 'Face not detected. Please ensure your face is visible.';
      case 'poor_lighting':
        return 'Poor lighting detected. Please move to a well-lit area.';
      case 'no_match':
        return 'No match found in database. Please ensure you are registered.';
      case 'low_confidence':
        return 'Could not verify identity. Please try again.';
      case 'no_registered_faces':
        return 'No registered faces in the system yet.';
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setError('');
    setResult(null);
    startCamera();
  };

  const handleClose = () => {
    stopCamera();
    setStatus('idle');
    setError('');
    setResult(null);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, stopCamera]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Scan className="w-5 h-5 text-primary" />
            Face Scan Attendance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera Preview */}
          <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${status === 'success' || status === 'error' ? 'opacity-50' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning Overlay */}
            {status === 'camera' && (
              <>
                {/* Face guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-56 border-2 border-primary/50 rounded-full animate-pulse" />
                </div>
                
                {/* Scanning line animation */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                
                {/* Lighting indicator */}
                {!lightingOk && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black px-3 py-1 rounded-full text-sm flex items-center gap-1">
                    <Sun className="w-4 h-4" />
                    Poor lighting
                  </div>
                )}
              </>
            )}

            {/* Scanning Status */}
            {status === 'scanning' && (
              <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-foreground font-medium">Scanning face...</p>
                <p className="text-muted-foreground text-sm">Please wait</p>
              </div>
            )}

            {/* Success State */}
            {status === 'success' && result && (
              <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4">
                <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                <p className="text-xl font-bold text-foreground mb-2">
                  {result.status === 'already_marked' ? 'Already Marked!' : 'Present!'}
                </p>
                <p className="text-lg text-foreground">{result.student?.name}</p>
                <p className="text-muted-foreground">Enroll: {result.student?.enroll}</p>
                {result.confidence && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Confidence: {result.confidence}%
                  </p>
                )}
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4">
                <XCircle className="w-16 h-16 text-destructive mb-4" />
                <p className="text-lg font-bold text-foreground mb-2">Scan Failed</p>
                <p className="text-muted-foreground text-center text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {status === 'camera' && (
              <Button 
                onClick={captureAndScan} 
                className="flex-1 glow-blue"
                disabled={!lightingOk}
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture & Scan
              </Button>
            )}

            {(status === 'success' || status === 'error') && (
              <>
                <Button 
                  onClick={handleRetry} 
                  variant="outline" 
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  onClick={handleClose} 
                  className="flex-1"
                >
                  Done
                </Button>
              </>
            )}

            {status === 'idle' && (
              <Button onClick={startCamera} className="flex-1">
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
            )}
          </div>

          {/* Instructions */}
          {status === 'camera' && (
            <p className="text-xs text-muted-foreground text-center">
              Position your face within the oval and ensure good lighting
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaceScanAttendance;
