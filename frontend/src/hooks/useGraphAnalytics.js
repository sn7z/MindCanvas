// src/hooks/useGraphAnalytics.js
import { useMemo } from 'react';
import { useKnowledgeStore } from '../store/knowledgeStore';

export const useGraphAnalytics = () => {
  const { graphData } = useKnowledgeStore();
  
  const analytics = useMemo(() => {
    if (!graphData?.nodes || !graphData?.links) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        avgConnections: 0,
        mostConnectedNode: null,
        clusters: [],
        centralityScores: {},
        componentAnalysis: {}
      };
    }
    
    const nodes = graphData.nodes;
    const links = graphData.links;
    
    // Calculate degree centrality
    const degreeMap = {};
    nodes.forEach(node => {
      degreeMap[node.id] = 0;
    });
    
    links.forEach(link => {
      degreeMap[link.source] = (degreeMap[link.source] || 0) + 1;
      degreeMap[link.target] = (degreeMap[link.target] || 0) + 1;
    });
    
    // Find most connected node
    const mostConnectedNode = nodes.reduce((max, node) => {
      return (degreeMap[node.id] || 0) > (degreeMap[max?.id] || 0) ? node : max;
    }, null);
    
    // Calculate average connections
    const totalConnections = Object.values(degreeMap).reduce((sum, count) => sum + count, 0);
    const avgConnections = nodes.length > 0 ? totalConnections / nodes.length : 0;
    
    // Simple clustering by content type
    const clusters = nodes.reduce((acc, node) => {
      const type = node.type || 'Unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push(node);
      return acc;
    }, {});
    
    return {
      nodeCount: nodes.length,
      edgeCount: links.length,
      avgConnections: Math.round(avgConnections * 100) / 100,
      mostConnectedNode,
      clusters: Object.entries(clusters).map(([type, nodeList]) => ({
        type,
        count: nodeList.length,
        nodes: nodeList
      })),
      centralityScores: degreeMap,
      componentAnalysis: {
        totalComponents: 1,
        largestComponent: nodes.length,
        isolatedNodes: 0
      }
    };
  }, [graphData]);
  
  return analytics;
};