import { useState, useRef, useEffect } from "react";
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, ChevronDown, Stethoscope, Heart, BookOpen, AlertCircle } from "lucide-react";
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
      // Try RAG-enhanced chat first
      try {
        const ragResponse = await apiRequest("POST", "/api/rag/chat", {
          message: data.message,
          courseId: data.courseId
        });
        const result = await ragResponse.json();
        console.log('RAG response:', result); // Debug log
        return { ...result, usedRAG: true } as ChatResponse;
      } catch (ragError) {
        console.log('RAG chat failed, falling back to basic chat:', ragError);
        // Fallback to basic chat
        const response = await apiRequest("POST", "/api/chat", data);
        const result = await response.json();
        console.log('Basic chat response:', result); // Debug log
        return { ...result, usedRAG: false } as ChatResponse;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", courseId] });
      setInputMessage("");
      
      // Read the AI response aloud if TTS is enabled
      const responseText = data.response || data.content;
      if (isTTSEnabled && synthesis && responseText) {
        speakText(responseText);
      }
    },
    onError: (error) => {
      console.error('Chat mutation error:', error);
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
              onClick={() => setIsTTSEnabled(!isTTSEnabled)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
              title={isTTSEnabled ? "Disable Text-to-Speech" : "Enable Text-to-Speech"}
            >
              {isTTSEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={stopSpeaking}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
              title="Stop current speech"
              disabled={!currentUtterance && !synthesis?.speaking}
            >
              <VolumeX className="w-4 h-4" />
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
        {messages.map((msg, index) => (
          <div key={msg.id} className="group animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
            {/* User Message */}
            <div className="flex items-end space-x-3 justify-end mb-6">
              <div className="flex-1">
                <div className="chat-message-user transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                  <p className="text-sm leading-relaxed select-text">{msg.message}</p>
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

            {/* Enhanced AI Response */}
            <div className="flex items-start space-x-4 mb-6">
              <div className="chat-avatar-bot">
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="chat-message-bot transition-all duration-300 hover:shadow-lg hover:scale-[1.01]">
                  <MarkdownRenderer 
                    content={msg.response} 
                    className="text-sm leading-relaxed select-text prose prose-sm max-w-none prose-headings:text-gray-800 prose-strong:text-gray-900 prose-a:text-medical-blue hover:prose-a:text-medical-blue-dark prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded" 
                  />
                </div>
                
                {/* Follow-up Actions */}
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
      </div>

      {/* Enhanced Input Area */}
      <div className="chat-input-container">
        <div className="p-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:shadow-md focus-within:border-medical-blue transition-all duration-200">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask me anything about diabetes care..."
                  className="chat-input placeholder-gray-400"
                  disabled={chatMutation.isPending}
                  rows={1}
                  style={{ 
                    minHeight: '48px',
                    resize: 'none'
                  }}
                />
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
                <span className="flex items-center space-x-1 text-red-600 animate-pulse">
                  <Mic className="w-3 h-3" />
                  <span>Listening...</span>
                </span>
              )}
              {synthesis?.speaking && (
                <span className="flex items-center space-x-1 text-medical-blue animate-pulse">
                  <Volume2 className="w-3 h-3" />
                  <span>Speaking...</span>
                </span>
              )}
              <span className="flex items-center space-x-1">
                <Bot className="w-3 h-3" />
                <span>Evidence-based responses</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-1 text-xs text-gray-400">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd>
              <span>to send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
