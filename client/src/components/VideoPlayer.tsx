import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  duration: string;
  onProgressUpdate: (progress: number) => void;
  onComplete: () => void;
  isMobile?: boolean;
}

export default function VideoPlayer({
  videoUrl,
  title,
  duration,
  onProgressUpdate,
  onComplete,
  isMobile = false
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Convert duration string (e.g., "12:45") to seconds
  const durationToSeconds = (durationStr: string): number => {
    const parts = durationStr.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return minutes * 60 + seconds;
  };

  useEffect(() => {
    setTotalDuration(durationToSeconds(duration));
  }, [duration]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start progress tracking when video plays
  useEffect(() => {
    if (isPlaying && totalDuration > 0) {
      progressIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          const newProgress = (newTime / totalDuration) * 100;
          
          setProgress(newProgress);
          onProgressUpdate(newProgress);
          
          // Mark as complete when 90% watched
          if (newProgress >= 90 && !hasCompleted) {
            setHasCompleted(true);
            onComplete();
          }
          
          return Math.min(newTime, totalDuration);
        });
      }, 1000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, totalDuration, onProgressUpdate, onComplete, hasCompleted]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setProgress(0);
    setIsPlaying(true);
    setHasCompleted(false);
  };

  const handleSkipForward = () => {
    const newTime = Math.min(currentTime + 30, totalDuration);
    setCurrentTime(newTime);
    const newProgress = (newTime / totalDuration) * 100;
    setProgress(newProgress);
    onProgressUpdate(newProgress);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    const newTime = (percentage / 100) * totalDuration;
    
    setCurrentTime(newTime);
    setProgress(percentage);
    onProgressUpdate(percentage);
  };

  return (
    <div className="bg-black rounded-lg overflow-hidden shadow-lg">
      <div className="relative aspect-video bg-gray-900">
        {/* YouTube iframe for actual video playback */}
        <iframe
          ref={iframeRef}
          src={`${videoUrl}?enablejsapi=1&autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}`}
          title={title}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />

        {/* Custom controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className={`flex items-center ${isMobile ? 'space-x-2' : 'space-x-4'}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              className="text-white hover:text-medical-blue transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestart}
              className="text-white hover:text-medical-blue transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipForward}
              className="text-white hover:text-medical-blue transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </Button>

            <div className="flex-1">
              <Progress 
                value={progress} 
                className="h-2 bg-white/20 cursor-pointer" 
                onClick={handleProgressClick}
              />
            </div>

            <span className={`text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {formatTime(currentTime)} / {duration}
            </span>

            {!isMobile && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-white hover:text-medical-blue transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:text-medical-blue transition-colors"
                >
                  <Maximize className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          {hasCompleted && (
            <div className="mt-2 text-center">
              <span className="text-green-400 text-sm font-medium">
                ✓ Module Completed
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}