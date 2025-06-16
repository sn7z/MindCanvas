// src/components/KnowledgeGraphViewer.js - Back to the simple, working version
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
`;

const LoadingSpinner = styled(motion.div)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  color: white;
  text-align: center;
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
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
  
  .debug-info {
    background: rgba(255, 255, 255, 0.1);
    padding: 10px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 0.8rem;
    margin-top: 10px;
  }
`;

// Simple color scheme for different content types
const NODE_COLORS = {
  'Tutorial': '#ff6b6b',
  'Documentation': '#4ecdc4', 
  'Article': '#9b59b6',
  'Blog': '#f39c12',
  'Research': '#e67e22',
  'News': '#e74c3c',
  'Video': '#3498db',
  'Book': '#2ecc71',
  'Unknown': '#667eea',
  'Web Content': '#95a5a6'
};

const KnowledgeGraphViewer = ({
  data,
  selectedNode,
  onNodeSelect,
  onBackgroundClick,
  layout = 'cose',
  className,
  ...props
}) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  console.log('🎯 KnowledgeGraphViewer render:', { 
    hasData: !!data, 
    nodeCount: data?.nodes?.length || 0,
    edgeCount: data?.links?.length || 0
  });

  // Enhanced clustering with more specific keywords
  const graphData = useMemo(() => {
    console.log('🎯 Processing graph data:', data);
    
    if (!data || !data.nodes || !Array.isArray(data.nodes)) {
      console.log('❌ No valid data provided');
      return { nodes: [], edges: [] };
    }

    // More specific and comprehensive clustering keywords
    const clusterKeywords = {
      'JavaScript': ['javascript', 'js', 'node.js', 'nodejs', 'react', 'vue', 'angular', 'typescript', 'npm', 'express', 'next.js', 'webpack', 'babel'],
      'Python': ['python', 'django', 'flask', 'numpy', 'pandas', 'jupyter', 'pip', 'scipy', 'matplotlib', 'python3', 'py'],
      'AI/ML': ['ai', 'artificial intelligence', 'machine learning', 'neural', 'deep learning', 'ml', 'tensorflow', 'pytorch', 'model', 'algorithm', 'data science'],
      'Web Development': ['web dev', 'html', 'css', 'frontend', 'backend', 'api', 'http', 'rest', 'bootstrap', 'sass', 'responsive'],
      'Programming': ['programming', 'coding', 'software', 'development', 'tutorial', 'guide', 'basics', 'fundamentals'],
      'Database': ['database', 'sql', 'mongodb', 'postgres', 'mysql', 'nosql', 'query'],
      'Mobile Development': ['mobile', 'android', 'ios', 'react native', 'flutter', 'swift', 'kotlin', 'app development'],
      'DevOps': ['devops', 'docker', 'kubernetes', 'aws', 'cloud', 'deployment', 'ci/cd', 'jenkins', 'infrastructure'],
      'Data Science': ['data science', 'analytics', 'visualization', 'statistics', 'big data', 'analysis'],
      'Design': ['design', 'ui', 'ux', 'figma', 'photoshop', 'graphics', 'typography', 'sketch', 'user interface'],
      'Mathematics': ['math', 'mathematics', 'calculus', 'algebra', 'statistics', 'probability', 'geometry', 'linear algebra'],
      'Education': ['tutorial', 'course', 'learning', 'education', 'beginner', 'basics', 'fundamentals', 'guide', 'class', 'lesson'],
      'Gaming': ['game', 'gaming', 'unity', 'unreal', 'gamedev', 'game development'],
      'Security': ['security', 'cybersecurity', 'encryption', 'authentication', 'vulnerability']
    };

    // Vibrant, distinct colors for better clustering visibility
    const clusterColors = {
      'JavaScript': '#f7df1e',           // Bright yellow
      'Python': '#3776ab',              // Python blue
      'AI/ML': '#ff4757',               // Bright red
      'Web Development': '#00d2d3',     // Cyan
      'Programming': '#5f27cd',         // Purple
      'Database': '#00a085',            // Teal
      'Mobile Development': '#ff6b9d',   // Pink
      'DevOps': '#2ed573',              // Green
      'Data Science': '#a55eea',        // Light purple
      'Design': '#ff6348',              // Orange-red
      'Mathematics': '#ffa502',         // Orange
      'Education': '#3742fa',           // Blue
      'Gaming': '#2f3542',              // Dark gray
      'Security': '#ff3838',            // Red
      'General': '#667eea'              // Default
    };

    // Smarter clustering function
    const getNodeCluster = (node) => {
      const title = (node.name || node.title || '').toLowerCase();
      const topics = (node.topics || node.key_topics || []).join(' ').toLowerCase();
      const type = (node.type || node.content_type || '').toLowerCase();
      const summary = (node.summary || node.description || '').toLowerCase();
      
      // Combine all text for analysis
      const allText = `${title} ${topics} ${type} ${summary}`.toLowerCase();

      // Find the best matching cluster with priority scoring
      let bestMatch = 'General';
      let maxScore = 0;

      for (const [cluster, keywords] of Object.entries(clusterKeywords)) {
        let score = 0;
        
        // Count keyword matches with different weights
        keywords.forEach(keyword => {
          if (title.includes(keyword)) score += 3; // Title matches are most important
          else if (topics.includes(keyword)) score += 2; // Topic matches are important
          else if (allText.includes(keyword)) score += 1; // General matches
        });

        if (score > maxScore) {
          maxScore = score;
          bestMatch = cluster;
        }
      }

      return bestMatch;
    };

    // Process nodes with better clustering
    const nodes = data.nodes.map((node, index) => {
      const nodeId = node.id?.toString() || `node-${index}`;
      const label = node.title || node.name || `Node ${index + 1}`;
      const cluster = getNodeCluster(node);
      const quality = node.quality || node.quality_score || 5;
      
      // Slightly smaller nodes for better clustering view
      const nodeSize = Math.max(18, Math.min(32, quality * 2 + 12));
      
      return {
        data: {
          id: nodeId,
          label: label.length > 12 ? label.substring(0, 12) + '...' : label,
          color: clusterColors[cluster] || clusterColors.General,
          size: nodeSize,
          cluster: cluster,
          originalData: node
        }
      };
    });

    // Create edges with validation
    const edges = [];
    if (data.links && Array.isArray(data.links)) {
      data.links.forEach((link, index) => {
        const source = link.source?.toString();
        const target = link.target?.toString();
        
        if (source && target && source !== target) {
          const sourceExists = nodes.some(n => n.data.id === source);
          const targetExists = nodes.some(n => n.data.id === target);
          
          if (sourceExists && targetExists) {
            edges.push({
              data: {
                id: `edge-${index}`,
                source: source,
                target: target
              }
            });
          }
        }
      });
    }

    // Log clustering for debugging
    const clusterCounts = nodes.reduce((acc, node) => {
      const cluster = node.data.cluster;
      acc[cluster] = (acc[cluster] || 0) + 1;
      return acc;
    }, {});

    console.log('✅ Enhanced clustering results:', clusterCounts);
    return { nodes, edges };
  }, [data]);

  // Initialize Cytoscape ONLY when data changes - prevent constant refreshing
  useEffect(() => {
    if (!containerRef.current || graphData.nodes.length === 0) {
      console.log('❌ Cannot initialize: no container or no nodes');
      return;
    }

    // Prevent multiple initializations
    if (isLoading) {
      console.log('⏸️ Already loading, skipping initialization');
      return;
    }

    console.log('🎯 Initializing Cytoscape...');
    setIsLoading(true);

    // Clean up existing instance
    if (cyRef.current) {
      console.log('🧹 Cleaning up existing Cytoscape instance');
      try {
        cyRef.current.destroy();
      } catch (error) {
        console.warn('Error destroying cytoscape:', error);
      }
      cyRef.current = null;
    }

    // Single initialization with proper cleanup
    const initTimeout = setTimeout(() => {
      if (!containerRef.current) {
        setIsLoading(false);
        return;
      }

      try {
        console.log('🎯 Creating Cytoscape instance');

        const cy = cytoscape({
          container: containerRef.current,
          elements: [...graphData.nodes, ...graphData.edges],
          
          style: [
            {
              selector: 'node',
              style: {
                'background-color': 'data(color)',
                'label': 'data(label)',
                'width': 'data(size)',
                'height': 'data(size)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '8px',
                'font-weight': 'bold',
                'color': 'white',
                'text-outline-width': 1,
                'text-outline-color': '#000',
                'border-width': 1,
                'border-color': 'rgba(255,255,255,0.4)',
                'border-opacity': 0.6
              }
            },
            {
              selector: 'node:hover',
              style: {
                'border-opacity': 1,
                'border-width': 2,
                'border-color': '#fff'
              }
            },
            {
              selector: 'node:selected',
              style: {
                'border-width': 3,
                'border-color': '#fff',
                'border-opacity': 1
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 1,
                'line-color': 'rgba(255, 255, 255, 0.3)',
                'target-arrow-color': 'rgba(255, 255, 255, 0.3)',
                'target-arrow-shape': 'triangle',
                'target-arrow-size': '6px',
                'curve-style': 'bezier'
              }
            }
          ],
          
          layout: {
            name: 'cose',
            animate: false, // CRITICAL: No animation
            fit: true,
            padding: 60,
            
            // Better clustering parameters
            nodeOverlap: 12,
            idealEdgeLength: 60,
            nodeRepulsion: 10000,
            edgeElasticity: 0.15,
            nestingFactor: 0.5,
            gravity: 0.8,
            gravityRange: 2.0,
            
            numIter: 1500,
            initialTemp: 1200,
            coolingFactor: 0.95,
            minTemp: 1.0,
            randomize: false, // CRITICAL: No randomization
            
            // Force stop after completion
            stop: function() {
              console.log('🛑 Layout forced to stop');
            }
          },
          
          zoomingEnabled: true,
          userZoomingEnabled: true,
          panningEnabled: true,
          userPanningEnabled: true,
          boxSelectionEnabled: false,
          selectionType: 'single',
          
          // Disable any auto-refresh triggers
          autolock: false,
          autoungrabify: false
        });

        cyRef.current = cy;
        console.log('✅ Cytoscape created successfully');

        // Simple event listeners
        cy.on('tap', 'node', (event) => {
          const node = event.target;
          const nodeData = node.data('originalData');
          if (onNodeSelect && nodeData) {
            onNodeSelect(nodeData);
          }
        });

        cy.on('tap', (event) => {
          if (event.target === cy && onBackgroundClick) {
            onBackgroundClick();
          }
        });

        // SINGLE layout completion handler
        cy.one('layoutstop', () => {
          console.log('✅ Layout completed - STOPPING');
          setIsLoading(false);
          
          // Force stop any further layout calculations
          cy.stop();
          
          // Fit once and done
          setTimeout(() => {
            try {
              cy.fit(cy.nodes(), 50);
              console.log('✅ Graph fitted - FINAL');
            } catch (error) {
              console.warn('Error fitting:', error);
            }
          }, 50);
        });

        // Emergency stop after 3 seconds
        setTimeout(() => {
          if (cyRef.current) {
            console.log('🚨 Emergency stop - preventing infinite refresh');
            setIsLoading(false);
            cyRef.current.stop();
          }
        }, 3000);

      } catch (error) {
        console.error('❌ Error creating Cytoscape:', error);
        setIsLoading(false);
      }
    }, 150);

    // Cleanup
    return () => {
      clearTimeout(initTimeout);
      if (cyRef.current) {
        try {
          cyRef.current.destroy();
        } catch (error) {
          console.warn('Error in cleanup:', error);
        }
        cyRef.current = null;
      }
    };
  }, [graphData.nodes.length, graphData.edges.length]); // ONLY depend on data length

  // Show empty state if no data
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <GraphContainer className={className} {...props}>
        <EmptyState>
          <div className="icon">🕸️</div>
          <div className="title">No Graph Data</div>
          <div className="description">
            {!data ? 'No data provided to graph component' :
             !data.nodes ? 'Data missing nodes array' :
             'No nodes found in data'}
          </div>
          <div className="debug-info">
            Debug Info:<br/>
            {JSON.stringify({
              hasData: !!data,
              hasNodes: !!(data?.nodes),
              nodeCount: data?.nodes?.length || 0,
              hasLinks: !!(data?.links),
              linkCount: data?.links?.length || 0
            }, null, 2)}
          </div>
        </EmptyState>
      </GraphContainer>
    );
  }

  return (
    <GraphContainer className={className} {...props}>
      <GraphCanvas ref={containerRef} />
      
      {/* Loading Spinner */}
      <AnimatePresence>
        {isLoading && (
          <LoadingSpinner
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="spinner" />
            <div>Building graph...</div>
          </LoadingSpinner>
        )}
      </AnimatePresence>
    </GraphContainer>
  );
};

export default KnowledgeGraphViewer;