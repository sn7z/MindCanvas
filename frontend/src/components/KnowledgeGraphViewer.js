// src/components/KnowledgeGraphViewer.js - Fixed Cytoscape runtime errors
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import cytoscape from 'cytoscape';

const GraphContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: ${props => props.theme.borderRadius.lg};
  overflow: hidden;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
`;

const GraphCanvas = styled.div`
  width: 100%;
  height: 100%;
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
  
  .cy-container {
    background: transparent !important;
  }
`;

const GraphOverlay = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
`;

const NodeTooltip = styled(motion.div)`
  position: absolute;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(15px);
  color: white;
  padding: 16px 20px;
  border-radius: 12px;
  font-size: 14px;
  max-width: 320px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 100;
  pointer-events: none;
  
  .tooltip-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 8px;
    gap: 12px;
  }
  
  .tooltip-title {
    font-weight: 600;
    margin-bottom: 4px;
    color: #ff6b6b;
    font-size: 15px;
    line-height: 1.3;
    flex: 1;
  }
  
  .tooltip-type {
    background: #667eea;
    color: white;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .tooltip-summary {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.5;
    margin-bottom: 12px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .tooltip-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    align-items: center;
    flex-wrap: wrap;
    
    .quality {
      background: #4ecdc4;
      color: white;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 600;
    }
    
    .connections {
      color: rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .topics {
      color: rgba(255, 255, 255, 0.7);
      font-style: italic;
    }
  }
  
  .tooltip-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 12px;
    height: 12px;
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: none;
    border-left: none;
    transform: translateX(-50%) rotate(45deg);
  }
`;

const GraphStats = styled(motion.div)`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(15px);
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  gap: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: auto;
  
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    
    .icon {
      font-size: 16px;
    }
    
    .value {
      font-weight: 600;
      color: white;
    }
    
    .label {
      color: rgba(255, 255, 255, 0.7);
    }
  }
`;

const GraphLegend = styled(motion.div)`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(15px);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: auto;
  max-width: 200px;
  
  .legend-title {
    font-weight: 600;
    margin-bottom: 12px;
    color: white;
    font-size: 14px;
  }
  
  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    
    .color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .label {
      color: rgba(255, 255, 255, 0.8);
    }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  padding: 40px;
  
  .icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .title {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .description {
    line-height: 1.5;
    max-width: 400px;
    margin-bottom: 1.5rem;
  }
  
  .cta-button {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }
  }
`;

const LoadingSpinner = styled(motion.div)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Color schemes for different content types
const CONTENT_TYPE_COLORS = {
  'Tutorial': '#ff6b6b',
  'Documentation': '#4ecdc4', 
  'Article': '#9b59b6',
  'Blog': '#f39c12',
  'Research': '#e67e22',
  'News': '#e74c3c',
  'Video': '#3498db',
  'Book': '#2ecc71',
  'Tool': '#34495e',
  'Course': '#e91e63',
  'Unknown': '#667eea',
  'Web Content': '#95a5a6'
};

// Simplified layout configs to prevent Cytoscape errors
const LAYOUT_CONFIGS = {
  fcose: {
    name: 'cose',
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 50,
    randomize: false
  },
  cola: {
    name: 'grid',
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50,
    avoidOverlap: true
  },
  dagre: {
    name: 'breadthfirst',
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50,
    directed: true
  },
  circle: {
    name: 'circle',
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50,
    avoidOverlap: true
  },
  grid: {
    name: 'grid',
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50,
    avoidOverlap: true
  },
  cose: {
    name: 'cose',
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 50,
    randomize: false
  }
};

