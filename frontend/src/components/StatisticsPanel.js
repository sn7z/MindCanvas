// src/components/StatisticsPanel.js - Fixed chart rendering and layout
import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';

// Fixed styling for proper container width and overflow handling
const PanelContainer = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: ${props => props.theme.borderRadius.lg};
  border: 1px solid ${props => props.theme.colors.border};
  overflow: hidden;
  box-shadow: ${props => props.theme.shadows.md};
  height: fit-content;
  min-height: 300px;
  width: 100%; /* Ensure full width */
  max-width: 100%; /* Prevent overflow */
`;

const PanelHeader = styled.div`
  padding: ${props => props.theme.spacing.lg};
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%; /* Ensure full width */
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: ${props => props.theme.colors.text};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  .icon {
    font-size: 1.2rem;
  }
`;

const PanelActions = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
`;

const ActionButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.sm};
  cursor: pointer;
  font-size: 0.8rem;
  transition: all ${props => props.theme.animations.fast};
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
`;

const PanelContent = styled.div`
  padding: ${props => props.theme.spacing.lg};
  height: 100%;
  min-height: 200px;
  width: 100%; /* Ensure full width */
`;

const StatCard = styled(motion.div)`
  background: linear-gradient(135deg, ${props => props.color || props.theme.colors.primary}, ${props => props.colorSecondary || props.theme.colors.secondary});
  border-radius: ${props => props.theme.borderRadius.md};
  padding: ${props => props.theme.spacing.lg};
  color: white;
  margin-bottom: ${props => props.theme.spacing.md};
  box-shadow: ${props => props.theme.shadows.sm};
  position: relative;
  overflow: hidden;
  width: 100%; /* Ensure full width */
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 100px;
    height: 100px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    transform: rotate(45deg);
  }
  
  .stat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${props => props.theme.spacing.sm};
    
    .icon {
      font-size: 1.5rem;
      opacity: 0.8;
    }
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: ${props => props.theme.spacing.xs};
    position: relative;
    z-index: 1;
  }
  
  .stat-label {
    font-size: 0.9rem;
    opacity: 0.9;
    position: relative;
    z-index: 1;
  }
  
  .stat-change {
    font-size: 0.8rem;
    margin-top: ${props => props.theme.spacing.xs};
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
    z-index: 1;
    
    &.positive { color: #4ade80; }
    &.negative { color: #f87171; }
    &.neutral { color: rgba(255, 255, 255, 0.7); }
  }
`;

// Fixed chart container with proper dimensions
const ChartContainer = styled.div`
  height: 250px;
  margin: ${props => props.theme.spacing.md} 0;
  width: 100%; /* Ensure full width */
  position: relative; /* For positioning */
  
  .recharts-text {
    fill: ${props => props.theme.colors.text};
    font-size: 12px;
  }
  
  .recharts-cartesian-axis-tick-value {
    fill: ${props => props.theme.colors.textSecondary};
  }
  
  .recharts-legend-text {
    color: ${props => props.theme.colors.text} !important;
  }
  
  /* Fix for chart dimensions */
  .recharts-wrapper {
    width: 100% !important;
    height: 100% !important;
  }
  
  .recharts-surface {
    overflow: visible;
  }
`;

const TrendingList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.sm};
  max-height: 300px;
  overflow-y: auto;
  width: 100%; /* Ensure full width */
`;

const TrendingItem = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${props => props.theme.borderRadius.sm};
  padding: ${props => props.theme.spacing.md};
  border-left: 3px solid ${props => props.color || props.theme.colors.accent};
  transition: all ${props => props.theme.animations.fast};
  width: 100%; /* Ensure full width */
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(4px);
  }
  
  .trending-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${props => props.theme.spacing.xs};
  }
  
  .trending-title {
    font-weight: 600;
    color: ${props => props.theme.colors.text};
    font-size: 0.9rem;
  }
  
  .trending-value {
    background: ${props => props.color || props.theme.colors.accent};
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  
  .trending-meta {
    font-size: 0.8rem;
    color: ${props => props.theme.colors.textSecondary};
    display: flex;
    gap: ${props => props.theme.spacing.sm};
  }
`;

const RecommendationCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${props => props.theme.borderRadius.md};
  padding: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.md};
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all ${props => props.theme.animations.fast};
  width: 100%; /* Ensure full width */
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  .recommendation-title {
    font-weight: 600;
    color: ${props => props.theme.colors.text};
    margin-bottom: ${props => props.theme.spacing.xs};
    font-size: 0.9rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .recommendation-summary {
    font-size: 0.8rem;
    color: ${props => props.theme.colors.textSecondary};
    line-height: 1.4;
    margin-bottom: ${props => props.theme.spacing.sm};
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .recommendation-meta {
    display: flex;
    gap: ${props => props.theme.spacing.sm};
    align-items: center;
    justify-content: space-between;
    
    .type-badge {
      background: ${props => props.theme.colors.primary};
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
    }
    
    .quality-score {
      font-size: 0.8rem;
      color: ${props => props.theme.colors.success};
      font-weight: 600;
    }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${props => props.theme.colors.textSecondary};
  text-align: center;
  width: 100%; /* Ensure full width */
  
  .empty-icon {
    font-size: 3rem;
    margin-bottom: ${props => props.theme.spacing.md};
    opacity: 0.5;
  }
  
  .empty-text {
    font-size: 0.9rem;
    line-height: 1.4;
  }
`;

// Color schemes for different chart types
const CHART_COLORS = ['#667eea', '#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#e67e22', '#e74c3c', '#2ecc71'];

const StatisticsPanel = ({ title, type, data, stats, trending, className, ...props }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Custom tooltip component for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '8px 12px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '6px',
          color: 'white',
          fontSize: '0.8rem'
        }}>
          {label && <p style={{ margin: 0, marginBottom: '4px', fontWeight: 600 }}>{label}</p>}
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: 0, color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Process data for chart rendering
  const processedData = useMemo(() => {
    if (!data) return null;
  
    switch (type) {
      case 'overview':
        return {
          totalContent: stats?.total_content || 0,
          vectorEnabled: stats?.vector_enabled || 0,
          avgQuality: stats?.average_quality || 0,
          clusters: stats?.content_clusters || 0,
        };
  
      case 'contentTypes':
        if (!data || typeof data !== 'object') return [];
        const entries = Object.entries(data);
        if (entries.length === 0) return [];
        
        // Format data for pie chart
        return entries.map(([type, count], index) => ({
          name: type,
          value: count,
          color: CHART_COLORS[index % CHART_COLORS.length]
        }));
  
      case 'qualityChart':
        if (!data || typeof data !== 'object') return [];
        return Object.entries(data).map(([quality, count]) => ({
          quality: `${quality}/10`,
          count: count
        }));
  
      case 'graphAnalytics': // Changed from 'analytics'
        if (!data || typeof data !== 'object') return { nodeCount: 0, edgeCount: 0, avgConnections: '0.0' };
        const nodeCount = data.nodeCount || 0;
        const edgeCount = data.edgeCount || 0;
        return {
          nodeCount: nodeCount,
          edgeCount: edgeCount,
          avgConnections: nodeCount > 0 ? (edgeCount / nodeCount).toFixed(1) : '0.0'
        };
  
      case 'recommendations':
        return Array.isArray(data) ? data.slice(0, 5) : [];
  
      default:
        return data;
    }
  }, [data, stats, type]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderContent = () => {
    switch (type) {
      case 'overview':
        return (
          <>
            <StatCard
              color="#667eea"
              colorSecondary="#764ba2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="stat-header">
                <span className="icon">📚</span>
              </div>
              <div className="stat-value">{processedData?.totalContent || 0}</div>
              <div className="stat-label">Total Content Items</div>
              <div className="stat-change positive">↗ Knowledge Base</div>
            </StatCard>
  
            <StatCard
              color="#4ecdc4"
              colorSecondary="#44a08d"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="stat-header">
                <span className="icon">🧠</span>
              </div>
              <div className="stat-value">{processedData?.vectorEnabled || 0}</div>
              <div className="stat-label">Vector Embeddings</div>
              <div className="stat-change positive">↗ AI Ready</div>
            </StatCard>
  
            <StatCard
              color="#ff6b6b"
              colorSecondary="#ee5a52"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="stat-header">
                <span className="icon">⭐</span>
              </div>
              <div className="stat-value">{processedData?.avgQuality?.toFixed(1) || '0.0'}</div>
              <div className="stat-label">Average Quality</div>
              <div className="stat-change positive">↗ High Quality</div>
            </StatCard>
          </>
        );
  
      case 'contentTypes':
        // Ensure we have valid data for the pie chart
        if (!processedData || processedData.length === 0) {
          return (
            <EmptyState>
              <div className="empty-icon">📊</div>
              <div className="empty-text">Loading content type data...</div>
            </EmptyState>
          );
        }
        
        // Fixed chart rendering with proper dimensions and responsive container
        return (
          <ChartContainer>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <Pie
                  data={processedData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {processedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        );
  
      case 'analytics':
      case 'graphAnalytics': // Changed from 'analytics'
        if (!processedData) {
          return (
            <EmptyState>
              <div className="empty-icon">📈</div>
              <div className="empty-text">Loading analytics data...</div>
            </EmptyState>
          );
        }
        
        return (
          <>
            <StatCard
              color="#9b59b6"
              colorSecondary="#8e44ad"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="stat-header">
                <span className="icon">🔗</span>
              </div>
              <div className="stat-value">{processedData.nodeCount || 0}</div>
              <div className="stat-label">Graph Nodes</div>
              <div className="stat-change neutral">Network Size</div>
            </StatCard>
  
            <StatCard
              color="#f39c12"
              colorSecondary="#e67e22"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="stat-header">
                <span className="icon">🌐</span>
              </div>
              <div className="stat-value">{processedData.edgeCount || 0}</div>
              <div className="stat-label">Connections</div>
              <div className="stat-change neutral">Relationships</div>
            </StatCard>
  
            <StatCard
              color="#e74c3c"
              colorSecondary="#c0392b"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="stat-header">
                <span className="icon">📊</span>
              </div>
              <div className="stat-value">{processedData.avgConnections || '0.0'}</div>
              <div className="stat-label">Avg Connections</div>
              <div className="stat-change neutral">Per Node</div>
            </StatCard>
          </>
        );
  
      case 'recommendations':
        if (!processedData || processedData.length === 0) {
          return (
            <EmptyState>
              <div className="empty-icon">💡</div>
              <div className="empty-text">No recommendations available.<br />Add more content to get personalized suggestions.</div>
            </EmptyState>
          );
        }
        
        return (
          <div>
            {processedData.map((item, index) => (
              <RecommendationCard
                key={item.id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => item.url && window.open(item.url, '_blank')}
                style={{ cursor: item.url ? 'pointer' : 'default' }}
              >
                <div className="recommendation-title">{item.title}</div>
                <div className="recommendation-summary">{item.summary || item.description}</div>
                <div className="recommendation-meta">
                  <span className="type-badge">{item.content_type}</span>
                  <span className="quality-score">Quality: {item.quality_score}/10</span>
                </div>
              </RecommendationCard>
            ))}
          </div>
        );
  
      case 'trending':
      default:
        if (trending && trending.length > 0) {
          return (
            <TrendingList>
              {trending.map((item, index) => (
                <TrendingItem
                  key={item.topic || index}
                  color={CHART_COLORS[index % CHART_COLORS.length]}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="trending-header">
                    <span className="trending-title">{item.topic}</span>
                    <span className="trending-value">{item.count}</span>
                  </div>
                  <div className="trending-meta">
                    <span>Quality: {item.average_quality}/10</span>
                    <span>Trending: 🔥</span>
                  </div>
                </TrendingItem>
              ))}
            </TrendingList>
          );
        }
        
        return (
          <EmptyState>
            <div className="empty-icon">🔥</div>
            <div className="empty-text">Loading trending topics...</div>
          </EmptyState>
        );
    }
  };

  return (
    <PanelContainer
      className={className}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      <PanelHeader>
        <PanelTitle>
          <span className="icon">
            {type === 'overview' && '📊'}
            {type === 'contentTypes' && '🎯'}
            {type === 'graphAnalytics' && '📈'}
            {type === 'qualityChart' && '📈'}
            {type === 'recommendations' && '💡'}
            {!['overview', 'contentTypes', 'graphAnalytics', 'qualityChart', 'recommendations'].includes(type) && '🔥'}
          </span>
          {title}
        </PanelTitle>
        <PanelActions>
          <ActionButton
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '−' : '+'}
          </ActionButton>
          <ActionButton
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? '⟳' : '↻'}
          </ActionButton>
        </PanelActions>
      </PanelHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ width: '100%' }} /* Ensure full width */
          >
            <PanelContent>
              {renderContent()}
            </PanelContent>
          </motion.div>
        )}
      </AnimatePresence>
    </PanelContainer>
  );
};

export default StatisticsPanel;