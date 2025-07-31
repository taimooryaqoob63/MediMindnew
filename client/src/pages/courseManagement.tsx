import { useState } from "react";
import { Plus, Upload, Edit, Trash2, Video, FileText, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Course, Module } from "@shared/schema";
import VideoUpload from "@/components/VideoUpload";
import AppHeader from "@/components/AppHeader";

interface CourseManagementProps {
  user: any;
}

export default function CourseManagement({ user }: CourseManagementProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourseId, "modules"],
    enabled: !!selectedCourseId,
  });

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const handleUploadComplete = (module: Module) => {
    setShowUpload(false);
    // Module list will update automatically via query invalidation
  };

  if (showUpload && selectedCourseId) {
    return (
      <div className="min-h-screen bg-light">
        <AppHeader user={user} />
        <div className="pt-16 p-6">
          <VideoUpload
            courseId={selectedCourseId}
            onUploadComplete={handleUploadComplete}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light">
      <AppHeader user={user} />
      
      <div className="pt-16 p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-dark mb-2">Course Management</h1>
          <p className="text-gray-600">Upload and manage your diabetes training course materials.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Course Selection */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Courses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className={`
                      p-3 rounded-lg border cursor-pointer transition-all
                      ${selectedCourseId === course.id 
                        ? 'border-medical-blue bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                    onClick={() => setSelectedCourseId(course.id)}
                  >
                    <h3 className="font-medium text-text-dark">{course.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                    <Badge variant="secondary" className="mt-2">
                      {course.category}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Course Modules */}
          <div className="lg:col-span-2">
            {selectedCourse ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedCourse.title}</CardTitle>
                      <p className="text-gray-600 mt-1">{selectedCourse.description}</p>
                    </div>
                    <Button
                      onClick={() => setShowUpload(true)}
                      className="bg-medical-blue hover:bg-medical-blue/90"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Video
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {modules.length === 0 ? (
                    <div className="text-center py-12">
                      <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-600 mb-2">No modules yet</h3>
                      <p className="text-gray-500 mb-6">Upload your first video to get started with this course.</p>
                      <Button
                        onClick={() => setShowUpload(true)}
                        className="bg-medical-blue hover:bg-medical-blue/90"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload First Video
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {modules
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                        .map((module) => (
                          <div
                            key={module.id}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className="w-12 h-8 bg-gray-900 rounded flex items-center justify-center">
                                    {module.videoUrl ? (
                                      <Video className="w-4 h-4 text-white" />
                                    ) : (
                                      <Upload className="w-4 h-4 text-gray-400" />
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="font-medium text-text-dark">{module.title}</h3>
                                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                                      <div className="flex items-center">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {module.duration}
                                      </div>
                                      <div className="flex items-center">
                                        <FileText className="w-3 h-3 mr-1" />
                                        Module {module.orderIndex}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-gray-600 text-sm mb-3">{module.description}</p>
                                
                                {/* Learning Objectives Preview */}
                                {module.content && 
                                 typeof module.content === 'object' && 
                                 'learningObjectives' in module.content &&
                                 Array.isArray((module.content as any).learningObjectives) && (
                                  <div className="flex flex-wrap gap-1">
                                    {((module.content as any).learningObjectives as string[])
                                      .slice(0, 3)
                                      .map((objective, index) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {objective.length > 30 ? objective.substring(0, 30) + "..." : objective}
                                        </Badge>
                                      ))}
                                    {((module.content as any).learningObjectives as string[]).length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{((module.content as any).learningObjectives as string[]).length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-2 ml-4">
                                <div className={`
                                  px-2 py-1 rounded-full text-xs font-medium
                                  ${module.videoUrl 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                  }
                                `}>
                                  {module.videoUrl ? 'Video Ready' : 'No Video'}
                                </div>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Course</h3>
                  <p className="text-gray-500">Choose a course from the left to manage its video modules.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Upload Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Video Upload Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-medium text-text-dark mb-2">Supported Formats</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• MP4 (recommended)</li>
                  <li>• AVI</li>
                  <li>• MOV</li>
                  <li>• WMV</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-text-dark mb-2">Technical Requirements</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Maximum file size: 500MB</li>
                  <li>• Recommended resolution: 1080p</li>
                  <li>• Frame rate: 30fps or higher</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-text-dark mb-2">Best Practices</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Clear audio quality</li>
                  <li>• Good lighting and visibility</li>
                  <li>• Include learning objectives</li>
                  <li>• Keep modules under 20 minutes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}