
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import KnowledgeGraphVisualization from '@/components/KnowledgeGraphVisualization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const { data: entities, isLoading: entitiesLoading } = useQuery<Entity[]>({
    queryKey: ['entities'],
    queryFn: async () => {
      const response = await fetch('/api/rag/entities');
      if (!response.ok) throw new Error('Failed to fetch entities');
      return response.json();
    },
  });

  const { data: relationships, isLoading: relationshipsLoading } = useQuery<Relationship[]>({
    queryKey: ['relationships'],
    queryFn: async () => {
      const response = await fetch('/api/rag/relationships');
      if (!response.ok) throw new Error('Failed to fetch relationships');
      return response.json();
    },
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

  // Transform data for visualization
  const nodes = entities?.map(entity => ({
    id: entity.id,
    name: entity.name,
    type: entity.type
  })) || [];

  const edges = relationships?.map(rel => ({
    source: rel.fromEntityId,
    target: rel.toEntityId,
    relationship: rel.relationshipType,
    weight: (rel.confidence || 100) / 100
  })) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Medical Knowledge Graph</h1>
          <p className="text-muted-foreground">
            Explore relationships between medical entities, procedures, and guidelines
          </p>
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
                <div className="text-2xl font-bold">{entities?.length || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Medications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {entities?.filter(e => e.type === 'medication').length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {entities?.filter(e => e.type === 'condition').length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Relationships</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{relationships?.length || 0}</div>
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
                {entities?.map(entity => (
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
                )) || <p>No entities found. Upload and process documents to populate the knowledge graph.</p>}
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
                {relationships?.map(rel => {
                  const fromEntity = entities?.find(e => e.id === rel.fromEntityId);
                  const toEntity = entities?.find(e => e.id === rel.toEntityId);
                  
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
                }) || <p>No relationships found. Process more documents to discover entity connections.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