const KnowledgeGraphViewer = ({
  data,
  selectedNode,
  onNodeSelect,
  onBackgroundClick,
  layout = 'fcose',
  showStats = true,
  showLegend = true,
  className,
  ...props
}) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const isMountedRef = useRef(true);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, node: null });
  const [isLoading, setIsLoading] = useState(false);
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0, density: 0 });

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Safe state setter that checks if component is still mounted
  const safeSetState = useCallback((setter) => {
    if (isMountedRef.current) {
      setter();
    }
  }, []);

  // Memoize processed data to avoid unnecessary recalculations
  const processedData = useMemo(() => {
    if (!data?.nodes || !Array.isArray(data.nodes)) {
      return { nodes: [], edges: [] };
    }

    const nodeConnections = {};
    
    // Count connections for each node
    if (data.links && Array.isArray(data.links)) {
      data.links.forEach(link => {
        const source = link.source?.toString();
        const target = link.target?.toString();
        if (source && target) {
          nodeConnections[source] = (nodeConnections[source] || 0) + 1;
          nodeConnections[target] = (nodeConnections[target] || 0) + 1;
        }
      });
    }

    // Process nodes with error checking
    const nodes = data.nodes.map(node => {
      const contentType = node.type || node.content_type || 'Unknown';
      const quality = node.quality || node.quality_score || 5;
      const connections = nodeConnections[node.id?.toString()] || 0;
      
      // Calculate node size based on quality and connections
      const baseSize = Math.max(25, Math.min(60, quality * 6 + connections * 2));
      
      return {
        data: {
          id: node.id?.toString() || `node-${Math.random()}`,
          label: node.name || node.title || `Node ${node.id}`,
          size: baseSize,
          color: CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS.Unknown,
          borderColor: selectedNode?.id?.toString() === node.id?.toString() ? '#fff' : 'rgba(255,255,255,0.3)',
          borderWidth: selectedNode?.id?.toString() === node.id?.toString() ? 4 : 2,
          
          // Store original data for tooltips and interactions
          originalNode: node,
          contentType: contentType,
          quality: quality,
          connections: connections,
          summary: node.summary || node.description || '',
          topics: node.topics || node.key_topics || [],
          url: node.url || '',
          visit_timestamp: node.visit_timestamp
        }
      };
    });

    // Process edges with error checking
    const edges = (data.links || []).map((link, index) => {
      const weight = Math.max(1, Math.min(5, (link.weight || 1) * 1.5));
      const similarity = link.similarity || 0.5;
      
      return {
        data: {
          id: `edge-${index}`,
          source: link.source?.toString() || '',
          target: link.target?.toString() || '',
          weight: weight,
          opacity: Math.max(0.3, similarity),
          sharedTopics: link.shared_topics || [],
          similarity: similarity
        }
      };
    });

    // Filter out edges with missing source/target
    const validEdges = edges.filter(edge => 
      edge.data.source && 
      edge.data.target && 
      nodes.some(n => n.data.id === edge.data.source) &&
      nodes.some(n => n.data.id === edge.data.target)
    );

    return { nodes, edges: validEdges };
  }, [data, selectedNode]);

  // Calculate graph statistics
  useEffect(() => {
    const nodeCount = processedData.nodes.length;
    const edgeCount = processedData.edges.length;
    const maxEdges = nodeCount > 1 ? nodeCount * (nodeCount - 1) / 2 : 0;
    const density = maxEdges > 0 ? (edgeCount / maxEdges * 100).toFixed(1) : 0;
    
    safeSetState(() => {
      setGraphStats({
        nodes: nodeCount,
        edges: edgeCount,
        density: density
      });
    });
  }, [processedData, safeSetState]);

  // Get graph style configuration
  const getGraphStyle = useCallback(() => [
    {
      selector: 'node',
      style: {
        'width': 'data(size)',
        'height': 'data(size)',
        'background-color': 'data(color)',
        'border-width': 'data(borderWidth)',
        'border-color': 'data(borderColor)',
        'border-opacity': 0.8,
        'label': 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 8,
        'font-size': '11px',
        'font-weight': '600',
        'color': '#ffffff',
        'text-outline-width': 2,
        'text-outline-color': '#000000',
        'text-outline-opacity': 0.8,
        'text-max-width': '100px',
        'text-wrap': 'wrap',
        'overlay-opacity': 0
      }
    },
    {
      selector: 'node:hover',
      style: {
        'background-color': '#ff6b6b',
        'border-color': '#ffffff',
        'border-width': 3,
        'z-index': 10
      }
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': '#4ecdc4',
        'border-color': '#ffffff',
        'border-width': 4,
        'z-index': 20
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 'data(weight)',
        'line-color': 'rgba(255, 255, 255, 0.4)',
        'line-opacity': 'data(opacity)',
        'target-arrow-color': 'rgba(255, 255, 255, 0.4)',
        'target-arrow-shape': 'triangle',
        'target-arrow-size': '8px',
        'curve-style': 'bezier',
        'overlay-opacity': 0
      }
    },
    {
      selector: 'edge:hover',
      style: {
        'line-color': 'rgba(255, 255, 255, 0.8)',
        'target-arrow-color': 'rgba(255, 255, 255, 0.8)',
        'width': 4,
        'z-index': 5
      }
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#4ecdc4',
        'target-arrow-color': '#4ecdc4',
        'width': 4,
        'z-index': 15
      }
    }
  ], []);

  // Safe Cytoscape cleanup
  const cleanupCytoscape = useCallback(() => {
    if (cyRef.current) {
      try {
        // Remove all event listeners first
        cyRef.current.removeAllListeners();
        // Destroy the instance
        cyRef.current.destroy();
      } catch (error) {
        console.warn('Error during Cytoscape cleanup:', error);
      } finally {
        cyRef.current = null;
      }
    }
  }, []);

  // Initialize Cytoscape graph with proper error handling
  const initializeCytoscape = useCallback(() => {
    if (!containerRef.current || !isMountedRef.current || processedData.nodes.length === 0) {
      return;
    }

    // Clean up existing instance
    cleanupCytoscape();

    safeSetState(() => setIsLoading(true));

    try {
      // Create new Cytoscape instance with error boundaries
      const cy = cytoscape({
        container: containerRef.current,
        elements: [...processedData.nodes, ...processedData.edges],
        style: getGraphStyle(),
        layout: LAYOUT_CONFIGS[layout] || LAYOUT_CONFIGS.fcose,
        
        // Safe interaction settings
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 3,
        zoomingEnabled: true,
        userZoomingEnabled: true,
        panningEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
        selectionType: 'single',
        autoungrabify: false,
        autounselectify: false,
        
        // Error handling
        ready: () => {
          if (isMountedRef.current) {
            console.log('🎯 Cytoscape initialized successfully');
          }
        }
      });

      if (!isMountedRef.current) {
        cy.destroy();
        return;
      }

      cyRef.current = cy;

      // Safe event handlers with error boundaries
      cy.on('tap', 'node', (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const node = event.target;
          const nodeData = node.data('originalNode');
          
          // Highlight connected edges
          cy.elements().removeClass('highlighted');
          const connectedEdges = node.connectedEdges();
          connectedEdges.addClass('highlighted');
          
          if (onNodeSelect && nodeData) {
            onNodeSelect(nodeData);
          }
        } catch (error) {
          console.warn('Error in node tap handler:', error);
        }
      });

      cy.on('tap', (event) => {
        if (!isMountedRef.current) return;
        
        try {
          if (event.target === cy) {
            cy.elements().removeClass('highlighted');
            if (onBackgroundClick) {
              onBackgroundClick();
            }
          }
        } catch (error) {
          console.warn('Error in background tap handler:', error);
        }
      });

      cy.on('mouseover', 'node', (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const node = event.target;
          const nodeData = node.data('originalNode');
          const renderedPosition = node.renderedPosition();
          
          safeSetState(() => {
            setTooltip({
              visible: true,
              x: renderedPosition.x,
              y: renderedPosition.y - 100,
              node: {
                ...nodeData,
                connections: node.data('connections'),
                contentType: node.data('contentType'),
                quality: node.data('quality')
              }
            });
          });
        } catch (error) {
          console.warn('Error in mouseover handler:', error);
        }
      });

      cy.on('mouseout', 'node', () => {
        if (!isMountedRef.current) return;
        
        safeSetState(() => {
          setTooltip({ visible: false, x: 0, y: 0, node: null });
        });
      });

      cy.on('viewport', () => {
        if (!isMountedRef.current) return;
        
        safeSetState(() => {
          setTooltip({ visible: false, x: 0, y: 0, node: null });
        });
      });

      // Layout complete handler
      cy.one('layoutstop', () => {
        if (isMountedRef.current) {
          safeSetState(() => setIsLoading(false));
          console.log('🎯 Graph layout completed');
        }
      });

      // Error handling
      cy.on('layoutstop', () => {
        if (isMountedRef.current) {
          safeSetState(() => setIsLoading(false));
        }
      });

    } catch (error) {
      console.error('Error initializing Cytoscape:', error);
      safeSetState(() => setIsLoading(false));
    }
  }, [processedData, layout, getGraphStyle, onNodeSelect, onBackgroundClick, cleanupCytoscape, safeSetState]);

  // Initialize graph when data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeCytoscape();
    }, 100); // Small delay to ensure DOM is ready

    return () => clearTimeout(timer);
  }, [initializeCytoscape]);

  // Handle selected node highlighting safely
  useEffect(() => {
    if (!cyRef.current || !selectedNode || !isMountedRef.current) return;

    try {
      const cy = cyRef.current;
      const nodeElement = cy.getElementById(selectedNode.id?.toString());
      
      if (nodeElement.length > 0) {
        // Clear previous selections
        cy.elements().unselect();
        
        // Select and center on node
        nodeElement.select();
        cy.center(nodeElement);
        cy.zoom({
          level: Math.min(2, cy.zoom() * 1.2),
          renderedPosition: nodeElement.renderedPosition()
        });
      }
    } catch (error) {
      console.warn('Error highlighting selected node:', error);
    }
  }, [selectedNode]);

  // Handle layout changes safely
  useEffect(() => {
    if (!cyRef.current || processedData.nodes.length === 0 || !isMountedRef.current) return;

    try {
      console.log('🎯 Applying layout:', layout);
      safeSetState(() => setIsLoading(true));
      
      const cy = cyRef.current;
      const layoutConfig = LAYOUT_CONFIGS[layout] || LAYOUT_CONFIGS.fcose;
      
      const layoutInstance = cy.layout(layoutConfig);
      
      layoutInstance.one('layoutstop', () => {
        if (isMountedRef.current) {
          safeSetState(() => setIsLoading(false));
          console.log('🎯 Layout change completed');
        }
      });
      
      layoutInstance.run();
    } catch (error) {
      console.warn('Error applying layout:', error);
      safeSetState(() => setIsLoading(false));
    }
  }, [layout, safeSetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanupCytoscape();
    };
  }, [cleanupCytoscape]);

  // Generate legend data
  const legendData = useMemo(() => {
    const typeCounts = {};
    processedData.nodes.forEach(node => {
      const type = node.data.contentType;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([type, count]) => ({
        type,
        count,
        color: CONTENT_TYPE_COLORS[type] || CONTENT_TYPE_COLORS.Unknown
      }));
  }, [processedData]);

  // Show empty state if no data
  if (!processedData.nodes.length) {
    return (
      <GraphContainer className={className} {...props}>
        <EmptyState>
          <div className="icon">🕸️</div>
          <div className="title">No Knowledge Graph Data</div>
          <div className="description">
            Your knowledge graph is empty. Use the Chrome extension to export your browsing history and start building your personal knowledge network.
          </div>
          <button 
            className="cta-button"
            onClick={() => alert('Use the MindCanvas Chrome extension to export your browsing history')}
          >
            📱 Get Chrome Extension
          </button>
        </EmptyState>
      </GraphContainer>
    );
  }

  return (
    <GraphContainer className={className} {...props}>
      <GraphCanvas ref={containerRef} />
      
      <GraphOverlay>
        {/* Loading Spinner */}
        <AnimatePresence>
          {isLoading && (
            <LoadingSpinner
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="spinner" />
            </LoadingSpinner>
          )}
        </AnimatePresence>

        {/* Graph Statistics */}
        {showStats && (
          <GraphStats
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="stat">
              <span className="icon">📊</span>
              <span className="value">{graphStats.nodes}</span>
              <span className="label">nodes</span>
            </div>
            <div className="stat">
              <span className="icon">🔗</span>
              <span className="value">{graphStats.edges}</span>
              <span className="label">connections</span>
            </div>
            <div className="stat">
              <span className="icon">🎯</span>
              <span className="value">{graphStats.density}%</span>
              <span className="label">density</span>
            </div>
          </GraphStats>
        )}

        {/* Content Type Legend */}
        {showLegend && legendData.length > 0 && (
          <GraphLegend
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="legend-title">Content Types</div>
            <div className="legend-items">
              {legendData.map(({ type, count, color }) => (
                <div key={type} className="legend-item">
                  <div className="color-dot" style={{ backgroundColor: color }} />
                  <span className="label">{type} ({count})</span>
                </div>
              ))}
            </div>
          </GraphLegend>
        )}

        {/* Node Tooltip */}
        <AnimatePresence>
          {tooltip.visible && tooltip.node && (
            <NodeTooltip
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <div className="tooltip-header">
                <div className="tooltip-title">{tooltip.node.title || tooltip.node.name}</div>
                <div className="tooltip-type">{tooltip.node.contentType}</div>
              </div>
              
              {tooltip.node.summary && (
                <div className="tooltip-summary">{tooltip.node.summary}</div>
              )}
              
              <div className="tooltip-meta">
                <span className="quality">Quality: {tooltip.node.quality}/10</span>
                <span className="connections">🔗 {tooltip.node.connections} connections</span>
                {tooltip.node.topics && tooltip.node.topics.length > 0 && (
                  <span className="topics">
                    Topics: {tooltip.node.topics.slice(0, 2).join(', ')}
                    {tooltip.node.topics.length > 2 && '...'}
                  </span>
                )}
              </div>
              
              <div className="tooltip-arrow" />
            </NodeTooltip>
          )}
        </AnimatePresence>
      </GraphOverlay>
    </GraphContainer>
  );
};

export default KnowledgeGraphViewer;