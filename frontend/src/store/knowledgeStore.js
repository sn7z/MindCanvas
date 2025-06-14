// src/store/knowledgeStore.js - Enhanced with real API integration
import { create } from 'zustand';

const API_BASE = 'http://localhost:8090/api';

// API helper function
const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Call failed:', error);
    throw error;
  }
};

export const useKnowledgeStore = create((set, get) => ({
  // Core Data State
  graphData: { nodes: [], links: [] },
  allContent: [],
  stats: {
    total_content: 0,
    vector_enabled: 0,
    content_clusters: 0,
    avg_quality: 0,
    by_content_type: {},
    by_processing_method: {}
  },
  
  // UI State
  selectedNode: null,
  isLoading: false,
  searchQuery: '',
  error: null,
  lastUpdate: null,
  
  // Basic Actions
  setSelectedNode: (node) => set({ selectedNode: node }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  // Load Statistics from Backend
  loadStats: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('Loading stats from backend...');
      
      const statsData = await apiCall('/stats');
      console.log('Stats loaded:', statsData);
      
      set({
        stats: {
          total_content: statsData.total_content || 0,
          vector_enabled: statsData.total_content || 0,
          content_clusters: Object.keys(statsData.by_content_type || {}).length,
          avg_quality: statsData.average_quality || 0,
          by_content_type: statsData.by_content_type || {},
          by_processing_method: statsData.by_processing_method || {}
        },
        isLoading: false,
        lastUpdate: new Date().toISOString()
      });
      
      return statsData;
    } catch (error) {
      console.error('Failed to load stats:', error);
      set({ 
        error: error.message, 
        isLoading: false,
        stats: {
          total_content: 0,
          vector_enabled: 0,
          content_clusters: 0,
          avg_quality: 0,
          by_content_type: {},
          by_processing_method: {}
        }
      });
      throw error;
    }
  },
  
  // Load Content from Backend
  loadContent: async (limit = 100) => {
    try {
      set({ isLoading: true, error: null });
      console.log('Loading content from backend...');
      
      const data = await apiCall(`/content?limit=${limit}`);
      console.log('Content loaded:', data);
      
      set({
        allContent: data.content || [],
        isLoading: false
      });
      
      return data.content || [];
    } catch (error) {
      console.error('Failed to load content:', error);
      set({ 
        error: error.message, 
        isLoading: false,
        allContent: []
      });
      throw error;
    }
  },
  
  // Load Knowledge Graph Data
  loadGraphData: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('Loading graph data from backend...');
      
      const data = await apiCall('/knowledge-graph/export');
      console.log('Graph data loaded:', data);
      
      const processedData = {
        nodes: (data.nodes || []).map(node => ({
          id: node.id,
          name: node.title || node.name || `Node ${node.id}`,
          title: node.title || node.name || `Node ${node.id}`,
          type: node.content_type || 'Unknown',
          quality: node.quality_score || 5,
          topics: node.key_topics || [],
          url: node.url || '',
          summary: node.summary || '',
          ...node
        })),
        links: (data.edges || []).map(edge => ({
          source: edge.source,
          target: edge.target,
          shared_topics: edge.shared_topics || [],
          weight: edge.shared_topics?.length || 1,
          ...edge
        }))
      };
      
      console.log('Processed graph data:', processedData);
      
      set({
        graphData: processedData,
        isLoading: false
      });
      
      return processedData;
    } catch (error) {
      console.error('Failed to load graph data:', error);
      
      // If no graph data available, try to load from content
      try {
        console.log('Attempting to create graph from content...');
        const content = await get().loadContent();
        
        if (content.length > 0) {
          const graphFromContent = {
            nodes: content.map(item => ({
              id: item.id,
              name: item.title || `Content ${item.id}`,
              title: item.title || `Content ${item.id}`,
              type: item.content_type || 'Unknown',
              quality: item.quality_score || 5,
              topics: item.key_details || [],
              url: item.url || '',
              summary: item.description || ''
            })),
            links: [] // Simple version without links for now
          };
          
          console.log('Created graph from content:', graphFromContent);
          
          set({
            graphData: graphFromContent,
            isLoading: false,
            error: null
          });
          
          return graphFromContent;
        }
      } catch (contentError) {
        console.error('Failed to create graph from content:', contentError);
      }
      
      set({ 
        error: error.message, 
        isLoading: false,
        graphData: { nodes: [], links: [] }
      });
      throw error;
    }
  },
  
  // Check Backend Health
  checkBackendHealth: async () => {
    try {
      console.log('Checking backend health...');
      const health = await apiCall('/health');
      console.log('Backend health:', health);
      return health.status === 'healthy';
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  },
  
  // Perform Search
  performSemanticSearch: async (query, limit = 20) => {
    try {
      set({ isLoading: true, error: null });
      console.log('Performing semantic search:', query);
      
      const response = await apiCall('/search/semantic', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          min_similarity: 0.1
        })
      });
      
      console.log('Search results:', response);
      
      set({
        searchQuery: query,
        isLoading: false
      });
      
      return response.results || [];
    } catch (error) {
      console.error('Search failed:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Bulk Data Refresh
  refreshAllData: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('Refreshing all data...');
      
      // Load data in sequence with error handling
      const results = {};
      
      try {
        results.stats = await get().loadStats();
      } catch (error) {
        console.warn('Stats loading failed:', error);
        results.stats = null;
      }
      
      try {
        results.content = await get().loadContent();
      } catch (error) {
        console.warn('Content loading failed:', error);
        results.content = [];
      }
      
      try {
        results.graphData = await get().loadGraphData();
      } catch (error) {
        console.warn('Graph data loading failed:', error);
        results.graphData = { nodes: [], links: [] };
      }
      
      console.log('All data refresh completed:', results);
      
      set({ 
        isLoading: false,
        lastUpdate: new Date().toISOString()
      });
      
      return results;
    } catch (error) {
      console.error('Failed to refresh all data:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Get Analytics
  getAnalytics: async () => {
    try {
      console.log('Loading analytics...');
      const analytics = await apiCall('/analytics');
      console.log('Analytics loaded:', analytics);
      return analytics;
    } catch (error) {
      console.error('Failed to load analytics:', error);
      throw error;
    }
  },
  
  // Export Knowledge Graph
  exportKnowledgeGraph: async () => {
    try {
      console.log('Exporting knowledge graph...');
      const graphData = await apiCall('/knowledge-graph/export?format_type=json');
      const dataStr = JSON.stringify(graphData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `mindcanvas-knowledge-graph-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      console.log('Export completed');
    } catch (error) {
      console.error('Export failed:', error);
      set({ error: error.message });
      throw error;
    }
  }
}));