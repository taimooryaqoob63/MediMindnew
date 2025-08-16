import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, ChevronDown, Stethoscope, Heart, BookOpen, AlertCircle, Copy, RotateCcw, ThumbsUp, ThumbsDown, Search, Download, Sparkles, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage, Module } from "@shared/schema";

interface AITutorChatProps {
  courseId: string;
  currentModule?: Module;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

interface SourceReference {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  type: string;
}

interface ChatResponse {
  message?: ChatMessage;
  id?: string;
  response?: string;
  content?: string;
  sources?: SourceReference[];
  confidence?: number;
  followUpQuestions?: string[];
  usedRAG?: boolean;
  timestamp?: Date;
}

interface EnhancedChatMessage extends ChatMessage {
  sources?: SourceReference[];
  confidence?: number;
  usedRAG?: boolean;
}

export default function AITutorChat({ courseId, currentModule, isMobile, isOpen, onClose }: AITutorChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [quickReplies] = useState([
    "What are the symptoms of diabetes?",
    "How to manage blood sugar levels?",
    "What medications are used for Type 2 diabetes?",
    "Signs of diabetic complications?",
    "Diet recommendations for diabetics?"
  ]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // TTS and STT state
  const [isListening, setIsListening] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [recognition, setRecognition] = useState<any>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", courseId],
  });

