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
import { HelpCircle, X } from "lucide-react";

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
      
      <div className="flex h-[calc(100vh-4rem)] relative">
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
            : 'relative h-full'
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
        <main className="flex-1 h-full overflow-hidden">
          <div className="h-full overflow-y-auto">
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
          <div className={`fixed bottom-0 right-0 z-40 shadow-2xl border border-gray-300 bg-white rounded-tl-xl rounded-tr-xl transition-all duration-300 ease-in-out transform ${
            isChatOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          } ${
            isMobile 
              ? 'w-full h-80 max-h-80' 
              : 'w-96 h-96 max-h-96'
          }`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50 rounded-tl-xl rounded-tr-xl">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI Assistant</h3>
                  <p className="text-xs text-gray-600">Ask me anything about diabetes care</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsChatOpen(false)}
                className="p-2 h-8 w-8 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="h-full pb-16 overflow-hidden">
              <FloatingAIChat 
                courseId={selectedCourseId || ""}
                context={currentModule ? `Current module: ${currentModule.title}` : ""}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Floating Chat Toggle Button */}
      <div className="fixed top-20 right-4 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`w-14 h-14 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95 ${
                isChatOpen 
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-green-200'
              }`}
              size="sm"
            >
              {isChatOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <HelpCircle className="w-6 h-6" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-gray-800 text-white">
            <p>{isChatOpen ? 'Close AI Assistant' : 'Ask AI Assistant'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Quick Access Toolbar */}
      <QuickAccessToolbar
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isMobile={isMobile}
        isChatOpen={isChatOpen}
      />
    </div>
  );
}
