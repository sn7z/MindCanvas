// src/App.js - Full working version
import React, { useState, useEffect } from 'react';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from './store/knowledgeStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useGraphAnalytics } from './hooks/useGraphAnalytics';
import PerformanceMonitor from './components/PerformanceMonitor';

// Enhanced theme
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
  }
};

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  html, body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: ${props => props.theme.colors.bg};
    color: ${props => props.theme.colors.text};
    overflow: hidden;
    height: 100%;
  }
  
  #root {
    height: 100vh;
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
  height: 100vh;
  width: 100vw;
  display: grid;
  grid-template-areas: 
    "left-panel main-graph right-panel"
    "chatbot chatbot chatbot";
  grid-template-columns: 300px 1fr 300px;
  grid-template-rows: 1fr 200px;
  gap: ${props => props.theme.spacing.md};
  padding: ${props => props.theme.spacing.md};
  
  @media (max-width: 1200px) {
    grid-template-areas: 
      "main-graph"
      "chatbot";
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 250px;
  }
`;

const Header = styled(motion.div)`
  position: absolute;
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
  align-items: center;
  justify-content: center;
`;

const SidePanel = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
  
  @media (max-width: 1200px) {
    display: none;
  }
`;

const PanelCard = styled(motion.div)`
  background: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius.lg};
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.theme.colors.border};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: ${props => props.theme.shadows.md};
  
  h3 {
    margin-bottom: ${props => props.theme.spacing.md};
    color: ${props => props.theme.colors.text};
    display: flex;
    align-items: center;
    gap: ${props => props.theme.spacing.sm};
  }
`;

const ChatbotArea = styled(motion.div)`
  grid-area: chatbot;
  background: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius.lg};
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: ${props => props.theme.shadows.md};
  padding: ${props => props.theme.spacing.lg};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ControlsPanel = styled(motion.div)`
  position: absolute;
  top: ${props => props.theme.spacing.lg};
  left: ${props => props.theme.spacing.lg};
  z-index: 1000;
  display: flex;
  gap: ${props => props.theme.spacing.sm};
`;

const ControlButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.md};
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.md};
  }
`;

const GraphVisualization = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
  
  .graph-icon {
    font-size: 4rem;
    margin-bottom: ${props => props.theme.spacing.lg};
    opacity: 0.6;
  }
  
  .graph-title {
    font-size: 1.5rem;
    margin-bottom: ${props => props.theme.spacing.md};
    color: ${props => props.theme.colors.text};
  }
  
  .graph-description {
    max-width: 400px;
    line-height: 1.6;
    margin-bottom: ${props => props.theme.spacing.lg};
  }
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  margin-bottom: ${props => props.theme.spacing.md};
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.connected ? props.theme.colors.success : props.theme.colors.error};
    animation: ${props => props.connected ? 'pulse 2s infinite' : 'none'};
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
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

const StatItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${props => props.theme.spacing.sm} 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  &:last-child {
    border-bottom: none;
  }
  
  .label {
    color: ${props => props.theme.colors.textSecondary};
  }
  
  .value {
    font-weight: 600;
    color: ${props => props.theme.colors.success};
  }
