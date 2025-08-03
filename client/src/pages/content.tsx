import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentManager } from "@/components/ContentManager";
import { VideoManager } from "@/components/VideoManager";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Video } from "lucide-react";
import type { Course } from "@shared/schema";

export function ContentPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");

  // Fetch selected course data
  const { data: selectedCourse } = useQuery<Course>({
    queryKey: ["/api/courses", selectedCourseId],
    enabled: !!selectedCourseId,
  });

  // Fetch modules for selected course
  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourseId, "modules"],
    enabled: !!selectedCourseId,
  });

  type ModuleType = {
    id: string;
    title: string;
    description: string;
    orderIndex: number;
  };

  const selectedModule = modules.find((m: ModuleType) => m.id === selectedModuleId);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Content Management" showNav={true} />
      
      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Course and Module Management */}
          <div className="lg:col-span-2">
            <ContentManager
              selectedCourseId={selectedCourseId}
              onCourseSelect={setSelectedCourseId}
            />
          </div>

          {/* Module Selection and Video Management */}
          <div className="space-y-6">
            {/* Module Selection */}
            {selectedCourseId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Select Module
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {modules.map((module: ModuleType, index: number) => (
                      <button
                        key={module.id}
                        className={`w-full p-3 text-left border rounded-lg transition-colors ${
                          selectedModuleId === module.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setSelectedModuleId(module.id)}
                      >
                        <div className="font-medium">
                          {index + 1}. {module.title}
                        </div>
                        <div className="text-sm text-gray-600">
                          {module.description}
                        </div>
                      </button>
                    ))}
                    {modules.length === 0 && (
                      <p className="text-center text-gray-500 py-4">
                        No modules available
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Video Management */}
            {selectedModuleId && selectedModule && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Video Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <VideoManager
                    moduleId={selectedModuleId}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}