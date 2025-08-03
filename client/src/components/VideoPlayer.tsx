import { useState, useRef, useEffect } from "react";

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

  const totalDuration = durationToSeconds(duration);

  // Simulate progress tracking for YouTube videos
  useEffect(() => {
    // Start progress tracking after a short delay
    const timeout = setTimeout(() => {
      let currentTime = 0;
      progressIntervalRef.current = setInterval(() => {
        currentTime += 1;
        const progress = (currentTime / totalDuration) * 100;

        onProgressUpdate(progress);

        // Mark as complete when 90% watched or duration reached
        if ((progress >= 90 || currentTime >= totalDuration) && !hasCompleted) {
          setHasCompleted(true);
          onComplete();
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        }
      }, 1000);
    }, 2000); // Start after 2 seconds

    return () => {
      clearTimeout(timeout);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [totalDuration, onProgressUpdate, onComplete, hasCompleted]);

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const videoId = getYouTubeVideoId(videoUrl);
  const embedUrl = videoId 
    ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0`
    : videoUrl;

  return (
    <div className="bg-black rounded-lg overflow-hidden shadow-lg">
      <div className="relative aspect-video bg-gray-900">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={title}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />

        {/* Completion indicator */}
        {hasCompleted && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            ✓ Completed
          </div>
        )}
      </div>
    </div>
  );
}