import { MessageCircle, Menu } from "lucide-react";
import helpIcon from "@/assets/help-icon.png";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QuickAccessToolbarProps {
  onChatToggle?: () => void;
  onSidebarToggle?: () => void;
  isMobile?: boolean;
  isChatOpen?: boolean;
}

export default function QuickAccessToolbar({ 
  onChatToggle, 
  onSidebarToggle, 
  isMobile,
  isChatOpen 
}: QuickAccessToolbarProps) {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-30">
      {/* Hand Icon FAB - Always visible */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="lg"
            className="w-16 h-16 rounded-full bg-white hover:bg-gray-50 shadow-2xl p-0 border-4 border-gray-200 transition-all duration-200 hover:scale-105"
            variant="ghost"
          >
            <img 
              src={helpIcon} 
              alt="Help Assistant" 
              className="w-12 h-12 object-contain"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Help Assistant</p>
        </TooltipContent>
      </Tooltip>

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
    </div>
  );
}