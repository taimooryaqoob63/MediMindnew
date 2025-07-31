import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import VideoSection from "@/components/VideoSection";
import AITutorChat from "@/components/AITutorChat";
import QuickAccessToolbar from "@/components/QuickAccessToolbar";

import type { Course, Module, User, UserProgress } from "@shared/schema";

export default function TrainingPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

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
    <div className="min-h-screen bg-light">
      <AppHeader 
        user={user} 
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onChatToggle={() => setIsChatOpen(!isChatOpen)}
        isMobile={isMobile}
      />
      
      <div className="flex h-screen pt-16 relative">
        {/* Mobile Sidebar Overlay */}
        {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          ${isMobile 
            ? `fixed top-16 left-0 h-full z-50 transform transition-transform duration-300 ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : 'relative'
          }
        `}>
          <Sidebar 
            course={selectedCourse}
            modules={modules}
            progress={progress}
            overallProgress={overallProgress}
            selectedModuleId={selectedModuleId || ""}
            onModuleSelect={(moduleId) => {
              setSelectedModuleId(moduleId);
              if (isMobile) setIsSidebarOpen(false);
            }}
            isMobile={isMobile}
          />
        </div>
        
        {/* Main Content */}
        <main className={`
          flex-1 flex overflow-hidden
          ${isMobile ? 'flex-col' : ''}
        `}>
          <div className={`
            ${isMobile ? 'flex-1' : 'flex-1'}
          `}>
            <VideoSection 
              module={currentModule}
              onProgressUpdate={(moduleId, progressValue) => {
                // Will implement progress tracking
              }}
              isMobile={isMobile}
            />
          </div>
          
          {/* Chat Section */}
          <div className={`
            ${isMobile 
              ? `fixed bottom-0 left-0 right-0 z-40 transform transition-transform duration-300 ${
                  isChatOpen ? 'translate-y-0' : 'translate-y-full'
                }`
              : 'w-96'
            }
          `}>
            <AITutorChat 
              courseId={selectedCourseId || ""}
              currentModule={currentModule}
              isMobile={isMobile}
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
            />
          </div>
        </main>
        
        {/* Mobile Chat Overlay */}
        {isMobile && isChatOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setIsChatOpen(false)}
          />
        )}
      </div>
      
      {/* Quick Access Toolbar */}
      <QuickAccessToolbar
        onChatToggle={() => setIsChatOpen(!isChatOpen)}
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isMobile={isMobile}
        isChatOpen={isChatOpen}
      />
    </div>
  );
}
