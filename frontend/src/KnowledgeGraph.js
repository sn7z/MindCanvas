import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ResponsiveNetwork } from '@nivo/network';

const EnhancedKnowledgeGraph = ({ data }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [graphStats, setGraphStats] = useState({ nodes: 0, links: 0, clusters: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);

  // Sample data structure for demonstration
  const sampleData = useMemo(() => {
    if (data && data.nodes && data.nodes.length > 0) {
      return data;
    }
    
    // Generate sample data with clusters
    return {
      nodes: [
        { id: 'tech', name: 'Technology', type: 'Tutorial', quality: 9, topics: ['React', 'Node.js', 'AI/ML', 'DevOps'], url: 'https://example.com/tech' },
        { id: 'design', name: 'Design', type: 'Documentation', quality: 8, topics: ['UI/UX', 'Figma', 'CSS', 'Typography'], url: 'https://example.com/design' },
        { id: 'business', name: 'Business', type: 'Article', quality: 7, topics: ['Strategy', 'Marketing', 'Finance', 'Leadership'], url: 'https://example.com/business' },
        { id: 'science', name: 'Science', type: 'Blog', quality: 9, topics: ['Physics', 'Chemistry', 'Biology', 'Mathematics'], url: 'https://example.com/science' },
        { id: 'health', name: 'Health', type: 'Tutorial', quality: 8, topics: ['Nutrition', 'Exercise', 'Mental Health', 'Medicine'], url: 'https://example.com/health' },
        { id: 'education', name: 'Education', type: 'Documentation', quality: 7, topics: ['Learning', 'Teaching', 'Research', 'Assessment'], url: 'https://example.com/education' }
      ],
      links: [
        { source: 'tech', target: 'design' },
        { source: 'design', target: 'business' },
        { source: 'business', target: 'education' },
        { source: 'science', target: 'health' },
        { source: 'health', target: 'education' },
        { source: 'tech', target: 'science' }
      ]
    };
  }, [data]);

  // Update stats when data changes
  useEffect(() => {
    const clusters = new Set(sampleData.nodes?.map(n => n.type) || []).size;
    setGraphStats({
      nodes: sampleData.nodes?.length || 0,
      links: sampleData.links?.length || 0,
      clusters: clusters
    });
  }, [sampleData]);

  // Calculate cluster positions using force-directed layout
  const getClusterPositions = useCallback((nodes) => {
    const clusters = {};
    const clusterCenters = {};
    
    // Group nodes by type (cluster)
    nodes.forEach(node => {
      if (!clusters[node.type]) {
        clusters[node.type] = [];
      }
      clusters[node.type].push(node);
    });

    // Calculate cluster centers in a circular arrangement
    const clusterTypes = Object.keys(clusters);
    const centerRadius = 150;
    
    clusterTypes.forEach((type, index) => {
      const angle = (index / clusterTypes.length) * 2 * Math.PI;
      clusterCenters[type] = {
        x: Math.cos(angle) * centerRadius,
        y: Math.sin(angle) * centerRadius
      };
    });

    return { clusters, clusterCenters };
  }, []);

  // Transform data for Nivo Network with clustering
  const networkData = useMemo(() => {
    if (!sampleData.nodes || sampleData.nodes.length === 0) {
      return { nodes: [], links: [] };
    }

    const nodes = [];
    const links = [];
    const { clusters, clusterCenters } = getClusterPositions(sampleData.nodes);

    // Add main category nodes with cluster positioning
    sampleData.nodes.forEach((node, nodeIndex) => {
      const clusterCenter = clusterCenters[node.type];
      const clusterNodes = clusters[node.type];
      const nodeIndexInCluster = clusterNodes.findIndex(n => n.id === node.id);
      
      // Position nodes within their cluster
      const angleOffset = (nodeIndexInCluster / clusterNodes.length) * 2 * Math.PI;
      const clusterRadius = 40 + (clusterNodes.length * 5);
      
      nodes.push({
        id: node.id,
        name: node.name || `Node ${node.id}`,
        type: node.type || 'default',
        quality: node.quality || 5,
        topics: node.topics || [],
        url: node.url,
        size: 20 + (node.quality || 5) * 3,
        color: getNodeColor(node.type),
        isExpanded: expandedNodes.has(node.id),
        isMainNode: true,
        cluster: node.type,
        x: clusterCenter.x + Math.cos(angleOffset) * clusterRadius,
        y: clusterCenter.y + Math.sin(angleOffset) * clusterRadius
      });

      // Add topic nodes if this node is expanded
      if (expandedNodes.has(node.id) && node.topics && node.topics.length > 0) {
        const mainNodePos = { 
          x: clusterCenter.x + Math.cos(angleOffset) * clusterRadius,
          y: clusterCenter.y + Math.sin(angleOffset) * clusterRadius
        };
        
        node.topics.forEach((topic, index) => {
          const topicId = `${node.id}_topic_${index}`;
          const topicAngle = (index / node.topics.length) * 2 * Math.PI;
          const topicRadius = 60;
          
          nodes.push({
            id: topicId,
            name: topic,
            type: 'topic',
            parentId: node.id,
            size: 12,
            color: getTopicColor(node.type),
            isMainNode: false,
            cluster: `${node.type}_topics`,
            x: mainNodePos.x + Math.cos(topicAngle) * topicRadius,
            y: mainNodePos.y + Math.sin(topicAngle) * topicRadius
          });

          // Create link between main node and topic
          links.push({
            source: node.id,
            target: topicId,
            distance: 70,
            strength: 0.8
          });
        });
      }
    });

    // Add original links between main nodes
    sampleData.links?.forEach(link => {
      const sourceExists = nodes.find(n => n.id === link.source && n.isMainNode);
      const targetExists = nodes.find(n => n.id === link.target && n.isMainNode);
      
      if (sourceExists && targetExists) {
        links.push({
          source: link.source,
          target: link.target,
          distance: 150,
          strength: 0.3
        });
      }
    });

    return { nodes, links };
  }, [sampleData, expandedNodes, getClusterPositions]);

  // Enhanced color scheme with gradients
  function getNodeColor(type) {
    const colors = {
      'Tutorial': '#ff6b6b',
      'Documentation': '#4ecdc4',
      'Article': '#9b59b6',
      'Blog': '#f39c12',
      'default': '#667eea'
    };
    return colors[type] || colors.default;
  }

  function getTopicColor(parentType) {
    const colors = {
      'Tutorial': '#ffb3b3',
      'Documentation': '#a6f0ec',
      'Article': '#c49bdb',
      'Blog': '#f9c74f',
      'default': '#a8b5ea'
    };
    return colors[parentType] || colors.default;
  }

  // Handle node interactions
  const handleNodeClick = useCallback((node, event) => {
    if (node.isMainNode) {
      setSelectedNode(node);
      
      const newExpanded = new Set(expandedNodes);
      if (expandedNodes.has(node.id)) {
        newExpanded.delete(node.id);
      } else {
        newExpanded.add(node.id);
      }
      setExpandedNodes(newExpanded);
    } else {
      setSelectedNode(node);
    }
  }, [expandedNodes]);

  const handleNodeHover = useCallback((node, event) => {
    setHoveredNode(node);
  }, []);

  const handleNodeLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  // Control functions
  const resetView = useCallback(() => {
    setSelectedNode(null);
    setExpandedNodes(new Set());
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  const expandAll = useCallback(() => {
    const allMainNodes = sampleData.nodes?.filter(n => n.topics && n.topics.length > 0).map(n => n.id) || [];
    setExpandedNodes(new Set(allMainNodes));
  }, [sampleData.nodes]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const openNodeUrl = useCallback(() => {
    if (selectedNode?.url) {
      window.open(selectedNode.url, '_blank');
    }
  }, [selectedNode]);

  // Custom node component with enhanced visuals
  const CustomNode = ({ node, x, y, size, color, borderWidth, borderColor, onMouseEnter, onMouseLeave, onClick }) => {
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const nodeSize = size || 15;
    const scale = isSelected ? 1.3 : isHovered ? 1.1 : 1;
    
    return (
      <g 
        transform={`translate(${x}, ${y}) scale(${scale})`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      >
        {/* Glow effect for selected/hovered nodes */}
        {(isSelected || isHovered) && (
          <circle
            r={nodeSize + 8}
            fill="none"
            stroke={color}
            strokeWidth="2"
            opacity="0.3"
            strokeDasharray="4,4"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0;360"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        
        {/* Node shadow */}
        <circle
          r={nodeSize + 1}
          fill="rgba(0,0,0,0.2)"
          transform="translate(3, 3)"
        />
        
        {/* Main node circle with gradient */}
        <defs>
          <radialGradient id={`gradient-${node.id}`} cx="30%" cy="30%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </radialGradient>
        </defs>
        
        <circle
          r={nodeSize}
          fill={`url(#gradient-${node.id})`}
          stroke={isSelected ? '#333' : '#fff'}
          strokeWidth={isSelected ? 3 : 2}
          style={{
            filter: isSelected ? 'brightness(1.2)' : 'none',
            transition: 'all 0.3s ease'
          }}
        />
        
        {/* Expansion indicator */}
        {node.isMainNode && node.topics && node.topics.length > 0 && (
          <g>
            <circle
              r={4}
              fill="#fff"
              stroke={color}
              strokeWidth={2}
              transform={`translate(${nodeSize - 6}, ${nodeSize - 6})`}
            />
            <text
              x={nodeSize - 6}
              y={nodeSize - 2}
              textAnchor="middle"
              style={{
                fontSize: '8px',
                fontWeight: 'bold',
                fill: color,
                pointerEvents: 'none'
              }}
            >
              {expandedNodes.has(node.id) ? '−' : '+'}
            </text>
          </g>
        )}
        
        {/* Quality indicator */}
        {node.isMainNode && node.quality && (
          <g transform={`translate(${-nodeSize + 6}, ${-nodeSize + 6})`}>
            <circle r="6" fill="#fff" stroke={color} strokeWidth="1" />
            <text
              textAnchor="middle"
              y="2"
              style={{
                fontSize: '8px',
                fontWeight: 'bold',
                fill: color,
                pointerEvents: 'none'
              }}
            >
              {node.quality}
            </text>
          </g>
        )}
        
        {/* Node label with background */}
        <g transform={`translate(0, ${nodeSize + 20})`}>
          <rect
            x={-30}
            y={-8}
            width="60"
            height="16"
            fill="rgba(255,255,255,0.9)"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="1"
            rx="8"
          />
          <text
            textAnchor="middle"
            y="2"
            style={{
              fontSize: node.isMainNode ? '11px' : '9px',
              fontWeight: isSelected ? 'bold' : 'normal',
              fill: '#333',
              pointerEvents: 'none'
            }}
          >
            {node.name && node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name || 'Node'}
          </text>
        </g>
      </g>
    );
  };

  // Custom link component with animations
  const CustomLink = ({ link, sourceX, sourceY, targetX, targetY }) => {
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const isTopicLink = targetId && targetId.includes('_topic_');
    const isHighlighted = selectedNode && (
      (typeof link.source === 'object' ? link.source.id : link.source) === selectedNode.id ||
      (typeof link.target === 'object' ? link.target.id : link.target) === selectedNode.id
    );
    
    return (
      <g>
        {/* Link glow for highlighted connections */}
        {isHighlighted && (
          <line
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
            stroke={isTopicLink ? '#3498db' : '#e74c3c'}
            strokeWidth={isTopicLink ? 4 : 6}
            opacity="0.3"
          />
        )}
        
        <line
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
          stroke={isTopicLink ? '#95a5a6' : '#bdc3c7'}
          strokeWidth={isTopicLink ? 2 : 3}
          strokeDasharray={isTopicLink ? '5,5' : 'none'}
          opacity={isHighlighted ? 1 : 0.6}
          style={{
            transition: 'all 0.3s ease'
          }}
        />
      </g>
    );
  };

  if (!sampleData.nodes || sampleData.nodes.length === 0) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <h3>📊 Interactive Knowledge Graph</h3>
          <p>No data available - Using sample data for demonstration</p>
        </div>
        
        <div style={{
          height: '500px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          border: '2px dashed #ddd',
          borderRadius: '12px',
          color: '#666',
          fontSize: '1.1rem'
        }}>
          Add your knowledge graph data to visualize connections
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ margin: 0, marginBottom: '10px' }}>🧠 Interactive Knowledge Graph</h2>
        <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>
          📊 {graphStats.nodes} nodes • 🔗 {graphStats.links} connections • 🎯 {graphStats.clusters} clusters
          {selectedNode && ` • Selected: ${selectedNode.name}`}
          {expandedNodes.size > 0 && ` • Expanded: ${expandedNodes.size}`}
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={resetView}
          style={{ 
            padding: '10px 15px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          🔄 Reset View
        </button>
        
        <button 
          onClick={expandAll}
          style={{ 
            padding: '10px 15px',
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          📊 Expand All
        </button>
        
        <button 
          onClick={collapseAll}
          style={{ 
            padding: '10px 15px',
            background: '#ffc107',
            color: '#212529',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          📁 Collapse All
        </button>
        
        {selectedNode && selectedNode.url && (
          <button 
            onClick={openNodeUrl}
            style={{ 
              padding: '10px 15px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            🔗 Open URL
          </button>
        )}
      </div>

      {/* Main Graph Container */}
      <div style={{ position: 'relative' }}>
        <div style={{
          height: '600px',
          border: '2px solid #e9ecef',
          borderRadius: '12px',
          background: 'radial-gradient(circle at 30% 30%, #f8f9fa 0%, #e9ecef 100%)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
        }}>
          <ResponsiveNetwork
            data={networkData}
            margin={{ top: 60, right: 60, bottom: 60, left: 60 }}
            linkDistance={function(link) { return link.distance || 120; }}
            centeringStrength={0.3}
            repulsivity={8}
            iterations={80}
            nodeSize={function(n) { return n.size || 20; }}
            activeNodeSize={function(n) { return (n.size || 20) * 1.2; }}
            inactiveNodeSize={function(n) { return (n.size || 20) * 0.9; }}
            nodeColor={function(n) { return n.color; }}
            nodeBorderWidth={2}
            nodeBorderColor="#ffffff"
            linkThickness={function(link) { 
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              return targetId && targetId.includes('_topic_') ? 2 : 3;
            }}
            linkColor="#e0e0e0"
            onClick={handleNodeClick}
            onMouseEnter={handleNodeHover}
            onMouseLeave={handleNodeLeave}
            animate={true}
            motionConfig={{
              mass: 1,
              tension: 160,
              friction: 26,
              clamp: false,
              precision: 0.01,
              velocity: 0
            }}
            isInteractive={true}
            useMesh={true}
            meshDetectionRadius={25}
            enablePanAndZoom={true}
            nodeTooltip={({ node }) => (
              <div style={{
                background: 'rgba(255, 255, 255, 0.98)',
                padding: '15px',
                borderRadius: '10px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                fontSize: '13px',
                maxWidth: '250px',
                border: `2px solid ${node.color}`,
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  marginBottom: '8px',
                  color: node.color,
                  fontSize: '15px'
                }}>
                  {node.name}
                </div>
                
                {node.isMainNode ? (
                  <>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '8px',
                      color: '#666'
                    }}>
                      <span>Type: <strong style={{ color: node.color }}>{node.type}</strong></span>
                      <span>Quality: <strong style={{ 
                        color: node.quality > 7 ? '#28a745' : node.quality > 4 ? '#ffc107' : '#dc3545'
                      }}>{node.quality}/10</strong></span>
                    </div>
                    
                    {node.topics && node.topics.length > 0 && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#28a745', 
                        marginBottom: '8px',
                        background: '#f8f9fa',
                        padding: '8px',
                        borderRadius: '6px'
                      }}>
                        <strong>Topics ({node.topics.length}):</strong>
                        <div style={{ marginTop: '4px' }}>
                          {node.topics.join(' • ')}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#007bff', 
                      fontStyle: 'italic',
                      textAlign: 'center',
                      background: '#e3f2fd',
                      padding: '6px',
                      borderRadius: '4px'
                    }}>
                      💡 Click to {expandedNodes.has(node.id) ? 'collapse' : 'expand'} topics
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#666' }}>
                    Topic under: <strong style={{ color: '#007bff' }}>
                      {sampleData.nodes.find(n => n.id === node.parentId)?.name || 'Unknown'}
                    </strong>
                  </div>
                )}
              </div>
            )}
          />
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '15px',
          borderRadius: '10px',
          fontSize: '12px',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
            🎨 Content Types:
          </div>
          {[
            { type: 'Tutorial', color: '#ff6b6b' },
            { type: 'Documentation', color: '#4ecdc4' },
            { type: 'Article', color: '#9b59b6' },
            { type: 'Blog', color: '#f39c12' }
          ].map(({ type, color }) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ 
                width: '14px', 
                height: '14px', 
                backgroundColor: color, 
                borderRadius: '50%', 
                marginRight: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}></div>
              {type}
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '15px',
          borderRadius: '10px',
          fontSize: '12px',
          color: '#666',
          maxWidth: '220px',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
            🎯 Controls:
          </div>
          <div style={{ lineHeight: '1.4' }}>
            • <strong>Click:</strong> Expand/collapse topics<br/>
            • <strong>Drag:</strong> Pan around the graph<br/>
            • <strong>Wheel:</strong> Zoom in/out<br/>
            • <strong>Hover:</strong> View node details<br/>
            • <strong>Quality badges:</strong> Content ratings<br/>
            • <strong>Clusters:</strong> Grouped by type
          </div>
        </div>

        {/* Selected Node Details */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.98)',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(15px)',
            border: `2px solid ${selectedNode.color}`,
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px'
            }}>
              <div>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '1.2rem',
                  color: selectedNode.color,
                  marginBottom: '4px'
                }}>
                  {selectedNode.name}
                </div>
                
                {selectedNode.isMainNode ? (
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    <span style={{ 
                      background: selectedNode.color,
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      marginRight: '8px'
                    }}>
                      {selectedNode.type}
                    </span>
                    Quality: <span style={{ 
                      color: selectedNode.quality > 7 ? '#28a745' : 
                             selectedNode.quality > 4 ? '#ffc107' : '#dc3545',
                      fontWeight: '600'
                    }}>
                      {selectedNode.quality}/10
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    Topic under: <span style={{ fontWeight: '600', color: '#007bff' }}>
                      {sampleData.nodes.find(n => n.id === selectedNode.parentId)?.name || 'Unknown'}
                    </span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#999',
                  padding: '0',
                  lineHeight: '1'
                }}
                title="Close details"
              >
                ×
              </button>
            </div>
            
            {selectedNode.isMainNode && selectedNode.topics && selectedNode.topics.length > 0 && (
              <div style={{ 
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div style={{ 
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#333',
                  marginBottom: '6px'
                }}>
                  📚 Topics ({selectedNode.topics.length}):
                </div>
                <div style={{ 
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  {selectedNode.topics.map((topic, index) => (
                    <span
                      key={index}
                      style={{
                        background: selectedNode.color,
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: '500'
                      }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ 
              fontSize: '0.8rem', 
              color: '#007bff',
              fontStyle: 'italic',
              textAlign: 'center',
              background: '#e3f2fd',
              padding: '8px',
              borderRadius: '6px'
            }}>
              {selectedNode.isMainNode ? (
                <>💡 Click node to {expandedNodes.has(selectedNode.id) ? 'collapse' : 'expand'} topics</>
              ) : (
                <>🔍 This is a topic node - part of the expanded view</>
              )}
            </div>
          </div>
        )}

        {/* Loading/Animation Styles */}
        <style jsx>{`
          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
          
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
          
          .graph-node:hover {
            animation: pulse 1s infinite;
          }
        `}</style>
      </div>

      {/* Footer Info */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: 'linear-gradient(135deg, #e9ecef 0%, #f8f9fa 100%)',
        borderRadius: '10px',
        fontSize: '0.9rem',
        color: '#666',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>🧠 Knowledge Graph Features:</strong>
        </div>
        <div style={{ lineHeight: '1.5' }}>
          ✨ <strong>Clustering:</strong> Nodes grouped by content type • 
          🎯 <strong>Interactive Expansion:</strong> Click to reveal topics • 
          🔍 <strong>Quality Indicators:</strong> Visual quality ratings • 
          🎨 <strong>Smart Positioning:</strong> Force-directed layout with clustering • 
          📊 <strong>Real-time Stats:</strong> Live connection tracking
        </div>
      </div>
    </div>
  );
};

export default EnhancedKnowledgeGraph;1