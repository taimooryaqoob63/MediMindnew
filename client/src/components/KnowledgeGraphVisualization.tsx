import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

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


export default function KnowledgeGraphVisualization({
  nodes: initialNodes,
  edges: initialEdges,
  width = 800,
  height = 600
}: KnowledgeGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

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

  // Process data for visualization with circular layout
  const positionedNodes = useMemo<PositionedNode[]>(() => {
    if (initialNodes.length === 0) return [];

    // Count connections for each node
    const connectionCounts: { [key: string]: number } = {};
    initialEdges.forEach(edge => {
      connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
      connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
    });

    // Position nodes in a circle layout
    return initialNodes.map((node, index) => {
      const angle = (index / initialNodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;

      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        connections: connectionCounts[node.id] || 0,
      };
    });
  }, [initialNodes, initialEdges, width, height]);

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
  const connectedEdges = selectedNode ? initialEdges.filter(e => e.source === selectedNode || e.target === selectedNode) : [];

  // Assume isDarkMode is available from context or props
  const isDarkMode = true; // Replace with actual dark mode check if available

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medical Knowledge Graph</CardTitle>
        {selectedNodeData && (
          <div className="text-sm text-muted-foreground">
            Selected: <span className="font-semibold">{selectedNodeData.name}</span>
            <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs capitalize">
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
            {initialEdges.map((edge, index) => {
              const sourceNode = getNodePosition(edge.source);
              const targetNode = getNodePosition(edge.target);
              if (!sourceNode || !targetNode) return null;

              const isHighlighted = selectedNode === null || 
                selectedNode === edge.source || 
                selectedNode === edge.target;

              return (
                <line
                  key={index}
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
      </CardContent>
    </Card>
  );
}