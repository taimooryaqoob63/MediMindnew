import { DocumentUpload } from "@/components/DocumentUpload";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload, Brain, BookOpen } from "lucide-react";

export default function DocumentsPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-foreground">
                AI Knowledge Base
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your organization's documents to enhance the AI tutor with specialized knowledge 
              and evidence-based guidelines for diabetes care.
            </p>
          </div>

          {/* Benefits Section */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="text-center">
                <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle className="text-lg">Upload PDFs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  Upload NICE guidelines, NHS protocols, and organizational policies 
                  to create a comprehensive knowledge base.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <Brain className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle className="text-lg">Enhanced AI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  The AI tutor uses your documents to provide more accurate, 
                  organization-specific guidance and recommendations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <BookOpen className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle className="text-lg">Source Citations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  All AI responses include source citations, showing exactly 
                  which documents informed the guidance provided.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Document Upload Component */}
          <DocumentUpload 
            onDocumentProcessed={() => {
              // Could add notification or refresh logic here
            }}
          />

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold">1. Upload Documents</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload PDF documents containing diabetes care guidelines, protocols, 
                    and procedures. The system accepts files up to 10MB in size.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">2. Automatic Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    Documents are automatically processed, analyzed, and converted 
                    into searchable knowledge chunks using advanced AI techniques.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">3. Enhanced Responses</h4>
                  <p className="text-sm text-muted-foreground">
                    When you ask questions, the AI tutor searches your uploaded 
                    documents and incorporates relevant information into responses.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">4. Source References</h4>
                  <p className="text-sm text-muted-foreground">
                    Every response includes references to the specific documents 
                    and sections that informed the AI's guidance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}