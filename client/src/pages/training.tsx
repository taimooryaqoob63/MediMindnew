import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import VideoSection from "@/components/VideoSection";
import AITutorChat from "@/components/AITutorChat";
import QuickAccessToolbar from "@/components/QuickAccessToolbar";
import type { Course, Module, User, UserProgress } from "@shared/schema";

export default function TrainingPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: user, error: userError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Handle unauthorized access
  useEffect(() => {
    if (userError && isUnauthorizedError(userError as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [userError, toast]);

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourseId, "modules"],
    enabled: !!selectedCourseId,
  });

  const { data: currentModule } = useQuery<Module>({
    queryKey: ["/api/modules", selectedModuleId],
    enabled: !!selectedModuleId,
  });

  const { data: progress = [] } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress", selectedCourseId],
    enabled: !!selectedCourseId,
  });

  // Auto-select first course and module when available
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (modules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(modules[0].id);
    }
  }, [modules, selectedModuleId]);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Calculate overall progress
  const totalModules = modules.length;
  const completedModules = progress.filter(p => p.completed).length;
  const overallProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(210, 40%, 98%)' }}>
      <AppHeader user={user} />
      
      <div className="flex h-screen pt-16">
        <Sidebar 
          course={selectedCourse}
          modules={modules}
          progress={progress}
          overallProgress={overallProgress}
          selectedModuleId={selectedModuleId}
          onModuleSelect={setSelectedModuleId}
        />
        
        <main className="flex-1 flex overflow-hidden">
          <VideoSection 
            module={currentModule}
            onProgressUpdate={(moduleId, progressValue) => {
              // Will implement progress tracking
            }}
          />
          
          <AITutorChat 
            courseId={selectedCourseId}
            currentModule={currentModule}
          />
        </main>
      </div>
      
      <QuickAccessToolbar />
    </div>
  );
}
