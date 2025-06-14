// src/App.js - Final complete working implementation
import React, { useState, useEffect } from 'react';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from './store/knowledgeStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useGraphAnalytics } from './hooks/useGraphAnalytics';

// Import all the components
import KnowledgeGraphViewer from './components/KnowledgeGraphViewer';
import ChatbotPanel from './components/ChatbotPanel';
import ControlPanel from './components/ControlPanel';
import NodeDetailsModal from './components/NodeDetailsModal';
import SearchOverlay from './components/SearchOverlay';
import SettingsPanel from './components/SettingsPanel';
import StatisticsPanel from './components/StatisticsPanel';
import PerformanceMonitor from './components/PerformanceMonitor';

// Enhanced theme with all necessary properties
const theme = {
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#ff6b6b',
    success: '#4ecdc4',
    warning: '#f39c12',
    error: '#e74c3c',
    bg: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
    surface: 'rgba(255, 255, 255, 0.05)',
    surfaceHover: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px'
  },
  shadows: {
    sm: '0 4px 15px rgba(0, 0, 0, 0.1)',
    md: '0 8px 32px rgba(0, 0, 0, 0.15)',
    lg: '0 16px 64px rgba(0, 0, 0, 0.2)',
  },
  animations: {
    fast: '0.15s ease',
    normal: '0.3s ease',
    slow: '0.5s ease'
  },
  fonts: {
    primary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  }
};

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  html, body {
    font-family: ${props => props.theme.fonts.primary};
    background: ${props => props.theme.colors.bg};
    color: ${props => props.theme.colors.text};
    height: 100%;
    overflow: auto; /* Allow scrolling */
  }
  
  #root {
    min-height: 100vh;
    width: 100vw;
  }

  ::-webkit-scrollbar {
    width: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
`;

const AppContainer = styled.div`
  min-height: 100vh;
  width: 100vw;
  display: grid;
  grid-template-areas: 
    "left-panel main-graph right-panel"
    "chatbot chatbot chatbot";
  grid-template-columns: 320px 1fr 320px;
  grid-template-rows: minmax(600px, 1fr) 300px; /* Fixed chatbot height */
  gap: ${props => props.theme.spacing.md};
  padding: ${props => props.theme.spacing.md};
  
  @media (max-width: 1200px) {
    grid-template-areas: 
      "main-graph"
      "left-panel"
      "right-panel"
      "chatbot";
    grid-template-columns: 1fr;
    grid-template-rows: minmax(400px, 60vh) auto auto 300px;
  }
`;

const Header = styled(motion.div)`
  position: fixed;
  top: ${props => props.theme.spacing.lg};
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: ${props => props.theme.borderRadius.xl};
  padding: ${props => props.theme.spacing.lg} ${props => props.theme.spacing.xl};
  border: 1px solid ${props => props.theme.colors.border};
  
  h1 {
    font-size: 2rem;
    margin-bottom: ${props => props.theme.spacing.sm};
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .subtitle {
    font-size: 1rem;
    opacity: 0.9;
  }
`;

const MainGraphArea = styled(motion.div)`
  grid-area: main-graph;
  background: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius.lg};
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.theme.colors.border};
  overflow: hidden;
  box-shadow: ${props => props.theme.shadows.lg};
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 600px;
`;

const SidePanel = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
  max-height: 100vh;
  overflow-y: auto;
  
  @media (max-width: 1200px) {
    max-height: none;
    overflow-y: visible;
  }
`;

const ChatbotArea = styled(motion.div)`
  grid-area: chatbot;
  background: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius.lg};
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: ${props => props.theme.shadows.md};
  overflow: hidden;
  height: 300px; /* Fixed height for chatbot */
`;

const ControlsPanel = styled(motion.div)`
  position: absolute;
  top: ${props => props.theme.spacing.lg};
  left: ${props => props.theme.spacing.lg};
  z-index: 1000;
`;

