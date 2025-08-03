import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Video, X, Clock, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ObjectUploader } from "./ObjectUploader";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertModuleVideoSchema } from "@shared/schema";
import type { UploadResult } from "@uppy/core";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

interface VideoUploadManagerProps {
  moduleId: string;
  onVideoAdded?: () => void;
}

const videoFormSchema = insertModuleVideoSchema.extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  orderIndex: z.number().min(1, "Order index must be at least 1"),
});

type VideoFormData = z.infer<typeof videoFormSchema>;

export function VideoUploadManager({ moduleId, onVideoAdded }: VideoUploadManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<VideoFormData>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      moduleId,
      title: "",
      description: "",
      videoUrl: "",
      orderIndex: 1,
      duration: 0,
    },
  });

  // Mutation to create a video record
  const createVideoMutation = useMutation({
    mutationFn: async (data: VideoFormData) => {
      return apiRequest("/api/videos", "POST", data);
    },
    onSuccess: (newVideo) => {
      // If we have an uploaded video URL, update the video with the URL
      if (uploadedVideoUrl) {
        updateVideoUrlMutation.mutate({
          videoId: newVideo.id,
          videoUrl: uploadedVideoUrl,
        });
      } else {
        // Reset form and close dialog
        form.reset();
        setIsOpen(false);
        setUploadedVideoUrl("");
        
        // Invalidate queries to refresh video list
        queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId, "videos"] });
        
        toast({
          title: "Video Added",
          description: "Video has been successfully added to the module.",
        });
        
        onVideoAdded?.();
      }
    },
    onError: (error) => {
      console.error("Failed to create video:", error);
      toast({
        title: "Error",
        description: "Failed to create video. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation to update video URL after upload
  const updateVideoUrlMutation = useMutation({
    mutationFn: async ({ videoId, videoUrl }: { videoId: string; videoUrl: string }) => {
      return apiRequest(`/api/videos/${videoId}/url`, "PUT", { videoUrl });
    },
    onSuccess: () => {
      // Reset form and close dialog
      form.reset();
      setIsOpen(false);
      setUploadedVideoUrl("");
      setIsUploading(false);
      
      // Invalidate queries to refresh video list
      queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId, "videos"] });
      
      toast({
        title: "Video Uploaded",
        description: "Video has been successfully uploaded and added to the module.",
      });
      
      onVideoAdded?.();
    },
    onError: (error) => {
      console.error("Failed to update video URL:", error);
      setIsUploading(false);
      toast({
        title: "Error",
        description: "Failed to upload video. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest("/api/objects/upload", "POST");
      return {
        method: "PUT" as const,
        url: response.uploadURL,
      };
    } catch (error) {
      console.error("Failed to get upload parameters:", error);
      toast({
        title: "Upload Error",
        description: "Failed to prepare video upload. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      setUploadedVideoUrl(uploadedFile.uploadURL as string);
      
      toast({
        title: "Upload Complete",
        description: "Video file uploaded successfully. Now add video details.",
      });
    }
  };

  const onSubmit = (data: VideoFormData) => {
    if (!uploadedVideoUrl && !data.videoUrl) {
      toast({
        title: "Missing Video",
        description: "Please upload a video file or provide a video URL.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    createVideoMutation.mutate({
      ...data,
      videoUrl: uploadedVideoUrl || data.videoUrl,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          Add Video to Module
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Video to Module</DialogTitle>
          <DialogDescription>
            Upload an MP4 video file or provide a video URL to add content to this module.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Video Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileVideo className="w-5 h-5" />
                  Video File
                </CardTitle>
                <CardDescription>
                  Upload an MP4 video file (max 100MB) or provide a video URL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {uploadedVideoUrl ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        Video uploaded successfully
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedVideoUrl("")}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={104857600} // 100MB
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Video File
                    </ObjectUploader>
                    
                    <div className="text-center text-sm text-gray-500">
                      or
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="videoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Video URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/video.mp4"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Video Details Section */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter video title" {...field} />
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
                        placeholder="Enter video description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="orderIndex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Index</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          value={field.value || ""}
                          onChange={e => field.onChange(parseInt(e.target.value) || 1)}
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
                      <FormLabel>Duration (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          {...field}
                          value={field.value || ""}
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isUploading || createVideoMutation.isPending || updateVideoUrlMutation.isPending}
              >
                {isUploading || createVideoMutation.isPending || updateVideoUrlMutation.isPending ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Adding Video...
                  </>
                ) : (
                  "Add Video"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}