import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { VideoUploader } from "@/components/VideoUploader";
import TranscriptVideoPlayer from "@/components/TranscriptVideoPlayer";
import { Plus, Play, Trash2, Calendar, Clock, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UploadedVideo {
  id: string;
  title: string;
  description?: string;
  objectPath: string;
  duration?: string;
  transcript?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  transcriptText?: string;
  transcriptionStatus: string;
  uploadedAt: string;
  userId: string;
}

export default function MyVideos() {
  const [selectedVideo, setSelectedVideo] = useState<UploadedVideo | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery<UploadedVideo[]>({
    queryKey: ["/api/videos"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return await apiRequest(`/api/videos/${videoId}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      toast({
        title: "Video deleted",
        description: "Your video has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      if (selectedVideo) {
        setSelectedVideo(null);
      }
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "There was an error deleting your video.",
        variant: "destructive",
      });
    },
  });

  const handleVideoSelect = async (video: UploadedVideo) => {
    try {
      // Fetch full video details including transcript
      const fullVideo = await apiRequest(`/api/videos/${video.id}`) as UploadedVideo;
      setSelectedVideo(fullVideo);
    } catch (error) {
      console.error("Error fetching video details:", error);
      toast({
        title: "Error",
        description: "Failed to load video details.",
        variant: "destructive",
      });
    }
  };

  const handleUploadComplete = (videoId: string) => {
    setShowUploader(false);
    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    toast({
      title: "Upload complete",
      description: "Your video is being processed and will appear shortly.",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Ready</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getVideoUrl = (objectPath: string) => {
    // Convert object path to video serving URL
    return objectPath.replace('/objects/', '/videos/');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your videos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Training Videos</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage your custom diabetes training videos with automatic transcription
          </p>
        </div>
        <Dialog open={showUploader} onOpenChange={setShowUploader}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Upload Video
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <VideoUploader 
              onUploadComplete={handleUploadComplete}
              onClose={() => setShowUploader(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Video List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Videos ({videos.length})</h2>
          
          {videos.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No videos yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your first training video to get started with automatic transcription
                </p>
                <Button onClick={() => setShowUploader(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Upload First Video
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {videos.map((video: UploadedVideo) => (
                <Card 
                  key={video.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedVideo?.id === video.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => handleVideoSelect(video)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium truncate">{video.title}</h3>
                          {getStatusBadge(video.transcriptionStatus)}
                        </div>
                        
                        {video.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {video.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(video.uploadedAt)}
                          </div>
                          {video.duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {video.duration}
                            </div>
                          )}
                          {video.transcript && (
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {video.transcript.length} segments
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVideoSelect(video);
                          }}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Are you sure you want to delete this video?")) {
                              deleteMutation.mutate(video.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Video Player */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Video Player</h2>
          
          {selectedVideo ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{selectedVideo.title}</span>
                    {getStatusBadge(selectedVideo.transcriptionStatus)}
                  </CardTitle>
                  {selectedVideo.description && (
                    <p className="text-sm text-muted-foreground">
                      {selectedVideo.description}
                    </p>
                  )}
                </CardHeader>
              </Card>
              
              <TranscriptVideoPlayer
                videoUrl={getVideoUrl(selectedVideo.objectPath)}
                title={selectedVideo.title}
                duration={selectedVideo.duration}
                transcript={selectedVideo.transcript}
                transcriptionStatus={selectedVideo.transcriptionStatus}
                onProgressUpdate={(progress) => {
                  // Could track viewing progress if needed
                  console.log("Video progress:", progress);
                }}
                onComplete={() => {
                  toast({
                    title: "Video completed",
                    description: "You've finished watching this training video.",
                  });
                }}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Play className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a video to play</h3>
                <p className="text-muted-foreground">
                  Choose a video from the list to watch it with synchronized transcript highlighting
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}