import { useState } from "react";
import { Play, Volume2, Maximize, Bookmark, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type { Module } from "@shared/schema";

interface VideoSectionProps {
  module?: Module;
  onProgressUpdate: (moduleId: string, progress: number) => void;
}

export default function VideoSection({ module, onProgressUpdate }: VideoSectionProps) {
  const [videoProgress, setVideoProgress] = useState(35);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!module) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Select a module to begin</p>
      </div>
    );
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-dark">{module.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{module.description}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Bookmark className="w-4 h-4 mr-2" />
              Bookmark
            </Button>
            <Button size="sm" className="bg-medical-blue hover:bg-medical-blue/90">
              <Award className="w-4 h-4 mr-2" />
              Take Quiz
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="bg-black rounded-lg overflow-hidden shadow-lg mb-6">
          <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
            
            <div className="text-center text-white z-10">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 mx-auto cursor-pointer hover:bg-white/30 transition-colors">
                <Play className="w-8 h-8 ml-1" />
              </div>
              <p className="text-lg font-medium">{module.title}</p>
              <p className="text-sm opacity-80">Duration: {module.duration}</p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayPause}
                  className="text-white hover:text-medical-blue"
                >
                  <Play className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                  <Progress 
                    value={videoProgress} 
                    className="h-2 bg-white/20" 
                  />
                </div>
                <span className="text-white text-sm">04:25 / {module.duration}</span>
                <Button variant="ghost" size="sm" className="text-white hover:text-medical-blue">
                  <Volume2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:text-medical-blue">
                  <Maximize className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <Tabs defaultValue="overview" className="w-full">
            <div className="border-b border-gray-200">
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
              </TabsList>
            </div>

            <TabsContent value="overview" className="p-6">
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold mb-4">Learning Objectives</h3>
{module.content && typeof module.content === 'object' && 'learningObjectives' in module.content && Array.isArray(module.content.learningObjectives) && (
                  <ul className="space-y-2 mb-6">
                    {module.content.learningObjectives.map((objective: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-success-green flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                        <span className="text-sm">{objective}</span>
                      </li>
                    ))}
                  </ul>
                )}

{module.content && typeof module.content === 'object' && 'keyTakeaways' in module.content && Array.isArray(module.content.keyTakeaways) && (
                  <>
                    <h3 className="text-lg font-semibold mb-4">Key Takeaways</h3>
                    <div className="space-y-4">
                      {module.content.keyTakeaways.map((takeaway: any, index: number) => (
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
                )}
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="p-6">
              <div className="text-sm text-gray-600">
                <p>Video transcript will be available here once the video is processed.</p>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="p-6">
              <div className="text-sm text-gray-600">
                <p>Your personal notes for this module will appear here.</p>
              </div>
            </TabsContent>

            <TabsContent value="downloads" className="p-6">
              <div className="text-sm text-gray-600">
                <p>Downloadable resources for this module will be listed here.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
