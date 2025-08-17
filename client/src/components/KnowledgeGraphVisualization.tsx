import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Define interfaces for nodes and edges
interface Node {
  id: string;
  name: string;
  type: 'medication' | 'condition' | 'procedure' | 'guideline' | string;
  connections?: number;
}

interface Edge {
  source: string;
  target: string;
  relationship: string;
  weight?: number;
}

interface KnowledgeGraphProps {
  nodes: Node[];
  edges: Edge[];
  width?: number;
  height?: number;
}

interface PositionedNode extends Node {
  x: number;
  y: number;
  connections: number;
}

// Performance optimization: Limit rendering
const MAX_NODES = 50;
const MAX_EDGES = 100;

export default function KnowledgeGraphVisualization({
  nodes: initialNodes,
  edges: initialEdges,
  width = 800,
  height = 600
}: KnowledgeGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Color mapping for node types
  const getNodeColor = useCallback((type: string) => {
    switch (type.toLowerCase()) {
      case 'medication': return '#3b82f6'; // Blue
      case 'condition': return '#ef4444'; // Red
      case 'procedure': return '#10b981'; // Green
      case 'guideline': return '#f59e0b'; // Yellow/Orange
      case 'concept': return '#8b5cf6'; // Purple
      default: return '#6b7280'; // Gray for unknown types
    }
  }, []);

  // Filter nodes based on search term and limit for performance
  const filteredNodes = useMemo(() => {
    let filtered = initialNodes;
    
    if (searchTerm.trim()) {
      filtered = initialNodes.filter(node => 
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Limit nodes for performance - prioritize most connected nodes
    if (filtered.length > MAX_NODES) {
      // Count connections for sorting
      const connectionCounts: { [key: string]: number } = {};
      initialEdges.forEach(edge => {
        connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
        connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
      });
      
      filtered = filtered
        .sort((a, b) => (connectionCounts[b.id] || 0) - (connectionCounts[a.id] || 0))
        .slice(0, MAX_NODES);
    }
    
    return filtered;
  }, [initialNodes, initialEdges, searchTerm]);

  // Filter edges to only include those connected to visible nodes
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
    let filtered = initialEdges.filter(edge => 
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
    
    // Limit edges for performance
    if (filtered.length > MAX_EDGES) {
      filtered = filtered.slice(0, MAX_EDGES);
    }
    
    return filtered;
  }, [filteredNodes, initialEdges]);

  // Process data for visualization with circular layout
  const positionedNodes = useMemo<PositionedNode[]>(() => {
    if (filteredNodes.length === 0) return [];

    // Count connections for each node from filtered edges
    const connectionCounts: { [key: string]: number } = {};
    filteredEdges.forEach(edge => {
      connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
      connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
    });

    // Position nodes in a circle layout
    return filteredNodes.map((node, index) => {
      const angle = (index / filteredNodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;

      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        connections: connectionCounts[node.id] || 0,
      };
    });
  }, [filteredNodes, filteredEdges, width, height]);

  // Get node position by ID
  const getNodePosition = useCallback((nodeId: string) => {
    return positionedNodes.find(n => n.id === nodeId);
  }, [positionedNodes]);

  // Get node radius based on connections
  const getNodeRadius = useCallback((connections: number) => {
    const baseRadius = 8;
    return baseRadius + Math.min(connections * 2, 12);
  }, []);

  // Get data for the selected node
  const selectedNodeData = selectedNode ? positionedNodes.find(n => n.id === selectedNode) : null;
  const connectedEdges = selectedNode ? filteredEdges.filter(e => e.source === selectedNode || e.target === selectedNode) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Medical Knowledge Graph</span>
          <div className="text-sm text-muted-foreground">
            {filteredNodes.length} / {initialNodes.length} entities
            {filteredNodes.length !== initialNodes.length && " (limited for performance)"}
          </div>
        </CardTitle>
        
        {/* Search interface */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search entities by name or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {selectedNodeData && (
          <div className="text-sm text-muted-foreground">
            Selected: <span className="font-semibold">{selectedNodeData.name}</span>
            <span className="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs capitalize">
              {selectedNodeData.type}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto">
          <svg
            width={width}
            height={height}
            className="border rounded-lg bg-gray-50"
            onClick={() => setSelectedNode(null)}
          >
            {/* Render edges */}
            {filteredEdges.map((edge, index) => {
              const sourceNode = getNodePosition(edge.source);
              const targetNode = getNodePosition(edge.target);
              if (!sourceNode || !targetNode) return null;

              const isHighlighted = selectedNode === null || 
                selectedNode === edge.source || 
                selectedNode === edge.target;

              return (
                <line
                  key={`edge-${edge.source}-${edge.target}-${index}`}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke="#9ca3af"
                  strokeWidth={edge.weight ? Math.max(edge.weight * 2, 1) : 1}
                  opacity={isHighlighted ? 0.6 : 0.1}
                />
              );
            })}

            {/* Render nodes */}
            {positionedNodes.map((node) => {
              const isSelected = selectedNode === node.id;
              const isHovered = hoveredNode === node.id;
              const isHighlighted = selectedNode === null || 
                selectedNode === node.id || 
                connectedEdges.some(e => e.source === node.id || e.target === node.id);

              return (
                <g key={node.id}>
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={getNodeRadius(node.connections)}
                    fill={getNodeColor(node.type)}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? 3 : isHovered ? 2 : 0}
                    opacity={isHighlighted ? 1 : 0.2}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(selectedNode === node.id ? null : node.id);
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  />

                  {/* Node label */}
                  <g
                    opacity={isHighlighted ? 1 : 0.1}
                    style={{ pointerEvents: 'none' }}
                  >
                    <rect
                      x={node.x - (node.name.length * 3)}
                      y={node.y + getNodeRadius(node.connections) + 10}
                      width={node.name.length * 6}
                      height={14}
                      fill="rgba(255, 255, 255, 0.9)"
                      rx={3}
                    />
                    <text
                      x={node.x}
                      y={node.y + getNodeRadius(node.connections) + 21}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="bold"
                      fill="#1f2937"
                    >
                      {node.name.length > 12 ? node.name.substring(0, 12) + '...' : node.name}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span>Medications</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span>Conditions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>Procedures</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <span>Guidelines</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
            <span>Concepts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
            <span>Others</span>
          </div>
        </div>

        {/* Selected node info */}
        {selectedNodeData && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">{selectedNodeData.name}</h4>
            <p className="text-sm text-muted-foreground mb-2">Type: {selectedNodeData.type}</p>
            {connectedEdges.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Connected to:</p>
                <div className="space-y-1">
                  {connectedEdges.map((edge, index) => {
                    const otherNodeId = edge.source === selectedNode ? edge.target : edge.source;
                    const otherNode = positionedNodes.find(n => n.id === otherNodeId);
                    return (
                      <div key={index} className="text-sm text-muted-foreground flex items-center justify-between">
                        <span>{otherNode?.name} ({edge.relationship})</span>
                        <button
                          onClick={() => setSelectedNode(otherNodeId)}
                          className="text-blue-500 hover:underline text-xs ml-2"
                        >
                          View
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {initialNodes.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Network className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No entities found in your knowledge graph.</p>
              <p className="text-sm">Upload and process documents to populate the graph.</p>
            </div>
          </div>
        )}
        
        {initialNodes.length > 0 && filteredNodes.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No entities match your search criteria.</p>
              <p className="text-sm">Try a different search term or clear the search.</p>
            </div>
          </div>
        )}
        
        {filteredNodes.length > 0 && filteredNodes.length < initialNodes.length && (
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-700 dark:text-blue-300">
            <p>Showing {filteredNodes.length} of {initialNodes.length} entities for optimal performance.</p>
            {searchTerm.trim() === '' && (
              <p>Use search to find specific entities or increase limits if needed.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}