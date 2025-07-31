import { useState, useRef, useEffect } from "react";
import { Bot, Send, Shield, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage, Module } from "@shared/schema";

interface AITutorChatProps {
  courseId: string;
  currentModule?: Module;
}

interface ChatResponse {
  message: ChatMessage;
}

export default function AITutorChat({ courseId, currentModule }: AITutorChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  
  // TTS and STT state
  const [isListening, setIsListening] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  const scrollToBottom = () => {
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
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-medical-blue to-accent-purple rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-text-dark">AI Tutor</h3>
            <p className="text-sm text-gray-500">Ask me anything about diabetes care</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
        {messages.map((msg) => (
          <div key={msg.id}>
            {/* User Message */}
            <div className="flex items-start space-x-3 justify-end mb-4">
              <div className="flex-1">
                <div className="bg-medical-blue rounded-lg p-3 ml-8">
                  <p className="text-sm text-white">{msg.message}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {formatTimestamp(msg.timestamp)}
                </p>
              </div>
              <div className="w-8 h-8 bg-medical-blue rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">You</span>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-medical-blue to-accent-purple rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-sm text-text-dark whitespace-pre-wrap">{msg.response}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatTimestamp(msg.timestamp)}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Loading Message */}
        {chatMutation.isPending && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-medical-blue to-accent-purple rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2 mb-2">
          <Input
            type="text"
            placeholder={isListening ? "Listening..." : "Ask about diabetes care guidelines..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 text-sm"
            disabled={chatMutation.isPending || isListening}
          />
          
          {/* Microphone Button */}
          <Button
            onClick={isListening ? stopListening : startListening}
            disabled={chatMutation.isPending || !recognition}
            variant={isListening ? "default" : "outline"}
            size="sm"
            className={isListening ? "bg-red-500 hover:bg-red-600 text-white" : ""}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          {/* Send Button */}
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || chatMutation.isPending}
            className="bg-medical-blue hover:bg-medical-blue/90"
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {/* TTS Controls and Info */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 flex items-center">
            <Shield className="w-3 h-3 medical-blue mr-1" />
            Responses based on NICE, NHS & CQC guidelines
          </p>
          
          <div className="flex items-center space-x-2">
            {/* TTS Toggle */}
            <Button
              onClick={toggleTTS}
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              title={isTTSEnabled ? "Disable text-to-speech" : "Enable text-to-speech"}
            >
              {isTTSEnabled ? (
                <Volume2 className="w-3 h-3 text-green-600" />
              ) : (
                <VolumeX className="w-3 h-3 text-gray-400" />
              )}
            </Button>
            
            {/* Stop Speaking Button */}
            {currentUtterance && synthesis && !synthesis.paused && (
              <Button
                onClick={stopSpeaking}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-red-500"
                title="Stop speaking"
              >
                Stop
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
