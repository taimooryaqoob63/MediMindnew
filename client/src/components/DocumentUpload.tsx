import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Check, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Document {
  id: string;
  originalName: string;
  fileSize: number;
  chunkCount: number;
  processed: boolean;
  uploadedAt: string;
}

interface DocumentUploadProps {
  onDocumentProcessed?: () => void;
}

export function DocumentUpload({ onDocumentProcessed }: DocumentUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's documents
  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("pdf", file);

      // Use XMLHttpRequest to track upload progress
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (error) {
              reject(new Error("Invalid response format"));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.message || "Upload failed"));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.open("POST", "/api/documents/upload");
        xhr.send(formData);
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Document uploaded successfully",
        description: `${data.document.originalName} has been processed into ${data.document.chunkCount} chunks.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setUploadProgress(0);
      setIsUploading(false);
      onDocumentProcessed?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
      setIsUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete document");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "The document and its associated data have been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Only PDF files are allowed.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File too large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    uploadMutation.mutate(file);
  }, [uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: isUploading,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Training Documents
          </CardTitle>
          <CardDescription>
            Upload PDF documents to enhance the AI tutor with your organization's specific guidelines and procedures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : isUploading
                ? "border-muted-foreground/25 bg-muted/25 cursor-not-allowed"
                : "border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2">
              <Upload className={`h-10 w-10 ${isUploading ? "text-muted-foreground" : "text-muted-foreground"}`} />
              {isUploading ? (
                <div className="space-y-2 w-full max-w-xs">
                  <p className="text-sm text-muted-foreground">Uploading and processing...</p>
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
                </div>
              ) : isDragActive ? (
                <p className="text-sm">Drop your PDF file here</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm">Drag and drop a PDF file here, or click to select</p>
                  <p className="text-xs text-muted-foreground">Maximum file size: 10MB</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uploaded Documents
          </CardTitle>
          <CardDescription>
            Manage your uploaded documents that enhance the AI tutor's knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingDocuments ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents uploaded yet</p>
              <p className="text-sm">Upload PDF documents to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0">
                      {doc.processed ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{doc.originalName}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>{doc.chunkCount} chunks</span>
                        <span>{formatDate(doc.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}