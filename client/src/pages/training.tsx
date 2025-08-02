import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import VideoSection from "@/components/VideoSection";
import { FloatingAIChat } from "@/components/FloatingAIChat";
import QuickAccessToolbar from "@/components/QuickAccessToolbar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Hand, X } from "lucide-react";

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

      <div className="flex min-h-screen bg-light">
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
            ? `fixed top-16 left-0 h-[calc(100vh-4rem)] z-50 transform transition-transform duration-300 ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : 'relative flex-shrink-0'
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
        <main className={`transition-all duration-300 ease-in-out ${
          isChatOpen ? 'pb-[400px]' : 'pb-0'
        }`}>
          <div className="h-full w-full pt-16 overflow-y-auto scrollbar-thin chat-scroll">
            <div className="w-full max-w-none">
              <VideoSection 
                module={currentModule}
                onProgressUpdate={(moduleId, progressValue) => {
                  // Will implement progress tracking
                }}
                isMobile={isMobile}
              />
            </div>
          </div>
        </main>

        {/* Chat Section - Conditionally rendered */}
        {isChatOpen && (
          <div className={`fixed z-40 shadow-xl border-l border-t border-gray-200 bg-white rounded-tl-lg transition-all duration-300 ease-in-out ${
            isMobile 
              ? 'bottom-0 left-0 right-0 h-[50vh] max-h-[50vh]' 
              : 'bottom-0 left-0 right-0 w-full max-h-[400px]'
          }`}>
            <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-tl-lg">
              <div className="flex items-center space-x-2">
                <Hand className="w-4 h-4 text-medical-blue" />
                <h3 className="font-medium text-gray-900">AI Assistant</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsChatOpen(false)}
                className="p-1 h-6 w-6 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className={`${isMobile ? 'h-[calc(50vh-3rem)]' : 'h-[calc(400px-3rem)]'} overflow-hidden`}>
              <FloatingAIChat 
                courseId={selectedCourseId || ""}
                context={currentModule ? `Current module: ${currentModule.title}` : ""}
              />
            </div>
          </div>
        )}
      </div>

      {/* Chat Toggle Button */}
        {!isChatOpen && (
          <Button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-medical-blue hover:bg-medical-blue/90 shadow-lg transition-all duration-300 ease-in-out hover:scale-105"
          >
            <Hand className="w-8 h-8 text-yellow-500" />
          </Button>
        )}

      {/* Quick Access Toolbar */}
      <QuickAccessToolbar
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isMobile={isMobile}
        isChatOpen={isChatOpen}
      />
    </div>
  );
}