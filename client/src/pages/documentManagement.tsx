import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Database, FileText, Trash2, Clock, AlertCircle, CheckCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AppHeader from "@/components/AppHeader";
import type { Document, ProcessingJob, User } from "@shared/schema";

interface DocumentManagementProps {
  user: User | null;
}

interface VerificationData {
  totalDocuments: number;
  documentsWithChunks: number;
  completedJobs: ProcessingJob[];
  processingJobs: ProcessingJob[];
  failedJobs: ProcessingJob[];
  totalChunks: number;
  documentsByCategory: Record<string, number>;
}

export default function DocumentManagement({ user }: DocumentManagementProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("guideline");
  const [category, setCategory] = useState("diabetes");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ["/api/rag/documents"],
  });

  // Fetch processing jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<ProcessingJob[]>({
    queryKey: ["/api/rag/jobs"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch verification data
  const { data: verificationData, isLoading: verificationLoading } = useQuery<VerificationData>({
    queryKey: ["/api/rag/verification"],
  });

  // Initialize vector store mutation
  const initializeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rag/initialize");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Vector Store Initialized",
        description: "RAG system is ready for document processing.",
      });
    },
    onError: () => {
      toast({
        title: "Initialization Failed",
        description: "Failed to initialize vector store. Check API keys.",
        variant: "destructive",
      });
    }
  });

  // Reprocess documents mutation
  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rag/reprocess-documents");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rag/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/verification"] });
      toast({
        title: "Document Reprocessing Started",
        description: `Started reprocessing ${data.summary?.reprocessingStarted || 0} documents. Check processing jobs for progress.`,
      });
    },
    onError: () => {
      toast({
        title: "Reprocessing Failed",
        description: "Failed to start document reprocessing. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/rag/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rag/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/verification"] });
      setUploadFile(null);
      toast({
        title: "Document Uploaded",
        description: "Document processing has started.",
      });
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("DELETE", `/api/rag/documents/${documentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rag/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/verification"] });
      toast({
        title: "Document Deleted",
        description: "Document and its vectors have been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete document.",
        variant: "destructive",
      });
    }
  });

  // Clear all data mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rag/clear-all");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rag/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/verification"] });
      toast({
        title: "All Data Cleared",
        description: "All documents and vectors have been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Clear Failed",
        description: "Failed to clear all data.",
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUpload = () => {
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append("document", uploadFile);
    formData.append("documentType", documentType);
    formData.append("category", category);

    uploadMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Please log in to access document management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
          <p className="text-gray-600 mt-2">
            Upload and manage medical documents for the RAG system. Supports PDF, DOCX, HTML, and TXT files.
          </p>
        </div>

        {/* RAG System Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2" />
              RAG System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Initialize the vector store to enable document processing and intelligent responses.
                  </p>
                </div>
                <Button
                  onClick={() => initializeMutation.mutate()}
                  disabled={initializeMutation.isPending}
                  className="ml-4"
                >
                  {initializeMutation.isPending ? "Initializing..." : "Initialize Vector Store"}
                </Button>
              </div>

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Re-process existing documents to ensure they are properly indexed into Pinecone for search.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      This will check all uploaded documents and re-index any that are missing from the vector store.
                    </p>
                  </div>
                  <Button
                    onClick={() => reprocessMutation.mutate()}
                    disabled={reprocessMutation.isPending}
                    variant="outline"
                    className="ml-4"
                  >
                    {reprocessMutation.isPending ? "Reprocessing..." : "Reprocess Documents"}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">
                      🧹 Clear Cache Data
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Clear cached query responses and temporary data to free up space and ensure fresh responses.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      if (window.confirm('Clear all cached data? This will remove stored query responses.')) {
                        fetch('/api/rag/clear-cache', { method: 'POST' })
                          .then(res => res.json())
                          .then(data => alert(`Cache cleared: ${data.recordsDeleted} records removed`))
                          .catch(err => alert('Error clearing cache'));
                      }
                    }}
                    variant="outline"
                    className="ml-4"
                  >
                    Clear Cache
                  </Button>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">
                      🗑️ Clear All Data (Fresh Start)
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Removes all documents, chunks, vectors, and cached data. Use this to start completely fresh with new documents.
                    </p>
                    <p className="text-xs text-red-500 mt-1 font-medium">
                      ⚠️ This action cannot be undone. All uploaded documents and processed data will be permanently deleted.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear ALL data? This will delete all documents, processed chunks, vectors, and cached data. This action cannot be undone.')) {
                        clearAllMutation.mutate();
                      }
                    }}
                    disabled={clearAllMutation.isPending}
                    variant="destructive"
                    className="ml-4"
                  >
                    {clearAllMutation.isPending ? "Clearing All Data..." : "Clear All Data"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Verification Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Document Status Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verificationLoading ? (
              <p>Loading verification data...</p>
            ) : verificationData ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800">Total Documents</h3>
                  <p className="text-2xl font-bold text-blue-600">{verificationData.totalDocuments}</p>
                  <p className="text-sm text-blue-600">
                    {verificationData.documentsWithChunks} with processed chunks
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800">Processing Status</h3>
                  <p className="text-sm text-green-600">
                    ✅ Completed: {verificationData.completedJobs.length}
                  </p>
                  <p className="text-sm text-yellow-600">
                    ⏳ Processing: {verificationData.processingJobs.length}
                  </p>
                  <p className="text-sm text-red-600">
                    ❌ Failed: {verificationData.failedJobs.length}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-800">Total Chunks</h3>
                  <p className="text-2xl font-bold text-purple-600">{verificationData.totalChunks}</p>
                  <p className="text-sm text-purple-600">Available for search</p>
                </div>
              </div>
            ) : (
              <p>Failed to load verification data</p>
            )}

            {verificationData?.documentsByCategory && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Documents by Category:</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(verificationData.documentsByCategory).map(([category, count]) => (
                    <Badge key={category} variant="outline" className="px-3 py-1">
                      {category}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              Upload Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="document-type">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NICE">NICE Guidelines</SelectItem>
                    <SelectItem value="NHS">NHS Best Practices</SelectItem>
                    <SelectItem value="CQC">CQC Requirements</SelectItem>
                    <SelectItem value="Oxford_Handbook">Oxford Handbook</SelectItem>
                    <SelectItem value="guideline">General Guideline</SelectItem>
                    <SelectItem value="policy">Policy Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diabetes">Diabetes Care</SelectItem>
                    <SelectItem value="medication">Medication Management</SelectItem>
                    <SelectItem value="emergency">Emergency Procedures</SelectItem>
                    <SelectItem value="nutrition">Nutrition Guidelines</SelectItem>
                    <SelectItem value="monitoring">Health Monitoring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="file-upload">Select Document</Label>
              <p className="text-sm text-gray-600 mb-2">
                Supported formats: PDF, DOCX, HTML, TXT, and JSON files
              </p>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.html,.htm,.txt,.json"
                onChange={handleFileUpload}
                className="mt-1"
              />
              {uploadFile && (
                <p className="text-sm text-gray-500 mt-1">
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploadMutation.isPending}
              className="w-full"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload and Process Document"}
            </Button>
          </CardContent>
        </Card>

        {/* Processing Jobs */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Processing Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <p className="text-gray-500">Loading processing jobs...</p>
            ) : jobs.length === 0 ? (
              <p className="text-gray-500">No processing jobs found.</p>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(job.status)}
                        <span className="font-medium">{job.jobType}</span>
                      </div>
                      <Progress value={job.progress} className="mt-2 w-full max-w-xs" />
                      <p className="text-xs text-gray-500 mt-1">{job.progress}% complete</p>
                      {job.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">{job.errorMessage}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(job.createdAt!).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Uploaded Documents ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <p className="text-gray-500">Loading documents...</p>
            ) : documents.length === 0 ? (
              <p className="text-gray-500">No documents uploaded yet. Upload your first document above.</p>
            ) : (
              <div className="space-y-3">
                {documents.map((document) => (
                  <div key={document.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{document.title}</span>
                        <Badge variant="outline">{document.documentType}</Badge>
                        <Badge variant="outline">{document.category}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 truncate max-w-lg">
                        {document.content.substring(0, 100)}...
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Added: {new Date(document.createdAt!).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // View document details
                          toast({
                            title: "Document Details",
                            description: `${document.title} - ${document.category}`,
                          });
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(document.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}