import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Upload, Trash2, Edit, Video, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoUploadManager } from "./VideoUploadManager";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ModuleVideo } from "@shared/schema";

interface VideoManagerProps {
  moduleId: string;
  isEditable?: boolean;
}

export function VideoManager({ moduleId, isEditable = false }: VideoManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch videos for this module
  const { data: videos = [], isLoading } = useQuery<ModuleVideo[]>({
    queryKey: ["/api/modules", moduleId, "videos"],
    enabled: !!moduleId,
  });

  // Delete video mutation
  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return apiRequest(`/api/videos/${videoId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId, "videos"] });
      toast({
        title: "Video Deleted",
        description: "Video has been removed from the module.",
      });
    },
    onError: (error) => {
      console.error("Failed to delete video:", error);
      toast({
        title: "Error",
        description: "Failed to delete video. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return "Unknown duration";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sortedVideos = videos.sort((a, b) => a.orderIndex - b.orderIndex);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Module Videos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="w-6 h-6 animate-spin mr-2" />
            Loading videos...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Module Videos
            </CardTitle>
            <CardDescription>
              {videos.length === 0 
                ? "No videos added to this module yet" 
                : `${videos.length} video${videos.length === 1 ? '' : 's'} in this module`
              }
            </CardDescription>
          </div>
          {isEditable && (
            <VideoUploadManager
              moduleId={moduleId}
              onVideoAdded={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId, "videos"] });
              }}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedVideos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Video className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="mb-2">No videos in this module</p>
            {isEditable && (
              <p className="text-sm">Click "Add Video to Module" to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedVideos.map((video, index) => (
              <div
                key={video.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    {index + 1}
                  </Badge>
                </div>
                
                <div className="flex-grow min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">
                    {video.title}
                  </h4>
                  {video.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {video.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(video.duration || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {video.videoUrl && (
                    <Button variant="outline" size="sm">
                      <Play className="w-4 h-4 mr-1" />
                      Play
                    </Button>
                  )}
                  
                  {isEditable && (
                    <>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteVideoMutation.mutate(video.id)}
                        disabled={deleteVideoMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}