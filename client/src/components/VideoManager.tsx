import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Upload, FileVideo, Clock, HardDrive } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";

import type { Video } from "@shared/schema";

const videoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  duration: z.string().optional(),
});

type VideoForm = z.infer<typeof videoSchema>;

interface VideoManagerProps {
  moduleId: string;
}

export function VideoManager({ moduleId }: VideoManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateVideoOpen, setIsCreateVideoOpen] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>("");
  const [videoMetadata, setVideoMetadata] = useState<{ duration?: string; fileSize?: number }>({});

  // Fetch videos for this module
  const { data: videos = [], isLoading } = useQuery<Video[]>({
    queryKey: ["/api/modules", moduleId, "videos"],
  });

  // Create video mutation
  const createVideoMutation = useMutation({
    mutationFn: async (data: VideoForm & { videoUrl: string; fileSize?: number; orderIndex: number }) => {
      return apiRequest(`/api/modules/${moduleId}/videos`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId, "videos"] });
      setIsCreateVideoOpen(false);
      setUploadedVideoUrl("");
      setVideoMetadata({});
      form.reset();
      toast({
        title: "Video Added",
        description: "Video has been successfully added to the module.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add video. Please try again.",
        variant: "destructive",
      });
    },
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
        description: "Video has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete video. Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<VideoForm>({
    resolver: zodResolver(videoSchema),
    defaultValues: {
      title: "",
      description: "",
      duration: "",
    },
  });

  const onSubmit = (data: VideoForm) => {
    if (!uploadedVideoUrl) {
      toast({
        title: "Upload Required",
        description: "Please upload a video file first.",
        variant: "destructive",
      });
      return;
    }

    createVideoMutation.mutate({
      ...data,
      videoUrl: uploadedVideoUrl,
      fileSize: videoMetadata.fileSize,
      duration: data.duration || videoMetadata.duration,
      orderIndex: videos.length,
    });
  };

  const handleVideoUpload = (url: string, metadata: { duration?: string; fileSize?: number }) => {
    setUploadedVideoUrl(url);
    setVideoMetadata(metadata);
    
    // Auto-fill duration if available
    if (metadata.duration && !form.getValues("duration")) {
      form.setValue("duration", metadata.duration);
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (duration: string) => {
    if (!duration) return "Unknown";
    
    // If it's already in MM:SS format, return as is
    if (duration.includes(":")) return duration;
    
    // If it's in seconds, convert to MM:SS
    const seconds = parseInt(duration);
    if (isNaN(seconds)) return duration;
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Add Video Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Videos ({videos.length})</h3>
          <p className="text-sm text-muted-foreground">
            Manage video content for this training module
          </p>
        </div>
        <Dialog open={isCreateVideoOpen} onOpenChange={setIsCreateVideoOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Video
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Video</DialogTitle>
              <DialogDescription>
                Upload a video file and provide details for this training module.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Video Upload Section */}
              <div className="space-y-4">
                <Label>Video File</Label>
                <ObjectUploader
                  onUploadComplete={handleVideoUpload}
                  acceptedTypes={["video/mp4", "video/avi", "video/mov", "video/quicktime"]}
                  maxSize={500 * 1024 * 1024} // 500MB
                  description="Upload video files (MP4, AVI, MOV) up to 500MB"
                />
                {uploadedVideoUrl && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      ✓ Video uploaded successfully
                      {videoMetadata.fileSize && (
                        <span className="ml-2">
                          ({formatFileSize(videoMetadata.fileSize)})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Video Details Form */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Introduction to Blood Glucose Testing" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe what this video covers..."
                            className="h-20"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 12:30 or auto-detected"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateVideoOpen(false);
                        setUploadedVideoUrl("");
                        setVideoMetadata({});
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createVideoMutation.isPending || !uploadedVideoUrl}
                    >
                      {createVideoMutation.isPending ? "Adding Video..." : "Add Video"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Videos List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading videos...</p>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileVideo className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No videos yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Upload your first video to get started with this module.
            </p>
            <Button onClick={() => setIsCreateVideoOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Video
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {videos
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((video) => (
              <Card key={video.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">{video.title}</h4>
                      {video.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {video.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {video.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(video.duration)}
                          </div>
                        )}
                        {video.fileSize && (
                          <div className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatFileSize(video.fileSize)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>Order: {video.orderIndex + 1}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Video</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{video.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteVideoMutation.mutate(video.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}