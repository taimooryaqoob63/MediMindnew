import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Module } from "@shared/schema";

interface ModuleDeleteDialogProps {
  module: Module;
  onDelete?: () => void;
}

export default function ModuleDeleteDialog({ module, onDelete }: ModuleDeleteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/modules/${module.id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", module.courseId, "modules"] });
      toast({
        title: "Module Deleted",
        description: "The module has been permanently removed.",
      });
      onDelete?.();
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete module. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>Delete Module</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              This action cannot be undone. The module and its video will be permanently removed.
            </AlertDescription>
          </Alert>

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-1">{module.title}</h4>
            <p className="text-sm text-gray-600">{module.description}</p>
            <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500">
              <span>Module {module.orderIndex}</span>
              {module.duration && <span>• {module.duration}</span>}
              {module.videoUrl && <span>• Video attached</span>}
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Are you sure you want to delete this module? This will remove:
          </p>
          <ul className="text-sm text-gray-600 space-y-1 ml-4">
            <li>• The module content and learning objectives</li>
            <li>• Any uploaded video files</li>
            <li>• User progress data for this module</li>
          </ul>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Module"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}