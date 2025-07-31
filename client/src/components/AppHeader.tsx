import { Clock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@shared/schema";
import logoPath from "@assets/logo (1)_1753960640359.png";

interface AppHeaderProps {
  user?: User;
}

export default function AppHeader({ user }: AppHeaderProps) {
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img 
                src={logoPath} 
                alt="MediMind AI Logo" 
                className="w-8 h-8 object-contain"
              />
              <h1 className="text-xl font-semibold medical-blue">MediMind AI</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <nav className="hidden md:flex items-center space-x-6">
              <Button variant="ghost" className="text-gray-600 hover:text-medical-blue">
                Home
              </Button>
              <Button variant="ghost" className="text-gray-600 hover:text-medical-blue">
                About Us
              </Button>
              <Button variant="outline" className="border-medical-blue text-medical-blue hover:bg-medical-blue hover:text-white">
                Login
              </Button>
            </nav>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 medical-blue" />
                <span>{currentTime}</span>
              </div>
              <Button variant="ghost" size="sm" className="p-2 text-gray-400 hover:text-medical-blue">
                <Bell className="w-4 h-4" />
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-medical-blue rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user ? getInitials(user.name) : 'U'}
                  </span>
                </div>
                <span className="hidden md:block text-sm font-medium">
                  {user?.name || 'User'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
