import { useState, useRef, useEffect } from "react";
import { Bot, Send, Shield, Mic, MicOff, Volume2, VolumeX, X, ChevronDown, Pause, Play, Square, Settings, Copy, Check, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage, Module } from "@shared/schema";

interface AITutorChatProps {
  courseId: string;
  currentModule?: Module;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

interface ChatResponse {
  message: ChatMessage;
}

export default function AITutorChat({ courseId, currentModule, isMobile, isOpen, onClose }: AITutorChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Enhanced TTS and STT state
  const [isListening, setIsListening] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState(0.9);
  const [speechVolume, setSpeechVolume] = useState(0.8);
  const [recognition, setRecognition] = useState<any>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(false);
  const [isRecordingAnimation, setIsRecordingAnimation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", courseId],
  });

  // Enhanced TTS and STT initialization
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
        setIsRecordingAnimation(true);
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
          setInputMessage(prev => prev + transcript);
          setIsListening(false);
          setIsRecordingAnimation(false);
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
        setIsRecordingAnimation(false);

        let errorMessage = "Speech recognition failed";
        switch (event.error) {
          case 'no-speech':
            errorMessage = "No speech detected. Please try again.";
            break;
          case 'audio-capture':
            errorMessage = "Microphone access denied or unavailable.";
            break;
          case 'not-allowed':
            errorMessage = "Microphone permission denied.";
            break;
          case 'network':
            errorMessage = "Network error occurred.";
            break;
        }

