// src/App.js - Fixed layout with proper chatbot integration
import React, { useState, useEffect, useMemo } from 'react';
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
    height: 100%; /* Ensure html and body can take full height */
    font-family: ${props => props.theme.fonts.primary};
    background: ${props => props.theme.colors.bg};
    color: ${props => props.theme.colors.text};
    /* Removed overflow: hidden; to allow scrolling */
    overflow-x: hidden; /* Prevent horizontal scroll on body */
  }
  
  #root {
    min-height: 100vh; /* Ensure root takes at least full viewport height */
    width: 100vw;
    /* Removed overflow: hidden; */
    display: flex; /* Allows AppContainer to grow and fill height */
    flex-direction: column;
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
    "left-panel main-graph right-panel";
  grid-template-columns: 360px 1fr 360px; /* Increased side panel width */
  grid-template-rows: 1fr;
  gap: ${props => props.theme.spacing.md};
  padding: ${props => props.theme.spacing.md};
  flex-grow: 1; /* Allows AppContainer to fill #root if #root is flex */
  
  @media (max-width: 1400px) {
    grid-template-columns: 320px 1fr 320px; /* Adjusted for medium screens */
  }
  
  @media (max-width: 1200px) {
    grid-template-areas: 
      "main-graph"
      "left-panel" 
      "right-panel";
    grid-template-columns: 1fr;
    grid-template-rows: 40vh auto auto; /* Reduced graph area height */
    overflow-y: auto; /* Allow scrolling on mobile */
  }
`;

const MainGraphArea = styled(motion.div)`
  grid-area: main-graph;
  background: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius.lg};
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.theme.colors.border};
  /* Changed overflow: hidden to auto to allow internal scrolling if graph is too large, or for zoom */
  overflow: auto; 
  box-shadow: ${props => props.theme.shadows.lg};
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 600px;
  
  @media (max-width: 1200px) {
    min-height: 35vh; /* Adjusted to match grid-template-rows change */
    height: 40vh; /* Adjusted to match grid-template-rows change */
  }
`;

const SidePanel = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: ${props => props.theme.spacing.xs}; /* Space for scrollbar */
  
  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  @media (max-width: 1200px) {
    height: auto;
    max-height: 70vh;
    overflow-y: auto;
  }
`;

const ChatbotArea = styled(motion.div)`
  grid-area: chatbot;
  border-radius: ${props => props.theme.borderRadius.lg};
  overflow: hidden; /* Keep overflow hidden for the ChatbotPanel's internal scroll */
  height: 550px; /* Increased height */
  min-height: 550px; /* Increased min-height */
  max-height: 550px;
  width: 100%;
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

const PanelHeaderTitle = styled(motion.div)`
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: ${props => props.theme.borderRadius.lg};
  padding: ${props => props.theme.spacing.lg};
  border: 1px solid ${props => props.theme.colors.border};
  margin-bottom: ${props => props.theme.spacing.md};
  margin-top: ${props => props.theme.spacing.xxl}; /* Pushes the title down */
  
  h1 {
    font-size: 1.8rem; /* Adjusted size for panel */
    margin-bottom: ${props => props.theme.spacing.xs};
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .subtitle {
    font-size: 0.9rem; /* Adjusted size for panel */
    opacity: 0.8;
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
            title=" Overview"
            type="overview"
            data={overviewStats}
            stats={stats}
          />

          <StatisticsPanel
            title=" Content Types"
            type="contentTypes"
            data={contentTypeData}
          />

          {trendingData.length > 0 && (
            <StatisticsPanel
              title="📁 Categories"
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
          {/* Moved Title Header to Right Panel */}
          <PanelHeaderTitle
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <h1>🧠 MindCanvas</h1>
            <div className="subtitle">AI-Powered Knowledge Graph</div>
          </PanelHeaderTitle>
          {recommendationsData.length > 0 && (
            <StatisticsPanel
              title=" Recommendations"
              type="recommendations"
              data={recommendationsData}
            />
          )}
          <ChatbotArea
            initial={{ y: 50, opacity: 0 }} /* Adjusted animation for panel context */
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <ChatbotPanel graphData={graphData} />
          </ChatbotArea>
        </SidePanel>

        {/* Chatbot Area - Fixed positioning */}
        {/* <ChatbotArea
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <ChatbotPanel graphData={graphData} />
        </ChatbotArea> */}

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