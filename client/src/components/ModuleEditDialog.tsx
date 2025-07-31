import { useState } from "react";
import { Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Module, InsertModule } from "@shared/schema";

interface ModuleEditDialogProps {
  module: Module;
  onUpdate?: (module: Module) => void;
}

export default function ModuleEditDialog({ module, onUpdate }: ModuleEditDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editData, setEditData] = useState({
    title: module.title,
    description: module.description,
    duration: module.duration || "",
    orderIndex: module.orderIndex,
    content: {
      learningObjectives: (module.content && 
                          typeof module.content === 'object' && 
                          'learningObjectives' in module.content &&
                          Array.isArray((module.content as any).learningObjectives)) 
                          ? (module.content as any).learningObjectives as string[]
                          : [""]
    }
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertModule>) => {
      const response = await apiRequest("PATCH", `/api/modules/${module.id}`, data);
      return response.json();
    },
    onSuccess: (updatedModule) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", module.courseId, "modules"] });
      toast({
        title: "Module Updated",
        description: "Module details have been updated successfully!",
      });
      onUpdate?.(updatedModule);
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update module. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    if (!editData.title.trim() || !editData.description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const updatePayload = {
      title: editData.title,
      description: editData.description,
      duration: editData.duration || null,
      orderIndex: editData.orderIndex,
      content: editData.content
    };

    updateMutation.mutate(updatePayload);
  };

  const addLearningObjective = () => {
    setEditData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        learningObjectives: [...prev.content.learningObjectives, ""]
      }
    }));
  };

  const updateLearningObjective = (index: number, value: string) => {
    setEditData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        learningObjectives: prev.content.learningObjectives.map((obj, i) => i === index ? value : obj)
      }
    }));
  };

  const removeLearningObjective = (index: number) => {
    if (editData.content.learningObjectives.length > 1) {
      setEditData(prev => ({
        ...prev,
        content: {
          ...prev.content,
          learningObjectives: prev.content.learningObjectives.filter((_, i) => i !== index)
        }
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="hover:bg-gray-100">
          <Edit className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Module Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="edit-title">Module Title *</Label>
            <Input
              id="edit-title"
              value={editData.title}
              onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="edit-description">Description *</Label>
            <Textarea
              id="edit-description"
              value={editData.description}
              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-duration">Duration</Label>
              <Input
                id="edit-duration"
                value={editData.duration}
                onChange={(e) => setEditData(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="e.g., 15:30"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-order">Order Index</Label>
              <Input
                id="edit-order"
                type="number"
                value={editData.orderIndex}
                onChange={(e) => setEditData(prev => ({ ...prev, orderIndex: parseInt(e.target.value) || 1 }))}
                className="mt-1"
                min={1}
              />
            </div>
          </div>

          {/* Learning Objectives */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Learning Objectives</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLearningObjective}
              >
                Add Objective
              </Button>
            </div>
            <div className="space-y-2">
              {editData.content.learningObjectives.map((objective, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={objective}
                    onChange={(e) => updateLearningObjective(index, e.target.value)}
                    placeholder="Enter learning objective..."
                    className="flex-1"
                  />
                  {editData.content.learningObjectives.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLearningObjective(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Video Info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Video Information</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">Status:</span> {module.videoUrl ? 'Video Ready' : 'No Video'}</p>
              {module.videoUrl && (
                <p><span className="font-medium">Video Path:</span> {module.videoUrl}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t mt-6">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!editData.title.trim() || !editData.description.trim() || updateMutation.isPending}
            className="bg-medical-blue hover:bg-medical-blue/90"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}