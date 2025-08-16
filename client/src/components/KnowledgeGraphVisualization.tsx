
import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Node {
  id: string;
  name: string;
  type: 'medication' | 'condition' | 'procedure' | 'guideline';
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
}

export default function KnowledgeGraphVisualization({ 
  nodes, 
  edges, 
  width = 800, 
  height = 600 
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'medication': return '#3b82f6';
      case 'condition': return '#ef4444';
      case 'procedure': return '#10b981';
      case 'guideline': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = svgRef.current;
    svg.innerHTML = ''; // Clear previous content

    // Simple force-directed layout simulation
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    // Position nodes in a circle initially
    const positionedNodes: PositionedNode[] = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Create groups for edges and nodes
    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgeGroup.setAttribute('class', 'edges');
    svg.appendChild(edgeGroup);

    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('class', 'nodes');
    svg.appendChild(nodeGroup);

    // Draw edges
    edges.forEach(edge => {
      const sourceNode = positionedNodes.find(n => n.id === edge.source);
      const targetNode = positionedNodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', sourceNode.x.toString());
        line.setAttribute('y1', sourceNode.y.toString());
        line.setAttribute('x2', targetNode.x.toString());
        line.setAttribute('y2', targetNode.y.toString());
        line.setAttribute('stroke', '#d1d5db');
        line.setAttribute('stroke-width', (edge.weight ? edge.weight * 2 : 1).toString());
        line.setAttribute('opacity', '0.6');
        edgeGroup.appendChild(line);

        // Add edge label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        label.setAttribute('x', midX.toString());
        label.setAttribute('y', midY.toString());
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '10');
        label.setAttribute('fill', '#6b7280');
        label.setAttribute('opacity', '0.7');
        label.textContent = edge.relationship;
        edgeGroup.appendChild(label);
      }
    });

    // Draw nodes
    positionedNodes.forEach(node => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x.toString());
      circle.setAttribute('cy', node.y.toString());
      circle.setAttribute('r', selectedNode === node.id ? '12' : hoveredNode === node.id ? '10' : '8');
      circle.setAttribute('fill', getNodeColor(node.type));
      circle.setAttribute('stroke', selectedNode === node.id ? '#1f2937' : '#ffffff');
      circle.setAttribute('stroke-width', selectedNode === node.id ? '3' : '2');
      circle.setAttribute('cursor', 'pointer');
      circle.setAttribute('opacity', selectedNode && selectedNode !== node.id ? '0.5' : '1');
      
      // Add click and hover events
      circle.addEventListener('click', () => {
        setSelectedNode(selectedNode === node.id ? null : node.id);
      });
      circle.addEventListener('mouseenter', () => {
        setHoveredNode(node.id);
      });
      circle.addEventListener('mouseleave', () => {
        setHoveredNode(null);
      });
      
      nodeGroup.appendChild(circle);

      // Add node label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', node.x.toString());
      label.setAttribute('y', (node.y + 25).toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('fill', '#1f2937');
      label.setAttribute('cursor', 'pointer');
      label.textContent = node.name.length > 15 ? node.name.substring(0, 15) + '...' : node.name;
      
      // Add click event to label too
      label.addEventListener('click', () => {
        setSelectedNode(selectedNode === node.id ? null : node.id);
      });
      
      nodeGroup.appendChild(label);
    });

  }, [nodes, edges, width, height, selectedNode, hoveredNode]);

  const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode) : null;
  const connectedEdges = selectedNode ? edges.filter(e => e.source === selectedNode || e.target === selectedNode) : [];

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
            ref={svgRef}
            width={width}
            height={height}
            className="border rounded-lg bg-gray-50"
          />
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
                    const otherNode = nodes.find(n => n.id === otherNodeId);
                    return (
                      <div key={index} className="text-sm text-muted-foreground">
                        {otherNode?.name} ({edge.relationship})
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {nodes.length === 0 && (
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
