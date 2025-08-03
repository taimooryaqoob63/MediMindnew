import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, SkipForward, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptVideoPlayerProps {
  videoUrl: string;
  title: string;
  duration?: string;
  transcript?: TranscriptSegment[];
  transcriptionStatus?: string;
  onProgressUpdate?: (progress: number) => void;
  onComplete?: () => void;
  isMobile?: boolean;
}

export default function TranscriptVideoPlayer({
  videoUrl,
  title,
  duration = "00:00",
  transcript = [],
  transcriptionStatus = "pending",
  onProgressUpdate,
  onComplete,
  isMobile = false
}: TranscriptVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Find active transcript segment
  useEffect(() => {
    if (transcript.length > 0) {
      const activeIndex = transcript.findIndex(segment => 
        currentTime >= segment.start && currentTime <= segment.end
      );
      setActiveSegmentIndex(activeIndex);
    }
  }, [currentTime, transcript]);

  // Handle video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration || totalDuration;
      
      setCurrentTime(current);
      const newProgress = (current / total) * 100;
      setProgress(newProgress);
      
      if (onProgressUpdate) {
        onProgressUpdate(newProgress);
      }
      
      // Mark as complete when 90% watched
      if (newProgress >= 90 && !hasCompleted) {
        setHasCompleted(true);
        if (onComplete) {
          onComplete();
        }
      }
    }
  };

  // Handle video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setTotalDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const clickProgress = (clickX / width) * 100;
      const newTime = (clickProgress / 100) * totalDuration;
      
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(clickProgress);
    }
  };

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, totalDuration);
    }
  };

  const restart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setProgress(0);
    }
  };

  const jumpToSegment = (segmentStart: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = segmentStart;
      setCurrentTime(segmentStart);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const getTranscriptionStatusBadge = () => {
    switch (transcriptionStatus) {
      case 'completed':
        return <Badge variant="default">Transcribed</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing...</Badge>;
      case 'failed':
        return <Badge variant="destructive">Transcription Failed</Badge>;
      default:
        return <Badge variant="outline">Transcription Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full aspect-video"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls={false}
        />
        
        {/* Custom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div 
            className="w-full h-2 bg-white/20 rounded-full mb-3 cursor-pointer"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              
              <span className="text-sm">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={restart}
                className="text-white hover:bg-white/20"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={skipForward}
                className="text-white hover:bg-white/20"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
              
              {transcript.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="text-white hover:bg-white/20"
                >
                  <FileText className="w-5 h-5" />
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
              >
                <Maximize className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Section */}
      {(showTranscript || isMobile) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Transcript</CardTitle>
            {getTranscriptionStatusBadge()}
          </CardHeader>
          <CardContent>
            {transcript.length > 0 ? (
              <ScrollArea className="h-64 w-full">
                <div className="space-y-2">
                  {transcript.map((segment, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        index === activeSegmentIndex
                          ? 'bg-blue-100 border-2 border-blue-500 text-blue-900'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                      onClick={() => jumpToSegment(segment.start)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatTime(segment.start)} - {formatTime(segment.end)}
                        </span>
                        {index === activeSegmentIndex && (
                          <Badge variant="secondary" className="text-xs">
                            Playing
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{segment.text}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : transcriptionStatus === 'processing' ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">
                  Transcribing video... This may take a few minutes.
                </p>
              </div>
            ) : transcriptionStatus === 'failed' ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-600">
                  Transcription failed. Please try uploading the video again.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  Transcript will appear here once processing is complete.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}