import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Video, Plus, Edit, Trash2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Course, Module } from "@shared/schema";

interface VideoUploadForm {
  courseId: string;
  title: string;
  description: string;
  duration: string;
  orderIndex: number;
  video: File | null;
}

export default function CourseManagement() {
  const [uploadForm, setUploadForm] = useState<VideoUploadForm>({
    courseId: "",
    title: "",
    description: "",
    duration: "",
    orderIndex: 1,
    video: null
  });
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: "", description: "", category: "diabetes" });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch courses
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch modules for selected course
  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourse, "modules"],
    enabled: !!selectedCourse,
    staleTime: 1000 * 60 * 5,
  });

  // Upload video mutation
  const uploadVideoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/modules/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Video uploaded and module created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", selectedCourse, "modules"] });
      setUploadForm({
        courseId: "",
        title: "",
        description: "",
        duration: "",
        orderIndex: 1,
        video: null
      });
      setIsUploading(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
    }
  });

  // Create course mutation
  const createCourseMutation = useMutation({
    mutationFn: async (courseData: { title: string; description: string; category: string }) => {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(courseData),
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create course");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Course created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setNewCourse({ title: "", description: "", category: "diabetes" });
      setIsCreateCourseOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete module mutation
  const deleteModuleMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      const response = await fetch(`/api/modules/${moduleId}`, {
        method: "DELETE",
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete module");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Module deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", selectedCourse, "modules"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleVideoUpload = async () => {
    if (!uploadForm.video || !uploadForm.courseId || !uploadForm.title) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and select a video file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("video", uploadForm.video);
    formData.append("courseId", uploadForm.courseId);
    formData.append("title", uploadForm.title);
    formData.append("description", uploadForm.description);
    formData.append("duration", uploadForm.duration);
    formData.append("orderIndex", uploadForm.orderIndex.toString());

    uploadVideoMutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadForm({ ...uploadForm, video: e.target.files[0] });
    }
  };

  const getVideoDuration = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const handleVideoSelection = async (file: File) => {
    setUploadForm({ ...uploadForm, video: file });
    try {
      const duration = await getVideoDuration(file);
      setUploadForm(prev => ({ ...prev, duration }));
    } catch (error) {
      console.error('Error getting video duration:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Management</h1>
          <p className="text-gray-600">Upload and manage video course materials</p>
        </div>

        {/* Course Selection & Creation */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Courses
            </CardTitle>
            <CardDescription>
              Select a course to manage or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="course-select">Select Course</Label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Dialog open={isCreateCourseOpen} onOpenChange={setIsCreateCourseOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Course
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Course</DialogTitle>
                    <DialogDescription>
                      Add a new training course to the platform
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="course-title">Course Title</Label>
                      <Input
                        id="course-title"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                        placeholder="e.g., Advanced Diabetes Care"
                      />
                    </div>
                    <div>
                      <Label htmlFor="course-description">Description</Label>
                      <Textarea
                        id="course-description"
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                        placeholder="Course description and objectives"
                      />
                    </div>
                    <div>
                      <Label htmlFor="course-category">Category</Label>
                      <Select value={newCourse.category} onValueChange={(value) => setNewCourse({ ...newCourse, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diabetes">Diabetes</SelectItem>
                          <SelectItem value="general">General Care</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createCourseMutation.mutate(newCourse)}
                      disabled={!newCourse.title || createCourseMutation.isPending}
                    >
                      Create Course
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Video Upload Section */}
        {selectedCourse && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Video Module
              </CardTitle>
              <CardDescription>
                Add a new video training module to the selected course
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="module-title">Module Title *</Label>
                  <Input
                    id="module-title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    placeholder="e.g., Blood Glucose Monitoring"
                  />
                </div>
                <div>
                  <Label htmlFor="order-index">Order Index</Label>
                  <Input
                    id="order-index"
                    type="number"
                    min="1"
                    value={uploadForm.orderIndex}
                    onChange={(e) => setUploadForm({ ...uploadForm, orderIndex: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="module-description">Description</Label>
                <Textarea
                  id="module-description"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Module description and learning objectives"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="video-file">Video File *</Label>
                  <div className="mt-1">
                    <input
                      id="video-file"
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  {uploadForm.video && (
                    <p className="text-sm text-gray-600 mt-1">
                      Selected: {uploadForm.video.name}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    value={uploadForm.duration}
                    onChange={(e) => setUploadForm({ ...uploadForm, duration: e.target.value })}
                    placeholder="e.g., 15:30"
                  />
                </div>
              </div>

              <Button
                onClick={handleVideoUpload}
                disabled={isUploading || !uploadForm.video || !uploadForm.title}
                className="w-full"
              >
                {isUploading ? (
                  "Uploading..."
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Upload Video Module
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Existing Modules */}
        {selectedCourse && modules.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Existing Modules</CardTitle>
              <CardDescription>
                Manage modules in the selected course
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {modules.map((module) => (
                  <div key={module.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{module.title}</h4>
                      <p className="text-sm text-gray-600">{module.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Order: {module.orderIndex}</span>
                        {module.duration && <span>Duration: {module.duration}</span>}
                        {module.videoUrl && <span>Video: ✓</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteModuleMutation.mutate(module.id)}
                        disabled={deleteModuleMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}