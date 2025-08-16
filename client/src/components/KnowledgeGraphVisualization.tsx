import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';
import * as d3 from 'd3'; // Import D3 for force-directed layout

// Define interfaces for nodes and edges
interface Node {
  id: string;
  name: string;
  type: 'medication' | 'condition' | 'procedure' | 'guideline' | string; // Allow string for flexibility
  x: number;
  y: number;
  vx?: number; // Velocity x
  vy?: number; // Velocity y
  fx?: number; // Fixed x position
  fy?: number; // Fixed y position
  connections: number; // Number of connections for styling/layout
}

interface Edge {
  source: string;
  target: string;
  relationship: string; // Renamed from 'type' to 'relationship' for clarity
  weight?: number; // Optional weight for edge styling
  strength?: number; // For D3 link force
}

interface KnowledgeGraphProps {
  nodes: Node[];
  edges: Edge[];
  width?: number;
  height?: number;
}

// Extend Node interface for internal use in simulation
interface PositionedNode extends Node {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

// Define a type for D3 links, aligning with D3's expectation
interface Link extends d3.SimulationLinkDatum<PositionedNode> {
  source: string;
  target: string;
  type: string;
  strength?: number;
}


export default function KnowledgeGraphVisualization({
  nodes: initialNodes, // Rename prop to avoid conflict with internal nodes
  edges: initialEdges,
  width = 800,
  height = 600
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [positionedNodes, setPositionedNodes] = useState<PositionedNode[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: PositionedNode[], links: Link[] }>({ nodes: [], links: [] });
  const simulationRef = useRef<d3.Simulation<PositionedNode, Link> | null>(null);

  // Color mapping for node types
  const getNodeColor = useCallback((type: string) => {
    switch (type.toLowerCase()) { // Convert to lowercase for case-insensitive matching
      case 'medication': return '#3b82f6'; // Blue
      case 'condition': return '#ef4444'; // Red
      case 'procedure': return '#10b981'; // Green
      case 'guideline': return '#f59e0b'; // Yellow/Orange
      case 'concept': return '#8b5cf6'; // Purple
      default: return '#6b7280'; // Gray for unknown types
    }
  }, []);

  // Process data for visualization with better layout
  const processGraphData = useCallback((entities: Node[], relationships: Edge[]) => {
    const nodes: PositionedNode[] = entities.map((entity, index) => {
      // Use force-directed positioning instead of simple circle
      const angle = (index / entities.length) * 2 * Math.PI;
      const radius = Math.min(150 + (index % 3) * 50, 300); // Vary radius

      return {
        ...entity,
        id: entity.id,
        name: entity.name || 'Unknown', // Ensure name is always present
        type: entity.type || 'concept', // Ensure type is always present
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 100, // Add some randomness
        y: Math.sin(angle) * radius + (Math.random() - 0.5) * 100,
        connections: 0,
        vx: 0,
        vy: 0,
        fx: undefined,
        fy: undefined
      };
    });

    // Create synthetic relationships if none exist to prevent overcrowding
    let links: Link[] = relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      relationship: rel.relationship || 'related', // Use relationship property
      strength: rel.weight || 0.5, // Use weight as strength
      index: undefined // D3 requires index for link data
    }));

    // If no relationships exist, create some based on entity types
    if (links.length === 0 && nodes.length > 1) {
      // Create connections between similar types
      const typeGroups: { [key: string]: PositionedNode[] } = {};
      nodes.forEach(node => {
        if (!typeGroups[node.type]) typeGroups[node.type] = [];
        typeGroups[node.type].push(node);
      });

      // Connect nodes of the same type
      Object.values(typeGroups).forEach(group => {
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < Math.min(i + 3, group.length); j++) { // Limit connections per node
            links.push({
              source: group[i].id,
              target: group[j].id,
              relationship: 'similarity',
              strength: 0.5,
              index: undefined
            });
          }
        }
      });

