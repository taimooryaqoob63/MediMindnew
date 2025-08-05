import { Clock, Bell, Menu, MessageCircle, X, User as UserIcon, Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { User, Notification } from "@shared/schema";
import logoPath from "@assets/logo (1)_1753961810037.png";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface AppHeaderProps {
  user?: User;
  onSidebarToggle?: () => void;
  onChatToggle?: () => void;
  isMobile?: boolean;
}

export default function AppHeader({ user, onSidebarToggle, onChatToggle, isMobile }: AppHeaderProps) {
  const [location, setLocation] = useLocation();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Fetch unread notifications
  const { data: unreadNotifications = [], isLoading: notificationsLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications/unread'],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest('PATCH', `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
    },
  });

  // Mark all notifications as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', '/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    markAsReadMutation.mutate(notification.id);
    
    // Navigate to action URL if provided
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
    }
    
    // Close popover
    setNotificationOpen(false);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleLogoClick = () => {
    setLocation('/training');
  };

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
            
            <button 
              onClick={handleLogoClick}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-medical-blue focus:ring-offset-2 rounded-md p-1"
            >
              <img 
                src={logoPath} 
                alt="MediMind AI Logo" 
                className="w-8 h-8 object-contain"
              />
              <h1 className={`font-semibold medical-blue ${isMobile ? 'text-lg' : 'text-xl'}`}>
                MediMind AI
              </h1>
            </button>
          </div>
          
          <div className="flex items-center space-x-6">
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/training">
                <Button 
                  variant="ghost" 
                  className={`text-gray-600 hover:text-medical-blue button-interactive ${
                    location === '/training' || location === '/' ? 'text-medical-blue' : ''
                  }`}
                >
                  Training
                </Button>
              </Link>
              <Link href="/manage">
                <Button 
                  variant="ghost" 
                  className={`text-gray-600 hover:text-medical-blue button-interactive ${
                    location === '/manage' ? 'text-medical-blue' : ''
                  }`}
                >
                  Manage Courses
                </Button>
              </Link>
              <Link href="/documents">
                <Button 
                  variant="ghost" 
                  className={`text-gray-600 hover:text-medical-blue button-interactive ${
                    location === '/documents' ? 'text-medical-blue' : ''
                  }`}
                >
                  Documents
                </Button>
              </Link>
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
              
              {/* Notification Bell */}
              <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-2 text-gray-400 hover:text-medical-blue button-interactive relative"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Notifications</h3>
                      {unreadNotifications.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-medical-blue hover:text-medical-blue/80"
                        >
                          Mark all as read
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="p-4 text-center text-gray-500">Loading...</div>
                    ) : unreadNotifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No new notifications</div>
                    ) : (
                      <div className="divide-y">
                        {unreadNotifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-start space-x-3">
                              <div className="w-2 h-2 bg-medical-blue rounded-full mt-2 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {notification.createdAt ? new Date(notification.createdAt).toLocaleDateString() : 'Recently'}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2 hover:bg-gray-100">
                    <div className="w-8 h-8 bg-medical-blue rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user ? getInitials(user) : 'U'}
                      </span>
                    </div>
                    <span className="hidden md:block text-sm font-medium max-w-32 truncate">
                      {user ? getUserDisplayName(user) : 'User'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user ? getUserDisplayName(user) : 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.email || 'user@example.com'}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">
                    <UserIcon className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={() => window.location.href = '/api/logout'}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
