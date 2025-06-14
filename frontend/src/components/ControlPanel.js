// src/components/ControlPanel.js
import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from '../store/knowledgeStore';

const ControlContainer = styled(motion.div)`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  align-items: center;
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
  transition: all ${props => props.theme.animations.fast};
  position: relative;
  min-width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  &.active {
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-color: #667eea;
  }
`;

const DropdownContainer = styled(motion.div)`
  position: relative;
`;

const DropdownButton = styled(ControlButton)`
  padding-right: ${props => props.theme.spacing.lg};
  
  &::after {
    content: '▼';
    position: absolute;
    right: ${props => props.theme.spacing.sm};
    font-size: 0.8rem;
    transition: transform ${props => props.theme.animations.fast};
  }
  
  &.open::after {
    transform: rotate(180deg);
  }
`;

const DropdownMenu = styled(motion.div)`
  position: absolute;
  top: calc(100% + ${props => props.theme.spacing.sm});
  left: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.md};
  box-shadow: ${props => props.theme.shadows.lg};
  overflow: hidden;
  z-index: 1000;
  min-width: 200px;
`;

const DropdownItem = styled.div`
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  font-size: 0.9rem;
  transition: all ${props => props.theme.animations.fast};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  &.active {
    background: linear-gradient(135deg, #667eea, #764ba2);
  }
  
  .icon {
    font-size: 1.1rem;
    width: 20px;
  }
  
  .description {
    font-size: 0.8rem;
    color: ${props => props.theme.colors.textSecondary};
    margin-top: 2px;
  }
`;

const DropdownSection = styled.div`
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  &:last-child {
    border-bottom: none;
  }
`;

const DropdownHeader = styled.div`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.lg};
  font-size: 0.8rem;
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.05);
`;

const Tooltip = styled(motion.div)`
  position: absolute;
  bottom: calc(100% + ${props => props.theme.spacing.sm});
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.sm};
  font-size: 0.8rem;
  white-space: nowrap;
  box-shadow: ${props => props.theme.shadows.md};
  z-index: 1001;
  pointer-events: none;
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }
`;

const KeyboardShortcut = styled.span`
  font-size: 0.7rem;
  color: ${props => props.theme.colors.textSecondary};
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  margin-left: auto;
`;

