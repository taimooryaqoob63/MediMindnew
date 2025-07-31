import { AlertTriangle, StickyNote, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function QuickAccessToolbar() {
  const quickActions = [
    {
      icon: AlertTriangle,
      title: "Emergency Protocols",
      color: "bg-medical-blue hover:bg-medical-blue/90",
      onClick: () => {
        // Handle emergency protocols
        console.log("Emergency protocols accessed");
      }
    },
    {
      icon: StickyNote,
      title: "Quick Notes",
      color: "bg-accent-purple hover:bg-accent-purple/90",
      onClick: () => {
        // Handle quick notes
        console.log("Quick notes accessed");
      }
    },
    {
      icon: HelpCircle,
      title: "Help & Support",
      color: "bg-success-green hover:bg-success-green/90",
      onClick: () => {
        // Handle help and support
        console.log("Help & support accessed");
      }
    }
  ];

  return (
    <div className="fixed bottom-4 right-4 flex flex-col space-y-2 z-40">
      {quickActions.map((action, index) => (
        <Tooltip key={index}>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              className={`w-12 h-12 rounded-full shadow-lg ${action.color} text-white p-0`}
              onClick={action.onClick}
            >
              <action.icon className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{action.title}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
