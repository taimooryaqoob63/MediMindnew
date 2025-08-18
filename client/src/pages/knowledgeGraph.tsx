
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import KnowledgeGraphVisualization from '@/components/KnowledgeGraphVisualization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Network, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Entity {
  id: string;
  name: string;
  type: 'medication' | 'condition' | 'procedure' | 'guideline';
  description?: string;
  metadata?: any;
}

interface Relationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string;
  confidence?: number;
  source?: string;
}

export default function KnowledgeGraphPage() {
  const [buildType, setBuildType] = useState<'build' | 'rebuild'>('build');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: entitiesData, isLoading: entitiesLoading } = useQuery<{entities: Entity[], total: number, hasMore: boolean}>({
    queryKey: ['entities'],
    queryFn: async () => {
      const response = await fetch('/api/rag/entities?limit=100');
      if (!response.ok) throw new Error('Failed to fetch entities');
      return response.json();
    },
  });

  const { data: relationshipsData, isLoading: relationshipsLoading } = useQuery<{relationships: Relationship[], total: number, hasMore: boolean}>({
    queryKey: ['relationships'],
    queryFn: async () => {
      const response = await fetch('/api/rag/relationships?limit=200');
      if (!response.ok) throw new Error('Failed to fetch relationships');
      return response.json();
    },
  });

  const buildKnowledgeGraphMutation = useMutation({
    mutationFn: async (rebuild: boolean = false) => {
      const response = await fetch('/api/rag/build-knowledge-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebuild })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to build knowledge graph');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Knowledge Graph Built Successfully",
        description: `Created ${data.stats.relationshipsCreated} new relationships between ${data.stats.entitiesProcessed} entities.`,
      });
      // Invalidate and refetch the relationships and entities data
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Build Knowledge Graph",
        description: error.message,
      });
    }
  });

  const clearKnowledgeGraphMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/rag/clear-knowledge-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to clear knowledge graph');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Knowledge Graph Cleared",
        description: "All entities and relationships have been removed.",
      });
      // Invalidate and refetch the relationships and entities data
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Clear Knowledge Graph",
        description: error.message,
      });
    }
  });

  if (entitiesLoading || relationshipsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading knowledge graph...</div>
        </div>
      </div>
    );
  }

  // Extract entities and relationships from paginated data
  const entities = entitiesData?.entities || [];
  const relationships = relationshipsData?.relationships || [];

  // Transform data for visualization
  const nodes = entities.map(entity => ({
    id: entity.id,
    name: entity.name,
    type: entity.type
  }));

  const edges = relationships.map(rel => ({
    source: rel.fromEntityId,
    target: rel.toEntityId,
    relationship: rel.relationshipType,
    weight: (rel.confidence || 100) / 100
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Medical Knowledge Graph</h1>
          <p className="text-muted-foreground">
            Explore relationships between medical entities, procedures, and guidelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          {relationships.length === 0 && entities.length > 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">No connections found</span>
            </div>
          )}
          <Button 
            onClick={() => buildKnowledgeGraphMutation.mutate(false)}
            disabled={buildKnowledgeGraphMutation.isPending || entities.length === 0}
            variant="default"
            size="sm"
          >
            {buildKnowledgeGraphMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Network className="w-4 h-4 mr-2" />
            )}
            {relationships.length > 0 ? 'Add More Connections' : 'Build Connections'}
          </Button>
          {relationships.length > 0 && (
            <Button 
              onClick={() => buildKnowledgeGraphMutation.mutate(true)}
              disabled={buildKnowledgeGraphMutation.isPending}
              variant="outline"
              size="sm"
            >
              {buildKnowledgeGraphMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Rebuild All
            </Button>
          )}
          {(entities.length > 0 || relationships.length > 0) && (
            <Button 
              onClick={() => clearKnowledgeGraphMutation.mutate()}
              disabled={clearKnowledgeGraphMutation.isPending}
              variant="destructive"
              size="sm"
            >
              {clearKnowledgeGraphMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4 mr-2" />
              )}
              Clear Graph
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="graph" className="space-y-4">
        <TabsList>
          <TabsTrigger value="graph">Graph View</TabsTrigger>
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="graph" className="space-y-4">
          <KnowledgeGraphVisualization 
            nodes={nodes} 
            edges={edges}
            width={1000}
            height={600}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{entities.length || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Medications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {entities.filter(e => e.type === 'medication').length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {entities.filter(e => e.type === 'condition').length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Relationships</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{relationships.length || 0}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="entities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Medical Entities</CardTitle>
              <CardDescription>
                All extracted medical entities from your document library
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {entities.map(entity => (
                  <div key={entity.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          entity.type === 'medication' ? 'bg-blue-500' :
                          entity.type === 'condition' ? 'bg-red-500' :
                          entity.type === 'procedure' ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        <h3 className="font-semibold">{entity.name}</h3>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded capitalize">
                          {entity.type}
                        </span>
                      </div>
                      {entity.description && (
                        <p className="text-sm text-muted-foreground">{entity.description}</p>
                      )}
                    </div>
                  </div>
                ))}
                {entities.length === 0 && (
                  <p>No entities found. Upload and process documents to populate the knowledge graph.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Entity Relationships</CardTitle>
              <CardDescription>
                Connections between medical entities discovered from your documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {relationships.map(rel => {
                  const fromEntity = entities.find(e => e.id === rel.fromEntityId);
                  const toEntity = entities.find(e => e.id === rel.toEntityId);
                  
                  return (
                    <div key={rel.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{fromEntity?.name || 'Unknown'}</span>
                        <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {rel.relationshipType}
                        </span>
                        <span className="font-medium">{toEntity?.name || 'Unknown'}</span>
                      </div>
                      {rel.confidence && (
                        <span className="text-sm text-muted-foreground">
                          {rel.confidence}% confidence
                        </span>
                      )}
                    </div>
                  );
                })}
                {relationships.length === 0 && (
                  <p>No relationships found. Process more documents to discover entity connections.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
