import MinimalistChatbox from "@/components/MinimalistChatbox";

export default function ChatDemo() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Minimalist Chatbox Demo
          </h1>
          <p className="text-gray-600">
            A clean, modern AI assistant chat interface
          </p>
        </div>
        
        <div className="h-[600px]">
          <MinimalistChatbox />
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Features: Clean design • Message bubbles • New chat option • Enter to send</p>
        </div>
      </div>
    </div>
  );
}