const LoadingOverlay = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: white;
  
  .loader {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: ${props => props.theme.spacing.lg};
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const EmptyGraphState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
  padding: ${props => props.theme.spacing.xl};
  
  .icon {
    font-size: 4rem;
    margin-bottom: ${props => props.theme.spacing.lg};
    opacity: 0.6;
  }
  
  .title {
    font-size: 1.5rem;
    margin-bottom: ${props => props.theme.spacing.md};
    color: ${props => props.theme.colors.text};
  }
  
  .description {
    max-width: 400px;
    line-height: 1.6;
    margin-bottom: ${props => props.theme.spacing.lg};
  }
`;

const Button = styled(motion.button)`
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: white;
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.borderRadius.md};
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const StatusBanner = styled(motion.div)`
  position: fixed;
  top: ${props => props.theme.spacing.lg};
  right: ${props => props.theme.spacing.lg};
  background: ${props => props.connected ? 
    'linear-gradient(135deg, #4ecdc4, #44a08d)' : 
    'linear-gradient(135deg, #e74c3c, #c0392b)'};
  color: white;
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.md};
  font-size: 0.9rem;
  font-weight: 600;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: ${props => props.connected ? 'pulse 2s infinite' : 'none'};
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const ErrorToast = styled(motion.div)`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  max-width: 400px;
  
  .error-title {
    font-weight: 600;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .error-message {
    font-size: 0.9rem;
    opacity: 0.9;
    line-height: 1.4;
  }
  
  .error-dismiss {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 18px;
    opacity: 0.7;
    
    &:hover {
      opacity: 1;
    }
  }
`;

const QuickActionsPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.sm};
  
  .action-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: ${props => props.theme.colors.text};
    padding: ${props => props.theme.spacing.md};
    border-radius: ${props => props.theme.borderRadius.md};
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: ${props => props.theme.spacing.sm};
    transition: all ${props => props.theme.animations.fast};
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .icon {
      font-size: 1.1rem;
    }
  }
`;

const App = () => {
  // UI State
  const [backendConnected, setBackendConnected] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [currentLayout, setCurrentLayout] = useState('fcose');
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
  
  // Store State
  const {
    graphData,
    isLoading,
    error,
    selectedNode,
    stats,
    allContent,
    trending,
    recommendations,
    refreshAllData,
    setLoading,
    setSelectedNode,
    checkBackendHealth,
    clearError,
    performSemanticSearch,
    loadStats,
    loadContent,
    loadTrending,
    loadRecommendations
  } = useKnowledgeStore();
  
  const analytics = useGraphAnalytics();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'ctrl+k',
      action: () => setShowSearchOverlay(true)
    },
    {
      keys: 'ctrl+r',
      action: (e) => {
        e.preventDefault();
        handleRefresh();
      }
    },
    {
      keys: 'ctrl+shift+p',
      action: () => setShowPerformanceMonitor(!showPerformanceMonitor)
    },
    {
      keys: 'ctrl+comma',
      action: () => setShowSettingsPanel(true)
    },
    {
      keys: 'escape',
      action: () => {
        setShowSearchOverlay(false);
        setShowSettingsPanel(false);
        setSelectedNodeDetails(null);
        setSelectedNode(null);
      }
    }
  ]);

  // Initialize app - check backend and load data
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Initializing MindCanvas App...');
      
      try {
        // Check backend health first
        const isHealthy = await checkBackendHealth();
        setBackendConnected(isHealthy);
        
        if (isHealthy) {
          console.log('✅ Backend is healthy, loading all data...');
          
          // Load all data in parallel
          await Promise.allSettled([
            refreshAllData(),
            loadStats(),
            loadContent(),
            loadTrending(),
            loadRecommendations()
          ]);
          
          console.log('✅ App initialization complete');
        } else {
          console.log('❌ Backend is not available');
        }
      } catch (error) {
        console.error('❌ App initialization failed:', error);
        setBackendConnected(false);
      }
    };

    initializeApp();
  }, [checkBackendHealth, refreshAllData, loadStats, loadContent, loadTrending, loadRecommendations]);

  // Periodic health check
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await checkBackendHealth();
        setBackendConnected(isHealthy);
      } catch (error) {
        setBackendConnected(false);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [checkBackendHealth]);

  // Auto-dismiss error messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 10000); // Auto-dismiss after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setLoading(true);
      await Promise.allSettled([
        refreshAllData(),
        loadStats(),
        loadContent(),
        loadTrending(),
        loadRecommendations()
      ]);
      console.log('🔄 Data refreshed successfully');
    } catch (error) {
      console.error('🔄 Refresh failed:', error);
    }
  };

  // Handle node selection
  const handleNodeSelect = (node) => {
    console.log('📌 Node selected:', node);
    setSelectedNode(node);
    setSelectedNodeDetails(node);
  };

  // Handle background click
  const handleBackgroundClick = () => {
    setSelectedNode(null);
    setSelectedNodeDetails(null);
  };

  // Handle layout change
  const handleLayoutChange = (layout) => {
    console.log('🎯 Layout changed to:', layout);
    setCurrentLayout(layout);
  };

  // Handle search
  const handleSearch = async (query) => {
    try {
      console.log('🔍 Performing search:', query);
      await performSemanticSearch(query, 20);
      setShowSearchOverlay(false);
    } catch (error) {
      console.error('🔍 Search failed:', error);
    }
  };

  // Handle export history (Chrome extension feature)
  const handleExportHistory = () => {
    // Check if running in extension context
    if (typeof window !== 'undefined' && window.chrome && window.chrome.runtime) {
      // Extension context
      window.chrome.runtime.sendMessage({ action: 'exportHistory' });
    } else {
      // Web context - show instruction
      alert('📱 To export your browsing history:\n\n1. Install the MindCanvas Chrome extension\n2. Click the extension icon\n3. Click "Export History"\n\nThe extension will send your data to this application.');
    }
  };

  // Handle dashboard open
  const handleOpenDashboard = () => {
    const dashboardUrl = 'http://localhost:8090/static/index.html';
    window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
  };

  // Check if we have graph data
  const hasGraphData = graphData && graphData.nodes && graphData.nodes.length > 0;

  // Prepare stats for panels
  const overviewStats = {
    totalContent: stats.total_content || 0,
    vectorEnabled: stats.vector_enabled || 0,
    avgQuality: stats.avg_quality || 0,
    clusters: stats.content_clusters || 0
  };

  const contentTypeData = stats.by_content_type || {};
  const trendingData = trending || [];
  const recommendationsData = recommendations || [];

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AppContainer>
        {/* Header */}
        <Header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>🧠 MindCanvas</h1>
          <div className="subtitle">AI-Powered Knowledge Graph</div>
        </Header>

        {/* Status Banner */}
        <StatusBanner
          connected={backendConnected}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="status-dot" />
          {backendConnected ? 'Backend Connected' : 'Backend Offline'}
        </StatusBanner>

        {/* Left Panel - Statistics */}
        <SidePanel
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ gridArea: 'left-panel' }}
        >
          <StatisticsPanel
            title="📊 Overview"
            type="overview"
            data={overviewStats}
            stats={stats}
          />
          
          <StatisticsPanel
            title="🎯 Content Types"
            type="contentTypes"
            data={contentTypeData}
          />

          {trendingData.length > 0 && (
            <StatisticsPanel
              title="🔥 Trending Topics"
              type="trending"
              trending={trendingData}
            />
          )}
        </SidePanel>

        {/* Main Graph Area */}
        <MainGraphArea
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Controls */}
          <ControlsPanel>
            <ControlPanel
              onSearch={() => setShowSearchOverlay(true)}
              onRefresh={handleRefresh}
              onLayoutChange={handleLayoutChange}
              currentLayout={currentLayout}
              isRefreshing={isLoading}
            />
          </ControlsPanel>

          {/* Graph Visualization */}
          {hasGraphData ? (
            <KnowledgeGraphViewer
              data={graphData}
              selectedNode={selectedNode}
              onNodeSelect={handleNodeSelect}
              onBackgroundClick={handleBackgroundClick}
              layout={currentLayout}
            />
          ) : (
            <EmptyGraphState>
              <div className="icon">🕸️</div>
              <div className="title">
                {backendConnected ? 'Knowledge Graph Ready' : 'Backend Offline'}
              </div>
              <div className="description">
                {backendConnected ? (
                  graphData.nodes?.length === 0 ? (
                    "Your knowledge graph is ready! Use the Chrome extension to export your browsing history and start building your personal knowledge network."
                  ) : (
                    `Displaying ${graphData.nodes?.length} knowledge nodes with ${graphData.links?.length} connections.`
                  )
                ) : (
                  "Please start the backend server to begin using MindCanvas. Check the README for setup instructions."
                )}
              </div>
              
              {backendConnected && (!graphData.nodes || graphData.nodes.length === 0) && (
                <Button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExportHistory}
                >
                  📱 Use Chrome Extension
                </Button>
              )}
            </EmptyGraphState>
          )}

          {/* Loading Overlay */}
          <AnimatePresence>
            {isLoading && (
              <LoadingOverlay
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="loader" />
                <div>Loading your knowledge graph...</div>
              </LoadingOverlay>
            )}
          </AnimatePresence>
        </MainGraphArea>

        {/* Right Panel - Analytics & Actions */}
        <SidePanel
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{ gridArea: 'right-panel' }}
        >
          <StatisticsPanel
            title="💡 Quick Actions"
            type="custom"
          >
            <QuickActionsPanel>
              <button 
                className="action-button"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <span className="icon">🔄</span>
                <span>Refresh Data</span>
              </button>
              
              <button 
                className="action-button"
                onClick={handleExportHistory}
              >
                <span className="icon">📤</span>
                <span>Export History</span>
              </button>
              
              <button 
                className="action-button"
                onClick={() => setShowSearchOverlay(true)}
              >
                <span className="icon">🔍</span>
                <span>Search Knowledge</span>
              </button>
              
              <button 
                className="action-button"
                onClick={() => setShowSettingsPanel(true)}
              >
                <span className="icon">⚙️</span>
                <span>Settings</span>
              </button>
              
              <button 
                className="action-button"
                onClick={handleOpenDashboard}
              >
                <span className="icon">🌐</span>
                <span>Open Dashboard</span>
              </button>
            </QuickActionsPanel>
          </StatisticsPanel>

          <StatisticsPanel
            title="📈 Analytics"
            type="analytics"
            data={{
              nodeCount: analytics.nodeCount,
              edgeCount: analytics.edgeCount,
              avgConnections: analytics.avgConnections,
              clusters: analytics.clusters.length
            }}
          />

          {recommendationsData.length > 0 && (
            <StatisticsPanel
              title="💡 Recommendations"
              type="recommendations"
              data={recommendationsData}
            />
          )}
        </SidePanel>

        {/* Chatbot Area */}
        <ChatbotArea
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <ChatbotPanel graphData={graphData} />
        </ChatbotArea>

        {/* Modals and Overlays */}
        <AnimatePresence>
          {showSearchOverlay && (
            <SearchOverlay
              onClose={() => setShowSearchOverlay(false)}
              onSearch={handleSearch}
              graphData={graphData}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSettingsPanel && (
            <SettingsPanel
              isOpen={showSettingsPanel}
              onClose={() => setShowSettingsPanel(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedNodeDetails && (
            <NodeDetailsModal
              node={selectedNodeDetails}
              onClose={() => {
                setSelectedNodeDetails(null);
                setSelectedNode(null);
              }}
              graphData={graphData}
            />
          )}
        </AnimatePresence>

        {/* Performance Monitor */}
        <PerformanceMonitor
          isVisible={showPerformanceMonitor}
          nodeCount={analytics.nodeCount}
          edgeCount={analytics.edgeCount}
        />

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <ErrorToast
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
            >
              <button 
                className="error-dismiss"
                onClick={clearError}
                aria-label="Dismiss error"
              >
                ×
              </button>
              <div className="error-title">
                ⚠️ Error
              </div>
              <div className="error-message">{error}</div>
            </ErrorToast>
          )}
        </AnimatePresence>
      </AppContainer>
    </ThemeProvider>
  );
};

export default App;