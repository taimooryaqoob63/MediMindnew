import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ObjectUploader } from './ObjectUploader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Upload, Play, Clock } from 'lucide-react';
import type { ModuleVideo, InsertModuleVideo } from '@shared/schema';
import type { UploadResult } from '@uppy/core';

interface VideoManagerProps {
  moduleId: string;
  moduleName: string;
}

export function VideoManager({ moduleId, moduleName }: VideoManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch videos for this module
  const { data: videos = [], isLoading } = useQuery<ModuleVideo[]>({
    queryKey: ['/api/modules', moduleId, 'videos'],
  });

  // Create video mutation
  const createVideoMutation = useMutation({
    mutationFn: async (video: InsertModuleVideo) => {
      return await apiRequest(`/api/modules/${moduleId}/videos`, {
        method: 'POST',
        body: JSON.stringify(video),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modules', moduleId, 'videos'] });
      toast({
        title: 'Success',
        description: 'Video added successfully',
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to add video: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete video mutation
  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return await apiRequest(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modules', moduleId, 'videos'] });
      toast({
        title: 'Success',
        description: 'Video deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete video: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest('/api/objects/upload', {
      method: 'POST',
    });
    return {
      method: 'PUT' as const,
      url: response.uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      setUploadedVideoUrl(uploadedFile.uploadURL);
      
      // Extract video metadata if available
      const file = uploadedFile.data as any;
      if (file && file.type && file.type.startsWith('video/')) {
        // Set a default title based on the filename
        if (!videoTitle) {
          setVideoTitle(file.name?.replace(/\.[^/.]+$/, '') || 'New Video');
        }
      }
      
      toast({
        title: 'Upload Complete',
        description: 'Video uploaded successfully. Please add title and save.',
      });
    }
  };

  const resetForm = () => {
    setVideoTitle('');
    setVideoDescription('');
    setUploadedVideoUrl('');
    setVideoDuration(null);
  };

  const handleSave = () => {
    if (!uploadedVideoUrl || !videoTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Please upload a video and provide a title',
        variant: 'destructive',
      });
      return;
    }

    const newVideo: InsertModuleVideo = {
      moduleId,
      title: videoTitle.trim(),
      videoUrl: uploadedVideoUrl,
      duration: videoDuration,
      orderIndex: videos.length + 1,
      description: videoDescription.trim() || undefined,
    };

    createVideoMutation.mutate(newVideo);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Module Videos</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-medical-blue hover:bg-medical-blue/90">
              <Upload className="w-4 h-4 mr-2" />
              Add Video
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Video to {moduleName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Upload Video</Label>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={104857600} // 100MB
                  allowedFileTypes={['video/*']}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleUploadComplete}
                  buttonClassName={uploadedVideoUrl ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span>{uploadedVideoUrl ? 'Video Uploaded ✓' : 'Choose Video File'}</span>
                  </div>
                </ObjectUploader>
                {uploadedVideoUrl && (
                  <p className="text-sm text-green-600">Video uploaded successfully</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-title">Video Title *</Label>
                <Input
                  id="video-title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Enter video title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-description">Description</Label>
                <Textarea
                  id="video-description"
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  placeholder="Enter video description (optional)"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-duration">Duration (seconds)</Label>
                <Input
                  id="video-duration"
                  type="number"
                  value={videoDuration || ''}
                  onChange={(e) => setVideoDuration(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Enter duration in seconds (optional)"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={createVideoMutation.isPending || !uploadedVideoUrl || !videoTitle.trim()}
                  className="bg-medical-blue hover:bg-medical-blue/90"
                >
                  {createVideoMutation.isPending ? 'Saving...' : 'Save Video'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-4">Loading videos...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No videos added yet</p>
          <p className="text-sm">Upload your first video to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {videos.map((video, index) => (
            <div
              key={video.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-medical-blue/10 rounded-full">
                  <Play className="w-4 h-4 text-medical-blue" />
                </div>
                <div>
                  <h4 className="font-medium">{video.title}</h4>
                  {video.description && (
                    <p className="text-sm text-gray-600">{video.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(video.duration)}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteVideoMutation.mutate(video.id)}
                disabled={deleteVideoMutation.isPending}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}