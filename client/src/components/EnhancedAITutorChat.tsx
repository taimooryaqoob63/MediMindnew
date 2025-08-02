import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, BookOpen, FileText, ExternalLink, Mic, MicOff, Volume2, VolumeX, ChevronUp, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  userId: string;
  courseId: string;
  message: string;
  response: string;
  timestamp: string;
}

interface Source {
  fileName: string;
  pageNumber?: number;
  content: string;
  relevanceScore: number;
}

interface ChatResponse {
  message: ChatMessage;
  sources?: Source[];
  suggestedQuestions?: string[];
}

interface EnhancedAITutorChatProps {
  courseId: string;
  context?: string;
}

export function EnhancedAITutorChat({ courseId, context }: EnhancedAITutorChatProps) {
  const [input, setInput] = useState("");
  const [selectedSources, setSelectedSources] = useState<Source[]>([]);
  const [chatHeight, setChatHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  
  // STT/TTS State
  const [isListening, setIsListening] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch chat messages
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chat/${courseId}`],
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ message, courseId, context }: { message: string; courseId: string; context?: string }) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, courseId, context }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send message");
      }
      
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/${courseId}`] });
      setInput("");
      
      // Update sources if available
      if (data.sources && data.sources.length > 0) {
        setSelectedSources(data.sources);
      } else {
        setSelectedSources([]);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (messageText?: string) => {
    const message = messageText || input.trim();
    if (!message) return;

    sendMessage.mutate({ message, courseId, context });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Initialize STT/TTS
  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechRecognitionSupported(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        toast({
          title: "Listening...",
          description: "Speak clearly into your microphone",
          duration: 2000,
        });
      };

      recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const transcript = lastResult[0].transcript;
          setInput(prev => prev + transcript);
          setIsListening(false);
          toast({
            title: "Speech captured",
            description: `"${transcript}"`,
            duration: 3000,
          });
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Speech recognition failed",
          description: "Please try again or type your message",
          variant: "destructive",
          duration: 3000,
        });
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      setSpeechSynthesisSupported(true);
      setSynthesis(window.speechSynthesis);
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // STT/TTS Functions
  const startListening = () => {
    if (recognition && speechRecognitionSupported) {
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  const speakText = (text: string) => {
    if (synthesis && speechSynthesisSupported && isTTSEnabled) {
      // Stop any current speech
      synthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.volume = 0.8;
      utterance.pitch = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      synthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (synthesis) {
      synthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleTTS = () => {
    setIsTTSEnabled(!isTTSEnabled);
    if (isSpeaking) {
      stopSpeaking();
    }
  };

  // Chat resize functions
  const handleResize = (newHeight: number) => {
    setChatHeight(Math.max(200, Math.min(800, newHeight)));
  };

  const toggleChatSize = () => {
    setChatHeight(prevHeight => prevHeight === 400 ? 600 : 400);
  };

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
      {/* Chat Header */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-sm">AI Diabetes Care Tutor</span>
            {selectedSources.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedSources.length} sources
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* TTS Toggle */}
            {speechSynthesisSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTTS}
                    className="h-8 w-8 p-0"
                  >
                    {isTTSEnabled ? (
                      <Volume2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isTTSEnabled ? "Disable TTS" : "Enable TTS"}</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* Resize Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleChatSize}
                  className="h-8 w-8 p-0"
                >
                  {chatHeight === 400 ? (
                    <Maximize2 className="h-4 w-4" />
                  ) : (
                    <Minimize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{chatHeight === 400 ? "Expand Chat" : "Minimize Chat"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">Welcome to your AI Diabetes Care Tutor!</p>
                  <p className="text-sm">Ask questions about diabetes management, NICE guidelines, or care procedures.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="space-y-4">
                    {/* User Message */}
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">You</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                          <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">AI Tutor</span>
                          {speechSynthesisSupported && isTTSEnabled && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => speakText(msg.response)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Volume2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Read aloud</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.response}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Document Sources Panel */}
        {selectedSources.length > 0 && (
          <div className="border-t bg-gray-50 dark:bg-gray-800">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Document Sources</span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {selectedSources.map((source, index) => (
                  <div key={index} className="text-xs bg-white dark:bg-gray-700 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{source.fileName}</span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(source.relevanceScore * 100)}%
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{source.content.substring(0, 100)}...</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-3 bg-white dark:bg-gray-900">
          {isListening && (
            <div className="mb-2 flex items-center justify-center">
              <div className="flex items-center space-x-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-1 rounded-full text-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span>Listening...</span>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isListening ? "🎤 Listening..." : "Ask about diabetes care, NICE guidelines..."}
                disabled={sendMessage.isPending}
                className="pr-20"
              />
              
              {/* Input Controls */}
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                {/* Microphone Button */}
                {speechRecognitionSupported && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={isListening ? stopListening : startListening}
                        disabled={sendMessage.isPending}
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${isListening ? "text-red-500" : "text-gray-500"}`}
                      >
                        {isListening ? (
                          <MicOff className="h-4 w-4" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isListening ? "Stop listening" : "Start voice input"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Send Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim() || sendMessage.isPending}
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      {sendMessage.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send message</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}