
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Plus, Search, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StructuredChunk {
  title: string;
  description: string;
  content: string;
  source: string;
  tags: string[];
}

interface SearchResult {
  id: string;
  score: number;
  metadata: {
    title: string;
    description: string;
    source: string;
    tags: string[];
    chunk_id: string;
  };
}

export default function CustomChunkUpload() {
  const { toast } = useToast();
  const [chunks, setChunks] = useState<StructuredChunk[]>([{
    title: '',
    description: '',
    content: '',
    source: '',
    tags: []
  }]);
  
  const [newTag, setNewTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchNamespace, setSearchNamespace] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const addChunk = () => {
    setChunks([...chunks, {
      title: '',
      description: '',
      content: '',
      source: '',
      tags: []
    }]);
  };

  const removeChunk = (index: number) => {
    setChunks(chunks.filter((_, i) => i !== index));
  };

  const updateChunk = (index: number, field: keyof StructuredChunk, value: string | string[]) => {
    const updatedChunks = [...chunks];
    updatedChunks[index] = { ...updatedChunks[index], [field]: value };
    setChunks(updatedChunks);
  };

  const addTag = (chunkIndex: number, tag: string) => {
    if (tag.trim() && !chunks[chunkIndex].tags.includes(tag.trim())) {
      const updatedChunks = [...chunks];
      updatedChunks[chunkIndex].tags.push(tag.trim());
      setChunks(updatedChunks);
    }
  };

  const removeTag = (chunkIndex: number, tagIndex: number) => {
    const updatedChunks = [...chunks];
    updatedChunks[chunkIndex].tags.splice(tagIndex, 1);
    setChunks(updatedChunks);
  };

  const embedChunks = async () => {
    // Validate chunks
    const invalidChunks = chunks.filter(chunk => 
      !chunk.title.trim() || !chunk.description.trim() || !chunk.content.trim() || !chunk.source.trim()
    );

    if (invalidChunks.length > 0) {
      toast({
        title: "Validation Error",
        description: "All chunks must have title, description, content, and source filled out.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/custom-chunks/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chunks }),
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Embedding Successful",
          description: `${result.processedChunks}/${result.totalChunks} chunks embedded successfully using text-embedding-3-large.`
        });

        if (result.errors && result.errors.length > 0) {
          console.warn('Some chunks had errors:', result.errors);
        }
      } else {
        throw new Error(result.message || 'Failed to embed chunks');
      }

    } catch (error) {
      console.error('Embedding error:', error);
      toast({
        title: "Embedding Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const searchChunks = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Error",
        description: "Please enter a search query.",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/custom-chunks/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          namespace: searchNamespace || undefined,
          topK: 5
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSearchResults(result.results);
        toast({
          title: "Search Complete",
          description: `Found ${result.results.length} matching chunks.`
        });
      } else {
        throw new Error(result.message || 'Search failed');
      }

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Chunk Embedding</h1>
          <p className="text-muted-foreground">
            Embed structured chunks using text-embedding-3-large and store them in Pinecone
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Structured Chunks
          </CardTitle>
          <CardDescription>
            Create and embed chunks with title, description, content, source, and tags.
            Each chunk will be embedded using text-embedding-3-large.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {chunks.map((chunk, index) => (
            <Card key={index} className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Chunk {index + 1}</CardTitle>
                  {chunks.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeChunk(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Title *</label>
                    <Input
                      value={chunk.title}
                      onChange={(e) => updateChunk(index, 'title', e.target.value)}
                      placeholder="Chunk title"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Source *</label>
                    <Input
                      value={chunk.source}
                      onChange={(e) => updateChunk(index, 'source', e.target.value)}
                      placeholder="Document source (e.g., NICE Guidelines)"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Description *</label>
                  <Textarea
                    value={chunk.description}
                    onChange={(e) => updateChunk(index, 'description', e.target.value)}
                    placeholder="Brief description of the chunk content"
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Content *</label>
                  <Textarea
                    value={chunk.content}
                    onChange={(e) => updateChunk(index, 'content', e.target.value)}
                    placeholder="Main chunk content"
                    rows={4}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add a tag"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addTag(index, newTag);
                          setNewTag('');
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        addTag(index, newTag);
                        setNewTag('');
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {chunk.tags.map((tag, tagIndex) => (
                      <Badge
                        key={tagIndex}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeTag(index, tagIndex)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={addChunk}>
              <Plus className="w-4 h-4 mr-2" />
              Add Another Chunk
            </Button>
            <Button 
              onClick={embedChunks}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? 'Embedding...' : `Embed ${chunks.length} Chunk${chunks.length !== 1 ? 's' : ''} with text-embedding-3-large`}
            </Button>
          </div>
          
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                Embedding chunks using text-embedding-3-large... {uploadProgress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Embedded Chunks
          </CardTitle>
          <CardDescription>
            Test your embedded chunks by searching through them
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter search query"
              className="flex-1"
            />
            <Input
              value={searchNamespace}
              onChange={(e) => setSearchNamespace(e.target.value)}
              placeholder="Namespace (optional)"
              className="w-48"
            />
            <Button onClick={searchChunks} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Search Results ({searchResults.length})</h3>
              {searchResults.map((result, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{result.metadata.title}</h4>
                      <Badge variant="outline">
                        Score: {(result.score * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {result.metadata.description}
                    </p>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="secondary">{result.metadata.source}</Badge>
                      {result.metadata.tags.map((tag, tagIndex) => (
                        <Badge key={tagIndex} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
