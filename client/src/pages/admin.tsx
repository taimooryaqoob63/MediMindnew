import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  BookOpen, 
  Users, 
  Settings, 
  Video,
  Plus,
  Edit,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { VideoManager } from "@/components/VideoManager";
import type { Course, Module } from "@shared/schema";

export default function AdminPage() {
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");

  // Fetch courses
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  // Fetch modules for selected course
  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourse, "modules"],
    enabled: !!selectedCourse,
  });

  const selectedCourseData = courses.find(c => c.id === selectedCourse);
  const selectedModuleData = modules.find(m => m.id === selectedModule);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Training
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Course Administration
                </h1>
                <p className="text-sm text-gray-500">
                  Manage courses, modules, and video content
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="courses" className="space-y-6">
          <TabsList>
            <TabsTrigger value="courses" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Courses
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Content Management
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Courses</CardTitle>
                    <CardDescription>
                      Manage your training courses and their modules
                    </CardDescription>
                  </div>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Course
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {courses.map((course) => (
                    <Card key={course.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{course.title}</CardTitle>
                            <Badge variant="secondary" className="mt-2">
                              {course.category}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600 mb-4">
                          {course.description}
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedCourse(course.id)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Link href={`/?course=${course.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Management Tab */}
          <TabsContent value="content" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Course Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Course</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {courses.map((course) => (
                      <Button
                        key={course.id}
                        variant={selectedCourse === course.id ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedCourse(course.id);
                          setSelectedModule(""); // Reset module selection
                        }}
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        {course.title}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Module Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {selectedCourseData ? `${selectedCourseData.title} Modules` : "Select Course First"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedCourse ? (
                    <div className="space-y-2">
                      {modules.map((module, index) => (
                        <Button
                          key={module.id}
                          variant={selectedModule === module.id ? "default" : "outline"}
                          className="w-full justify-start"
                          onClick={() => setSelectedModule(module.id)}
                        >
                          <span className="mr-2 text-xs bg-gray-200 rounded px-1">
                            {index + 1}
                          </span>
                          {module.title}
                        </Button>
                      ))}
                      {modules.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No modules in this course
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Select a course to view its modules
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Video Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {selectedModuleData ? `${selectedModuleData.title} Videos` : "Select Module"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedModule ? (
                    <VideoManager moduleId={selectedModule} isEditable={true} />
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Select a module to manage its videos
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{courses.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Modules</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {courses.reduce((total, course) => {
                      // This would need to be calculated with proper module counts
                      return total + 1; // Placeholder
                    }, 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Learners</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">
                    +12% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <Video className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">73%</div>
                  <p className="text-xs text-muted-foreground">
                    +5% from last month
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest course interactions and completions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Module completed</p>
                      <p className="text-xs text-gray-500">
                        "Introduction to Diabetes Management" by user #123
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">2 hours ago</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">New video uploaded</p>
                      <p className="text-xs text-gray-500">
                        "Blood Sugar Monitoring Techniques"
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">4 hours ago</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Course started</p>
                      <p className="text-xs text-gray-500">
                        "Advanced Diabetes Care" by user #456
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">1 day ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}