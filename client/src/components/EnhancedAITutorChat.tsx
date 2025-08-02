import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, BookOpen, FileText, ExternalLink } from "lucide-react";
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    <div className="flex flex-col h-full space-y-4">
      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Diabetes Care Tutor
            {selectedSources.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedSources.length} document sources
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-96 px-4">
            <div className="space-y-4 py-4">
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
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">You</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <div className="bg-primary/5 rounded-lg p-3">
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">AI Tutor</span>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <p className="text-sm whitespace-pre-wrap">{msg.response}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Document Sources Panel */}
      {selectedSources.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Document Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedSources.map((source, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{source.fileName}</span>
                    {source.pageNumber && (
                      <Badge variant="outline" className="text-xs">
                        Page {source.pageNumber}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(source.relevanceScore * 100)}% relevant
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {source.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Input Area */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about diabetes care, NICE guidelines, or care procedures..."
              disabled={sendMessage.isPending}
              className="flex-1"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || sendMessage.isPending}
              size="sm"
            >
              {sendMessage.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Suggested Questions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "What are the NICE guidelines for diabetes management?",
              "How should I handle hypoglycemia?",
              "What dietary advice should I provide?",
              "How often should blood glucose be monitored?"
            ].map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleSendMessage(question)}
                disabled={sendMessage.isPending}
                className="text-xs"
              >
                {question}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}