  // Initialize TTS and STT
  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      setSynthesis(window.speechSynthesis);
    }
  }, []);

  const chatMutation = useMutation({
    mutationFn: async (data: { message: string; courseId: string; context?: string }) => {
      console.log('🚀 Starting chat mutation with data:', { 
        message: data.message?.substring(0, 50), 
        courseId: data.courseId,
        timestamp: new Date().toISOString()
      });
      
      // Always use RAG chat endpoint - server will handle fallbacks
      try {
        console.log('🤖 Attempting RAG chat with payload:', {
          message: data.message?.substring(0, 100) + '...',
          courseId: data.courseId,
          payloadSize: JSON.stringify({ message: data.message, courseId: data.courseId }).length
        });
        
        console.log('📡 Making RAG API request...');
        const ragResponse = await apiRequest("POST", "/api/rag/chat", {
          message: data.message,
          courseId: data.courseId
        });
        
        console.log('📡 RAG API response status:', ragResponse.status);
        
        if (!ragResponse.ok) {
          const errorText = await ragResponse.text();
          console.error('❌ RAG API error details:', {
            status: ragResponse.status,
            statusText: ragResponse.statusText,
            errorBody: errorText,
            headers: Object.fromEntries(ragResponse.headers.entries())
          });
          throw new Error(`RAG API returned ${ragResponse.status}: ${ragResponse.statusText} - ${errorText}`);
        }
        
        console.log('📊 Parsing RAG response...');
        const result = await ragResponse.json();
        console.log('✅ RAG response successful:', { 
          hasResponse: !!result.response || !!result.content, 
          confidence: result.confidence,
          sourcesCount: result.sources?.length || 0,
          agentsUsed: result.agentsUsed,
          usedRAG: result.usedRAG,
          responseLength: (result.response || result.content || '').length
        });
        return { ...result, usedRAG: true } as ChatResponse;
      } catch (ragError) {
        console.error('❌ RAG chat failed, error details:', {
          error: ragError,
          errorMessage: ragError instanceof Error ? ragError.message : 'Unknown error',
          errorStack: ragError instanceof Error ? ragError.stack : null,
          timestamp: new Date().toISOString()
        });
        
        console.log('🔄 Falling back to basic chat...');
        // Fallback to basic chat
        try {
          console.log('📡 Making basic chat API request...');
          const response = await apiRequest("POST", "/api/chat", data);
          console.log('📡 Basic chat API response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Basic chat API error:', {
              status: response.status,
              statusText: response.statusText,
              errorBody: errorText
            });
            throw new Error(`Basic chat API returned ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log('✅ Basic chat fallback successful:', {
            hasResponse: !!result.response || !!result.content,
            responseLength: (result.response || result.content || '').length
          });
          return { ...result, usedRAG: false } as ChatResponse;
        } catch (basicError) {
          console.error('❌ Basic chat also failed:', {
            error: basicError,
            errorMessage: basicError instanceof Error ? basicError.message : 'Unknown error',
            errorStack: basicError instanceof Error ? basicError.stack : null
          });
          throw basicError;
        }
      }
    },
    onSuccess: (data) => {
      console.log('✅ Chat mutation successful:', {
        hasData: !!data,
        hasResponse: !!(data.response || data.content),
        usedRAG: data.usedRAG,
        confidence: data.confidence,
        sourcesCount: data.sources?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/chat", courseId] });
      setInputMessage("");
      
      // Read the AI response aloud if TTS is enabled
      const responseText = data.response || data.content;
      if (isTTSEnabled && synthesis && responseText) {
        console.log('🔊 Starting TTS for response:', responseText.substring(0, 50) + '...');
        speakText(responseText);
      }
    },
    onError: (error) => {
      console.error('❌ Chat mutation error - Full details:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : null,
        timestamp: new Date().toISOString(),
        inputMessage: inputMessage?.substring(0, 100) + '...',
        courseId: courseId
      });
      
      // Check if it's a network error
      if (error instanceof Error && error.message.includes('fetch')) {
        console.error('🌐 Network error detected - checking connection');
      }
    }
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

  // TTS Functions
  const speakText = (text: string) => {
    if (!synthesis) return;
    
    // Stop any current speech
    synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    // Find a suitable voice (prefer English voices)
    const voices = synthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang.startsWith('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    setCurrentUtterance(utterance);
    synthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthesis) {
      synthesis.cancel();
      setCurrentUtterance(null);
    }
  };

  const toggleTTS = () => {
    setIsTTSEnabled(!isTTSEnabled);
    if (!isTTSEnabled && synthesis) {
      synthesis.cancel();
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

  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim()) return;
    
    const trimmedMessage = inputMessage.trim();
    
    // Add to recent queries
    setRecentQueries(prev => {
      const updated = [trimmedMessage, ...prev.filter(q => q !== trimmedMessage)].slice(0, 5);
      localStorage.setItem('medimind-recent-queries', JSON.stringify(updated));
      return updated;
    });
    
    const context = currentModule ? `Current module: ${currentModule.title} - ${currentModule.description}` : undefined;
    
    chatMutation.mutate({
      message: trimmedMessage,
      courseId,
      context,
    });
  }, [inputMessage, currentModule, courseId, chatMutation]);

  // Load recent queries on mount
  useEffect(() => {
    const saved = localStorage.getItem('medimind-recent-queries');
    if (saved) {
      try {
        setRecentQueries(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent queries:', e);
      }
    }
  }, []);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage, adjustTextareaHeight]);

  const copyMessageText = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log('Copied to clipboard');
    });
  }, []);

  const regenerateResponse = useCallback((originalMessage: string) => {
    const context = currentModule ? `Current module: ${currentModule.title} - ${currentModule.description}` : undefined;
    
    chatMutation.mutate({
      message: originalMessage + " (regenerate)",
      courseId,
      context,
    });
  }, [currentModule, courseId, chatMutation]);

  const exportChatHistory = useCallback(() => {
    if (!messages.length) return;
    
    const chatData = messages.map(msg => ({
      timestamp: msg.timestamp,
      user: msg.message,
      ai: msg.response
    }));
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medimind-chat-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [messages]);

  const filteredMessages = showSearch && searchQuery 
    ? messages.filter(msg => 
        msg.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.response.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

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
        ? 'h-96 chat-container border-t-0 rounded-t-2xl' 
        : 'w-96 h-full chat-container border-l-0 rounded-l-none rounded-r-2xl'
      } 
      flex flex-col slide-in-right overflow-hidden
    `}>
      {/* Enhanced Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-medical-blue to-healthcare-green text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-healthcare-green rounded-full border-2 border-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">MediMind AI Tutor</h3>
              <p className="text-white/80 text-sm font-medium">Diabetes Care Specialist</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 border border-white/20"
              title="Search Chat History"
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportChatHistory}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 border border-white/20"
              title="Export Chat History"
              disabled={!messages.length}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTTSEnabled(!isTTSEnabled)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 border border-white/20"
              title={isTTSEnabled ? "Disable Text-to-Speech" : "Enable Text-to-Speech"}
            >
              {isTTSEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
              >
                <ChevronDown className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-6 py-3 border-b border-white/20 bg-gradient-to-r from-medical-blue/10 to-healthcare-green/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-medical-blue transition-colors"
            />
          </div>
        </div>
      )}

      {/* Enhanced Chat Messages Area */}
      <div 
        ref={scrollContainerRef}
        className={`
          flex-1 overflow-y-auto px-6 py-4 space-y-6 bg-gradient-to-b from-white to-gray-50/30
          ${isMobile ? 'max-h-64' : 'min-h-0'}
          chat-scroll
        `}
        style={{ 
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}>
        {/* Enhanced Welcome Message */}
        <div className="flex items-start space-x-4 animate-fade-in">
          <div className="chat-avatar-bot">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="chat-message-bot">
              <div className="flex items-center space-x-2 mb-2">
                <BookOpen className="w-4 h-4 text-healthcare-green" />
                <span className="text-sm font-medium text-healthcare-green">Welcome Guide</span>
              </div>
              <p className="text-sm leading-relaxed">
                Hello! I'm your MediMind AI tutor, specializing in evidence-based diabetes care. 
                I can help with clinical guidelines, medication management, and patient care protocols 
                based on <strong>NICE guidelines</strong>, <strong>NHS best practices</strong>, and <strong>CQC requirements</strong>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-healthcare-green-light text-healthcare-green font-medium">
                  📋 Clinical Guidelines
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-medical-blue-light text-medical-blue font-medium">
                  💊 Medication Safety
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                  🎯 Best Practices
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 flex items-center space-x-1">
              <Bot className="w-3 h-3" />
              <span>AI Assistant • Always learning</span>
            </p>
          </div>
        </div>

        {/* Enhanced Chat Messages */}
        {filteredMessages.map((msg, index) => (
          <div key={msg.id} className="group message-entrance" style={{ animationDelay: `${index * 0.1}s` }}>
            {/* User Message */}
            <div className="flex items-end space-x-3 justify-end mb-6">
              <div className="flex-1">
                <div className="chat-message-user transition-all duration-300 hover:shadow-lg hover:scale-[1.02] relative group/user">
                  <p className="text-sm leading-relaxed select-text">{msg.message}</p>
                  <div className="absolute top-2 left-2 opacity-0 group-hover/user:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyMessageText(msg.message)}
                      className="w-6 h-6 p-0 bg-white/20 hover:bg-white/30 text-white/80 hover:text-white"
                      title="Copy message"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-right opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <span className="inline-flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>You</span>
                    <span>•</span>
                    <span>{formatTimestamp(msg.timestamp)}</span>
                  </span>
                </p>
              </div>
              <div className="chat-avatar-user">
                <span className="text-white text-xs font-semibold">You</span>
              </div>
            </div>

            {/* Enhanced AI Response */}
            <div className="flex items-start space-x-4 mb-6">
              <div className="chat-avatar-bot">
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="chat-message-bot transition-all duration-300 hover:shadow-lg hover:scale-[1.01] relative group/bot">
                  <MarkdownRenderer 
                    content={msg.response} 
                    className="text-sm leading-relaxed select-text prose prose-sm max-w-none prose-headings:text-gray-800 prose-strong:text-gray-900 prose-a:text-medical-blue hover:prose-a:text-medical-blue-dark prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded" 
                  />
                  
                  {/* Message Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover/bot:opacity-100 transition-opacity flex space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyMessageText(msg.response)}
                      className="w-6 h-6 p-0 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800"
                      title="Copy response"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => regenerateResponse(msg.message)}
                      className="w-6 h-6 p-0 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800"
                      title="Regenerate response"
                      disabled={chatMutation.isPending}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {/* Sources Display - Currently not available in schema, could be added later */}
                {/* Note: Sources would be displayed here when available from RAG response */}
                
                {/* Enhanced Follow-up Actions */}
                <div className="flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <button className="inline-flex items-center px-3 py-1.5 text-xs bg-medical-blue-light text-medical-blue rounded-full hover:bg-medical-blue hover:text-white transition-colors duration-200">
                    <BookOpen className="w-3 h-3 mr-1" />
                    View Guidelines
                  </button>
                  <button className="inline-flex items-center px-3 py-1.5 text-xs bg-healthcare-green-light text-healthcare-green rounded-full hover:bg-healthcare-green hover:text-white transition-colors duration-200">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Test Knowledge
                  </button>
                  <button className="inline-flex items-center px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-600 hover:text-white transition-colors duration-200">
                    <Heart className="w-3 h-3 mr-1" />
                    Related Topics
                  </button>
                </div>
                
                {/* Message Feedback */}
                <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <p className="text-xs text-gray-500">
                    <span className="inline-flex items-center space-x-1">
                      <Bot className="w-3 h-3" />
                      <span>MediMind AI</span>
                      <span>•</span>
                      <span>{formatTimestamp(msg.timestamp)}</span>
                      <span>•</span>
                      <span className="text-healthcare-green">Evidence-based</span>
                    </span>
                  </p>
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-6 h-6 p-0 text-gray-400 hover:text-green-600"
                      title="Helpful response"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-6 h-6 p-0 text-gray-400 hover:text-red-600"
                      title="Not helpful"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Enhanced Loading Message */}
        {chatMutation.isPending && (
          <div className="flex items-start space-x-4 message-entrance">
            <div className="chat-avatar-bot">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="chat-message-bot relative overflow-hidden typing-shimmer">
                <div className="flex items-center space-x-3">
                  <div className="chat-typing-indicator">
                    <div className="chat-typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="chat-typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="chat-typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm text-gray-600 font-medium">Analyzing your question...</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">🔍 Searching medical guidelines • 📚 Accessing knowledge base • 🩺 Applying clinical expertise</p>
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-medical-blue via-healthcare-green to-medical-blue" style={{ animation: 'gradientShift 2s ease-in-out infinite', backgroundSize: '200% 200%' }}></div>
              </div>
            </div>
          </div>
        )}

        {showSearch && searchQuery && filteredMessages.length === 0 && (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No messages found for "{searchQuery}"</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Input Area */}
      <div className="chat-input-container">
        {/* Quick Replies */}
        {inputMessage === '' && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-4 h-4 text-medical-blue" />
              <span className="text-sm font-medium text-gray-700">Quick Questions</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {quickReplies.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => setInputMessage(reply)}
                  className="text-xs bg-gray-100 hover:bg-medical-blue-light text-gray-700 hover:text-medical-blue px-3 py-1.5 rounded-full quick-reply-hover"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Recent Queries */}
        {recentQueries.length > 0 && inputMessage === '' && (
          <div className="px-4 pb-3">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-healthcare-green" />
              <span className="text-sm font-medium text-gray-700">Recent</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentQueries.slice(0, 3).map((query, index) => (
                <button
                  key={index}
                  onClick={() => setInputMessage(query)}
                  className="text-xs bg-healthcare-green-light hover:bg-healthcare-green text-healthcare-green hover:text-white px-3 py-1.5 rounded-full transition-colors duration-200 hover:scale-105 transform line-clamp-1 max-w-48"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:shadow-md focus-within:border-medical-blue transition-all duration-200">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    adjustTextareaHeight();
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask me anything about diabetes care..."
                  className="chat-input placeholder-gray-400"
                  disabled={chatMutation.isPending}
                  rows={1}
                  style={{ 
                    minHeight: '48px',
                    maxHeight: '120px',
                    resize: 'none'
                  }}
                />
                
                {/* Character count */}
                {inputMessage.length > 200 && (
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {inputMessage.length}/500
                  </div>
                )}
              </div>
            </div>
            
            {/* Enhanced Control Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={isListening ? stopListening : startListening}
                disabled={chatMutation.isPending}
                className={`chat-button ${isListening ? 'chat-button-voice listening' : 'chat-button-voice'}`}
                size="sm"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              
              <Button
                onClick={stopSpeaking}
                className={`chat-button transition-all duration-200 ${
                  synthesis?.speaking 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                }`}
                size="sm"
                title="Stop/Mute speech"
              >
                <VolumeX className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || chatMutation.isPending}
                className="chat-button chat-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex items-center justify-between mt-3 px-2">
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              {isListening && (
                <span className="flex items-center space-x-1 text-red-600 animate-pulse bg-red-50 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                  <Mic className="w-3 h-3" />
                  <span>Listening...</span>
                </span>
              )}
              {synthesis?.speaking && (
                <span className="flex items-center space-x-1 text-medical-blue animate-pulse bg-blue-50 px-2 py-1 rounded-full">
                  <Volume2 className="w-3 h-3" />
                  <span>Speaking...</span>
                </span>
              )}
              {chatMutation.isPending && (
                <span className="flex items-center space-x-1 text-healthcare-green animate-pulse bg-green-50 px-2 py-1 rounded-full">
                  <div className="flex space-x-0.5">
                    <div className="w-1 h-1 bg-healthcare-green rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-1 h-1 bg-healthcare-green rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-healthcare-green rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>Thinking...</span>
                </span>
              )}
              {!isListening && !synthesis?.speaking && !chatMutation.isPending && (
                <span className="flex items-center space-x-1">
                  <Bot className="w-3 h-3" />
                  <span>Evidence-based responses</span>
                </span>
              )}
            </div>
            
            <div className="flex flex-col items-end space-y-1">
              <div className="flex items-center space-x-1 text-xs text-gray-400">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd>
                <span>to send</span>
                <span className="text-gray-300">•</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Shift+Enter</kbd>
                <span>new line</span>
              </div>
              {filteredMessages.length > 0 && (
                <div className="text-xs text-gray-400">
                  {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}{showSearch && searchQuery ? ` (filtered)` : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