`;

const App = () => {
  const [backendConnected, setBackendConnected] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [currentView, setCurrentView] = useState('main');
  
  const {
    graphData,
    isLoading,
    refreshAllData,
    setLoading
  } = useKnowledgeStore();
  
  const analytics = useGraphAnalytics();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'ctrl+k',
      action: () => console.log('Search shortcut pressed')
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
    }
  ]);

  // Check backend on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:8090/api/health');
        setBackendConnected(response.ok);
        if (response.ok) {
          // Load initial data
          await refreshAllData();
        }
      } catch (error) {
        setBackendConnected(false);
      }
    };

    checkBackend();
  }, [refreshAllData]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshAllData();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  const handleExportHistory = () => {
    alert('Chrome extension feature - use the browser extension to export history');
  };

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

        {/* Left Panel - Statistics */}
        <SidePanel
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <PanelCard>
            <h3>📊 Overview</h3>
            <StatusIndicator connected={backendConnected}>
              <div className="status-dot" />
              <span>{backendConnected ? 'Backend Connected' : 'Backend Offline'}</span>
            </StatusIndicator>
            
            <StatItem>
              <span className="label">Total Nodes:</span>
              <span className="value">{analytics.nodeCount}</span>
            </StatItem>
            <StatItem>
              <span className="label">Total Edges:</span>
              <span className="value">{analytics.edgeCount}</span>
            </StatItem>
            <StatItem>
              <span className="label">Avg Connections:</span>
              <span className="value">{analytics.avgConnections}</span>
            </StatItem>
            <StatItem>
              <span className="label">Clusters:</span>
              <span className="value">{analytics.clusters.length}</span>
            </StatItem>
          </PanelCard>

          <PanelCard>
            <h3>🎯 Content Types</h3>
            {analytics.clusters.map((cluster, index) => (
              <StatItem key={index}>
                <span className="label">{cluster.type}:</span>
                <span className="value">{cluster.count}</span>
              </StatItem>
            ))}
            {analytics.clusters.length === 0 && (
              <div style={{ textAlign: 'center', opacity: 0.6 }}>
                No content clusters yet
              </div>
            )}
          </PanelCard>
        </SidePanel>

        {/* Main Graph Area */}
        <MainGraphArea
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ControlsPanel>
            <ControlButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? '🔄' : '↻'} Refresh
            </ControlButton>
            
            <ControlButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExportHistory}
            >
              📤 Export
            </ControlButton>
            
            <ControlButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
            >
              📊 Performance
            </ControlButton>
          </ControlsPanel>

          {/* Graph Visualization */}
          <GraphVisualization>
            <div className="graph-icon">🕸️</div>
            <div className="graph-title">Interactive Knowledge Graph</div>
            <div className="graph-description">
              {backendConnected ? (
                graphData.nodes.length > 0 ? (
                  `Displaying ${graphData.nodes.length} knowledge nodes with ${graphData.links.length} connections. Use the Chrome extension to add more content to your graph.`
                ) : (
                  "Your knowledge graph is ready! Use the Chrome extension to export your browsing history and start building your personal knowledge network."
                )
              ) : (
                "Backend server is not connected. Please start the backend server to begin using MindCanvas."
              )}
            </div>
            
            {backendConnected && graphData.nodes.length === 0 && (
              <Button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExportHistory}
              >
                📱 Use Chrome Extension
              </Button>
            )}
          </GraphVisualization>

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

        {/* Right Panel - Recommendations */}
        <SidePanel
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <PanelCard>
            <h3>💡 Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button
                whileHover={{ scale: 1.02 }}
                onClick={handleRefresh}
                disabled={isLoading}
              >
                🔄 Refresh Data
              </Button>
              <Button
                whileHover={{ scale: 1.02 }}
                onClick={handleExportHistory}
              >
                📤 Export History
              </Button>
              <Button
                whileHover={{ scale: 1.02 }}
                onClick={() => window.open('http://localhost:8090/static/index.html', '_blank')}
              >
                🌐 Open Dashboard
              </Button>
            </div>
          </PanelCard>

          <PanelCard>
            <h3>🔥 Recent Activity</h3>
            <div style={{ textAlign: 'center', opacity: 0.6, padding: '20px 0' }}>
              <div>📈</div>
              <div style={{ marginTop: '8px' }}>
                Activity will appear here as you use the system
              </div>
            </div>
          </PanelCard>
        </SidePanel>

        {/* Chatbot Area */}
        <ChatbotArea
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div style={{ textAlign: 'center', opacity: 0.8 }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🤖</div>
            <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>AI Chatbot</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
              {backendConnected ? 
                'Chat functionality will be available once you have content in your knowledge graph' :
                'Connect to backend to enable AI chat features'
              }
            </div>
          </div>
        </ChatbotArea>

        {/* Performance Monitor */}
        <PerformanceMonitor
          isVisible={showPerformanceMonitor}
          nodeCount={analytics.nodeCount}
          edgeCount={analytics.edgeCount}
        />
      </AppContainer>
    </ThemeProvider>
  );
};

export default App;