        toast({
          title: "Speech Recognition Error",
          description: errorMessage,
          variant: "destructive",
          duration: 4000,
        });
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsRecordingAnimation(false);
      };

      setRecognition(recognition);
    } else {
      setSpeechRecognitionSupported(false);
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      setSpeechSynthesisSupported(true);
      const synth = window.speechSynthesis;
      setSynthesis(synth);

      // Load available voices
      const loadVoices = () => {
        const voices = synth.getVoices();
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en-'));
        setAvailableVoices(englishVoices.length > 0 ? englishVoices : voices);

        // Try to find a good default voice
        const preferredVoice = englishVoices.find(voice => 
          voice.name.toLowerCase().includes('google') || 
          voice.name.toLowerCase().includes('microsoft') ||
          voice.name.toLowerCase().includes('default')
        );
        if (preferredVoice) {
          const index = englishVoices.indexOf(preferredVoice);
          setSelectedVoiceIndex(index >= 0 ? index : 0);
        }
      };

      // Load voices immediately and also listen for voice changes
      loadVoices();
      synth.onvoiceschanged = loadVoices;
    } else {
      setSpeechSynthesisSupported(false);
    }
  }, [toast]);

  const chatMutation = useMutation({
    mutationFn: async (data: { message: string; courseId: string; context?: string }) => {
      const response = await apiRequest("POST", "/api/chat", data);
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", courseId] });
      setInputMessage("");

      // Read the AI response aloud if TTS is enabled
      if (isTTSEnabled && synthesis && data.message.response) {
        speakText(data.message.response);
      }
    },
  });

  // Clear chat mutation
  const clearChatMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await apiRequest("DELETE", `/api/chat/${courseId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Clear chat error:", errorText);
        throw new Error(`Failed to clear chat: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", courseId] });
      toast({
        title: "New chat started",
        description: "Ready for a fresh conversation!",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      console.error("Clear chat mutation error:", error);
      toast({
        title: "Failed to clear chat",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
    // Fallback to the messagesEndRef method
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Enhanced TTS Functions
  const speakText = (text: string) => {
    if (!synthesis || !speechSynthesisSupported) return;

    // Stop any current speech
    synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechSpeed;
    utterance.pitch = 1;
    utterance.volume = speechVolume;

    // Use selected voice
    if (availableVoices.length > 0 && availableVoices[selectedVoiceIndex]) {
      utterance.voice = availableVoices[selectedVoiceIndex];
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentUtterance(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentUtterance(null);
      toast({
        title: "Speech Error",
        description: "Failed to speak the text",
        variant: "destructive",
        duration: 3000,
      });
    };

    setCurrentUtterance(utterance);
    synthesis.speak(utterance);
  };

  const pauseSpeaking = () => {
    if (synthesis && isSpeaking) {
      synthesis.pause();
    }
  };

  const resumeSpeaking = () => {
    if (synthesis && isSpeaking) {
      synthesis.resume();
    }
  };

  const stopSpeaking = () => {
    if (synthesis) {
      synthesis.cancel();
      setCurrentUtterance(null);
      setIsSpeaking(false);
    }
  };

  const toggleTTS = () => {
    setIsTTSEnabled(!isTTSEnabled);
    if (!isTTSEnabled && synthesis) {
      synthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;

    if (window.confirm("Are you sure you want to clear all chat messages? This action cannot be undone.")) {
      clearChatMutation.mutate(courseId);
    }
  };

  // Copy message function
  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      toast({
        title: "Copied to clipboard",
        description: "Message copied successfully",
        duration: 2000,
      });
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy message to clipboard",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // STT Functions
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

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const context = currentModule ? `Current module: ${currentModule.title} - ${currentModule.description}` : undefined;

    chatMutation.mutate({
      message: inputMessage.trim(),
      courseId,
      context,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`
      ${isMobile 
        ? 'h-96 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-t-xl shadow-2xl' 
        : 'w-96 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg'
      } 
      flex flex-col transition-all duration-300 ease-in-out
    `}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-medical-blue/5 to-accent-purple/5 dark:from-medical-blue/10 dark:to-accent-purple/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className={`w-10 h-10 bg-gradient-to-br from-medical-blue to-accent-purple rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                isSpeaking ? 'speaking-ring' : isListening ? 'listening-ring' : ''
              }`}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              {isSpeaking && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center speaking-indicator">
                  <Volume2 className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              {isListening && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center recording-pulse">
                  <Mic className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-text-dark dark:text-white">AI Tutor</h3>
                <div className="flex space-x-1">
                  {speechSynthesisSupported && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                      TTS
                    </Badge>
                  )}
                  {speechRecognitionSupported && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                      STT
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ask me anything about diabetes care</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {/* New Chat Button */}
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearChat}
                    disabled={clearChatMutation.isPending}
                    className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900 text-blue-500 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>New Chat</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* TTS Settings (for desktop) */}
            {!isMobile && speechSynthesisSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTTS}
                    className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    {isTTSEnabled ? (
                      <Volume2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isTTSEnabled ? "Disable TTS" : "Enable TTS"}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <ChevronDown className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className={`
          flex-1 overflow-y-auto p-4 space-y-4 
          ${isMobile ? 'max-h-64' : 'min-h-0'}
          scrollbar-thin chat-scroll
        `}
        style={{ 
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}>
        {/* Welcome Message */}
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-medical-blue to-accent-purple rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-gray-100 rounded-lg p-3">
              <p className="text-sm text-text-dark">
                Hello! I'm your AI tutor, ready to help you understand diabetes management. 
                I can answer questions based on NICE guidelines, NHS best practices, and CQC requirements. 
                What would you like to know?
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-1">AI Assistant</p>
          </div>
        </div>

        {/* Chat Messages */}
        {messages.map((msg, index) => (
          <div key={msg.id} className="group message-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
            {/* User Message */}
            <div className="flex items-start space-x-3 justify-end mb-4">
              <div className="flex-1">
                <div className="relative bg-medical-blue rounded-lg p-3 ml-8 message-hover-lift group/message">
                  <p className="text-sm text-white select-text pr-8">{msg.message}</p>
                  <div className="absolute top-2 right-2 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(msg.message, `user-${msg.id}`)}
                          className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                        >
                          {copiedMessageId === `user-${msg.id}` ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy message</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {formatTimestamp(msg.timestamp)}
                </p>
              </div>
              <div className="w-8 h-8 bg-medical-blue rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white text-xs font-medium">You</span>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-medical-blue to-accent-purple rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="relative bg-gray-100 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-lg p-3 message-hover-lift group/message">
                  <p className="text-sm text-text-dark dark:text-gray-200 whitespace-pre-wrap select-text pr-16">{msg.response}</p>
                  <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
                    {speechSynthesisSupported && isTTSEnabled && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => speakText(msg.response)}
                            className="h-6 w-6 p-0 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-500"
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Read aloud</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(msg.response, `ai-${msg.id}`)}
                          className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {copiedMessageId === `ai-${msg.id}` ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy response</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(msg.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading Message */}
        {chatMutation.isPending && (
          <div className="flex items-start space-x-3 message-slide-in">
            <div className="w-8 h-8 bg-gradient-to-br from-medical-blue to-accent-purple rounded-full flex items-center justify-center flex-shrink-0 pulse-soft">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 glow-effect">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-medical-blue rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-medical-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-medical-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300 ml-2">AI is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className={`${isMobile ? 'p-3' : 'p-4'} border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50`}>
        {/* Voice Recording Indicator */}
        {isListening && (
          <div className="mb-3 flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-full text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>Listening... Speak now</span>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        )}

        {/* Speech Controls (when speaking) */}
        {isSpeaking && (
          <div className="mb-3 flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-2 rounded-full text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Speaking...</span>
              <div className="flex space-x-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={synthesis?.paused ? resumeSpeaking : pauseSpeaking}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
                    >
                      {synthesis?.paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{synthesis?.paused ? "Resume" : "Pause"}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={stopSpeaking}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                    >
                      <Square className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        <div className={`flex space-x-2 mb-3`}>
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder={
                isListening 
                  ? "🎤 Listening..." 
                  : (isMobile ? "Type or speak your question..." : "Ask about diabetes care guidelines...")
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`text-sm pr-20 transition-all duration-200 ${
                isListening 
                  ? 'ring-2 ring-red-500 ring-opacity-50 bg-red-50 dark:bg-red-900/20' 
                  : 'focus:ring-2 focus:ring-medical-blue'
              }`}
              disabled={chatMutation.isPending}
            />

            {/* Input Controls */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              {/* Microphone Button */}
              {speechRecognitionSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={isListening ? stopListening : startListening}
                      disabled={chatMutation.isPending}
                      variant="ghost"
                      size="sm"
                      className={`h-8 w-8 p-0 transition-all duration-200 ${
                        isListening 
                          ? "bg-red-500 hover:bg-red-600 text-white" 
                          : "text-gray-500 hover:text-medical-blue dark:text-gray-400 dark:hover:text-medical-blue"
                      }`}
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
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
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || chatMutation.isPending}
                    size="sm"
                    className="h-8 w-8 p-0 bg-medical-blue hover:bg-medical-blue/90 disabled:bg-gray-300 transition-all duration-200"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send message (Enter)</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Enhanced Controls and Info */}
        <div className={`flex items-center justify-between ${isMobile ? 'flex-col space-y-2' : ''}`}>
          <div className="flex items-center space-x-2">
            <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 dark:text-gray-400 flex items-center`}>
              <Shield className="w-3 h-3 text-medical-blue mr-1" />
              {isMobile ? 'NICE/NHS Guidelines' : 'Based on NICE, NHS & CQC guidelines'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Feature Status Indicators */}
            {!speechRecognitionSupported && (
              <Badge variant="outline" className="text-xs text-gray-500">
                No STT
              </Badge>
            )}
            {!speechSynthesisSupported && (
              <Badge variant="outline" className="text-xs text-gray-500">
                No TTS
              </Badge>
            )}

            {/* TTS Toggle (mobile) */}
            {isMobile && speechSynthesisSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={toggleTTS}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    {isTTSEnabled ? (
                      <Volume2 className="w-3 h-3 text-green-600" />
                    ) : (
                      <VolumeX className="w-3 h-3 text-gray-400" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isTTSEnabled ? "Disable TTS" : "Enable TTS"}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}