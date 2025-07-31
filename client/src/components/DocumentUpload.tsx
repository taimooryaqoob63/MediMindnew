
import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    const file = files[0];
    
    // Check file type
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, DOCX, or TXT files only.",
        variant: "destructive",
      });
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload files smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await apiRequest("POST", "/api/documents/upload", formData);
      
      if (response.ok) {
        const result = await response.json();
        setUploadedFiles(prev => [...prev, file.name]);
        
        toast({
          title: "Upload successful",
          description: `${file.name} has been processed and added to the knowledge base.`,
        });
        
        onUploadComplete?.();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const initializeVectorStore = async () => {
    setIsUploading(true);
    
    try {
      const response = await apiRequest("POST", "/api/documents/initialize", {});
      
      if (response.ok) {
        toast({
          title: "Knowledge base initialized",
          description: "The AI tutor is now ready with your documents.",
        });
      } else {
        throw new Error('Initialization failed');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      toast({
        title: "Initialization failed",
        description: "There was an error initializing the knowledge base.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-dark mb-2">Upload Guidelines</h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload NICE, NHS, or CQC guideline documents to enhance the AI tutor's knowledge.
        </p>
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragActive ? 'border-medical-blue bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt"
          onChange={handleChange}
          disabled={isUploading}
        />
        
        <div className="flex flex-col items-center space-y-2">
          {isUploading ? (
            <>
              <div className="w-8 h-8 border-2 border-medical-blue border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Processing document...</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-600">
                Drop your guideline document here or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Supports PDF, DOCX, TXT files (max 10MB)
              </p>
            </>
          )}
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-text-dark mb-2">Uploaded Documents:</h4>
          <div className="space-y-2">
            {uploadedFiles.map((filename, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-green-50 rounded border">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                <span className="text-sm text-gray-800 truncate">{filename}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Button
          onClick={initializeVectorStore}
          disabled={isUploading}
          className="w-full bg-medical-blue hover:bg-medical-blue/90"
        >
          {isUploading ? "Processing..." : "Initialize Knowledge Base"}
        </Button>
        
        <p className="text-xs text-gray-500 text-center">
          Click "Initialize Knowledge Base" after uploading all your documents
        </p>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-1">
              <li>• Upload your NICE, NHS, or CQC guideline documents</li>
              <li>• Documents are processed and added to the AI's knowledge base</li>
              <li>• The AI tutor will now reference these guidelines in responses</li>
              <li>• More accurate, guideline-specific answers for healthcare workers</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
