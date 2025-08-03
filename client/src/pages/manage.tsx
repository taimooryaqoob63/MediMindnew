import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, BookOpen, FileVideo, Settings, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { VideoManager } from "@/components/VideoManager";

import type { Course, Module } from "@shared/schema";

const courseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().default("diabetes"),
});

const moduleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  content: z.object({
    learningObjectives: z.array(z.string()).default([]),
  }).default({}),
  orderIndex: z.number().min(0),
});

type CourseForm = z.infer<typeof courseSchema>;
type ModuleForm = z.infer<typeof moduleSchema>;

export default function ManagePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [isCreateModuleOpen, setIsCreateModuleOpen] = useState(false);

  // Fetch courses
  const { data: courses = [], isLoading: isLoadingCourses } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  // Fetch modules for selected course
  const { data: modules = [], isLoading: isLoadingModules } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourse?.id, "modules"],
    enabled: !!selectedCourse?.id,
  });

  // Create course mutation
  const createCourseMutation = useMutation({
    mutationFn: async (data: CourseForm) => {
      return apiRequest("/api/courses", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setIsCreateCourseOpen(false);
      toast({
        title: "Course Created",
        description: "New course has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create course. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create module mutation
  const createModuleMutation = useMutation({
    mutationFn: async (data: ModuleForm & { courseId: string }) => {
      const { courseId, ...moduleData } = data;
      return apiRequest(`/api/courses/${courseId}/modules`, "POST", moduleData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", selectedCourse?.id, "modules"] });
      setIsCreateModuleOpen(false);
      toast({
        title: "Module Created",
        description: "New module has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create module. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Forms
  const courseForm = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "diabetes",
    },
  });

  const moduleForm = useForm<ModuleForm>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      title: "",
      description: "",
      content: { learningObjectives: [] },
      orderIndex: 0,
    },
  });

  const onCreateCourse = (data: CourseForm) => {
    createCourseMutation.mutate(data);
  };

  const onCreateModule = (data: ModuleForm) => {
    if (!selectedCourse) return;
    createModuleMutation.mutate({
      ...data,
      courseId: selectedCourse.id,
      orderIndex: modules.length,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <Settings className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-foreground">
                Course Management
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create and manage training courses, modules, and video content for your diabetes care team.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Courses Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Courses
                  </CardTitle>
                  <Dialog open={isCreateCourseOpen} onOpenChange={setIsCreateCourseOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Course
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Course</DialogTitle>
                        <DialogDescription>
                          Create a new training course for your team.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...courseForm}>
                        <form onSubmit={courseForm.handleSubmit(onCreateCourse)} className="space-y-4">
                          <FormField
                            control={courseForm.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Course Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Diabetes Management Training" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={courseForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Describe the course content and objectives..."
                                    className="h-20"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={courseForm.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="diabetes">Diabetes Care</SelectItem>
                                    <SelectItem value="general">General Healthcare</SelectItem>
                                    <SelectItem value="compliance">Compliance & Safety</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end gap-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setIsCreateCourseOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={createCourseMutation.isPending}
                            >
                              {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCourses ? (
                  <p className="text-sm text-muted-foreground">Loading courses...</p>
                ) : (
                  <div className="space-y-2">
                    {courses.map((course) => (
                      <Card
                        key={course.id}
                        className={`cursor-pointer transition-colors ${
                          selectedCourse?.id === course.id
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedCourse(course)}
                      >
                        <CardContent className="p-3">
                          <h3 className="font-medium">{course.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {course.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Modules Panel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileVideo className="h-5 w-5" />
                    Modules
                    {selectedCourse && (
                      <span className="text-sm text-muted-foreground">
                        - {selectedCourse.title}
                      </span>
                    )}
                  </CardTitle>
                  {selectedCourse && (
                    <Dialog open={isCreateModuleOpen} onOpenChange={setIsCreateModuleOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          New Module
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New Module</DialogTitle>
                          <DialogDescription>
                            Add a new module to {selectedCourse.title}.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...moduleForm}>
                          <form onSubmit={moduleForm.handleSubmit(onCreateModule)} className="space-y-4">
                            <FormField
                              control={moduleForm.control}
                              name="title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Module Title</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., Blood Glucose Monitoring" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={moduleForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Describe what students will learn in this module..."
                                      className="h-20"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end gap-2">
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setIsCreateModuleOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                disabled={createModuleMutation.isPending}
                              >
                                {createModuleMutation.isPending ? "Creating..." : "Create Module"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedCourse ? (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Select a course to view and manage modules</p>
                  </div>
                ) : isLoadingModules ? (
                  <p className="text-sm text-muted-foreground">Loading modules...</p>
                ) : (
                  <div className="space-y-4">
                    {modules.map((module) => (
                      <Card
                        key={module.id}
                        className={`cursor-pointer transition-colors ${
                          selectedModule?.id === module.id
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedModule(module)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium">{module.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {module.description}
                              </p>
                              {module.duration && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Duration: {module.duration}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                Order: {module.orderIndex}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {modules.length === 0 && (
                      <div className="text-center py-8">
                        <FileVideo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No modules yet. Create your first module!</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Video Management Section */}
          {selectedModule && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Video Management - {selectedModule.title}
                </CardTitle>
                <CardDescription>
                  Upload and manage videos for this module. Supports MP4, AVI, MOV formats up to 500MB.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideoManager moduleId={selectedModule.id} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}