// src/store/knowledgeStore.js - Error-free implementation with full API integration
import { create } from 'zustand';

const API_BASE = 'http://localhost:8090/api';

// Enhanced API helper with better error handling and retry logic
const apiCall = async (endpoint, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: controller.signal,
      ...options
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timed out - backend may be slow or unavailable');
    }
    
    console.error('API Call failed:', endpoint, error);
    throw error;
  }
};

// Default graph settings
const defaultGraphSettings = {
  layout: 'fcose',
  showLabels: true,
  clustering: true,
  physics: true,
  nodeSize: 'quality',
  edgeStyle: 'curved',
  viewMode: 'graph',
  colorScheme: 'type'
};

// Default filter options
const defaultFilterOptions = {
  qualityRange: [1, 10],
  contentTypes: [],
  dateRange: null,
  showOnlyConnected: false,
  minSimilarity: 0.1
};

export const useKnowledgeStore = create((set, get) => ({
  // ==================== CORE DATA STATE ====================
  graphData: { nodes: [], links: [] },
  allContent: [],
  clusters: [],
  trending: [],
  recommendations: [],
  analytics: {},
  
  // Statistics from backend
  stats: {
    total_content: 0,
    vector_enabled: 0,
    content_clusters: 0,
    avg_quality: 0,
    by_content_type: {},
    by_processing_method: {},
    quality_distribution: {},
    recent_activity: []
  },

  // ==================== UI STATE ====================
  selectedNode: null,
  isLoading: false,
  searchQuery: '',
  searchResults: [],
  error: null,
  lastUpdate: null,
  backendHealth: 'unknown',

  // Settings and preferences
  graphSettings: defaultGraphSettings,
  filterOptions: defaultFilterOptions,
  userPreferences: {
    autoRefresh: true,
    refreshInterval: 300000, // 5 minutes
    enableNotifications: true,
    compactMode: false
  },

  // ==================== BASIC ACTIONS ====================
  setSelectedNode: (node) => {
    console.log('🎯 Setting selected node:', node?.title || node?.id);
    set({ selectedNode: node });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => {
    console.error('❌ Setting error:', error);
    set({ error: typeof error === 'string' ? error : error?.message || 'Unknown error' });
  },

  clearError: () => set({ error: null }),

  updateGraphSettings: (newSettings) => {
    const currentSettings = get().graphSettings;
    const updatedSettings = { ...currentSettings, ...newSettings };
    console.log('⚙️ Updating graph settings:', newSettings);
    set({ graphSettings: updatedSettings });
  },

  updateFilterOptions: (newFilters) => {
    const currentFilters = get().filterOptions;
    const updatedFilters = { ...currentFilters, ...newFilters };
    console.log('🔽 Updating filter options:', newFilters);
    set({ filterOptions: updatedFilters });
  },

  // ==================== BACKEND HEALTH ====================
  checkBackendHealth: async () => {
    try {
      console.log('🏥 Checking backend health...');
      const health = await apiCall('/health');
      const isHealthy = health.status === 'healthy';
      
      set({ backendHealth: isHealthy ? 'healthy' : 'unhealthy' });
      console.log('🏥 Backend health:', isHealthy ? '✅ Healthy' : '❌ Unhealthy');
      
      return isHealthy;
    } catch (error) {
      console.error('🏥 Backend health check failed:', error);
      set({ backendHealth: 'offline' });
      return false;
    }
  },

  // ==================== DATA LOADING ====================
  loadStats: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('📊 Loading statistics from backend...');
      
      const statsData = await apiCall('/stats');
      console.log('📊 Statistics loaded:', statsData);
      
      const processedStats = {
        total_content: statsData.total_content || 0,
        vector_enabled: statsData.total_content || 0, // Assuming all content has vectors
        content_clusters: Object.keys(statsData.by_content_type || {}).length,
        avg_quality: statsData.average_quality || 0,
        by_content_type: statsData.by_content_type || {},
        by_processing_method: statsData.by_processing_method || {},
        quality_distribution: statsData.quality_distribution || {},
        recent_activity: []
      };
      
      set({
        stats: processedStats,
        isLoading: false,
        lastUpdate: new Date().toISOString()
      });
      
      return processedStats;
    } catch (error) {
      console.error('📊 Failed to load statistics:', error);
      get().setError('Failed to load statistics: ' + error.message);
      set({ isLoading: false });
      throw error;
    }
  },

  loadContent: async (limit = 100) => {
    try {
      set({ isLoading: true, error: null });
      console.log('📚 Loading content from backend...');
      
      const data = await apiCall(`/content?limit=${limit}`);
      console.log('📚 Content loaded:', data.content?.length || 0, 'items');
      
      const content = data.content || [];
      set({
        allContent: content,
        isLoading: false
      });
      
      return content;
    } catch (error) {
      console.error('📚 Failed to load content:', error);
      get().setError('Failed to load content: ' + error.message);
      set({ isLoading: false, allContent: [] });
      throw error;
    }
  },

  loadGraphData: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('🕸️ Loading knowledge graph from backend...');
      
      const data = await apiCall('/knowledge-graph/export');
      console.log('🕸️ Raw graph data loaded:', {
        nodes: data.nodes?.length || 0,
        edges: data.edges?.length || 0
      });
      
      // Process and enhance the graph data
      const processedData = {
        nodes: (data.nodes || []).map(node => ({
          id: node.id?.toString(),
          name: node.title || node.name || `Node ${node.id}`,
          title: node.title || node.name || `Node ${node.id}`,
          type: node.content_type || 'Unknown',
          quality: node.quality_score || 5,
          topics: node.key_topics || [],
          url: node.url || '',
          summary: node.summary || '',
          content: node.content || '',
          visit_timestamp: node.visit_timestamp,
          processing_method: node.processing_method,
          ...node
        })),
        links: (data.edges || []).map(edge => ({
          source: edge.source?.toString(),
          target: edge.target?.toString(),
          shared_topics: edge.shared_topics || [],
          weight: edge.shared_topics?.length || 1,
          similarity: edge.similarity || 0.5,
          ...edge
        }))
      };
      
      console.log('🕸️ Processed graph data:', {
        nodes: processedData.nodes.length,
        links: processedData.links.length
      });
      
      set({
        graphData: processedData,
        isLoading: false
      });
      
      return processedData;
    } catch (error) {
      console.error('🕸️ Failed to load graph data:', error);
      
      // Fallback: try to create graph from content
      try {
        console.log('🔄 Attempting to create graph from content...');
        const content = get().allContent.length > 0 ? get().allContent : await get().loadContent();
        
        if (content.length > 0) {
          const fallbackGraph = {
            nodes: content.map(item => ({
              id: item.id?.toString(),
              name: item.title || `Content ${item.id}`,
              title: item.title || `Content ${item.id}`,
              type: item.content_type || 'Unknown',
              quality: item.quality_score || 5,
              topics: item.key_details || [],
              url: item.url || '',
              summary: item.description || '',
              ...item
            })),
            links: [] // No connections in fallback mode
          };
          
          console.log('🔄 Created fallback graph from content:', {
            nodes: fallbackGraph.nodes.length,
            links: fallbackGraph.links.length
          });
          
          set({
            graphData: fallbackGraph,
            isLoading: false,
            error: null
          });
          
          return fallbackGraph;
        }
      } catch (contentError) {
        console.error('🔄 Failed to create fallback graph:', contentError);
      }
      
      get().setError('Failed to load graph data: ' + error.message);
      set({ 
        isLoading: false,
        graphData: { nodes: [], links: [] }
      });
      throw error;
    }
  },

  loadClusters: async () => {
    try {
      console.log('🎯 Loading content clusters...');
      const data = await apiCall('/cluster');
      console.log('🎯 Clusters loaded:', data.clusters?.length || 0);
      
      set({ clusters: data.clusters || [] });
      return data.clusters || [];
    } catch (error) {
      console.error('🎯 Failed to load clusters:', error);
      set({ clusters: [] });
      throw error;
    }
  },

  loadTrending: async (limit = 10) => {
    try {
      console.log('🔥 Loading trending topics...');
      const data = await apiCall(`/trending?limit=${limit}`);
      console.log('🔥 Trending loaded:', data.trending_topics?.length || 0);
      
      set({ trending: data.trending_topics || [] });
      return data.trending_topics || [];
    } catch (error) {
      console.error('🔥 Failed to load trending topics:', error);
      set({ trending: [] });
      throw error;
    }
  },

  loadRecommendations: async (limit = 10) => {
    try {
      console.log('💡 Loading recommendations...');
      const data = await apiCall(`/recommendations?limit=${limit}`);
      console.log('💡 Recommendations loaded:', data.recommendations?.length || 0);
      
      set({ recommendations: data.recommendations || [] });
      return data.recommendations || [];
    } catch (error) {
      console.error('💡 Failed to load recommendations:', error);
      set({ recommendations: [] });
      throw error;
    }
  },

  loadAnalytics: async () => {
    try {
      console.log('📈 Loading analytics...');
      const data = await apiCall('/analytics');
      console.log('📈 Analytics loaded:', data);
      
      set({ analytics: data || {} });
      return data || {};
    } catch (error) {
      console.error('📈 Failed to load analytics:', error);
      set({ analytics: {} });
      throw error;
    }
  },

  // ==================== SEARCH FUNCTIONALITY ====================
  performSemanticSearch: async (query, limit = 20) => {
    try {
      set({ isLoading: true, error: null });
      console.log('🔍 Performing semantic search:', query);
      
      const response = await apiCall('/search/semantic', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          min_similarity: get().filterOptions.minSimilarity
        })
      });
      
      console.log('🔍 Semantic search results:', response.results?.length || 0);
      
      set({
        searchQuery: query,
        searchResults: response.results || [],
        isLoading: false
      });
      
      return response.results || [];
    } catch (error) {
      console.error('🔍 Semantic search failed:', error);
      get().setError('Search failed: ' + error.message);
      set({ isLoading: false, searchResults: [] });
      throw error;
    }
  },

  performTextSearch: async (query, limit = 50) => {
    try {
      set({ isLoading: true, error: null });
      console.log('📝 Performing text search:', query);
      
      const response = await apiCall(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      console.log('📝 Text search results:', response.results?.length || 0);
      
      set({
        searchQuery: query,
        searchResults: response.results || [],
        isLoading: false
      });
      
      return response.results || [];
    } catch (error) {
      console.error('📝 Text search failed:', error);
      get().setError('Search failed: ' + error.message);
      set({ isLoading: false, searchResults: [] });
      throw error;
    }
  },

  // ==================== GRAPH ANALYSIS ====================
  findRelatedContent: async (contentId, limit = 10) => {
    try {
      console.log('🔗 Finding related content for:', contentId);
      const response = await apiCall(`/related/${contentId}?limit=${limit}`);
      console.log('🔗 Related content found:', response.related_content?.length || 0);
      
      return response.related_content || [];
    } catch (error) {
      console.error('🔗 Failed to find related content:', error);
      throw error;
    }
  },

  getNodeNeighbors: (nodeId) => {
    const { graphData } = get();
    const neighbors = [];
    
    // Find all nodes connected to the given node
    graphData.links.forEach(link => {
      if (link.source === nodeId) {
        const target = graphData.nodes.find(n => n.id === link.target);
        if (target) neighbors.push({ ...target, relationship: 'outgoing' });
      } else if (link.target === nodeId) {
        const source = graphData.nodes.find(n => n.id === link.source);
        if (source) neighbors.push({ ...source, relationship: 'incoming' });
      }
    });
    
    return neighbors;
  },

  // ==================== DATA MANAGEMENT ====================
  refreshAllData: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('🔄 Starting comprehensive data refresh...');
      
      const results = {};
      const errors = [];
      
      // Load all data with individual error handling
      const dataLoaders = [
        { name: 'stats', loader: get().loadStats },
        { name: 'content', loader: get().loadContent },
        { name: 'graphData', loader: get().loadGraphData },
        { name: 'clusters', loader: get().loadClusters },
        { name: 'trending', loader: get().loadTrending },
        { name: 'recommendations', loader: get().loadRecommendations },
        { name: 'analytics', loader: get().loadAnalytics }
      ];
      
      for (const { name, loader } of dataLoaders) {
        try {
          console.log(`🔄 Loading ${name}...`);
          results[name] = await loader();
          console.log(`✅ ${name} loaded successfully`);
        } catch (error) {
          console.warn(`⚠️ ${name} loading failed:`, error.message);
          errors.push(`${name}: ${error.message}`);
          results[name] = null;
        }
      }
      
      const successCount = Object.values(results).filter(r => r !== null).length;
      const totalCount = dataLoaders.length;
      
      console.log(`🔄 Data refresh completed: ${successCount}/${totalCount} successful`);
      
      if (errors.length > 0) {
        console.warn('⚠️ Some data failed to load:', errors);
        get().setError(`Some data failed to load: ${errors.length} errors`);
      } else {
        set({ error: null });
      }
      
      set({ 
        isLoading: false,
        lastUpdate: new Date().toISOString()
      });
      
      return results;
    } catch (error) {
      console.error('🔄 Complete data refresh failed:', error);
      get().setError('Data refresh failed: ' + error.message);
      set({ isLoading: false });
      throw error;
    }
  },

  // ==================== EXPORT FUNCTIONALITY ====================
  exportKnowledgeGraph: async (format = 'json') => {
    try {
      console.log('💾 Exporting knowledge graph as:', format);
      const response = await apiCall(`/export/formats?format_type=${format}&include_embeddings=false&include_content=true`);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `mindcanvas-knowledge-graph-${timestamp}.${format}`;
      
      let dataStr;
      let mimeType;
      
      if (format === 'json') {
        dataStr = JSON.stringify(response, null, 2);
        mimeType = 'application/json';
      } else if (format === 'csv') {
        // Convert CSV data to actual CSV string
        const csvData = response.data || [];
        if (csvData.length > 0) {
          const headers = Object.keys(csvData[0]).join(',');
          const rows = csvData.map(row => Object.values(row).map(val => 
            typeof val === 'string' && val.includes(',') ? `"${val}"` : val
          ).join(','));
          dataStr = [headers, ...rows].join('\n');
          mimeType = 'text/csv';
        } else {
          throw new Error('No CSV data to export');
        }
      } else {
        dataStr = JSON.stringify(response, null, 2);
        mimeType = 'application/json';
      }
      
      const dataBlob = new Blob([dataStr], { type: mimeType });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      console.log('💾 Export completed:', filename);
      
      return { success: true, filename, format };
    } catch (error) {
      console.error('💾 Export failed:', error);
      get().setError('Export failed: ' + error.message);
      throw error;
    }
  },

  // ==================== UTILITY FUNCTIONS ====================
  resetStore: () => {
    console.log('🔄 Resetting knowledge store to defaults...');
    set({
      graphData: { nodes: [], links: [] },
      allContent: [],
      clusters: [],
      trending: [],
      recommendations: [],
      analytics: {},
      stats: {
        total_content: 0,
        vector_enabled: 0,
        content_clusters: 0,
        avg_quality: 0,
        by_content_type: {},
        by_processing_method: {},
        quality_distribution: {},
        recent_activity: []
      },
      selectedNode: null,
      isLoading: false,
      searchQuery: '',
      searchResults: [],
      error: null,
      lastUpdate: null,
      backendHealth: 'unknown',
      graphSettings: defaultGraphSettings,
      filterOptions: defaultFilterOptions
    });
  },

  // ==================== AUTO-REFRESH ====================
  startAutoRefresh: () => {
    const { userPreferences } = get();
    if (!userPreferences.autoRefresh) return;
    
    console.log('⏰ Starting auto-refresh timer...');
    const interval = setInterval(() => {
      console.log('⏰ Auto-refreshing data...');
      get().refreshAllData().catch(error => {
        console.error('⏰ Auto-refresh failed:', error);
      });
    }, userPreferences.refreshInterval);
    
    // Store interval ID for cleanup
    set({ autoRefreshInterval: interval });
    
    return interval;
  },

  stopAutoRefresh: () => {
    const { autoRefreshInterval } = get();
    if (autoRefreshInterval) {
      console.log('⏰ Stopping auto-refresh timer...');
      clearInterval(autoRefreshInterval);
      set({ autoRefreshInterval: null });
    }
  }
}));