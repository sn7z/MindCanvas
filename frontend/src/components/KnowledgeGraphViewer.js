// src/components/KnowledgeGraphViewer.js
import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import cytoscape from 'cytoscape';

const GraphContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: ${props => props.theme.borderRadius.lg};
  overflow: hidden;
`;

const GraphCanvas = styled.div`
  width: 100%;
  height: 100%;
  cursor: grab;
  
  &:active {
    cursor: grabbing;
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
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  max-width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 100;
  pointer-events: none;
  
  .title {
    font-weight: 600;
    margin-bottom: 4px;
    color: #ff6b6b;
  }
  
  .summary {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.4;
    margin-bottom: 8px;
  }
  
  .meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    
    .type {
      background: #667eea;
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    .quality {
      background: #4ecdc4;
      padding: 2px 6px;
      border-radius: 4px;
    }
  }
`;

const GraphStats = styled(motion.div)`
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  gap: 12px;
  
  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    
    .value {
      font-weight: 600;
      color: white;
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
  }
`;

const KnowledgeGraphViewer = ({
  data,
  selectedNode,
  onNodeSelect,
  onBackgroundClick
}) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, node: null });

  // Graph style configuration
  const getGraphStyle = () => [
    {
      selector: 'node',
      style: {
        'width': 'data(size)',
        'height': 'data(size)',
        'background-color': 'data(color)',
        'border-width': 2,
        'border-color': '#ffffff',
        'border-opacity': 0.8,
        'label': 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 8,
        'font-size': '12px',
        'font-weight': '600',
        'color': '#ffffff',
        'text-outline-width': 2,
        'text-outline-color': '#000000',
        'text-outline-opacity': 0.7,
        'text-max-width': '120px',
        'text-wrap': 'wrap',
        'overlay-opacity': 0
      }
    },
    {
      selector: 'node:hover',
      style: {
        'background-color': '#ff6b6b',
        'border-color': '#ff6b6b',
        'border-width': 3,
        'width': 'calc(data(size) * 1.2)',
        'height': 'calc(data(size) * 1.2)',
        'z-index': 10
      }
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': '#4ecdc4',
        'border-color': '#4ecdc4',
        'border-width': 4,
        'z-index': 20
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 'data(weight)',
        'line-color': 'rgba(255, 255, 255, 0.3)',
        'target-arrow-color': 'rgba(255, 255, 255, 0.3)',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier'
      }
    },
    {
      selector: 'edge:hover',
      style: {
        'line-color': 'rgba(255, 255, 255, 0.6)',
        'target-arrow-color': 'rgba(255, 255, 255, 0.6)',
        'width': 'calc(data(weight) * 2)'
      }
    }
  ];

  // Process graph data
  const processGraphData = (rawData) => {
    if (!rawData?.nodes) {
      return { nodes: [], edges: [] };
    }

    // Process nodes
    const nodes = rawData.nodes.map(node => {
      const contentType = node.type || 'Unknown';
      const size = Math.max(30, Math.min(80, (node.quality || 5) * 8));
      
      // Color mapping
      const colorMap = {
        'Tutorial': '#ff6b6b',
        'Documentation': '#4ecdc4',
        'Article': '#9b59b6',
        'Blog': '#f39c12',
        'Research': '#e67e22',
        'News': '#e74c3c',
        'Unknown': '#667eea'
      };
      
      return {
        data: {
          id: node.id.toString(),
          label: node.name || node.title || `Node ${node.id}`,
          size: size,
          color: colorMap[contentType] || colorMap.Unknown,
          contentType: contentType,
          quality: node.quality || 5,
          url: node.url || '',
          summary: node.summary || '',
          topics: node.topics || [],
          originalData: node
        }
      };
    });

    // Process edges
    const edges = (rawData.links || []).map((link, index) => {
      const weight = Math.max(2, Math.min(6, (link.weight || 1) * 2));
      
      return {
        data: {
          id: `edge-${index}`,
          source: link.source.toString(),
          target: link.target.toString(),
          weight: weight,
          sharedTopics: link.shared_topics || [],
          originalData: link
        }
      };
    });

    return { nodes, edges };
  };

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || !data) return;

    const processedData = processGraphData(data);
    
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    // Only create graph if we have nodes
    if (processedData.nodes.length === 0) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...processedData.nodes, ...processedData.edges],
      style: getGraphStyle(),
      layout: {
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0
      },
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 3
    });

    cyRef.current = cy;

    // Event handlers
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeData = node.data('originalData');
      if (onNodeSelect) {
        onNodeSelect(nodeData);
      }
    });

    cy.on('tap', (event) => {
      if (event.target === cy && onBackgroundClick) {
        onBackgroundClick();
      }
    });

    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      const renderedPosition = node.renderedPosition();
      
      setTooltip({
        visible: true,
        x: renderedPosition.x,
        y: renderedPosition.y - 80,
        node: node.data()
      });
    });

    cy.on('mouseout', 'node', () => {
      setTooltip({ visible: false, x: 0, y: 0, node: null });
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [data, onNodeSelect, onBackgroundClick]);

  // Handle selected node highlighting
  useEffect(() => {
    if (!cyRef.current || !selectedNode) return;

    const cy = cyRef.current;
    const nodeElement = cy.getElementById(selectedNode.id?.toString());
    
    if (nodeElement.length > 0) {
      cy.elements().removeClass('highlighted');
      nodeElement.addClass('highlighted');
      cy.center(nodeElement);
    }
  }, [selectedNode]);

  // Show empty state if no data
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <EmptyState>
        <div className="icon">🕸️</div>
        <div className="title">No Knowledge Graph Data</div>
        <div className="description">
          Use the Chrome extension to export your browsing history, or check that your backend server is running and has processed content.
        </div>
      </EmptyState>
    );
  }

  return (
    <GraphContainer>
      <GraphCanvas ref={containerRef} />
      
      <GraphOverlay>
        <GraphStats
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="stat">
            <span>📊</span>
            <span className="value">{data.nodes?.length || 0}</span>
            <span>nodes</span>
          </div>
          <div className="stat">
            <span>🔗</span>
            <span className="value">{data.links?.length || 0}</span>
            <span>connections</span>
          </div>
        </GraphStats>

        {tooltip.visible && tooltip.node && (
          <NodeTooltip
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="title">{tooltip.node.label}</div>
            {tooltip.node.summary && (
              <div className="summary">{tooltip.node.summary.substring(0, 150)}...</div>
            )}
            <div className="meta">
              <span className="type">{tooltip.node.contentType}</span>
              <span className="quality">Quality: {tooltip.node.quality}/10</span>
            </div>
          </NodeTooltip>
        )}
      </GraphOverlay>
    </GraphContainer>
  );
};

export default KnowledgeGraphViewer;