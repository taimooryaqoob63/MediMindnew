import { useState, useRef } from "react";
import { Upload, FileVideo, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { InsertModule } from "@shared/schema";

interface VideoUploadProps {
  courseId: string;
  onUploadComplete?: (module: any) => void;
  onCancel?: () => void;
}

interface VideoUploadResponse {
  message: string;
  videoUrl: string;
  originalName: string;
  filename: string;
  size: number;
}

export default function VideoUpload({ courseId, onUploadComplete, onCancel }: VideoUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState({
    title: "",
    description: "",
    duration: "",
    orderIndex: 1,
    content: {
      learningObjectives: [""],
      keyTakeaways: []
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json() as Promise<VideoUploadResponse>;
    },
    onSuccess: (data) => {
      setVideoUrl(data.videoUrl);
      setUploadProgress(100);
      toast({
        title: "Upload Successful",
        description: "Video uploaded successfully. Please add course details.",
      });
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload video. Please try again.",
        variant: "destructive",
      });
      setUploadProgress(0);
    }
  });

  const createModuleMutation = useMutation({
    mutationFn: async (data: InsertModule) => {
      const response = await apiRequest("POST", "/api/modules", data);
      return response.json();
    },
    onSuccess: (module) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "modules"] });
      toast({
        title: "Module Created",
        description: "Course module created successfully!",
      });
      onUploadComplete?.(module);
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create module. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        handleFileSelect(file);
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload a video file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      toast({
        title: "File Too Large",
        description: "Video file must be under 500MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setModuleData(prev => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, "") }));
    
    // Start upload
    setUploadProgress(10);
    uploadMutation.mutate(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!videoUrl || !moduleData.title || !moduleData.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const modulePayload: InsertModule = {
      courseId,
      title: moduleData.title,
      description: moduleData.description,
      videoUrl,
      duration: moduleData.duration || "Unknown",
      orderIndex: moduleData.orderIndex,
      content: moduleData.content
    };

    createModuleMutation.mutate(modulePayload);
  };

  const addLearningObjective = () => {
    setModuleData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        learningObjectives: [...prev.content.learningObjectives, ""]
      }
    }));
  };

  const updateLearningObjective = (index: number, value: string) => {
    setModuleData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        learningObjectives: prev.content.learningObjectives.map((obj, i) => i === index ? value : obj)
      }
    }));
  };

  const removeLearningObjective = (index: number) => {
    setModuleData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        learningObjectives: prev.content.learningObjectives.filter((_, i) => i !== index)
      }
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-dark mb-2">Upload Course Video</h2>
        <p className="text-gray-600">Add a new video module to your diabetes training course.</p>
      </div>

      {!selectedFile ? (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive ? 'border-medical-blue bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <FileVideo className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Drop your video file here, or click to browse
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Supports MP4, AVI, MOV, WMV files up to 500MB
          </p>
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-medical-blue hover:bg-medical-blue/90"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose Video File
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upload Progress */}
          {uploadProgress < 100 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Uploading: {selectedFile.name}</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Upload Success */}
          {uploadProgress === 100 && videoUrl && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-center">
                <Check className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800">Video uploaded successfully!</span>
              </div>
            </div>
          )}

          {/* Module Details Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Module Title *</Label>
              <Input
                id="title"
                value={moduleData.title}
                onChange={(e) => setModuleData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Understanding Diabetes Fundamentals"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={moduleData.description}
                onChange={(e) => setModuleData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what learners will gain from this module..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  value={moduleData.duration}
                  onChange={(e) => setModuleData(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g., 15:30"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="order">Order Index</Label>
                <Input
                  id="order"
                  type="number"
                  value={moduleData.orderIndex}
                  onChange={(e) => setModuleData(prev => ({ ...prev, orderIndex: parseInt(e.target.value) || 1 }))}
                  className="mt-1"
                  min={1}
                />
              </div>
            </div>

            {/* Learning Objectives */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Learning Objectives</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLearningObjective}
                >
                  Add Objective
                </Button>
              </div>
              <div className="space-y-2">
                {moduleData.content.learningObjectives.map((objective, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={objective}
                      onChange={(e) => updateLearningObjective(index, e.target.value)}
                      placeholder="Enter learning objective..."
                      className="flex-1"
                    />
                    {moduleData.content.learningObjectives.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLearningObjective(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={createModuleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!videoUrl || !moduleData.title || !moduleData.description || createModuleMutation.isPending}
              className="bg-medical-blue hover:bg-medical-blue/90"
            >
              {createModuleMutation.isPending ? "Creating..." : "Create Module"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}