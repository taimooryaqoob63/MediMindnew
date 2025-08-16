
import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Node {
  id: string;
  name: string;
  type: 'medication' | 'condition' | 'procedure' | 'guideline';
  x?: number;
  y?: number;
}

interface Edge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
}

interface KnowledgeGraphProps {
  nodes: Node[];
  edges: Edge[];
  width?: number;
  height?: number;
}

export default function KnowledgeGraphVisualization({ 
  nodes, 
  edges, 
  width = 800, 
  height = 600 
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = svgRef.current;
    svg.innerHTML = ''; // Clear previous content

    // Simple force-directed layout simulation
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    // Position nodes in a circle initially
    const positionedNodes = nodes.map((node, index) => {
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
        line.setAttribute('x1', sourceNode.x!.toString());
        line.setAttribute('y1', sourceNode.y!.toString());
        line.setAttribute('x2', targetNode.x!.toString());
        line.setAttribute('y2', targetNode.y!.toString());
        line.setAttribute('stroke', '#e2e8f0');
        line.setAttribute('stroke-width', Math.min(edge.weight * 2, 4).toString());
        line.setAttribute('opacity', '0.6');
        edgeGroup.appendChild(line);

        // Add relationship label
        const midX = (sourceNode.x! + targetNode.x!) / 2;
        const midY = (sourceNode.y! + targetNode.y!) / 2;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX.toString());
        text.setAttribute('y', midY.toString());
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '10');
        text.setAttribute('fill', '#64748b');
        text.textContent = edge.relationship;
        edgeGroup.appendChild(text);
      }
    });

    // Draw nodes
    positionedNodes.forEach(node => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'node');
      group.setAttribute('transform', `translate(${node.x}, ${node.y})`);

      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '20');
      circle.setAttribute('fill', getNodeColor(node.type));
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('cursor', 'pointer');
      group.appendChild(circle);

      // Node label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '4');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', '#ffffff');
      text.textContent = node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name;
      group.appendChild(text);

      // Add hover title
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${node.name} (${node.type})`;
      group.appendChild(title);

      nodeGroup.appendChild(group);
    });

  }, [nodes, edges, width, height]);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'medication': return '#3b82f6'; // Blue
      case 'condition': return '#ef4444'; // Red
      case 'procedure': return '#10b981'; // Green
      case 'guideline': return '#f59e0b'; // Yellow
      default: return '#6b7280'; // Gray
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medical Knowledge Graph</CardTitle>
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
      </CardContent>
    </Card>
  );
}
