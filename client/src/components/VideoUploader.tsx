import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileVideo, X, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VideoUploaderProps {
  onUploadComplete?: (videoId: string) => void;
  onClose?: () => void;
}

export function VideoUploader({ onUploadComplete, onClose }: VideoUploaderProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, title, description }: { file: File; title: string; description: string }) => {
      // Step 1: Get upload URL
      setUploadStatus('uploading');
      setUploadProgress(10);
      
      const urlResponse = await apiRequest("/api/videos/upload-url", {
        method: "POST"
      }) as { uploadURL: string };
      const { uploadURL } = urlResponse;

      // Step 2: Upload file to object storage
      setUploadProgress(30);
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          'Content-Type': 'video/mp4'
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload video file');
      }

      setUploadProgress(60);

      // Step 3: Create video record
      const objectPath = new URL(uploadURL).pathname;
      const video = await apiRequest("/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          objectPath,
          transcriptionStatus: 'pending'
        })
      }) as { id: string };

      setUploadProgress(100);
      setUploadStatus('processing');
      
      return video;
    },
    onSuccess: (video) => {
      toast({
        title: "Video uploaded successfully",
        description: "Transcription is being processed in the background.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      onUploadComplete?.(video.id);
      setUploadStatus('complete');
    },
    onError: (error) => {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your video. Please try again.",
        variant: "destructive",
      });
      setUploadStatus('error');
      setUploadProgress(0);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        toast({
          title: "Invalid file type",
          description: "Please select a video file (MP4, MOV, AVI, etc.)",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 25MB for Whisper API)
      if (file.size > 25 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Video files must be under 25MB for transcription.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !title.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a video file and enter a title.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      file: selectedFile,
      title: title.trim(),
      description: description.trim()
    });
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStatus('idle');
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FileVideo className="w-5 h-5" />;
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Uploading video...';
      case 'processing':
        return 'Processing and transcribing...';
      case 'complete':
        return 'Upload complete!';
      case 'error':
        return 'Upload failed';
      default:
        return 'Ready to upload';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Upload Training Video
        </CardTitle>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Video File</label>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
              className="flex-1"
            />
            {selectedFile && (
              <div className="text-sm text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Supported formats: MP4, MOV, AVI, WMV (max 25MB)
          </p>
        </div>

        {/* Video Details */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title *
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title"
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this video covers..."
              rows={3}
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
            />
          </div>
        </div>

        {/* Upload Progress */}
        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{getStatusText()}</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {uploadStatus === 'complete' ? (
            <Button onClick={resetForm} className="flex-1">
              Upload Another Video
            </Button>
          ) : uploadStatus === 'error' ? (
            <>
              <Button onClick={resetForm} variant="outline" className="flex-1">
                Reset
              </Button>
              <Button onClick={handleUpload} className="flex-1">
                Try Again
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={resetForm}
                variant="outline"
                disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className="flex-1"
              >
                Reset
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !title.trim() || uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </Button>
            </>
          )}
        </div>

        {/* Status Messages */}
        {uploadStatus === 'processing' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Your video is being processed and transcribed. This may take a few minutes depending on the video length.
              You can close this dialog and check back later.
            </p>
          </div>
        )}

        {uploadStatus === 'complete' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              Video uploaded successfully! Transcription will be available shortly and you'll see synchronized highlighting during playback.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}