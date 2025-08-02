import { MessageCircle, Menu, Hand } from "lucide-react";
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
            className="w-16 h-16 rounded-full bg-yellow-400 hover:bg-yellow-500 shadow-xl interactive-hover text-gray-800 p-0 border-2 border-yellow-300"
          >
            <Hand className="w-8 h-8" />
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