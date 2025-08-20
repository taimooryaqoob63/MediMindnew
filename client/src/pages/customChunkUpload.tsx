
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CustomChunk {
  title: string;
  description: string;
  source: string;
  content: string;
  tags: string[];
}

export default function CustomChunkUpload() {
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentType, setDocumentType] = useState('guideline');
  const [category, setCategory] = useState('diabetes');
  const [source, setSource] = useState('');
  const [chunks, setChunks] = useState<CustomChunk[]>([]);
  const [currentChunk, setCurrentChunk] = useState<CustomChunk>({
    title: '',
    description: '',
    source: '',
    content: '',
    tags: []
  });
  const [currentTag, setCurrentTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const { toast } = useToast();

  const addTag = () => {
    if (currentTag.trim() && !currentChunk.tags.includes(currentTag.trim())) {
      setCurrentChunk(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCurrentChunk(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addChunk = () => {
    if (currentChunk.title && currentChunk.content) {
      setChunks(prev => [...prev, { ...currentChunk }]);
      setCurrentChunk({
        title: '',
        description: '',
        source: source,
        content: '',
        tags: []
      });
      toast({
        title: "Chunk Added",
        description: `Added "${currentChunk.title}" to the upload queue.`,
      });
    }
  };

  const removeChunk = (index: number) => {
    setChunks(prev => prev.filter((_, i) => i !== index));
  };

  const validateChunks = async () => {
    try {
      const response = await fetch('/api/custom-chunks/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chunks })
      });

      if (response.ok) {
        const results = await response.json();
        setValidationResults(results);
        
        if (results.summary.canUpload) {
          toast({
            title: "Validation Successful",
            description: `All ${results.summary.totalChunks} chunks are valid and ready for upload.`,
          });
        } else {
          toast({
            title: "Validation Issues",
            description: `${results.summary.invalidChunks} chunks have errors that need to be fixed.`,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Failed to validate chunks.",
        variant: "destructive"
      });
    }
  };

  const uploadChunks = async () => {
    if (!documentTitle || chunks.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please provide a document title and at least one chunk.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/custom-chunks/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documentTitle,
          documentType,
          category,
          source,
          chunks
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Upload Successful",
          description: `Uploaded ${result.successCount} chunks successfully.`,
        });
        
        // Reset form
        setDocumentTitle('');
        setSource('');
        setChunks([]);
        setValidationResults(null);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to upload chunks.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const parseFromText = () => {
    const sampleText = `Chunk 3: Causes of Type 2 Diabetes
•	Title: Causes of Type 2 Diabetes
•	Description: Explanation of the primary causes of type 2 diabetes, including insulin resistance and deficiency.
•	Source: Causes _ Background information _ Diabetes - type 2 _ CKS _ NICE.pdf
•	Content: "Type 2 diabetes is caused by a combination of insulin resistance/insensitivity (where the body is unable to respond to normal levels of insulin) and insulin deficiency (where the pancreas is unable to secrete enough insulin to compensate for this resistance) [Mayer-Davis, 2018 (/topics/diabetes-type-2/references/)] [Zeitler, 2018 (/topics/diabetes-type-2/references/)]."
•	Tags: Type 2 Diabetes, Causes, Insulin Resistance, Insulin Deficiency`;

    setCurrentChunk({
      title: 'Causes of Type 2 Diabetes',
      description: 'Explanation of the primary causes of type 2 diabetes, including insulin resistance and deficiency.',
      source: 'Causes _ Background information _ Diabetes - type 2 _ CKS _ NICE.pdf',
      content: 'Type 2 diabetes is caused by a combination of insulin resistance/insensitivity (where the body is unable to respond to normal levels of insulin) and insulin deficiency (where the pancreas is unable to secrete enough insulin to compensate for this resistance) [Mayer-Davis, 2018 (/topics/diabetes-type-2/references/)] [Zeitler, 2018 (/topics/diabetes-type-2/references/)].',
      tags: ['Type 2 Diabetes', 'Causes', 'Insulin Resistance', 'Insulin Deficiency']
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Chunk Upload</h1>
          <p className="text-muted-foreground">
            Upload pre-structured chunks with your own titles, descriptions, and tags
          </p>
        </div>
      </div>

      <Tabs defaultValue="document" className="space-y-6">
        <TabsList>
          <TabsTrigger value="document">Document Info</TabsTrigger>
          <TabsTrigger value="chunks">Add Chunks ({chunks.length})</TabsTrigger>
          <TabsTrigger value="review">Review & Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="document" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
              <CardDescription>
                Provide basic information about your document
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="documentTitle">Document Title</Label>
                  <Input
                    id="documentTitle"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="Enter document title"
                  />
                </div>
                <div>
                  <Label htmlFor="source">Source</Label>
                  <Input
                    id="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g., NICE Guidelines.pdf"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="documentType">Document Type</Label>
                  <select
                    id="documentType"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="guideline">Guideline</option>
                    <option value="faq">FAQ</option>
                    <option value="paper">Research Paper</option>
                    <option value="learning">Learning Material</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="diabetes">Diabetes</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="general">General</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chunks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Chunk</CardTitle>
              <CardDescription>
                Create structured chunks with proper metadata
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={parseFromText} variant="outline" size="sm">
                Load Example Chunk
              </Button>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="chunkTitle">Title</Label>
                  <Input
                    id="chunkTitle"
                    value={currentChunk.title}
                    onChange={(e) => setCurrentChunk(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Chunk title"
                  />
                </div>
                <div>
                  <Label htmlFor="chunkSource">Source</Label>
                  <Input
                    id="chunkSource"
                    value={currentChunk.source}
                    onChange={(e) => setCurrentChunk(prev => ({ ...prev, source: e.target.value }))}
                    placeholder="Source document/page"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="chunkDescription">Description</Label>
                <Textarea
                  id="chunkDescription"
                  value={currentChunk.description}
                  onChange={(e) => setCurrentChunk(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this chunk"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="chunkContent">Content</Label>
                <Textarea
                  id="chunkContent"
                  value={currentChunk.content}
                  onChange={(e) => setCurrentChunk(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="The actual content of this chunk"
                  rows={6}
                />
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    placeholder="Add a tag"
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button onClick={addTag} size="sm">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentChunk.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <Button onClick={addChunk} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Chunk to Queue
              </Button>
            </CardContent>
          </Card>

          {chunks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Queued Chunks ({chunks.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {chunks.map((chunk, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{chunk.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {chunk.content.substring(0, 100)}...
                        </div>
                        <div className="flex gap-1 mt-1">
                          {chunk.tags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                          {chunk.tags.length > 3 && <Badge variant="outline" className="text-xs">+{chunk.tags.length - 3}</Badge>}
                        </div>
                      </div>
                      <Button onClick={() => removeChunk(index)} variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review & Upload</CardTitle>
              <CardDescription>
                Validate and upload your custom chunks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded">
                <div className="text-center">
                  <div className="text-2xl font-bold">{chunks.length}</div>
                  <div className="text-sm text-muted-foreground">Total Chunks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {chunks.reduce((acc, chunk) => acc + chunk.content.split(/\s+/).length, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Words</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {Array.from(new Set(chunks.flatMap(chunk => chunk.tags))).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Unique Tags</div>
                </div>
              </div>

              {validationResults && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Validation: {validationResults.summary.validChunks} valid, {validationResults.summary.invalidChunks} invalid
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button onClick={validateChunks} variant="outline" disabled={chunks.length === 0}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Validate Chunks
                </Button>
                <Button 
                  onClick={uploadChunks} 
                  disabled={chunks.length === 0 || !documentTitle || isUploading}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload Custom Chunks'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
