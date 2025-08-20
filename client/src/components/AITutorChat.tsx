import { useState, useRef, useEffect } from "react";
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, ChevronDown, Stethoscope, Heart, BookOpen, AlertCircle, Maximize2, Minimize2, Trash2, FileText, Download, Sparkles, HighlighterIcon as Highlight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatAIResponse, cleanupResponse } from "@/lib/responseFormatter";
import type { ChatMessage, Module } from "@shared/schema";

interface AITutorChatProps {
  courseId: string;
  currentModule?: Module;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

interface ChatResponse {
  message?: ChatMessage;
  id?: string;
  response?: string;
  content?: string;
  sources?: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
    type: string;
  }>;
  confidence?: number;
  followUpQuestions?: string[];
  usedRAG?: boolean;
  timestamp?: Date;
}

export default function AITutorChat({ courseId, currentModule, isMobile, isOpen, onClose }: AITutorChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Enhanced UI state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [lastSessionBreak, setLastSessionBreak] = useState<Date>(new Date());

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

  // Enhanced functionality methods
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const clearChat = async () => {
    try {
      console.log("Clearing chat history and cache...");
      
      // Clear chat history and cache using the new API
      const response = await apiRequest("DELETE", "/api/cache/clear");
      
      if (response.ok) {
        const result = await response.json();
        console.log("Cache and chat history cleared successfully:", result);
        
        // Invalidate all chat queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
        setLastSessionBreak(new Date());
        
        // Show success message
        console.log(`Cleared ${result.cleared?.chatMessages || 0} chat messages and ${result.cleared?.expiredCache || 0} cache entries`);
      } else {
        throw new Error("Failed to clear cache");
      }
    } catch (error) {
      console.error("Failed to clear chat and cache:", error);
      
      // Fallback to old course-specific clearing
      try {
        console.log("Falling back to course-specific clearing for course:", courseId);
        await apiRequest("DELETE", `/api/chat/${courseId}`);
        queryClient.invalidateQueries({ queryKey: ["/api/chat", courseId] });
        setLastSessionBreak(new Date());
        console.log("Course-specific chat cleared successfully");
      } catch (fallbackError) {
        console.error("Fallback clearing also failed:", fallbackError);
      }
    }
  };

  const summarizeConversation = async () => {
    if (messages.length === 0) return;

    const conversationText = messages.map(msg => {
      // Format the AI response for summarization
      const cleanedResponse = cleanupResponse(msg.response);
      const formatted = formatAIResponse(cleanedResponse);
      return `User: ${msg.message}\nAI: ${formatted.content}`;
    }).join('\n\n');

    const summaryPrompt = `Please summarize this diabetes care learning conversation, highlighting key medical concepts, guidelines discussed, and main learning points. Format your response with clear sections including:\n\n## 📚 Key Concepts Discussed\n## 🎯 Main Learning Points\n## 💡 Important Guidelines\n## ➡️ Recommended Next Steps\n\nConversation to summarize:\n\n${conversationText}`;

    chatMutation.mutate({
      message: summaryPrompt,
      courseId,
      context: "Summary request - please provide a structured educational summary"
    });
  };

  const exportChat = () => {
    const chatContent = messages.map(msg => {
      const timestamp = formatTimestamp(msg.timestamp);
      // Format the AI response for export
      const cleanedResponse = cleanupResponse(msg.response);
      const formatted = formatAIResponse(cleanedResponse);
      return `[${timestamp}] You: ${msg.message}\n\n[${timestamp}] MediMind AI:\n${formatted.content}\n\n---\n\n`;
    }).join('');

    const fullContent = `MediMind AI - Diabetes Care Learning Session\nExported: ${new Date().toLocaleString()}\nCourse ID: ${courseId}\n\n${chatContent}`;

    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medimind-chat-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shouldShowSessionBreak = (currentIndex: number) => {
    if (currentIndex === 0) return false;
    const currentMessage = messages[currentIndex];
    const previousMessage = messages[currentIndex - 1];

    const timeDiff = new Date(currentMessage.timestamp).getTime() - new Date(previousMessage.timestamp).getTime();
    return timeDiff > 30 * 60 * 1000; // 30 minutes
  };

  return (
    <>
      {/* Fullscreen backdrop */}
      {isFullScreen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fade-in" />
      )}

      <div className={`
        ${isFullScreen 
          ? 'fixed inset-4 z-50 max-w-none max-h-none rounded-3xl shadow-2xl glass-morphism-strong' 
          : isMobile 
            ? 'h-96 border-t-0 rounded-t-2xl glass-morphism' 
            : 'w-96 h-full border-l-0 rounded-l-none rounded-r-2xl glass-morphism'
        } 
        flex flex-col slide-in-right overflow-hidden transition-all duration-500 ease-in-out glass-floating
      `}>
        {/* Enhanced Header with New Actions */}
        <div className="px-6 py-3 text-white flex-shrink-0 medical-header-gradient">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-teal-400 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base leading-tight">MediMind AI Tutor</h3>
              </div>
            </div>

            {/* Enhanced Action Buttons */}
            <div className="flex items-center space-x-2">
              {/* Learning Tools */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Summarize button clicked, messages:', messages.length);
                  summarizeConversation();
                }}
                disabled={false}
                className="glass-button p-2 text-white/90 hover:text-white rounded-xl transition-all duration-200 hover:scale-105"
                title="Summarize conversation"
              >
                <FileText className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Export button clicked, messages:', messages.length);
                  exportChat();
                }}
                disabled={false}
                className="glass-button p-2 text-white/90 hover:text-white rounded-xl transition-all duration-200 hover:scale-105"
                title="Export chat"
              >
                <Download className="w-4 h-4" />
              </Button>

              {/* Clear Chat */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Clear chat button clicked, messages:', messages.length);
                  clearChat();
                }}
                disabled={false}
                className="glass-button p-2 text-white/90 hover:text-white hover:bg-red-400/30 rounded-xl transition-all duration-200 hover:scale-105"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </Button>

              {/* Fullscreen Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Fullscreen toggle clicked, current state:', isFullScreen);
                  toggleFullScreen();
                }}
                className="glass-button p-2 text-white/90 hover:text-white rounded-xl transition-all duration-200 hover:scale-105"
                title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>



              {/* Close/Minimize */}
              {(isMobile || isFullScreen) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={isFullScreen ? toggleFullScreen : onClose}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
                >
                  <ChevronDown className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>

      {/* Enhanced Chat Messages Area */}
      <div 
        ref={scrollContainerRef}
        className={`
          flex-1 overflow-y-auto py-4 space-y-6 bg-gradient-to-b from-white to-gray-50/30
          ${isFullScreen ? 'px-4' : 'px-6'}
          ${isMobile ? 'max-h-64' : 'min-h-0'}
          chat-scroll
        `}
        style={{ 
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}>
        {/* Container for centered messages in full screen */}
        <div className={`${isFullScreen ? 'max-w-4xl mx-auto' : ''}`}>
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

        {/* Enhanced Chat Messages with Session Breaks */}
        {messages.map((msg, index) => (
          <div key={msg.id}>
            {/* Session Break */}
            {shouldShowSessionBreak(index) && (
              <div className="flex items-center my-6 session-break animate-fade-in">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                <div className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full text-xs text-gray-500 font-medium shadow-sm">
                  <span>{new Date(msg.timestamp).toLocaleDateString()} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </div>
            )}

            <div className="group animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              {/* User Message with Glassmorphism */}
              <div className="flex items-end space-x-3 justify-end mb-6">
                <div className="flex-1">
                  <div className={`${isFullScreen ? 'chat-message-user-glassmorphism-fullscreen ml-auto' : 'chat-message-user-glassmorphism ml-auto'} transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}>
                    <p className="text-sm leading-relaxed select-text font-medium">{msg.message}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-right opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <span className="inline-flex items-center space-x-1">
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

              {/* Enhanced AI Response with Glassmorphism */}
              <div className="flex items-start space-x-4 mb-6">
                <div className="chat-avatar-bot">
                  <Stethoscope className="w-4 h-4 text-white" />
                </div>
                <div className="space-y-3 flex-1">
                  <div className={`${isFullScreen ? 'chat-message-bot-glassmorphism-fullscreen' : 'chat-message-bot-glassmorphism'} transition-all duration-300 hover:shadow-lg hover:scale-[1.01] chat-response-formatted`}>
                    <MarkdownRenderer 
                      content={(() => {
                        // Clean and format the response for better presentation
                        const cleanedResponse = cleanupResponse(msg.response);
                        const formatted = formatAIResponse(cleanedResponse);
                        return formatted.content;
                      })()} 
                      className={`
                        text-sm leading-relaxed select-text prose prose-sm max-w-none 
                        prose-headings:text-gray-800 prose-headings:font-semibold
                        prose-strong:text-gray-900 prose-strong:font-bold
                        prose-a:text-medical-blue hover:prose-a:text-medical-blue-dark 
                        prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded
                        prose-p:mb-4 prose-p:leading-7
                        prose-ul:my-4 prose-li:my-1
                        ${highlightMode ? 'prose-strong:bg-yellow-200 prose-strong:px-1 prose-strong:rounded' : ''}
                      `}
                    />
                  </div>

                  <p className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <span className="inline-flex items-center space-x-1">
                      <Bot className="w-3 h-3" />
                      <span>MediMind AI</span>
                      <span>•</span>
                      <span>{formatTimestamp(msg.timestamp)}</span>
                      <span>•</span>
                      <span className="text-healthcare-green">Evidence-based</span>
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Enhanced Loading Message */}
        {chatMutation.isPending && (
          <div className="flex items-start space-x-4 animate-fade-in">
            <div className="chat-avatar-bot">
              <Stethoscope className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="chat-message-bot">
                <div className="flex items-center space-x-3">
                  <div className="chat-typing-indicator">
                    <div className="chat-typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="chat-typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="chat-typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm text-gray-600 font-medium">Analyzing your question...</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Consulting medical guidelines and evidence-based practices</p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div> {/* End centered messages container */}
      </div>

      {/* Enhanced Input Area with Glassmorphism */}
      <div className="glass-morphism-subtle">
        <div className={`${isFullScreen ? 'px-6 py-3' : 'px-4 py-2'}`}>
          <div className={`${isFullScreen ? 'max-w-4xl mx-auto' : ''}`}>
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <div className="relative glass-input rounded-2xl focus-within:shadow-lg focus-within:scale-[1.02] transition-all duration-300">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask me anything"
                  className="w-full px-4 py-3 bg-transparent border-0 focus:outline-none resize-none placeholder-gray-500 text-gray-800"
                  disabled={chatMutation.isPending}
                  rows={1}
                  style={{ 
                    minHeight: '48px',
                    resize: 'none'
                  }}
                />
              </div>
            </div>

            {/* Enhanced Control Buttons with Glassmorphism */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={isListening ? stopListening : startListening}
                disabled={chatMutation.isPending}
                className={`glass-button p-3 rounded-xl ${isListening ? 'glass-morphism-strong text-red-600' : 'text-medical-blue'}`}
                size="sm"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <Button
                onClick={stopSpeaking}
                className={`glass-button p-3 rounded-xl transition-all duration-300 ${
                  synthesis?.speaking 
                    ? 'text-red-600 glass-morphism-strong' 
                    : 'text-gray-600'
                }`}
                size="sm"
                title="Stop/Mute speech"
              >
                <VolumeX className="w-4 h-4" />
              </Button>

              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || chatMutation.isPending}
                className="glass-button p-3 text-medical-blue hover:text-white hover:bg-medical-blue disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-300"
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Enhanced Status Indicators with Glassmorphism */}
          <div className="flex items-center justify-between mt-2 px-2">
            <div className="flex items-center space-x-4 text-xs text-gray-600">
              {isListening && (
                <span className="flex items-center space-x-1 text-red-600 animate-pulse glass-morphism-subtle px-2 py-1 rounded-full">
                  <Mic className="w-3 h-3" />
                  <span>Listening...</span>
                </span>
              )}
              {synthesis?.speaking && (
                <span className="flex items-center space-x-1 text-medical-blue animate-pulse glass-morphism-subtle px-2 py-1 rounded-full">
                  <Volume2 className="w-3 h-3" />
                  <span>Speaking...</span>
                </span>
              )}
              <span className="flex items-center space-x-1 glass-morphism-subtle px-2 py-1 rounded-full">
                <Bot className="w-3 h-3" />
                <span>Evidence-based responses</span>
              </span>
            </div>

            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <kbd className="px-1.5 py-0.5 glass-morphism-subtle rounded text-xs">Enter</kbd>
              <span>to send</span>
            </div>
          </div>
          </div> {/* End centered input container */}
        </div>
      </div>
      </div>
    </>
  );
}