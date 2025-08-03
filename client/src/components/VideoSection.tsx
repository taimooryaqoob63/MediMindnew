import { useState } from "react";
import { Bookmark, Award, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoPlayer from "./VideoPlayer";
import { VideoManager } from "./VideoManager";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Module } from "@shared/schema";

interface VideoSectionProps {
  module?: Module;
  courseId?: string;
  isMobile?: boolean;
}

export default function VideoSection({ module, courseId, isMobile }: VideoSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Progress update mutation
  const progressMutation = useMutation({
    mutationFn: async (data: { courseId: string; moduleId: string; progress: number; completed?: boolean }) => {
      return apiRequest("/api/progress", "POST", data);
    },
    onSuccess: () => {
      // Invalidate progress cache to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/progress", courseId] });
    },
    onError: (error) => {
      console.error("Failed to update progress:", error);
      toast({
        title: "Progress Update Failed",
        description: "Unable to save your progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper function to safely access module content
  const getModuleContent = () => {
    if (!module?.content || typeof module.content !== 'object' || module.content === null) {
      return null;
    }
    return module.content as Record<string, any>;
  };

  if (!module) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center fade-in">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4 mx-auto">
            <Play className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">Select a module to begin</p>
        </div>
      </div>
    );
  }

  const handleProgressUpdate = (progress: number) => {
    if (module && courseId) {
      progressMutation.mutate({
        courseId,
        moduleId: module.id,
        progress: Math.round(progress),
        completed: false
      });
    }
  };

  const handleVideoComplete = () => {
    if (module && courseId) {
      progressMutation.mutate({
        courseId,
        moduleId: module.id,
        progress: 100,
        completed: true
      });

      toast({
        title: "Module Completed!",
        description: `You've successfully completed "${module.title}"`,
        variant: "default",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col fade-in">
      <div className="bg-white border-b border-gray-200 p-4">
        <div className={`flex items-center justify-between ${isMobile ? 'flex-col space-y-3' : ''}`}>
          <div className={isMobile ? 'text-center' : ''}>
            <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-text-dark`}>
              {module.title}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{module.description}</p>
          </div>
          <div className={`flex items-center space-x-2 ${isMobile ? 'w-full justify-center' : ''}`}>
            <Button variant="outline" size="sm" className="button-interactive">
              <Bookmark className="w-4 h-4 mr-2" />
              {isMobile ? '' : 'Bookmark'}
            </Button>
            <Button size="sm" className="bg-medical-blue hover:bg-medical-blue/90 button-interactive">
              <Award className="w-4 h-4 mr-2" />
              {isMobile ? 'Quiz' : 'Take Quiz'}
            </Button>
          </div>
        </div>
      </div>

      <div className={`flex-1 ${isMobile ? 'p-4' : 'p-6'}`}>
        <div className="mb-6">
          {module.videoUrl ? (
            <VideoPlayer
              videoUrl={module.videoUrl}
              title={module.title}
              duration={module.duration || "0:00"}
              onProgressUpdate={handleProgressUpdate}
              onComplete={handleVideoComplete}
              isMobile={isMobile}
            />
          ) : (
            <div className="bg-gray-100 aspect-video rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p>Video not available for this module</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <Tabs defaultValue="overview" className="w-full flex flex-col flex-1">
            <div className="border-b border-gray-200 flex-shrink-0">
              <TabsList className="h-auto p-0 bg-transparent">
                <TabsTrigger 
                  value="overview" 
                  className="py-4 px-6 border-b-2 border-transparent data-[state=active]:border-medical-blue data-[state=active]:text-medical-blue rounded-none"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="transcript"
                  className="py-4 px-6 border-b-2 border-transparent data-[state=active]:border-medical-blue data-[state=active]:text-medical-blue rounded-none"
                >
                  Transcript
                </TabsTrigger>
                <TabsTrigger 
                  value="notes"
                  className="py-4 px-6 border-b-2 border-transparent data-[state=active]:border-medical-blue data-[state=active]:text-medical-blue rounded-none"
                >
                  Notes
                </TabsTrigger>
                <TabsTrigger 
                  value="downloads"
                  className="py-4 px-6 border-b-2 border-transparent data-[state=active]:border-medical-blue data-[state=active]:text-medical-blue rounded-none"
                >
                  Downloads
                </TabsTrigger>
                <TabsTrigger 
                  value="videos"
                  className="py-4 px-6 border-b-2 border-transparent data-[state=active]:border-medical-blue data-[state=active]:text-medical-blue rounded-none"
                >
                  Videos
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="p-6 overflow-y-auto flex-1 scrollbar-thin chat-scroll max-h-96">
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold mb-4">Learning Objectives</h3>
                {(() => {
                  const content = getModuleContent();
                  if (content && 'learningObjectives' in content && Array.isArray(content.learningObjectives)) {
                    return (
                      <ul className="space-y-2 mb-6">
                        {content.learningObjectives.map((objective: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <div className="w-5 h-5 rounded-full bg-success-green flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                            <span className="text-sm">{objective}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return null;
                })()}

                {(() => {
                  const content = getModuleContent();
                  if (content && 'keyTakeaways' in content && Array.isArray(content.keyTakeaways)) {
                    return (
                      <>
                        <h3 className="text-lg font-semibold mb-4">Key Takeaways</h3>
                        <div className="space-y-4">
                          {content.keyTakeaways.map((takeaway: any, index: number) => (
                            <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-start">
                                <div className="w-6 h-6 rounded-full bg-medical-blue flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-blue-900 mb-2">{takeaway.title}</h4>
                                  <p className="text-blue-800 text-sm">{takeaway.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="p-6 overflow-y-auto flex-1 scrollbar-thin chat-scroll max-h-96">
              <div className="text-sm text-gray-600">
                <p>Video transcript will be available here once the video is processed.</p>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="p-6 overflow-y-auto flex-1 scrollbar-thin chat-scroll max-h-96">
              <div className="text-sm text-gray-600">
                <p>Your personal notes for this module will appear here.</p>
              </div>
            </TabsContent>

            <TabsContent value="downloads" className="p-6 overflow-y-auto flex-1 scrollbar-thin chat-scroll max-h-96">
              <div className="text-sm text-gray-600">
                <p>Downloadable resources for this module will be listed here.</p>
              </div>
            </TabsContent>

            <TabsContent value="videos" className="p-6 overflow-y-auto flex-1 scrollbar-thin chat-scroll max-h-96">
              {module && (
                <VideoManager moduleId={module.id} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
