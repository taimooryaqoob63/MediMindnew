import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileVideo, X, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ObjectUploaderProps {
  onUploadComplete: (url: string, metadata: { duration?: string; fileSize?: number }) => void;
  acceptedTypes?: string[];
  maxSize?: number;
  description?: string;
}

export function ObjectUploader({ 
  onUploadComplete, 
  acceptedTypes = ["video/*"], 
  maxSize = 500 * 1024 * 1024,
  description = "Upload video files up to 500MB"
}: ObjectUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setUploading(true);
    setUploadProgress(0);
    setIsComplete(false);

    try {
      // Get upload URL from our backend
      const { uploadURL } = await apiRequest("/api/objects/upload", "POST");
      
      // Upload file to object storage
      await uploadToObjectStorage(file, uploadURL);
      
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
      setUploading(false);
      setUploadedFile(null);
    }
  }, [toast]);

  const uploadToObjectStorage = async (file: File, uploadURL: string) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploading(false);
          setIsComplete(true);
          
          // Get video metadata
          getVideoMetadata(file).then((metadata) => {
            // Convert the upload URL to the accessible URL format
            const accessibleUrl = convertToAccessibleUrl(uploadURL);
            onUploadComplete(accessibleUrl, metadata);
          });
          
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.open("PUT", uploadURL);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  };

  const getVideoMetadata = async (file: File): Promise<{ duration?: string; fileSize: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        resolve({
          duration: isNaN(duration) ? undefined : formattedDuration,
          fileSize: file.size,
        });
      };
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        resolve({ fileSize: file.size });
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const convertToAccessibleUrl = (uploadURL: string): string => {
    // Extract the object path from the signed URL
    try {
      const url = new URL(uploadURL);
      const pathParts = url.pathname.split('/');
      
      // The path should be like: /bucket/path/to/object
      if (pathParts.length >= 3) {
        const objectPath = '/' + pathParts.slice(2).join('/');
        return `/objects${objectPath}`;
      }
    } catch (error) {
      console.error("Failed to parse upload URL:", error);
    }
    
    // Fallback: return the upload URL
    return uploadURL;
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setUploading(false);
    setUploadProgress(0);
    setIsComplete(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    multiple: false,
  });

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (isComplete && uploadedFile) {
    return (
      <div className="border-2 border-green-200 border-dashed rounded-lg p-6 bg-green-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-900">{uploadedFile.name}</p>
              <p className="text-sm text-green-700">
                {formatFileSize(uploadedFile.size)} • Upload complete
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetUpload}
            className="text-green-700 border-green-300 hover:bg-green-100"
          >
            <X className="h-4 w-4 mr-1" />
            Change
          </Button>
        </div>
      </div>
    );
  }

  if (uploading && uploadedFile) {
    return (
      <div className="border-2 border-primary border-dashed rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileVideo className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <p className="font-medium">{uploadedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(uploadedFile.size)}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center text-center">
        <Upload className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">
          {isDragActive ? "Drop video here" : "Upload video file"}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          {description}
        </p>
        <Button variant="outline" type="button">
          <Upload className="h-4 w-4 mr-2" />
          Choose File
        </Button>
      </div>
    </div>
  );
}