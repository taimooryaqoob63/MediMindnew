import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import VideoSection from "@/components/VideoSection";
import AITutorChat from "@/components/AITutorChat";
import QuickAccessToolbar from "@/components/QuickAccessToolbar";
import type { Course, Module, User, UserProgress } from "@shared/schema";

export default function TrainingPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string>("course-1");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("module-1");

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourseId, "modules"],
  });

  const { data: currentModule } = useQuery<Module>({
    queryKey: ["/api/modules", selectedModuleId],
  });

  const { data: progress = [] } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress", selectedCourseId],
  });

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
