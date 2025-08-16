
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

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
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
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
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [positionedNodes, setPositionedNodes] = useState<PositionedNode[]>([]);
  const animationRef = useRef<number>();

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'medication': return '#3b82f6';
      case 'condition': return '#ef4444';
      case 'procedure': return '#10b981';
      case 'guideline': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Force-directed layout simulation
  const simulateForces = useCallback((nodes: PositionedNode[]) => {
    const alpha = 0.3;
    const linkDistance = 100;
    const repulsionStrength = 300;
    const centerForce = 0.01;
    
    // Apply forces
    nodes.forEach(node => {
      if (!node.vx) node.vx = 0;
      if (!node.vy) node.vy = 0;
      
      // Center force
      const centerX = width / 2;
      const centerY = height / 2;
      node.vx += (centerX - node.x) * centerForce;
      node.vy += (centerY - node.y) * centerForce;
      
      // Repulsion force between nodes
      nodes.forEach(other => {
        if (node.id !== other.id) {
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 0) {
            const force = repulsionStrength / (distance * distance);
            node.vx! += (dx / distance) * force;
            node.vy! += (dy / distance) * force;
          }
        }
      });
    });
    
    // Link forces
    edges.forEach(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
          const force = (distance - linkDistance) * 0.1;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          source.vx! += fx;
          source.vy! += fy;
          target.vx! -= fx;
          target.vy! -= fy;
        }
      }
    });
    
    // Update positions
    nodes.forEach(node => {
      if (!node.fx && !node.fy) {
        node.vx! *= 0.85; // Damping
        node.vy! *= 0.85;
        node.x += node.vx! * alpha;
        node.y += node.vy! * alpha;
        
        // Keep nodes within bounds
        const padding = 50;
        node.x = Math.max(padding, Math.min(width - padding, node.x));
        node.y = Math.max(padding, Math.min(height - padding, node.y));
      }
    });
    
    return nodes;
  }, [width, height, edges]);

  // Initialize positions
  const initializePositions = useCallback(() => {
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Use a grid-based initial positioning for better distribution
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = Math.min(width, height) / (cols + 1);
    
    const initialNodes: PositionedNode[] = nodes.map((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = centerX - (cols - 1) * spacing / 2 + col * spacing + (Math.random() - 0.5) * 50;
      const y = centerY - (Math.floor(nodes.length / cols)) * spacing / 2 + row * spacing + (Math.random() - 0.5) * 50;
      
      return {
        ...node,
        x,
        y,
        vx: 0,
        vy: 0
      };
    });
    
    setPositionedNodes(initialNodes);
  }, [nodes, width, height]);

  // Animation loop
  const animate = useCallback(() => {
    setPositionedNodes(currentNodes => {
      const newNodes = [...currentNodes];
      return simulateForces(newNodes);
    });
    animationRef.current = requestAnimationFrame(animate);
  }, [simulateForces]);

  // Handle mouse events for dragging
  const handleMouseDown = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(nodeId);
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setPositionedNodes(nodes => 
          nodes.map(node => 
            node.id === nodeId 
              ? { ...node, x, y, fx: x, fy: y }
              : node
          )
        );
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(null);
      setPositionedNodes(nodes => 
        nodes.map(node => 
          node.id === nodeId 
            ? { ...node, fx: undefined, fy: undefined }
            : node
        )
      );
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Get node radius based on connections
  const getNodeRadius = (nodeId: string) => {
    const connections = edges.filter(e => e.source === nodeId || e.target === nodeId).length;
    const baseRadius = 8;
    return baseRadius + Math.min(connections * 2, 12); // Max radius of 20
  };

  // Initialize positions when nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      initializePositions();
    }
  }, [nodes, initializePositions]);

  // Start animation when positioned nodes are available
  useEffect(() => {
    if (positionedNodes.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [positionedNodes.length, animate]);

  // Render the SVG
  useEffect(() => {
    if (!svgRef.current || !positionedNodes.length) return;

    const svg = svgRef.current;
    svg.innerHTML = ''; // Clear previous content

    // Create groups for edges and nodes
    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgeGroup.setAttribute('class', 'edges');
    svg.appendChild(edgeGroup);

    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('class', 'nodes');
    svg.appendChild(nodeGroup);

    // Draw edges with better positioning
    edges.forEach((edge, edgeIndex) => {
      const sourceNode = positionedNodes.find(n => n.id === edge.source);
      const targetNode = positionedNodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', sourceNode.x.toString());
        line.setAttribute('y1', sourceNode.y.toString());
        line.setAttribute('x2', targetNode.x.toString());
        line.setAttribute('y2', targetNode.y.toString());
        line.setAttribute('stroke', selectedNode && (selectedNode === edge.source || selectedNode === edge.target) ? '#374151' : '#d1d5db');
        line.setAttribute('stroke-width', (edge.weight ? Math.max(edge.weight * 2, 1) : 1).toString());
        line.setAttribute('opacity', selectedNode && (selectedNode !== edge.source && selectedNode !== edge.target) ? '0.3' : '0.6');
        edgeGroup.appendChild(line);

        // Add edge label with better positioning to avoid overlaps
        if (selectedNode === edge.source || selectedNode === edge.target || !selectedNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          
          if (length > 50) { // Only show labels for longer edges
            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;
            
            // Offset label perpendicular to edge to reduce overlap
            const offsetDistance = 15;
            const offsetX = (-dy / length) * offsetDistance;
            const offsetY = (dx / length) * offsetDistance;
            
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', (midX + offsetX).toString());
            label.setAttribute('y', (midY + offsetY).toString());
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '9');
            label.setAttribute('fill', '#6b7280');
            label.setAttribute('opacity', '0.8');
            label.setAttribute('dominant-baseline', 'middle');
            
            // Add white background for better readability
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const textLength = edge.relationship.length * 5;
            rect.setAttribute('x', (midX + offsetX - textLength / 2).toString());
            rect.setAttribute('y', (midY + offsetY - 6).toString());
            rect.setAttribute('width', textLength.toString());
            rect.setAttribute('height', '12');
            rect.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
            rect.setAttribute('rx', '2');
            
            edgeGroup.appendChild(rect);
            
            label.textContent = edge.relationship.length > 12 ? edge.relationship.substring(0, 12) + '...' : edge.relationship;
            edgeGroup.appendChild(label);
          }
        }
      }
    });

    // Draw nodes with dynamic sizing
    positionedNodes.forEach(node => {
      const radius = getNodeRadius(node.id);
      const isSelected = selectedNode === node.id;
      const isHovered = hoveredNode === node.id;
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x.toString());
      circle.setAttribute('cy', node.y.toString());
      circle.setAttribute('r', (isSelected ? radius + 4 : isHovered ? radius + 2 : radius).toString());
      circle.setAttribute('fill', getNodeColor(node.type));
      circle.setAttribute('stroke', isSelected ? '#1f2937' : '#ffffff');
      circle.setAttribute('stroke-width', isSelected ? '3' : '2');
      circle.setAttribute('cursor', isDragging === node.id ? 'grabbing' : 'grab');
      circle.setAttribute('opacity', selectedNode && selectedNode !== node.id ? '0.5' : '1');
      
      // Add mouse events
      circle.addEventListener('click', () => {
        setSelectedNode(selectedNode === node.id ? null : node.id);
      });
      circle.addEventListener('mouseenter', () => {
        setHoveredNode(node.id);
      });
      circle.addEventListener('mouseleave', () => {
        setHoveredNode(null);
      });
      circle.addEventListener('mousedown', (e) => {
        handleMouseDown(node.id, e as any);
      });
      
      nodeGroup.appendChild(circle);

      // Add node label with better positioning
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const labelY = node.y + radius + 18;
      label.setAttribute('x', node.x.toString());
      label.setAttribute('y', labelY.toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('fill', '#1f2937');
      label.setAttribute('cursor', isDragging === node.id ? 'grabbing' : 'grab');
      label.setAttribute('opacity', selectedNode && selectedNode !== node.id ? '0.7' : '1');
      
      // Truncate long names more intelligently
      const maxLength = isSelected ? 20 : 12;
      const displayName = node.name.length > maxLength ? node.name.substring(0, maxLength) + '...' : node.name;
      
      // Add white background for labels
      const textLength = displayName.length * 6;
      const labelRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      labelRect.setAttribute('x', (node.x - textLength / 2).toString());
      labelRect.setAttribute('y', (labelY - 8).toString());
      labelRect.setAttribute('width', textLength.toString());
      labelRect.setAttribute('height', '14');
      labelRect.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
      labelRect.setAttribute('rx', '3');
      nodeGroup.appendChild(labelRect);
      
      label.textContent = displayName;
      
      // Add click and drag events to label too
      label.addEventListener('click', () => {
        setSelectedNode(selectedNode === node.id ? null : node.id);
      });
      label.addEventListener('mousedown', (e) => {
        handleMouseDown(node.id, e as any);
      });
      
      nodeGroup.appendChild(label);
    });

  }, [positionedNodes, selectedNode, hoveredNode, isDragging, getNodeRadius, handleMouseDown, edges]);

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