      // Add some cross-type connections for variety
      for (let i = 0; i < Math.min(nodes.length * 0.3, 10); i++) {
        const node1 = nodes[Math.floor(Math.random() * nodes.length)];
        const node2 = nodes[Math.floor(Math.random() * nodes.length)];
        if (node1.id !== node2.id && !links.find(l =>
          (l.source === node1.id && l.target === node2.id) ||
          (l.source === node2.id && l.target === node1.id)
        )) {
          links.push({
            source: node1.id,
            target: node2.id,
            relationship: 'association',
            strength: 0.3,
            index: undefined
          });
        }
      }
    }

    // Count connections for each node
    links.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);
      if (sourceNode) sourceNode.connections++;
      if (targetNode) targetNode.connections++;
    });

    return { nodes, links };
  }, []);

  // Initialize graph data and simulation
  useEffect(() => {
    const processedData = processGraphData(initialNodes, initialEdges);
    setGraphData(processedData);
    setPositionedNodes(processedData.nodes); // Initialize positioned nodes
  }, [initialNodes, initialEdges, processGraphData]);

  // Set up and manage the D3 force simulation
  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) return;

    const svg = d3.select(svgRef.current);

    // Clear previous simulation if it exists
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Set up force simulation with better parameters
    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.links)
        .id((d: any) => d.id)
        .distance(d => 60 + (d as any).strength * 40) // Variable distance based on strength
        .strength(0.8))
      .force('charge', d3.forceManyBody()
        .strength(d => -200 - (d as any).connections * 10)) // Stronger repulsion for highly connected nodes
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.1))
      .force('collision', d3.forceCollide().radius(d => 15 + Math.sqrt((d as any).connections) * 3))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    simulationRef.current = simulation;

    const ticked = () => {
      setPositionedNodes(nodes =>
        nodes.map(node => {
          const simNode = simulation.find(node.x, node.y); // Find node in simulation
          return {
            ...node,
            x: simNode.x,
            y: simNode.y,
            vx: simNode.vx,
            vy: simNode.vy,
            fx: simNode.fx,
            fy: simNode.fy,
          };
        })
      );

      // Update SVG elements directly in the tick function for performance
      svg.selectAll('line')
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      svg.selectAll('.node-group')
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

      svg.selectAll('.node-label-group')
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    };

    simulation.on('tick', ticked);

    // Initial positioning before simulation starts
    simulation.nodes().forEach(node => {
      node.x = node.fx || node.x;
      node.y = node.fy || node.y;
    });
    ticked(); // Call ticked once to set initial positions


    // Cleanup simulation on component unmount
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [graphData.nodes, graphData.links, width, height, isDragging]); // Re-run if graph data or dimensions change

  // Handle node dragging
  const handleMouseDown = useCallback((event: React.MouseEvent, node: PositionedNode) => {
    event.preventDefault();
    setIsDragging(node.id);

    const svgInstance = svgRef.current;
    const svgClientRect = svgInstance?.getBoundingClientRect();

    const handleMouseMove = (e: MouseEvent) => {
      if (!svgClientRect) return;
      const x = e.clientX - svgClientRect.left;
      const y = e.clientY - svgClientRect.top;

      setPositionedNodes(currentNodes =>
        currentNodes.map(n =>
          n.id === node.id
            ? { ...n, x, y, fx: x, fy: y } // Fix node position while dragging
            : n
        )
      );

      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart(); // Reheat simulation slightly
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      // Release fixed position
      setPositionedNodes(currentNodes =>
        currentNodes.map(n =>
          n.id === node.id
            ? { ...n, fx: undefined, fy: undefined }
            : n
        )
      );
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0); // Stop reheating
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Get node radius based on connections
  const getNodeRadius = useCallback((node: PositionedNode) => {
    const baseRadius = 8;
    return baseRadius + Math.min(node.connections * 2, 12); // Max radius of 20
  }, []);

  // Render the SVG elements
  useEffect(() => {
    if (!svgRef.current || !positionedNodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous elements

    // Create groups for edges and nodes
    const edgeGroup = svg.append('g').attr('class', 'edges');
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    // Draw edges
    const linkElements = edgeGroup.selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('stroke', '#9ca3af') // Default gray stroke
      .attr('stroke-width', d => d.weight ? Math.max(d.weight * 2, 1) : 1)
      .attr('opacity', 0.6);

    // Draw nodes with labels
    const nodeElements = nodeGroup.selectAll('.node-group')
      .data(positionedNodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .on('click', (event, d) => {
        event.stopPropagation(); // Prevent click from propagating to SVG
        setSelectedNode(selectedNode === d.id ? null : d.id);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNode(d.id);
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
      })
      .on('mousedown', handleMouseDown); // Attach mousedown handler for dragging

    nodeElements.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d.type))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', d => (selectedNode === d.id ? 3 : (hoveredNode === d.id ? 2 : 0))) // Highlight stroke
      .attr('cursor', d => (isDragging === d.id ? 'grabbing' : 'grab'));

    // Add node labels
    const labelElements = nodeGroup.selectAll('.node-label-group')
      .data(positionedNodes)
      .enter()
      .append('g')
      .attr('class', 'node-label-group')
      .attr('transform', d => `translate(${d.x},${d.y + getNodeRadius(d) + 18})`) // Position label below node
      .style('pointer-events', 'none'); // Labels shouldn't capture events

    labelElements.append('rect')
      .attr('x', d => {
        const textLength = (d.name.length > (selectedNode === d.id ? 20 : 12) ? (selectedNode === d.id ? 20 : 12) : d.name.length) * 6;
        return -textLength / 2;
      })
      .attr('y', -8)
      .attr('width', d => {
        const maxLength = selectedNode === d.id ? 20 : 12;
        const displayName = d.name.length > maxLength ? d.name.substring(0, maxLength) : d.name;
        return displayName.length * 6;
      })
      .attr('height', 14)
      .attr('fill', 'rgba(255, 255, 255, 0.9)')
      .attr('rx', 3);

    labelElements.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11')
      .attr('font-weight', 'bold')
      .attr('fill', '#1f2937')
      .text(d => {
        const maxLength = selectedNode === d.id ? 20 : 12;
        return d.name.length > maxLength ? d.name.substring(0, maxLength) + '...' : d.name;
      });

    // Update SVG elements based on simulation ticks
    simulationRef.current?.on('tick', () => {
      linkElements
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeElements
        .attr('transform', d => `translate(${d.x},${d.y})`);

      labelElements
        .attr('transform', d => `translate(${d.x},${d.y + getNodeRadius(d) + 18})`);
    });

    // Update positions of positionedNodes state when simulation ticks
    // This is necessary to reflect changes in state for re-renders,
    // but direct DOM manipulation in tick is for immediate visual update.
    const updateStateFromSimulation = () => {
        if (simulationRef.current) {
            const nodes = simulationRef.current.nodes();
            setPositionedNodes(nodes);
        }
    };
    simulationRef.current?.on('tick', () => {
        updateStateFromSimulation(); // Update state periodically
        linkElements
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        nodeElements
          .attr('transform', d => `translate(${d.x},${d.y})`);

        labelElements
          .attr('transform', d => `translate(${d.x},${d.y + getNodeRadius(d) + 18})`);
    });


  }, [positionedNodes, selectedNode, hoveredNode, isDragging, getNodeRadius, handleMouseDown, graphData.links, graphData.nodes]);

  // Effect to handle filtering of edges and node visibility based on selection
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // Adjust edge opacity and visibility
    svg.selectAll('line')
      .attr('opacity', d => {
        if (selectedNode === null) return 0.6; // All visible if nothing selected
        if (d.source.id === selectedNode || d.target.id === selectedNode) return 0.8; // Highlight connected edges
        return 0.1; // Dim others
      });

    // Adjust node opacity
    svg.selectAll('.node-group')
      .style('opacity', d => {
        if (selectedNode === null) return 1;
        if (d.id === selectedNode) return 1;
        // Check if the node is connected to the selected node
        const isConnected = graphData.links.some(link =>
          (link.source.id === selectedNode && link.target.id === d.id) ||
          (link.source.id === d.id && link.target.id === selectedNode)
        );
        if (isConnected) return 0.7;
        return 0.2; // Dim nodes not connected to selected node
      });

    // Adjust label opacity
    svg.selectAll('.node-label-group')
      .style('opacity', d => {
        if (selectedNode === null) return 1;
        if (d.id === selectedNode) return 1;
        const isConnected = graphData.links.some(link =>
          (link.source.id === selectedNode && link.target.id === d.id) ||
          (link.source.id === d.id && link.target.id === selectedNode)
        );
        if (isConnected) return 0.8;
        return 0.1;
      });

  }, [selectedNode, graphData.links, graphData.nodes]); // Re-run when selectedNode or graphData changes

  // Get data for the selected node
  const selectedNodeData = selectedNode ? positionedNodes.find(n => n.id === selectedNode) : null;
  const connectedEdges = selectedNode ? graphData.links.filter(e => e.source.id === selectedNode || e.target.id === selectedNode) : [];

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
            onClick={() => setSelectedNode(null)} // Deselect node when clicking on SVG background
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
                    // Ensure edge.source and edge.target are strings (IDs)
                    const otherNodeId = edge.source.id === selectedNode ? edge.target.id : edge.source.id;
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