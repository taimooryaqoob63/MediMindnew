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
        <main className="flex-1 overflow-hidden pb-96">
          <div className="h-full overflow-y-auto scrollbar-thin chat-scroll">
            <VideoSection 
              module={currentModule}
              onProgressUpdate={(moduleId, progressValue) => {
                // Will implement progress tracking
              }}
              isMobile={isMobile}
            />
          </div>
        </main>
        
        {/* Chat Section - Conditionally rendered */}
        {isChatOpen && (
          <div className={`fixed bottom-0 right-0 z-40 shadow-xl border-l border-t border-gray-200 bg-white rounded-tl-lg transition-all duration-300 ease-in-out ${
            isMobile 
              ? 'w-full h-80 max-h-80' 
              : 'w-96 h-96 max-h-96'
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
            <div className="h-full pb-12 overflow-hidden">
              <FloatingAIChat 
                courseId={selectedCourseId || ""}
                context={currentModule ? `Current module: ${currentModule.title}` : ""}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Floating Chat Toggle Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`fixed top-20 right-4 z-50 w-12 h-12 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-110 ${
              isChatOpen 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-medical-blue hover:bg-medical-blue/90 text-white'
            }`}
            size="sm"
          >
            {isChatOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Hand className="w-5 h-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{isChatOpen ? 'Close AI Assistant' : 'Open AI Assistant'}</p>
        </TooltipContent>
      </Tooltip>
      
      {/* Quick Access Toolbar */}
      <QuickAccessToolbar
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isMobile={isMobile}
        isChatOpen={isChatOpen}
      />
    </div>
  );
}
