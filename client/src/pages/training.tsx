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
import { HelpCircle, X, Minus, Maximize2 } from "lucide-react";

import type { Course, Module, User, UserProgress } from "@shared/schema";

export default function TrainingPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // Draggable button state
  const [dragPosition, setDragPosition] = useState({ x: window.innerWidth - 72, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Drag handlers for mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.y));

    setDragPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Drag handlers for touch
  const handleTouchStart = (e: React.TouchEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    const newX = Math.max(0, Math.min(window.innerWidth - 56, touch.clientX - dragOffset.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 56, touch.clientY - dragOffset.y));

    setDragPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Add event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset]);

  // Initialize position on window resize
  useEffect(() => {
    const handleResize = () => {
      setDragPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 56),
        y: Math.min(prev.y, window.innerHeight - 56),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [chatHeight, setChatHeight] = useState(400);
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

        {/* Chat Section - Bottom positioned, resizable */}
        {isChatOpen && (
          <div className={`fixed bottom-0 left-0 right-0 z-40 shadow-2xl bg-white border-t border-gray-300 transition-all duration-300 ease-in-out transform ${
            isChatOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
          style={{ height: isChatMinimized ? '44px' : `${isMobile ? Math.min(chatHeight, window.innerHeight * 0.8) : chatHeight}px` }}>
            {/* Resize Handle and Controls */}
            <div className="flex items-center justify-between bg-gray-100 border-b border-gray-200 px-4 py-2">
              <div className="flex items-center space-x-2">
                {!isChatMinimized && (
                  <div 
                    className="flex items-center justify-center cursor-ns-resize hover:bg-gray-200 transition-colors rounded px-2 py-1"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const startY = e.clientY;
                      const startHeight = chatHeight;

                      const handleMouseMove = (e: MouseEvent) => {
                        const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, startHeight + (startY - e.clientY)));
                        setChatHeight(newHeight);
                      };

                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };

                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    title="Drag to resize"
                  >
                    <div className="w-8 h-1 bg-gray-400 rounded-full"></div>
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700">AI Assistant</span>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChatMinimized(!isChatMinimized)}
                  className="p-1 h-6 w-6 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                  title={isChatMinimized ? "Maximize" : "Minimize"}
                >
                  {isChatMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 h-6 w-6 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {!isChatMinimized && (
              <FloatingAIChat 
                courseId={selectedCourseId || ""}
                context={currentModule ? `Current module: ${currentModule.title}` : ""}
              />
            )}
          </div>
        )}
      </div>

      {/* Draggable Floating Chat Toggle Button */}
      <div 
        className="fixed z-50 cursor-move select-none"
        style={{
          top: dragPosition.y,
          left: dragPosition.x,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`w-14 h-14 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95 flex items-center justify-center ${
                isChatOpen 
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-green-200'
              }`}
              size="sm"
            >
              {isChatOpen ? (
                <X className="w-8 h-8" />
              ) : (
                <HelpCircle className="w-8 h-8" />
              )}</Button>
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