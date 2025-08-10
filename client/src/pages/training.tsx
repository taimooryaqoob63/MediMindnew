import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAnalytics, userFlows } from "@/hooks/useAnalytics";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import VideoSection from "@/components/VideoSection";
import AITutorChat from "@/components/AITutorChat";
import OnboardingHints from "@/components/OnboardingHints";
import { ApiError } from "@/components/ErrorBoundary";
import { AccessibilityPanel } from "@/components/AccessibilityEnhancements";

import type { Course, Module, User, UserProgress } from "@shared/schema";

export default function TrainingPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showA11yPanel, setShowA11yPanel] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { track, startFlow, updateFlow, completeFlow } = useAnalytics();

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

  const { data: courses = [], error: coursesError, isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const { data: modules = [], error: modulesError, isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourseId, "modules"],
    enabled: !!selectedCourseId,
  });

  const { data: currentModule, error: moduleError, isLoading: moduleLoading } = useQuery<Module>({
    queryKey: ["/api/modules", selectedModuleId],
    enabled: !!selectedModuleId,
  });

  const { data: progress = [], error: progressError, isLoading: progressLoading } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress", selectedCourseId],
    enabled: !!selectedCourseId,
  });

  // Auto-select first course and module when available
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
      startFlow(userFlows.videoLearning, "course_selected");
    }
  }, [courses, selectedCourseId, startFlow]);

  useEffect(() => {
    if (modules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(modules[0].id);
      updateFlow(userFlows.videoLearning, "module_selected");
    }
  }, [modules, selectedModuleId, updateFlow]);

  // Check for first-time user and show onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("medimind-onboarding-completed");
    if (!hasSeenOnboarding && user?.id) {
      setShowOnboarding(true);
      track("feature_used", { feature: "onboarding", context: "first_visit" });
    }
  }, [user?.id, track]);

  // Track page analytics
  useEffect(() => {
    track("page_view", { page: "training", courseId: selectedCourseId, moduleId: selectedModuleId });
  }, [selectedCourseId, selectedModuleId, track]);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Calculate overall progress
  const totalModules = modules.length;
  const completedModules = progress.filter(p => p.completed).length;
  const overallProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  // Helper functions to toggle sidebar and chat
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleChat = () => setIsChatOpen(!isChatOpen);

  return (
    <div className="min-h-screen bg-light">
      <AppHeader 
        user={user} 
        onSidebarToggle={toggleSidebar}
        onChatToggle={toggleChat}
        isMobile={isMobile}
      />

      <div className="flex h-screen pt-16 relative">
        {/* Mobile Sidebar Overlay */}
        {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={toggleSidebar}
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
        `} data-testid="sidebar">
          {coursesError || modulesError || progressError ? (
            <div className="p-4">
              <ApiError 
                error={coursesError || modulesError || progressError} 
                onRetry={() => window.location.reload()}
              />
            </div>
          ) : (
            <Sidebar 
              course={selectedCourse}
              modules={modules}
              progress={progress}
              overallProgress={overallProgress}
              selectedModuleId={selectedModuleId || ""}
              onModuleSelect={(moduleId) => {
                setSelectedModuleId(moduleId);
                if (isMobile) toggleSidebar();
                track("feature_used", { feature: "module_selection", context: moduleId });
              }}
              isMobile={isMobile}
            />
          )}
        </div>

        {/* Main Content */}
        <main className={`
          flex-1 flex overflow-hidden
          ${isMobile ? 'flex-col' : ''}
        `} id="main-content">
          <div className={`
            ${isMobile ? 'flex-1 overflow-y-auto' : 'flex-1 overflow-y-auto'}
            scrollbar-thin chat-scroll
          `} data-testid="video-section">
            {moduleError ? (
              <div className="p-4">
                <ApiError 
                  error={moduleError} 
                  onRetry={() => window.location.reload()}
                />
              </div>
            ) : moduleLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-lg" role="status" aria-live="polite">
                  Loading module...
                </div>
              </div>
            ) : (
              <VideoSection 
                module={currentModule}
                onProgressUpdate={(moduleId, progressValue) => {
                  track("video_progress", { moduleId, progress: progressValue });
                }}
                isMobile={isMobile}
                userId={user?.id}
                courseId={selectedCourseId || undefined}
              />
            )}
          </div>

          {/* Chat Section */}
          <div className={`
            ${isMobile 
              ? `fixed bottom-0 left-0 right-0 z-40 transform transition-transform duration-300 ${
                  isChatOpen ? 'translate-y-0' : 'translate-y-full'
                }`
              : 'w-96'
            }
          `} data-testid="ai-chat">
            <AITutorChat 
              courseId={selectedCourseId || ""}
              currentModule={currentModule}
              isMobile={isMobile}
              isOpen={isChatOpen}
              onClose={() => {
                toggleChat();
                track("feature_used", { feature: "ai_chat_close", context: "user_action" });
              }}
            />
          </div>
        </main>

        {/* Mobile Chat Overlay */}
        {isMobile && isChatOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={toggleChat}
          />
        )}
      </div>

      {/* Onboarding */}
      <OnboardingHints 
        isFirstTime={showOnboarding}
        currentPage="training"
      />

      {/* Accessibility Panel */}
      <AccessibilityPanel 
        isOpen={showA11yPanel}
        onClose={() => setShowA11yPanel(false)}
      />
    </div>
  );
}