// src/components/KnowledgeGraphViewer.js - Fixed clustering and improved appearance
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
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 100;
  pointer-events: none;
  
  .tooltip-title {
    font-weight: 600;
    margin-bottom: 4px;
    color: #ff6b6b;
    font-size: 13px;
    line-height: 1.2;
  }
  
  .tooltip-type {
    background: #667eea;
    color: white;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    display: inline-block;
    margin-bottom: 6px;
  }
  
  .tooltip-summary {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.3;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .tooltip-meta {
    display: flex;
    gap: 8px;
    font-size: 10px;
    align-items: center;
    flex-wrap: wrap;
    
    .quality {
      background: #4ecdc4;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    
    .connections {
      color: rgba(255, 255, 255, 0.7);
    }
  }
`;

const GraphStats = styled(motion.div)`
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(15px);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  gap: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: auto;
  
  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    
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
  top: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(15px);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: auto;
  max-width: 180px;
  
  .legend-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: white;
    font-size: 12px;
  }
  
  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    
    .color-dot {
      width: 8px;
      height: 8px;
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
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Simplified color scheme for better visual organization
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

// Improved layout configs with better visual spacing
const LAYOUT_CONFIGS = {
  fcose: {
    name: 'fcose',
    animate: false,
    fit: true,
    padding: 80,
    nodeDimensionsIncludeLabels: true,
    uniformNodeDimensions: false,
    packComponents: true,
    nodeRepulsion: 6000,         // Increased for better spacing
    idealEdgeLength: 80,         // Shorter edges for tighter clusters
    edgeElasticity: 0.3,         // Less elastic for more organized layout
    nestingFactor: 0.1,
    gravity: 0.4,                // Stronger gravity to pull nodes together
    numIter: 2000,               // Fewer iterations for faster rendering
    tile: true,
    tilingPaddingVertical: 15,
    tilingPaddingHorizontal: 15,
    gravityRangeCompound: 1.2,
    gravityCompound: 0.8,
    gravityRange: 2.5,
    quality: 'default'
  },
  
  cola: {
    name: 'cola',
    animate: false,
    fit: true,
    padding: 60,
    avoidOverlap: true,
    handleDisconnected: true,
    convergenceThreshold: 0.01,
    nodeSpacing: 40,             // Tighter spacing
    flow: null,
    alignment: null,
    gapInequalities: undefined,
    centerGraph: true
  },
  
  dagre: {
    name: 'dagre',
    animate: false,
    fit: true,
    padding: 60,
    directed: true,
    rankDir: 'TB',               // Top to bottom
    ranker: 'longest-path',      // Better for knowledge graphs
    nodeSep: 40,                 // Horizontal spacing between nodes
    edgeSep: 15,                 // Spacing between edges
    rankSep: 80,                 // Vertical spacing between ranks
    marginx: 20,
    marginy: 20
  },
  
  circle: {
    name: 'circle',
    animate: false,
    fit: true,
    padding: 60,
    avoidOverlap: true,
    nodeDimensionsIncludeLabels: false,
    spacing: 30,                 // Tighter circular spacing
    radius: undefined,
    startAngle: 0,               // Start from top
    sweep: 2 * Math.PI,         // Full circle
    clockwise: true,
    sort: (a, b) => {           // Sort by quality
      const qualityA = a.data('quality') || 0;
      const qualityB = b.data('quality') || 0;
      return qualityB - qualityA;
    }
  },
  
  grid: {
    name: 'grid',
    animate: false,
    fit: true,
    padding: 60,
    avoidOverlap: true,
    avoidOverlapPadding: 8,
    nodeDimensionsIncludeLabels: false,
    spacingFactor: 1.2,          // Tighter grid
    condense: true,              // More compact grid
    rows: undefined,
    cols: undefined,
    sort: (a, b) => {           // Sort by content type then quality
      const typeA = a.data('contentType') || '';
      const typeB = b.data('contentType') || '';
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      const qualityA = a.data('quality') || 0;
      const qualityB = b.data('quality') || 0;
      return qualityB - qualityA;
    }
  },
  // New: Clustered layout for better organization
  clustered: {
    name: 'fcose',
    animate: false,
    fit: true,
    padding: 80,
    nodeDimensionsIncludeLabels: true,
    uniformNodeDimensions: false,
    packComponents: true,
    nodeRepulsion: 8000,         // High repulsion for distinct clusters
    idealEdgeLength: 60,
    edgeElasticity: 0.2,
    nestingFactor: 0.05,         // Less nesting for cleaner clusters  
    gravity: 0.6,                // Strong gravity for tight clusters
    numIter: 3000,
    tile: true,
    tilingPaddingVertical: 25,
    tilingPaddingHorizontal: 25,
    gravityRangeCompound: 1.5,
    gravityCompound: 1.2,
    gravityRange: 3.0,
    quality: 'proof',            // Higher quality rendering
    // Custom node positioning based on content type
    nodeRepulsion: (node) => {
      const contentType = node.data('contentType');
      // Give different types different repulsion forces
      const typeMultipliers = {
        'Tutorial': 1.2,
        'Documentation': 1.0,
        'Article': 0.8,
        'Blog': 0.6,
        'Research': 1.4
      };
      return 8000 * (typeMultipliers[contentType] || 1.0);
    }
  },
  
  // New: Concentric layout for hierarchical display
  concentric: {
    name: 'concentric',
    animate: false,
    fit: true,
    padding: 80,
    avoidOverlap: true,
    nodeDimensionsIncludeLabels: false,
    spacingFactor: 1.5,
    equidistant: false,
    minNodeSpacing: 30,
    concentric: (node) => {
      // Place higher quality nodes in inner circles
      return node.data('quality') || 1;
    },
    levelWidth: (nodes) => {
      // Distribute nodes evenly across levels
      return Math.max(1, Math.floor(nodes.length / 3));
    },
    clockwise: true,
    startAngle: -Math.PI / 2    // Start from top
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
  const initializingRef = useRef(false);
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

  // Safe state setter
  const safeSetState = useCallback((setter) => {
    if (isMountedRef.current) {
      try {
        setter();
      } catch (error) {
        console.warn('Safe setState error:', error);
      }
    }
  }, []);

  // IMPROVED CLUSTERING LOGIC - Much simpler and cleaner
  const processedData = useMemo(() => {
    if (!data?.nodes || !Array.isArray(data.nodes)) {
      return { nodes: [], edges: [] };
    }

    // Simple cluster positioning based on content type
    const clusters = {};
    const clusterCenters = {};
    
    // Group nodes by content type
    data.nodes.forEach(node => {
      const type = node.type || node.content_type || 'Unknown';
      if (!clusters[type]) {
        clusters[type] = [];
      }
      clusters[type].push(node);
    });

    // Calculate cluster centers in a more organized way
    const clusterTypes = Object.keys(clusters);
    const numClusters = clusterTypes.length;
    
    // Use a simple grid layout for cluster centers
    const gridSize = Math.ceil(Math.sqrt(numClusters));
    const spacing = 200;
    
    clusterTypes.forEach((type, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      clusterCenters[type] = {
        x: (col - gridSize / 2) * spacing,
        y: (row - gridSize / 2) * spacing
      };
    });

    // Process nodes with simplified sizing and positioning
    const nodes = data.nodes.map((node, index) => {
      const contentType = node.type || node.content_type || 'Unknown';
      const quality = node.quality || node.quality_score || 5;
      const nodeId = node.id?.toString() || `node-${index}`;
      
      // Calculate smaller, more reasonable node size
      const baseSize = Math.max(20, Math.min(45, quality * 4 + 10));
      
      return {
        data: {
          id: nodeId,
          label: (node.name || node.title || `Node ${nodeId}`).substring(0, 25), // Shorter labels
          size: baseSize,
          color: CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS.Unknown,
          borderColor: selectedNode?.id?.toString() === nodeId ? '#fff' : 'rgba(255,255,255,0.3)',
          borderWidth: selectedNode?.id?.toString() === nodeId ? 3 : 1.5,
          
          // Store original data
          originalNode: node,
          contentType: contentType,
          quality: quality,
          summary: node.summary || node.description || '',
          topics: node.topics || node.key_topics || [],
          url: node.url || '',
          visit_timestamp: node.visit_timestamp
        }
      };
    });

    // Process edges with smaller arrows and better styling
    const validEdges = [];
    if (data.links && Array.isArray(data.links)) {
      data.links.forEach((link, index) => {
        const sourceId = link.source?.toString();
        const targetId = link.target?.toString();
        
        if (sourceId && targetId && 
            nodes.some(n => n.data.id === sourceId) &&
            nodes.some(n => n.data.id === targetId) &&
            sourceId !== targetId) {
          
          const weight = Math.max(1, Math.min(3, (link.weight || 1) * 1.2)); // Smaller edge weights
          const similarity = link.similarity || 0.5;
          
          validEdges.push({
            data: {
              id: `edge-${index}`,
              source: sourceId,
              target: targetId,
              weight: weight,
              opacity: Math.max(0.4, similarity),
              sharedTopics: link.shared_topics || [],
              similarity: similarity
            }
          });
        }
      });
    }

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

  // IMPROVED GRAPH STYLING with smaller arrows and better proportions
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
        'text-margin-y': 6,
        'font-size': '9px', // Smaller font
        'font-weight': '600',
        'color': '#ffffff',
        'text-outline-width': 1.5,
        'text-outline-color': '#000000',
        'text-outline-opacity': 0.8,
        'text-max-width': '80px', // Smaller text width
        'text-wrap': 'wrap',
        'overlay-opacity': 0,
        'opacity': 1
      }
    },
    {
      selector: 'node:hover',
      style: {
        'background-color': '#ff6b6b',
        'border-color': '#ffffff',
        'border-width': 2.5,
        'z-index': 10,
        'opacity': 1
      }
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': '#4ecdc4',
        'border-color': '#ffffff',
        'border-width': 3,
        'z-index': 20,
        'opacity': 1
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 'data(weight)',
        'line-color': 'rgba(255, 255, 255, 0.3)',
        'line-opacity': 'data(opacity)',
        'target-arrow-color': 'rgba(255, 255, 255, 0.3)',
        'target-arrow-shape': 'triangle',
        'target-arrow-size': '4px', // Much smaller arrows
        'curve-style': 'bezier',
        'control-point-step-size': 40,
        'overlay-opacity': 0,
        'source-endpoint': 'outside-to-node',
        'target-endpoint': 'outside-to-node'
      }
    },
    {
      selector: 'edge:hover',
      style: {
        'line-color': 'rgba(255, 255, 255, 0.6)',
        'target-arrow-color': 'rgba(255, 255, 255, 0.6)',
        'width': 2.5,
        'target-arrow-size': '5px', // Slightly larger on hover
        'z-index': 5
      }
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#4ecdc4',
        'target-arrow-color': '#4ecdc4',
        'width': 3,
        'target-arrow-size': '6px',
        'z-index': 15
      }
    }
  ], []);

  // Complete Cytoscape cleanup
  const cleanupCytoscape = useCallback(() => {
    if (cyRef.current) {
      try {
        const cy = cyRef.current;
        cy.removeAllListeners();
        cy.stop();
        cy.destroy();
      } catch (error) {
        console.warn('Error during Cytoscape cleanup:', error);
      } finally {
        cyRef.current = null;
      }
    }
  }, []);

  // Initialize Cytoscape with improved settings
  const initializeCytoscape = useCallback(() => {
    if (!containerRef.current || !isMountedRef.current || processedData.nodes.length === 0 || initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    cleanupCytoscape();
    safeSetState(() => setIsLoading(true));

    setTimeout(() => {
      if (!isMountedRef.current || !containerRef.current) {
        initializingRef.current = false;
        return;
      }

      try {
        const cy = cytoscape({
          container: containerRef.current,
          elements: [...processedData.nodes, ...processedData.edges],
          style: getGraphStyle(),
          layout: LAYOUT_CONFIGS[layout] || LAYOUT_CONFIGS.fcose,
          
          // Optimized settings for better performance and appearance
          wheelSensitivity: 0.3,
          minZoom: 0.2,
          maxZoom: 2.5,
          zoomingEnabled: true,
          userZoomingEnabled: true,
          panningEnabled: true,
          userPanningEnabled: true,
          boxSelectionEnabled: false,
          selectionType: 'single',
          autoungrabify: false,
          autounselectify: false,
          
          // Better rendering settings
          pixelRatio: 'auto',
          motionBlur: false,
          textureOnViewport: false,
          hideEdgesOnViewport: false,
          hideLabelsOnViewport: false,
          renderer: {
            name: 'canvas'
          }
        });

        if (!isMountedRef.current) {
          cy.destroy();
          initializingRef.current = false;
          return;
        }

        cyRef.current = cy;

        // Event handlers
        cy.on('tap', 'node', (event) => {
          if (!isMountedRef.current || !cyRef.current) return;
          
          try {
            const node = event.target;
            if (!node || !node.data) return;
            
            const nodeData = node.data('originalNode');
            
            if (cyRef.current) {
              cyRef.current.elements().removeClass('highlighted');
              const connectedEdges = node.connectedEdges();
              if (connectedEdges && connectedEdges.addClass) {
                connectedEdges.addClass('highlighted');
              }
            }
            
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
              if (cyRef.current) {
                cyRef.current.elements().removeClass('highlighted');
              }
              if (onBackgroundClick) {
                onBackgroundClick();
              }
            }
          } catch (error) {
            console.warn('Error in background tap handler:', error);
          }
        });

        cy.on('mouseover', 'node', (event) => {
          if (!isMountedRef.current || !cyRef.current) return;
          
          try {
            const node = event.target;
            if (!node || !node.data || !node.renderedPosition) return;
            
            const nodeData = node.data('originalNode');
            const renderedPosition = node.renderedPosition();
            
            if (renderedPosition && typeof renderedPosition.x === 'number' && typeof renderedPosition.y === 'number') {
              safeSetState(() => {
                setTooltip({
                  visible: true,
                  x: renderedPosition.x,
                  y: renderedPosition.y - 80, // Closer to node
                  node: {
                    ...nodeData,
                    contentType: node.data('contentType'),
                    quality: node.data('quality')
                  }
                });
              });
            }
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

        cy.one('layoutstop', () => {
          if (isMountedRef.current) {
            safeSetState(() => setIsLoading(false));
            initializingRef.current = false;
            console.log('🎯 Graph layout completed');
          }
        });

        setTimeout(() => {
          if (isMountedRef.current) {
            safeSetState(() => setIsLoading(false));
            initializingRef.current = false;
          }
        }, 3000);

      } catch (error) {
        console.error('Error initializing Cytoscape:', error);
        safeSetState(() => setIsLoading(false));
        initializingRef.current = false;
      }
    }, 200);
  }, [processedData, layout, getGraphStyle, onNodeSelect, onBackgroundClick, cleanupCytoscape, safeSetState]);

  // Initialize graph when data changes
  useEffect(() => {
    if (processedData.nodes.length > 0) {
      initializeCytoscape();
    }
  }, [processedData.nodes.length]);

  // Handle layout changes safely
  useEffect(() => {
    if (!cyRef.current || processedData.nodes.length === 0 || !isMountedRef.current || initializingRef.current) return;

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
      
      setTimeout(() => {
        if (isMountedRef.current) {
          safeSetState(() => setIsLoading(false));
        }
      }, 2000);
      
    } catch (error) {
      console.warn('Error applying layout:', error);
      safeSetState(() => setIsLoading(false));
    }
  }, [layout, safeSetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      initializingRef.current = false;
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
      .slice(0, 5) // Show only top 5 types
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
              <span>📊</span>
              <span className="value">{graphStats.nodes}</span>
              <span className="label">nodes</span>
            </div>
            <div className="stat">
              <span>🔗</span>
              <span className="value">{graphStats.edges}</span>
              <span className="label">connections</span>
            </div>
            <div className="stat">
              <span>🎯</span>
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
              transition={{ duration: 0.15 }}
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <div className="tooltip-title">{tooltip.node.title || tooltip.node.name}</div>
              <div className="tooltip-type">{tooltip.node.contentType}</div>
              
              {tooltip.node.summary && (
                <div className="tooltip-summary">{tooltip.node.summary}</div>
              )}
              
              <div className="tooltip-meta">
                <span className="quality">Q: {tooltip.node.quality}/10</span>
                {tooltip.node.topics && tooltip.node.topics.length > 0 && (
                  <span className="connections">
                    {tooltip.node.topics.slice(0, 2).join(', ')}
                    {tooltip.node.topics.length > 2 && '...'}
                  </span>
                )}
              </div>
            </NodeTooltip>
          )}
        </AnimatePresence>
      </GraphOverlay>
    </GraphContainer>
  );
};

export default KnowledgeGraphViewer;