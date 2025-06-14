import React, { useRef, useEffect, useState } from 'react';

// Mock ForceGraph2D component since we can't import external libraries
// In a real implementation, you would use: import ForceGraph2D from 'react-force-graph-2d';

const KnowledgeGraph = ({ data }) => {
  const graphRef = useRef();
  const canvasRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [graphStats, setGraphStats] = useState({ nodes: 0, links: 0 });

  // Update stats when data changes
  useEffect(() => {
    setGraphStats({
      nodes: data.nodes?.length || 0,
      links: data.links?.length || 0
    });
  }, [data]);

  // Simple canvas-based graph implementation
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set up basic styling
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (!data.nodes || data.nodes.length === 0) {
      // Draw placeholder
      ctx.fillStyle = '#999';
      ctx.fillText('No graph data available', width / 2, height / 2);
      ctx.fillText('Export data first or add more content', width / 2, height / 2 + 20);
      return;
    }

    // Position nodes in a circle for demo
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    // Draw connections first (behind nodes)
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    
    data.links?.forEach(link => {
      const sourceNode = data.nodes.find(n => n.id === link.source);
      const targetNode = data.nodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode) {
        const sourceIndex = data.nodes.indexOf(sourceNode);
        const targetIndex = data.nodes.indexOf(targetNode);
        
        const sourceAngle = (sourceIndex / data.nodes.length) * 2 * Math.PI;
        const targetAngle = (targetIndex / data.nodes.length) * 2 * Math.PI;
        
        const sourceX = centerX + radius * Math.cos(sourceAngle);
        const sourceY = centerY + radius * Math.sin(sourceAngle);
        const targetX = centerX + radius * Math.cos(targetAngle);
        const targetY = centerY + radius * Math.sin(targetAngle);
        
        ctx.beginPath();
        ctx.moveTo(sourceX, sourceY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
      }
    });

    // Draw nodes
    data.nodes.forEach((node, index) => {
      const angle = (index / data.nodes.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // Node color based on type
      let color = '#667eea';
      switch (node.type) {
        case 'Tutorial':
          color = '#ff6b6b';
          break;
        case 'Documentation':
          color = '#4ecdc4';
          break;
        case 'Article':
          color = '#9b59b6';
          break;
        case 'Blog':
          color = '#f39c12';
          break;
        default:
          color = '#667eea';
      }

      // Node size based on quality
      const nodeSize = 8 + (node.quality || 5) * 2;

      // Draw node
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
      ctx.fill();

      // Draw node border
      ctx.strokeStyle = selectedNode?.id === node.id ? '#333' : '#fff';
      ctx.lineWidth = selectedNode?.id === node.id ? 3 : 2;
      ctx.stroke();

      // Draw node label
      ctx.fillStyle = '#333';
      const label = node.name || `Node ${node.id}`;
      const shortLabel = label.length > 15 ? label.substring(0, 15) + '...' : label;
      ctx.fillText(shortLabel, x, y + nodeSize + 15);
    });

  }, [data, selectedNode]);

  // Handle canvas click
  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 3;

    // Check if click is on a node
    data.nodes?.forEach((node, index) => {
      const angle = (index / data.nodes.length) * 2 * Math.PI;
      const nodeX = centerX + radius * Math.cos(angle);
      const nodeY = centerY + radius * Math.sin(angle);
      const nodeSize = 8 + (node.quality || 5) * 2;

      const distance = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      if (distance <= nodeSize) {
        setSelectedNode(node);
      }
    });
  };

  // Reset selection
  const resetSelection = () => {
    setSelectedNode(null);
  };

  // Open node URL
  const openNodeUrl = () => {
    if (selectedNode?.url) {
      window.open(selectedNode.url, '_blank');
    }
  };

  return (
    <div className="graph-wrapper">
      <div className="graph-info">
        <strong>📊 Graph Stats:</strong> {graphStats.nodes} nodes, {graphStats.links} connections
        {selectedNode && (
          <span> | 🎯 Selected: {selectedNode.name}</span>
        )}
      </div>
      
      <div className="graph-controls">
        <button 
          className="btn btn-secondary" 
          onClick={resetSelection}
          style={{ fontSize: '12px', padding: '5px 10px' }}
        >
          Clear Selection
        </button>
        
        {selectedNode && selectedNode.url && (
          <button 
            className="btn btn-primary" 
            onClick={openNodeUrl}
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            Open URL
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: '400px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
        }}
      />

      {selectedNode && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {selectedNode.name}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '5px' }}>
            Type: {selectedNode.type} | Quality: {selectedNode.quality}/10
          </div>
          {selectedNode.topics && selectedNode.topics.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: '#28a745' }}>
              Topics: {selectedNode.topics.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '10px',
        borderRadius: '6px',
        fontSize: '0.8rem',
        color: '#666',
        maxWidth: '200px'
      }}>
        💡 Click on nodes to explore connections and view details. Colors represent content types.
      </div>
    </div>
  );
};

export default KnowledgeGraph;