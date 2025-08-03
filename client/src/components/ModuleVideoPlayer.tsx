
import { useQuery } from "@tanstack/react-query";
import VideoPlayer from "./VideoPlayer";
import type { Module, ModuleVideo } from "@shared/schema";

interface ModuleVideoPlayerProps {
  module: Module;
  courseId?: string;
  onProgressUpdate: (progress: number) => void;
  onComplete: () => void;
  isMobile?: boolean;
}

export default function ModuleVideoPlayer({ 
  module, 
  courseId, 
  onProgressUpdate, 
  onComplete, 
  isMobile 
}: ModuleVideoPlayerProps) {
  // Fetch videos for this module
  const { data: moduleVideos = [] } = useQuery<ModuleVideo[]>({
    queryKey: ["/api/modules", module.id, "videos"],
    enabled: !!module.id,
  });

  // Determine which video to show
  const getVideoToDisplay = () => {
    // If module has a main videoUrl, use that
    if (module.videoUrl) {
      return {
        videoUrl: module.videoUrl,
        title: module.title,
        duration: module.duration || "0:00"
      };
    }

    // Otherwise, use the first video from the module's video collection
    if (moduleVideos.length > 0) {
      const sortedVideos = moduleVideos.sort((a, b) => a.orderIndex - b.orderIndex);
      const firstVideo = sortedVideos[0];
      return {
        videoUrl: firstVideo.videoUrl,
        title: firstVideo.title,
        duration: formatDuration(firstVideo.duration || 0)
      };
    }

    return null;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const videoToDisplay = getVideoToDisplay();

  if (!videoToDisplay || !videoToDisplay.videoUrl) {
    return (
      <div className="bg-gray-100 aspect-video rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p>No video available for this module</p>
          <p className="text-sm mt-2">Videos added through the Videos tab will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <VideoPlayer
      videoUrl={videoToDisplay.videoUrl}
      title={videoToDisplay.title}
      duration={videoToDisplay.duration}
      onProgressUpdate={onProgressUpdate}
      onComplete={onComplete}
      isMobile={isMobile}
    />
  );
}
