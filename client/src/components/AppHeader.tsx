import { Clock, Bell, Menu, MessageCircle, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@shared/schema";
import logoPath from "@assets/logo (1)_1753961810037.png";

interface AppHeaderProps {
  user?: User;
  onSidebarToggle?: () => void;
  onChatToggle?: () => void;
  isMobile?: boolean;
}

export default function AppHeader({ user, onSidebarToggle, onChatToggle, isMobile }: AppHeaderProps) {
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    } else if (user.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      return user.firstName;
    } else if (user.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            {isMobile && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onSidebarToggle}
                className="p-2 text-gray-600 hover:text-medical-blue button-interactive"
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            
            <div className="flex items-center space-x-2">
              <img 
                src={logoPath} 
                alt="MediMind AI Logo" 
                className="w-8 h-8 object-contain"
              />
              <h1 className={`font-semibold medical-blue ${isMobile ? 'text-lg' : 'text-xl'}`}>
                MediMind AI
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <nav className="hidden md:flex items-center space-x-6">
              <Button 
                variant="ghost" 
                className="text-gray-600 hover:text-medical-blue button-interactive"
                onClick={() => window.location.href = '/training'}
              >
                Training
              </Button>
              <Button 
                variant="ghost" 
                className="text-gray-600 hover:text-medical-blue button-interactive flex items-center gap-2"
                onClick={() => window.location.href = '/documents'}
              >
                <FileText className="h-4 w-4" />
                Documents
              </Button>
              <Button 
                variant="outline" 
                className="border-medical-blue text-medical-blue hover:bg-medical-blue hover:text-white button-interactive"
                onClick={() => window.location.href = '/api/logout'}
              >
                Logout
              </Button>
            </nav>
            
            <div className="flex items-center space-x-2">
              {/* Mobile Chat Button */}
              {isMobile && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onChatToggle}
                  className="p-2 text-gray-600 hover:text-medical-blue button-interactive"
                >
                  <MessageCircle className="w-5 h-5" />
                </Button>
              )}
              
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 medical-blue" />
                <span>{currentTime}</span>
              </div>
              <Button variant="ghost" size="sm" className="p-2 text-gray-400 hover:text-medical-blue button-interactive">
                <Bell className="w-4 h-4" />
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-medical-blue rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user ? getInitials(user) : 'U'}
                  </span>
                </div>
                <span className="hidden md:block text-sm font-medium">
                  {user ? getUserDisplayName(user) : 'User'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
