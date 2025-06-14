import React, { useState, useEffect } from 'react';
import './App.css';
import KnowledgeGraph from './KnowledgeGraph';

const API_BASE = 'http://localhost:8090/api';

const App = () => {
  // State management
  const [stats, setStats] = useState({
    total_content: 0,
    vector_enabled: 0,
    content_clusters: 0,
    avg_quality: 0
  });
  
  const [allContent, setAllContent] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  
  const [currentTab, setCurrentTab] = useState('content');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('semantic');
  const [statusMessage, setStatusMessage] = useState('Ready to explore your knowledge...');
  const [statusType, setStatusType] = useState('info');
  const [isLoading, setIsLoading] = useState(false);

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
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Call failed:', error);
      showStatus(`Error: ${error.message}`, 'error');
      throw error;
    }
  };

  // Show status messages
  const showStatus = (message, type = 'info') => {
    setStatusMessage(message);
    setStatusType(type);
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const statsData = await apiCall('/stats');
      const updatedStats = {
        total_content: statsData.total_content || 0,
        vector_enabled: statsData.total_content || 0,
        content_clusters: Object.keys(statsData.by_content_type || {}).length,
        avg_quality: statsData.average_quality || 0
      };
      setStats(updatedStats);
      showStatus(`✅ Stats loaded - Database: ${statsData.database || 'Supabase'}`, 'success');
    } catch (error) {
      console.error('Failed to load stats:', error);
      showStatus('Failed to load statistics', 'error');
    }
  };

  // Load content
  const loadContent = async () => {
    try {
      setIsLoading(true);
      showStatus('Loading content...', 'info');
      const data = await apiCall('/content?limit=100');
      const content = data.content || [];
      setAllContent(content);

      if (content.length === 0) {
        showStatus('No content available. Use Chrome extension to export history first.', 'info');
      } else {
        showStatus(`✅ Loaded ${content.length} content items with vector embeddings`, 'success');
      }
    } catch (error) {
      showStatus('Failed to load content', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load trending topics
  const loadTrending = async () => {
    try {
      const response = await apiCall('/trending?days=7&limit=15');
      setTrending(response.trending_topics || []);
    } catch (error) {
      console.error('Failed to load trending topics:', error);
    }
  };

  // Load recommendations
  const loadRecommendations = async () => {
    try {
      const response = await apiCall('/recommendations?limit=10');
      setRecommendations(response.recommendations || []);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  // Load knowledge graph data
  const loadGraphData = async () => {
    try {
      const data = await apiCall('/knowledge-graph/export');
      const nodes = (data.nodes || []).map(node => ({
        id: node.id,
        name: node.title,
        type: node.content_type,
        quality: node.quality_score,
        topics: node.key_topics || [],
        url: node.url
      }));
      
      const links = (data.edges || []).map(edge => ({
        source: edge.source,
        target: edge.target,
        shared_topics: edge.shared_topics || []
      }));
      
      setGraphData({ nodes, links });
    } catch (error) {
      console.error('Failed to load graph data:', error);
      // Create demo data if API fails
      setGraphData({
        nodes: [
          { id: 1, name: 'React Tutorials', type: 'Tutorial', quality: 8 },
          { id: 2, name: 'JavaScript Guide', type: 'Documentation', quality: 9 },
          { id: 3, name: 'AI Research', type: 'Article', quality: 7 }
        ],
        links: [
          { source: 1, target: 2 },
          { source: 2, target: 3 }
        ]
      });
    }
  };

  // Perform search
  const performSearch = async () => {
    if (!searchQuery.trim()) {
      showStatus('Please enter a search query', 'error');
      return;
    }

    try {
      setIsLoading(true);
      showStatus(`🔍 Searching for "${searchQuery}"...`, 'info');

      let results;
      if (searchType === 'semantic') {
        const response = await apiCall('/search/semantic', {
          method: 'POST',
          body: JSON.stringify({
            query: searchQuery,
            limit: 20,
            min_similarity: 0.1
          })
        });
        results = response.results || [];
      } else {
        const response = await apiCall(`/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
        results = response.results || [];
      }

      setSearchResults(results);
      showStatus(`Found ${results.length} results for "${searchQuery}"`, 'success');
    } catch (error) {
      showStatus(`Search failed: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Cluster content
  const clusterContent = async () => {
    try {
      setIsLoading(true);
      showStatus('🎯 Clustering content by similarity...', 'info');

      const response = await apiCall('/cluster', {
        method: 'POST',
        body: JSON.stringify({
          min_cluster_size: 3
        })
      });

      const clustersData = response.clusters || [];
      setClusters(clustersData);
      showStatus(`✅ Generated ${clustersData.length} content clusters`, 'success');
      setCurrentTab('clusters');
    } catch (error) {
      showStatus(`Clustering failed: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Show analytics
  const showAnalytics = async () => {
    try {
      setIsLoading(true);
      showStatus('📊 Loading analytics...', 'info');

      const analytics = await apiCall('/analytics?days=30');
      showStatus('✅ Analytics loaded', 'success');

      alert(`Learning Analytics (Last 30 days):
                
📚 Content Stats:
- Total Processed: ${analytics.content_stats?.total_processed || 0}
- Average Quality: ${analytics.content_stats?.average_quality || 0}

🔍 Search Patterns:
- Total Searches: ${analytics.search_patterns?.total_searches || 0}
- Unique Queries: ${analytics.search_patterns?.unique_queries || 0}

📊 Learning Velocity:
- Content per Day: ${analytics.learning_velocity?.content_per_day || 0}
- Learning Streak: ${analytics.learning_velocity?.learning_streak || 0} days

🎯 Knowledge Graph:
- Total Relationships: ${analytics.knowledge_graph_stats?.total_relationships || 0}
- Average Strength: ${analytics.knowledge_graph_stats?.average_strength || 0}`);
    } catch (error) {
      showStatus(`Analytics failed: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Export data
  const exportData = async () => {
    try {
      setIsLoading(true);
      showStatus('💾 Exporting knowledge graph...', 'info');

      const graphData = await apiCall('/knowledge-graph/export?format_type=json');
      const dataStr = JSON.stringify(graphData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `mindcanvas-knowledge-graph-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      URL.revokeObjectURL(url);
      showStatus('✅ Knowledge graph exported successfully', 'success');
    } catch (error) {
      showStatus(`Export failed: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setIsLoading(true);
    await Promise.all([
      loadStats(),
      loadContent(),
      loadTrending(),
      loadRecommendations(),
      loadGraphData()
    ]);
    setIsLoading(false);
  };

  // Handle search on Enter key
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  // Tab switching
  const showTab = (tabName) => {
    setCurrentTab(tabName);
  };

  // Content item component
  const ContentItem = ({ item, showSimilarity = false }) => (
    <div className="content-item">
      <div className="content-title">{item.title || 'No Title'}</div>
      <div className="content-description">
        {item.description || item.summary || 'No description available'}
      </div>
      <div className="content-meta">
        <span className="content-type">{item.content_type || 'Unknown'}</span>
        <span className="quality-score">Quality: {item.quality_score || 'N/A'}</span>
        {showSimilarity && item.similarity && (
          <span className="similarity-score">
            Similarity: {(item.similarity * 100).toFixed(1)}%
          </span>
        )}
        <span className="content-keywords">
          Keywords: {(item.key_details || item.key_topics || []).join(', ') || 'None'}
        </span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto' }}>
          🔗 Open
        </a>
      </div>
    </div>
  );

  // Initial load
  useEffect(() => {
    refreshData();
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <h1>🧠 MindCanvas</h1>
        <div className="subtitle">AI-Powered Knowledge Graph Platform</div>
        <div className="features">
          <span className="feature-tag">🔍 Vector Search</span>
          <span className="feature-tag">🎯 Smart Clustering</span>
          <span className="feature-tag">📊 Learning Analytics</span>
          <span className="feature-tag">🤖 Dual LLM Processing</span>
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button 
          className="btn btn-primary" 
          onClick={refreshData}
          disabled={isLoading}
        >
          🔄 Refresh Data
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={clusterContent}
          disabled={isLoading}
        >
          🎯 Cluster Content
        </button>
        <button 
          className="btn btn-accent" 
          onClick={showAnalytics}
          disabled={isLoading}
        >
          📊 Analytics
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={exportData}
          disabled={isLoading}
        >
          💾 Export Data
        </button>
      </div>

      {/* Stats Panel */}
      <div className="stats-panel">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total_content}</div>
            <div className="stat-label">Total Content</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.vector_enabled}</div>
            <div className="stat-label">Vector Enabled</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.content_clusters}</div>
            <div className="stat-label">Content Clusters</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.avg_quality}</div>
            <div className="stat-label">Avg Quality</div>
          </div>
        </div>

        <div className={`status-message ${statusType}`}>
          {statusMessage}
        </div>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <h3>🔍 Intelligent Search</h3>
        <div className="search-container">
          <input
            type="text"
            className="search-box"
            placeholder="Search your knowledge (e.g., 'machine learning tutorials')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleSearchKeyPress}
          />
          <select
            className="search-type"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
          >
            <option value="semantic">🧠 Semantic Search</option>
            <option value="text">📝 Text Search</option>
          </select>
          <button 
            className="btn btn-primary" 
            onClick={performSearch}
            disabled={isLoading}
          >
            Search
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="search-results">
            <h4>Search Results ({searchResults.length}) - {searchType === 'semantic' ? '🧠 Semantic' : '📝 Text'}</h4>
            <div className="content-list">
              {searchResults.map((item, index) => (
                <ContentItem key={index} item={item} showSimilarity={searchType === 'semantic'} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content Panel */}
      <div className="content-panel">
        <div className="content-tabs">
          <button 
            className={`tab ${currentTab === 'content' ? 'active' : ''}`}
            onClick={() => showTab('content')}
          >
            📚 Content
          </button>
          <button 
            className={`tab ${currentTab === 'clusters' ? 'active' : ''}`}
            onClick={() => showTab('clusters')}
          >
            🎯 Clusters
          </button>
          <button 
            className={`tab ${currentTab === 'trending' ? 'active' : ''}`}
            onClick={() => showTab('trending')}
          >
            🔥 Trending
          </button>
          <button 
            className={`tab ${currentTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => showTab('recommendations')}
          >
            💡 Recommendations
          </button>
          <button 
            className={`tab ${currentTab === 'graph' ? 'active' : ''}`}
            onClick={() => showTab('graph')}
          >
            🌐 Knowledge Graph
          </button>
        </div>

        {/* Content Tab */}
        {currentTab === 'content' && (
          <div className="tab-content">
            <div className="content-list">
              {isLoading ? (
                <div className="loading">Loading content...</div>
              ) : allContent.length === 0 ? (
                <div className="loading">No content available. Use the Chrome extension to export history first.</div>
              ) : (
                allContent.map((item, index) => (
                  <ContentItem key={index} item={item} />
                ))
              )}
            </div>
          </div>
        )}

        {/* Clusters Tab */}
        {currentTab === 'clusters' && (
          <div className="tab-content">
            <div className="clusters-list">
              {clusters.length === 0 ? (
                <div className="loading">Click "Cluster Content" to generate content clusters.</div>
              ) : (
                clusters.map((cluster, index) => (
                  <div key={index} className="cluster-item">
                    <div className="cluster-name">{cluster.name}</div>
                    <div className="cluster-stats">
                      📊 {cluster.content_count} items | 
                      🎯 Cluster ID: {cluster.id} |
                      📈 Generated by vector similarity
                    </div>
                    <div>{cluster.description || 'Content cluster based on semantic similarity'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Trending Tab */}
        {currentTab === 'trending' && (
          <div className="tab-content">
            <div className="trending-list">
              {trending.length === 0 ? (
                <div className="loading">No trending topics yet. Add more content to see trends.</div>
              ) : (
                <>
                  <h4>🔥 Trending Topics (Last 7 days)</h4>
                  <div style={{ marginTop: '15px' }}>
                    {trending.map((topic, index) => (
                      <span key={index} className="trending-topic">
                        {topic.topic} ({topic.count})
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#666' }}>
                    Topics ranked by frequency and content quality
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {currentTab === 'recommendations' && (
          <div className="tab-content">
            <div className="recommendations-list">
              {recommendations.length === 0 ? (
                <div className="loading">No recommendations yet. Add more content to get personalized suggestions.</div>
              ) : (
                <>
                  <h4>💡 Recommended for You</h4>
                  {recommendations.map((item, index) => (
                    <ContentItem key={index} item={item} />
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Knowledge Graph Tab */}
        {currentTab === 'graph' && (
          <div className="tab-content">
            <div className="graph-container">
              <h4>🌐 Interactive Knowledge Graph</h4>
              <KnowledgeGraph data={graphData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;