const ControlPanel = ({ 
  onSearch, 
  onRefresh, 
  onLayoutChange, 
  currentLayout, 
  isRefreshing 
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  
  const { 
    graphSettings, 
    updateGraphSettings, 
    refreshAllData,
    exportKnowledgeGraph,
    filterOptions,
    updateFilterOptions
  } = useKnowledgeStore();

  const layoutOptions = [
    {
      id: 'fcose',
      name: 'Force-Directed',
      icon: '🌐',
      description: 'Physics-based layout with clustering'
    },
    {
      id: 'cola',
      name: 'Constraint-Based',
      icon: '🎯',
      description: 'Organized layout with constraints'
    },
    {
      id: 'dagre',
      name: 'Hierarchical',
      icon: '🌳',
      description: 'Tree-like hierarchical structure'
    },
    {
      id: 'elk',
      name: 'Layered',
      icon: '📊',
      description: 'Layered directed graph'
    },
    {
      id: 'circle',
      name: 'Circular',
      icon: '⭕',
      description: 'Nodes arranged in a circle'
    },
    {
      id: 'grid',
      name: 'Grid',
      icon: '⬜',
      description: 'Regular grid arrangement'
    }
  ];

  const viewOptions = [
    {
      id: 'graph',
      name: 'Graph View',
      icon: '🕸️',
      description: 'Interactive node-link diagram'
    },
    {
      id: 'cluster',
      name: 'Cluster View',
      icon: '🎯',
      description: 'Grouped by content clusters'
    },
    {
      id: 'timeline',
      name: 'Timeline View',
      icon: '📅',
      description: 'Chronological arrangement'
    }
  ];

  const filterOptions_config = [
    {
      id: 'quality',
      name: 'High Quality Only',
      icon: '⭐',
      active: filterOptions.qualityRange[0] > 7,
      action: () => updateFilterOptions({
        qualityRange: filterOptions.qualityRange[0] > 7 ? [1, 10] : [8, 10]
      })
    },
    {
      id: 'connected',
      name: 'Connected Nodes',
      icon: '🔗',
      active: filterOptions.showOnlyConnected,
      action: () => updateFilterOptions({
        showOnlyConnected: !filterOptions.showOnlyConnected
      })
    },
    {
      id: 'recent',
      name: 'Recent Content',
      icon: '🕒',
      active: filterOptions.dateRange !== null,
      action: () => updateFilterOptions({
        dateRange: filterOptions.dateRange ? null : 'week'
      })
    }
  ];

  const handleLayoutSelect = (layoutId) => {
    onLayoutChange(layoutId);
    updateGraphSettings({ layout: layoutId });
    setShowLayoutMenu(false);
  };

  const handleViewSelect = (viewId) => {
    updateGraphSettings({ viewMode: viewId });
    setShowViewMenu(false);
  };

  const handleRefresh = async () => {
    try {
      await refreshAllData();
      onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  const handleExport = async () => {
    try {
      await exportKnowledgeGraph();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const toggleGraphSetting = (setting) => {
    updateGraphSettings({
      [setting]: !graphSettings[setting]
    });
  };

  return (
    <ControlContainer>
      {/* Search Button */}
      <ControlButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onSearch}
        onMouseEnter={() => setHoveredButton('search')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        🔍
        <AnimatePresence>
          {hoveredButton === 'search' && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Search Knowledge <KeyboardShortcut>⌘K</KeyboardShortcut>
            </Tooltip>
          )}
        </AnimatePresence>
      </ControlButton>

      {/* Layout Selector */}
      <DropdownContainer>
        <DropdownButton
          className={showLayoutMenu ? 'open' : ''}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowLayoutMenu(!showLayoutMenu)}
          onMouseEnter={() => setHoveredButton('layout')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          🌐
        </DropdownButton>
        
        <AnimatePresence>
          {hoveredButton === 'layout' && !showLayoutMenu && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Change Layout
            </Tooltip>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showLayoutMenu && (
            <DropdownMenu
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <DropdownHeader>Layout Algorithms</DropdownHeader>
              {layoutOptions.map((layout) => (
                <DropdownItem
                  key={layout.id}
                  className={currentLayout === layout.id ? 'active' : ''}
                  onClick={() => handleLayoutSelect(layout.id)}
                >
                  <span className="icon">{layout.icon}</span>
                  <div>
                    <div>{layout.name}</div>
                    <div className="description">{layout.description}</div>
                  </div>
                </DropdownItem>
              ))}
            </DropdownMenu>
          )}
        </AnimatePresence>
      </DropdownContainer>

      {/* View Mode Selector */}
      <DropdownContainer>
        <DropdownButton
          className={showViewMenu ? 'open' : ''}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowViewMenu(!showViewMenu)}
          onMouseEnter={() => setHoveredButton('view')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          👁️
        </DropdownButton>

        <AnimatePresence>
          {hoveredButton === 'view' && !showViewMenu && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Change View Mode
            </Tooltip>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showViewMenu && (
            <DropdownMenu
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
            >
              <DropdownHeader>View Modes</DropdownHeader>
              {viewOptions.map((view) => (
                <DropdownItem
                  key={view.id}
                  className={graphSettings.viewMode === view.id ? 'active' : ''}
                  onClick={() => handleViewSelect(view.id)}
                >
                  <span className="icon">{view.icon}</span>
                  <div>
                    <div>{view.name}</div>
                    <div className="description">{view.description}</div>
                  </div>
                </DropdownItem>
              ))}
            </DropdownMenu>
          )}
        </AnimatePresence>
      </DropdownContainer>

      {/* Filters */}
      <DropdownContainer>
        <DropdownButton
          className={showFilterMenu ? 'open' : ''}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowFilterMenu(!showFilterMenu)}
          onMouseEnter={() => setHoveredButton('filter')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          🔽
        </DropdownButton>

        <AnimatePresence>
          {hoveredButton === 'filter' && !showFilterMenu && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Filter Options
            </Tooltip>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFilterMenu && (
            <DropdownMenu
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
            >
              <DropdownSection>
                <DropdownHeader>Content Filters</DropdownHeader>
                {filterOptions_config.map((filter) => (
                  <DropdownItem
                    key={filter.id}
                    className={filter.active ? 'active' : ''}
                    onClick={filter.action}
                  >
                    <span className="icon">{filter.icon}</span>
                    <div>{filter.name}</div>
                  </DropdownItem>
                ))}
              </DropdownSection>

              <DropdownSection>
                <DropdownHeader>Display Settings</DropdownHeader>
                <DropdownItem
                  className={graphSettings.showLabels ? 'active' : ''}
                  onClick={() => toggleGraphSetting('showLabels')}
                >
                  <span className="icon">🏷️</span>
                  <div>Show Labels</div>
                </DropdownItem>
                <DropdownItem
                  className={graphSettings.clustering ? 'active' : ''}
                  onClick={() => toggleGraphSetting('clustering')}
                >
                  <span className="icon">🎯</span>
                  <div>Enable Clustering</div>
                </DropdownItem>
                <DropdownItem
                  className={graphSettings.physics ? 'active' : ''}
                  onClick={() => toggleGraphSetting('physics')}
                >
                  <span className="icon">⚡</span>
                  <div>Physics Simulation</div>
                </DropdownItem>
              </DropdownSection>
            </DropdownMenu>
          )}
        </AnimatePresence>
      </DropdownContainer>

      {/* Refresh Button */}
      <ControlButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleRefresh}
        disabled={isRefreshing}
        onMouseEnter={() => setHoveredButton('refresh')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        {isRefreshing ? '⟳' : '🔄'}
        <AnimatePresence>
          {hoveredButton === 'refresh' && !isRefreshing && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Refresh Data <KeyboardShortcut>⌘R</KeyboardShortcut>
            </Tooltip>
          )}
        </AnimatePresence>
      </ControlButton>

      {/* Export Button */}
      <ControlButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleExport}
        onMouseEnter={() => setHoveredButton('export')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        💾
        <AnimatePresence>
          {hoveredButton === 'export' && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Export Knowledge Graph
            </Tooltip>
          )}
        </AnimatePresence>
      </ControlButton>

      {/* Fullscreen Toggle */}
      <ControlButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
        }}
        onMouseEnter={() => setHoveredButton('fullscreen')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        ⛶
        <AnimatePresence>
          {hoveredButton === 'fullscreen' && (
            <Tooltip
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
            >
              Toggle Fullscreen <KeyboardShortcut>F11</KeyboardShortcut>
            </Tooltip>
          )}
        </AnimatePresence>
      </ControlButton>
    </ControlContainer>
  );
};

export default ControlPanel;