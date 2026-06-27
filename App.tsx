
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CoachStatus, AnalysisResult, FeedbackMessage } from './types';
import { visionService } from './services/visionService';
import { voiceService } from './services/voiceService';
import { getAICompositionAdvice } from './services/geminiService';
import { 
  Camera, 
  StopCircle, 
  Play, 
  Info, 
  Zap, 
  Move, 
  ShieldCheck, 
  MessageSquareQuote,
  Activity,
  AlertCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<CoachStatus>(CoachStatus.IDLE);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isCameraFallback, setIsCameraFallback] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisLoopRef = useRef<number | null>(null);
  const lastAiAdviceTime = useRef<number>(0);

  const addMessage = useCallback((text: string, type: 'info' | 'warning' | 'success' = 'info') => {
    const newMessage: FeedbackMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      type,
      timestamp: Date.now()
    };
    setMessages(prev => [newMessage, ...prev].slice(0, 5));
    
    // Speak the message
    voiceService.speak(text);
  }, []);

  const startCoach = async () => {
    try {
      setPermissionError(null);
      let stream: MediaStream;

      // Check for getDisplayMedia support (usually for desktop/screen sharing)
      const hasDisplayMedia = navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';
      // Check for getUserMedia support (camera access)
      const hasUserMedia = navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

      if (hasDisplayMedia) {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 15, width: { ideal: 640 } },
            audio: false
          });
          setIsCameraFallback(false);
          addMessage("Coach active: Watching your screen.", 'success');
        } catch (e: any) {
          // If user cancels display media or it fails, try camera as secondary fallback
          if (hasUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment', frameRate: 15, width: { ideal: 640 } },
              audio: false
            });
            setIsCameraFallback(true);
            addMessage("Coach active: Using direct camera access.", 'success');
          } else {
            throw e;
          }
        }
      } else if (hasUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', frameRate: 15, width: { ideal: 640 } },
          audio: false
        });
        setIsCameraFallback(true);
        addMessage("Coach active: Using direct camera access.", 'success');
      } else {
        throw new Error("No media capture capabilities found in this browser.");
      }
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays on mobile
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(console.error);
      }

      setStatus(CoachStatus.WATCHING);

      // Handle stream stop
      stream.getTracks()[0].onended = () => stopCoach();

    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError') {
        setPermissionError("Permissions were denied.");
      } else if (err.name === 'NotFoundError') {
        setPermissionError("No camera or screen capture device found.");
      } else {
        setPermissionError(err.message || "An error occurred while starting the coach.");
      }
      setStatus(CoachStatus.ERROR);
    }
  };

  const stopCoach = useCallback(() => {
    if (analysisLoopRef.current) {
      cancelAnimationFrame(analysisLoopRef.current);
      analysisLoopRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    visionService.reset();
    voiceService.cancel();
    setStatus(CoachStatus.IDLE);
    setIsCameraFallback(false);
    addMessage("Coach deactivated.", 'info');
  }, [addMessage]);

  // Core Analysis Loop
  useEffect(() => {
    if (status !== CoachStatus.WATCHING) return;

    const process = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (video.videoWidth > 0 && ctx) {
        // Downscale for performance and privacy
        canvas.width = 320;
        canvas.height = (video.videoHeight / video.videoWidth) * 320;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const result = visionService.analyzeFrame(canvas);
        setCurrentAnalysis(result);

        // Rule-Based Logic (Throttled via addMessage's internal voiceService throttle)
        if (result.isLowLight) {
          addMessage("Lighting is too low for a good shot.", 'warning');
        } else if (result.isShaking) {
          addMessage("Hold steady for better clarity.", 'warning');
        }

        // Periodic AI Composition Scan (every 12 seconds to save on API calls)
        const now = Date.now();
        if (now - lastAiAdviceTime.current > 12000) {
          lastAiAdviceTime.current = now;
          const frameBase64 = canvas.toDataURL('image/jpeg', 0.5);
          getAICompositionAdvice(frameBase64).then(advice => {
            if (advice && status === CoachStatus.WATCHING) addMessage(advice, 'info');
          });
        }
      }

      analysisLoopRef.current = requestAnimationFrame(process);
    };

    analysisLoopRef.current = requestAnimationFrame(process);

    return () => {
      if (analysisLoopRef.current) cancelAnimationFrame(analysisLoopRef.current);
    };
  }, [status, addMessage]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center p-6 md:p-12 overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Camera className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white/90">Camera Coach</h1>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 ${
          status === CoachStatus.WATCHING ? 'bg-emerald-500/10 text-emerald-400' : 
          status === CoachStatus.IDLE ? 'bg-zinc-800 text-zinc-400' : 'bg-rose-500/10 text-rose-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            status === CoachStatus.WATCHING ? 'bg-emerald-400 pulse-red' : 
            status === CoachStatus.IDLE ? 'bg-zinc-500' : 'bg-rose-500'
          }`} />
          {status === CoachStatus.WATCHING && isCameraFallback ? 'CAMERA MODE' : status}
        </div>
      </div>

      <main className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Main Controls Card */}
        <section className="glass p-8 rounded-[32px] flex flex-col justify-between h-full min-h-[320px]">
          <div>
            <h2 className="text-xl font-semibold mb-2">AI Assistant</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              {isCameraFallback 
                ? "I'm using your camera directly to provide real-time coaching." 
                : "Enable coaching to get real-time voice guidance for your photography."}
            </p>
          </div>

          <div className="space-y-4">
            {status === CoachStatus.IDLE || status === CoachStatus.ERROR ? (
              <button 
                onClick={startCoach}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                <Play fill="currentColor" size={20} />
                ACTIVATE COACH
              </button>
            ) : (
              <button 
                onClick={stopCoach}
                className="w-full py-4 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-500 transition-all rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95"
              >
                <StopCircle size={20} />
                STOP SESSION
              </button>
            )}

            {permissionError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2">
                <AlertCircle className="text-rose-400 flex-shrink-0" size={16} />
                <p className="text-rose-400 text-xs font-medium">{permissionError}</p>
              </div>
            )}
          </div>
        </section>

        {/* Real-time Stats Card */}
        <section className="glass p-8 rounded-[32px] space-y-6">
          <div className="flex items-center justify-between">
             <h2 className="text-xl font-semibold">Environment</h2>
             <Activity className="text-indigo-400 w-5 h-5" />
          </div>

          <div className="space-y-5">
            <StatRow 
              icon={<Zap className={currentAnalysis?.isLowLight ? 'text-amber-400' : 'text-zinc-400'} size={18} />}
              label="Brightness"
              value={currentAnalysis ? `${Math.round(currentAnalysis.brightness)}` : '--'}
              status={currentAnalysis?.isLowLight ? 'Low' : 'Optimal'}
              statusColor={currentAnalysis?.isLowLight ? 'text-amber-400' : 'text-emerald-400'}
            />
            <StatRow 
              icon={<Move className={currentAnalysis?.isShaking ? 'text-rose-400' : 'text-zinc-400'} size={18} />}
              label="Motion"
              value={currentAnalysis ? `${Math.round(currentAnalysis.motionScore)}` : '--'}
              status={currentAnalysis?.isShaking ? 'High' : 'Stable'}
              statusColor={currentAnalysis?.isShaking ? 'text-rose-400' : 'text-emerald-400'}
            />
            <div className="pt-4 border-t border-white/5 flex items-center gap-3 text-xs text-zinc-500">
              <ShieldCheck size={14} className="text-emerald-500" />
              Privacy: Local frame analysis
            </div>
          </div>
        </section>

        {/* Feedback Feed */}
        <section className="glass p-8 rounded-[32px] md:col-span-2 min-h-[260px]">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquareQuote className="text-indigo-400" size={20} />
            <h2 className="text-xl font-semibold">Voice Transcript</h2>
          </div>
          
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-20">
                <Info size={40} className="mb-2" />
                <p className="text-sm">Ready to provide guidance...</p>
              </div>
            ) : (
              messages.map(msg => (
                <div 
                  key={msg.id}
                  className={`p-4 rounded-2xl flex items-start gap-3 transition-all animate-in slide-in-from-bottom duration-500 ${
                    msg.type === 'warning' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-200' : 
                    msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200' : 
                    'bg-white/5 border border-white/10 text-zinc-200'
                  }`}
                >
                  <div className="mt-1">
                    {msg.type === 'warning' ? <Zap size={14} /> : <Info size={14} />}
                  </div>
                  <p className="text-sm font-medium">{msg.text}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Hidden processing elements */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Footer Branding */}
      <footer className="mt-auto py-8 text-zinc-600 text-[10px] uppercase tracking-[0.2em] font-bold">
        Powered by Gemini Flash Composition Engine
      </footer>
    </div>
  );
};

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: string;
  statusColor: string;
}

const StatRow: React.FC<StatRowProps> = ({ icon, label, value, status, statusColor }) => (
  <div className="flex items-center justify-between group">
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-sm font-medium text-zinc-400">{label}</span>
    </div>
    <div className="text-right">
      <div className="text-sm font-bold text-white/90">{value}</div>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>{status}</div>
    </div>
  </div>
);

export default App;
