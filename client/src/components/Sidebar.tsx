import { PlayCircle, Check, FileText, BarChart3, Network, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import type { Course, Module, UserProgress } from "@shared/schema";

interface SidebarProps {
  course?: Course;
  modules: Module[];
  progress: UserProgress[];
  overallProgress: number;
  selectedModuleId: string;
  onModuleSelect: (moduleId: string) => void;
  isMobile?: boolean;
}

export default function Sidebar({
  course,
  modules,
  progress,
  overallProgress,
  selectedModuleId,
  onModuleSelect,
  isMobile
}: SidebarProps) {
  const [, setLocation] = useLocation();

  const isModuleCompleted = (moduleId: string) => {
    return progress.some(p => p.moduleId === moduleId && p.completed);
  };

  const isModuleInProgress = (moduleId: string) => {
    return progress.some(p => p.moduleId === moduleId && !p.completed && (p.progress || 0) > 0);
  };

  const resources = [
    { id: '1', title: 'NICE Guidelines', icon: FileText, color: 'text-red-500' },
    { id: '2', title: 'NHS Best Practices', icon: FileText, color: 'text-red-500' },
    { id: '3', title: 'CQC Requirements', icon: FileText, color: 'text-red-500' },
  ];

  return (
    <aside className={`
      ${isMobile ? 'w-80' : 'w-80'}
      bg-white shadow-lg border-r border-gray-200 overflow-y-auto
      ${isMobile ? 'h-full' : ''}
      slide-in-left
    `}>
      <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
        <div className="mb-6 fade-in">
          <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-text-dark mb-2`}>
            {course?.title || 'Course Title'}
          </h2>
          <div className="bg-medical-blue/10 rounded-lg p-3 card-hover">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium medical-blue">Course Progress</span>
              <span className="text-sm font-semibold medical-blue">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        </div>

        <nav className="space-y-1">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
              Course Modules
            </h3>

            <div className="space-y-1">
              {modules.map((module, index) => {
                const isSelected = module.id === selectedModuleId;
                const isCompleted = isModuleCompleted(module.id);
                const isInProgress = isModuleInProgress(module.id);

                return (
                  <Button
                    key={module.id}
                    variant={isSelected ? "default" : "ghost"}
                    className={`w-full justify-start px-3 py-2 text-sm h-auto transition-all duration-200 ${
                      isSelected
                        ? 'bg-medical-blue text-white hover:bg-medical-blue/90 shadow-md'
                        : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                    } button-interactive`}
                    onClick={() => onModuleSelect(module.id)}
                  >
                    <PlayCircle className={`mr-3 w-4 h-4 transition-all duration-200 ${
                      isSelected ? 'text-white' : 'text-gray-400'
                    }`} />
                    <span className="flex-1 text-left">
                      {index + 1}. {module.title}
                    </span>
                    {isCompleted && (
                      <Check className="ml-2 w-4 h-4 success-green animate-pulse" />
                    )}
                    {isInProgress && !isCompleted && (
                      <div className="w-2 h-2 bg-medical-blue rounded-full ml-2 pulse-soft" />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
              Resources
            </h3>
            <div className="space-y-1">
              {resources.map((resource) => (
                <Button
                  key={resource.id}
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <resource.icon className={`mr-3 w-4 h-4 ${resource.color}`} />
                  <span>{resource.title}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Navigation for Analytics and Knowledge Graph */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
              Tools
            </h3>
            <div className="space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setLocation("/analytics")}
              >
                <BarChart3 className="mr-3 h-4 w-4 text-gray-500" />
                <span className="text-left">Analytics</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setLocation("/knowledge-graph")}
              >
                <Network className="mr-3 h-4 w-4 text-gray-500" />
                <span className="text-left">Knowledge Graph</span>
              </Button>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}