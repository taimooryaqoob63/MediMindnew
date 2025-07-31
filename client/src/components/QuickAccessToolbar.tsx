import { BookOpen, Calculator, Clock, HelpCircle, MessageCircle, Menu, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QuickAccessToolbarProps {
  onChatToggle?: () => void;
  onSidebarToggle?: () => void;
  onDocumentUpload?: () => void;
  isMobile?: boolean;
  isChatOpen?: boolean;
}

export default function QuickAccessToolbar({ 
  onChatToggle, 
  onSidebarToggle, 
  onDocumentUpload,
  isMobile,
  isChatOpen 
}: QuickAccessToolbarProps) {
  const quickActions = [
    {
      icon: BookOpen,
      title: "Quick Reference",
      color: "bg-medical-blue hover:bg-medical-blue/90",
      onClick: () => {
        console.log("Quick reference accessed");
      }
    },
    {
      icon: Calculator,
      title: "Insulin Calculator", 
      color: "bg-accent-purple hover:bg-accent-purple/90",
      onClick: () => {
        console.log("Insulin calculator accessed");
      }
    },
    {
      icon: Clock,
      title: "Medication Reminders",
      color: "bg-success-green hover:bg-success-green/90",
      onClick: () => {
        console.log("Medication reminders accessed");
      }
    },
    {
      icon: HelpCircle,
      title: "Help & Support",
      color: "bg-gray-600 hover:bg-gray-700",
      onClick: () => {
        console.log("Help & support accessed");
      }
    }
  ];

  return (
    <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-30">
      {/* Mobile Chat FAB */}
      {isMobile && onChatToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              onClick={onChatToggle}
              className={`w-14 h-14 rounded-full shadow-lg transition-all duration-300 interactive-hover ${
                isChatOpen 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-medical-blue hover:bg-medical-blue/90'
              } text-white p-0`}
            >
              <MessageCircle className="w-6 h-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{isChatOpen ? "Close AI Chat" : "Open AI Chat"}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Mobile Menu FAB */}
      {isMobile && onSidebarToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              onClick={onSidebarToggle}
              className="w-12 h-12 rounded-full bg-accent-purple hover:bg-accent-purple/90 shadow-lg interactive-hover text-white p-0"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Toggle Menu</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Quick Access Tools */}
      {quickActions.map((action, index) => (
        <Tooltip key={index}>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              className={`w-12 h-12 rounded-full shadow-lg ${action.color} text-white p-0 interactive-hover`}
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