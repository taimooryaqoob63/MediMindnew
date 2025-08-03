import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Volume2, VolumeX, Mic, MicOff, HelpCircle, Plus, Settings, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Source {
  fileName: string;
  pageNumber?: number;
  content: string;
  relevanceScore: number;
}

interface ChatMessage {
  id: string;
  userId: string;
  courseId: string;
  message: string;
  response: string;
  timestamp: string;
  sources?: Source[];
}

interface FloatingAIChatProps {
  courseId: string;
  context?: string;
}

export function FloatingAIChat({ courseId, context }: FloatingAIChatProps) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize speech features
  useEffect(() => {
    // Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechRecognitionSupported(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };
      recognition.onerror = () => {
        setIsListening(false);
        toast({
          title: "Speech recognition error",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive",
        });
      };

      setRecognition(recognition);
    }

    // Speech Synthesis
    if ('speechSynthesis' in window) {
      setSpeechSynthesisSupported(true);
    }
  }, [toast]);

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
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/${courseId}`] });
      setInput("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clear chat mutation
  const clearChatMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await fetch(`/api/chat/${courseId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to clear chat");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/${courseId}`] });
      toast({
        title: "Chat cleared",
        description: "All previous messages have been removed",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to clear chat",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    sendMessage.mutate({
      message: input.trim(),
      courseId,
      context,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startListening = () => {
    if (recognition && !isListening) {
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  const speakText = (text: string) => {
    if (!speechSynthesisSupported || !isTTSEnabled) return;
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    
    if (window.confirm("Are you sure you want to clear all chat messages? This action cannot be undone.")) {
      clearChatMutation.mutate(courseId);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Welcome Message */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <h2 className="text-2xl font-normal text-gray-800 mb-8 text-center">
            Ready when you are.
          </h2>
        </div>
      )}

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-6">
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-4">
                  {/* User Message */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 rounded-2xl px-4 py-3">
                        <p className="text-gray-800 leading-relaxed">{msg.message}</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                        <p className="text-gray-800 leading-relaxed mb-3">{msg.response}</p>
                        
                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="border-t border-gray-100 pt-3 mt-3">
                            <p className="text-xs font-medium text-gray-600 mb-2">Sources:</p>
                            <div className="space-y-1">
                              {msg.sources.map((source, index) => (
                                <div key={index} className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1">
                                  <span className="font-medium">{source.fileName}</span>
                                  {source.pageNumber && <span> - Page {source.pageNumber}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* TTS Button */}
                      {speechSynthesisSupported && isTTSEnabled && (
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => speakText(msg.response)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                          >
                            <Volume2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Input Area */}
      <div className="p-6 border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <div className="flex items-center bg-gray-50 rounded-full border border-gray-200 px-4 py-3">
              {/* Plus Icon */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 mr-3"
              >
                <Plus className="h-4 w-4" />
              </Button>

              {/* Input */}
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything"
                className="flex-1 border-0 bg-transparent text-gray-800 placeholder-gray-500 focus:ring-0 focus:outline-none p-0"
                disabled={sendMessage.isPending}
              />

              {/* Clear Chat Button */}
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  disabled={clearChatMutation.isPending}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600 mx-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {/* Tools Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 mx-3"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500 mr-3">Tools</span>

              {/* Speech Recognition */}
              {speechRecognitionSupported && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={isListening ? stopListening : startListening}
                  className={`h-6 w-6 p-0 mr-2 ${isListening ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              )}

              {/* TTS Toggle */}
              {speechSynthesisSupported && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                  className={`h-6 w-6 p-0 mr-2 ${isTTSEnabled ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {isTTSEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              )}

              {/* Send Button */}
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || sendMessage.isPending}
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                variant="ghost"
              >
                {sendMessage.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}