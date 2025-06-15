// src/components/SettingsPanel.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from '../store/knowledgeStore';
import { ThemeUtils } from '../utils/themeUtils';

const SettingsOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.lg};
`;

const SettingsContainer = styled(motion.div)`
  width: 100%;
  max-width: 1000px;
  max-height: 90vh;
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.1) 0%, 
    rgba(118, 75, 162, 0.1) 100%);
  backdrop-filter: blur(20px);
  border-radius: ${props => props.theme.borderRadius.xl};
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: ${props => props.theme.shadows.lg};
  overflow: hidden;
  display: grid;
  grid-template-columns: 250px 1fr;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    max-width: 95vw;
  }
`;

const SettingsSidebar = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-right: 1px solid ${props => props.theme.colors.border};
  padding: ${props => props.theme.spacing.xl};
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const SettingsContent = styled.div`
  padding: ${props => props.theme.spacing.xl};
  overflow-y: auto;
  max-height: 90vh;
`;

const SettingsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${props => props.theme.spacing.xl};
  padding-bottom: ${props => props.theme.spacing.lg};
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const SettingsTitle = styled.h2`
  margin: 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.5rem;
  font-weight: 600;
`;

const CloseButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.md};
  cursor: pointer;
  font-size: 1.2rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const TabList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.sm};
`;

const TabButton = styled(motion.button)`
  background: ${props => props.active ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent'};
  border: 1px solid ${props => props.active ? '#667eea' : 'rgba(255, 255, 255, 0.2)'};
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.borderRadius.md};
  cursor: pointer;
  font-size: 0.9rem;
  text-align: left;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  &:hover {
    background: ${props => props.active ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255, 255, 255, 0.1)'};
  }
  
  .icon {
    font-size: 1.1rem;
  }
`;

const SettingSection = styled.div`
  margin-bottom: ${props => props.theme.spacing.xl};
`;

const SectionTitle = styled.h3`
  margin: 0 0 ${props => props.theme.spacing.lg} 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
`;

const SettingItem = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${props => props.theme.borderRadius.md};
  padding: ${props => props.theme.spacing.lg};
  margin-bottom: ${props => props.theme.spacing.md};
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const SettingLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  margin-bottom: ${props => props.theme.spacing.sm};
  cursor: pointer;
`;

const SettingDescription = styled.p`
  margin: 0;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
  line-height: 1.4;
`;

const SettingControl = styled.div`
  margin-top: ${props => props.theme.spacing.md};
`;

const Toggle = styled(motion.div)`
  width: 50px;
  height: 26px;
  background: ${props => props.active ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255, 255, 255, 0.2)'};
  border-radius: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
  position: relative;
  
  .toggle-thumb {
    width: 22px;
    height: 22px;
    background: white;
    border-radius: 50%;
    transform: translateX(${props => props.active ? '24px' : '0px'});
    transition: transform 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const Slider = styled.input`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  opacity: 0.7;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 1;
  }
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const Select = styled.select`
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.md};
  padding: ${props => props.theme.spacing.md};
  color: ${props => props.theme.colors.text};
  font-size: 0.9rem;
  
  option {
    background: #1a1a2e;
    color: white;
  }
`;

const ColorPicker = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  flex-wrap: wrap;
  margin-top: ${props => props.theme.spacing.sm};
`;

const ColorOption = styled(motion.div)`
  width: 40px;
  height: 40px;
  border-radius: ${props => props.theme.borderRadius.md};
  background: ${props => props.color};
  cursor: pointer;
  border: 3px solid ${props => props.active ? 'white' : 'transparent'};
  transition: all ${props => props.theme.animations.fast};
  
  &:hover {
    transform: scale(1.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  margin-top: ${props => props.theme.spacing.lg};
`;

const Button = styled(motion.button)`
  background: ${props => props.variant === 'primary' 
    ? 'linear-gradient(135deg, #667eea, #764ba2)' 
    : 'rgba(255, 255, 255, 0.1)'};
  border: 1px solid ${props => props.variant === 'primary' ? '#667eea' : 'rgba(255, 255, 255, 0.2)'};
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.borderRadius.md};
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const SettingsPanel = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const [settings, setSettings] = useState({
    appearance: {
      theme: 'dark',
      primaryColor: '#667eea',
      animations: true,
      fontSize: 14,
      compactMode: false
    },
    graph: {
      layout: 'fcose',
      showLabels: true,
      nodeSize: 'quality',
      edgeStyle: 'curved',
      clustering: true,
      physics: true,
      performance: 'balanced'
    },
    search: {
      defaultType: 'semantic',
      autoComplete: true,
      searchHistory: true,
      maxResults: 20
    },
    privacy: {
      analytics: false,
      errorReporting: true,
      dataRetention: '30days',
      shareUsage: false
    },
    advanced: {
      debugMode: false,
      experimentalFeatures: false,
      cacheSize: 100,
      refreshInterval: 30
    }
  });

  const { updateGraphSettings, graphSettings } = useKnowledgeStore();

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'graph', label: 'Graph Settings', icon: '🌐' },
    { id: 'search', label: 'Search & AI', icon: '🔍' },
    { id: 'privacy', label: 'Privacy & Data', icon: '🔒' },
    { id: 'advanced', label: 'Advanced', icon: '⚙️' }
  ];

  const colorOptions = [
    '#667eea', '#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', 
    '#e67e22', '#e74c3c', '#2ecc71', '#3498db', '#34495e'
  ];

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('mindcanvas-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }
  }, []);

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const saveSettings = () => {
    localStorage.setItem('mindcanvas-settings', JSON.stringify(settings));
    
    // Apply graph settings
    updateGraphSettings({
      layout: settings.graph.layout,
      showLabels: settings.graph.showLabels,
      clustering: settings.graph.clustering,
      physics: settings.graph.physics
    });
    
    // Apply theme changes
    document.documentElement.style.setProperty('--primary-color', settings.appearance.primaryColor);
    document.documentElement.style.setProperty('--font-size', `${settings.appearance.fontSize}px`);
    
    onClose();
  };

  const resetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      localStorage.removeItem('mindcanvas-settings');
      setSettings({
        appearance: {
          theme: 'dark',
          primaryColor: '#667eea',
          animations: true,
          fontSize: 14,
          compactMode: false
        },
        graph: {
          layout: 'fcose',
          showLabels: true,
          nodeSize: 'quality',
          edgeStyle: 'curved',
          clustering: true,
          physics: true,
          performance: 'balanced'
        },
        search: {
          defaultType: 'semantic',
          autoComplete: true,
          searchHistory: true,
          maxResults: 20
        },
        privacy: {
          analytics: false,
          errorReporting: true,
          dataRetention: '30days',
          shareUsage: false
        },
        advanced: {
          debugMode: false,
          experimentalFeatures: false,
          cacheSize: 100,
          refreshInterval: 30
        }
      });
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'appearance':
        return (
          <>
            <SettingSection>
              <SectionTitle>🎨 Theme & Colors</SectionTitle>
              
              <SettingItem>
                <SettingLabel>
                  Primary Color
                </SettingLabel>
                <SettingDescription>
                  Choose the main accent color for the interface
                </SettingDescription>
                <ColorPicker>
                  {colorOptions.map(color => (
                    <ColorOption
                      key={color}
                      color={color}
                      active={settings.appearance.primaryColor === color}
                      onClick={() => updateSetting('appearance', 'primaryColor', color)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    />
                  ))}
                </ColorPicker>
              </SettingItem>

              <SettingItem>
                <SettingLabel htmlFor="fontSize">
                  Font Size: {settings.appearance.fontSize}px
                </SettingLabel>
                <SettingDescription>
                  Adjust the base font size for better readability
                </SettingDescription>
                <SettingControl>
                  <Slider
                    id="fontSize"
                    type="range"
                    min="12"
                    max="18"
                    value={settings.appearance.fontSize}
                    onChange={(e) => updateSetting('appearance', 'fontSize', parseInt(e.target.value))}
                  />
                </SettingControl>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Animations
                  <Toggle
                    active={settings.appearance.animations}
                    onClick={() => updateSetting('appearance', 'animations', !settings.appearance.animations)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Enable smooth animations and transitions
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Compact Mode
                  <Toggle
                    active={settings.appearance.compactMode}
                    onClick={() => updateSetting('appearance', 'compactMode', !settings.appearance.compactMode)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Reduce spacing and padding for more content density
                </SettingDescription>
              </SettingItem>
            </SettingSection>
          </>
        );

      case 'graph':
        return (
          <>
            <SettingSection>
              <SectionTitle>🌐 Graph Visualization</SectionTitle>
              
              <SettingItem>
                <SettingLabel>Default Layout Algorithm</SettingLabel>
                <SettingDescription>
                  Choose the default layout for new graph visualizations
                </SettingDescription>
                <SettingControl>
                  <Select
                    value={settings.graph.layout}
                    onChange={(e) => updateSetting('graph', 'layout', e.target.value)}
                  >
                    <option value="fcose">Force-Directed (fCoSE)</option>
                    <option value="cola">Constraint-Based (Cola)</option>
                    <option value="dagre">Hierarchical (Dagre)</option>
                    <option value="elk">Layered (ELK)</option>
                    <option value="circle">Circular</option>
                  </Select>
                </SettingControl>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Show Node Labels
                  <Toggle
                    active={settings.graph.showLabels}
                    onClick={() => updateSetting('graph', 'showLabels', !settings.graph.showLabels)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Display text labels on graph nodes
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Enable Clustering
                  <Toggle
                    active={settings.graph.clustering}
                    onClick={() => updateSetting('graph', 'clustering', !settings.graph.clustering)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Automatically group related nodes together
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Physics Simulation
                  <Toggle
                    active={settings.graph.physics}
                    onClick={() => updateSetting('graph', 'physics', !settings.graph.physics)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Enable real-time physics for interactive node movement
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel>Performance Mode</SettingLabel>
                <SettingDescription>
                  Balance between visual quality and performance
                </SettingDescription>
                <SettingControl>
                  <Select
                    value={settings.graph.performance}
                    onChange={(e) => updateSetting('graph', 'performance', e.target.value)}
                  >
                    <option value="quality">High Quality</option>
                    <option value="balanced">Balanced</option>
                    <option value="performance">High Performance</option>
                  </Select>
                </SettingControl>
              </SettingItem>
            </SettingSection>
          </>
        );

      case 'search':
        return (
          <>
            <SettingSection>
              <SectionTitle>🔍 Search & AI</SectionTitle>
              
              <SettingItem>
                <SettingLabel>Default Search Type</SettingLabel>
                <SettingDescription>
                  Choose the default search method for new queries
                </SettingDescription>
                <SettingControl>
                  <Select
                    value={settings.search.defaultType}
                    onChange={(e) => updateSetting('search', 'defaultType', e.target.value)}
                  >
                    <option value="semantic">Semantic Search (AI-powered)</option>
                    <option value="text">Text Search (Keyword-based)</option>
                    <option value="local">Local Search (Fast)</option>
                  </Select>
                </SettingControl>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Auto-Complete
                  <Toggle
                    active={settings.search.autoComplete}
                    onClick={() => updateSetting('search', 'autoComplete', !settings.search.autoComplete)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Show search suggestions as you type
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Search History
                  <Toggle
                    active={settings.search.searchHistory}
                    onClick={() => updateSetting('search', 'searchHistory', !settings.search.searchHistory)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Remember recent searches for quick access
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel htmlFor="maxResults">
                  Max Results: {settings.search.maxResults}
                </SettingLabel>
                <SettingDescription>
                  Maximum number of search results to display
                </SettingDescription>
                <SettingControl>
                  <Slider
                    id="maxResults"
                    type="range"
                    min="10"
                    max="50"
                    value={settings.search.maxResults}
                    onChange={(e) => updateSetting('search', 'maxResults', parseInt(e.target.value))}
                  />
                </SettingControl>
              </SettingItem>
            </SettingSection>
          </>
        );

      case 'privacy':
        return (
          <>
            <SettingSection>
              <SectionTitle>🔒 Privacy & Data</SectionTitle>
              
              <SettingItem>
                <SettingLabel>
                  Usage Analytics
                  <Toggle
                    active={settings.privacy.analytics}
                    onClick={() => updateSetting('privacy', 'analytics', !settings.privacy.analytics)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Help improve MindCanvas by sharing anonymous usage data
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Error Reporting
                  <Toggle
                    active={settings.privacy.errorReporting}
                    onClick={() => updateSetting('privacy', 'errorReporting', !settings.privacy.errorReporting)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Automatically report errors to help fix bugs
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel>Data Retention</SettingLabel>
                <SettingDescription>
                  How long to keep your browsing data locally
                </SettingDescription>
                <SettingControl>
                  <Select
                    value={settings.privacy.dataRetention}
                    onChange={(e) => updateSetting('privacy', 'dataRetention', e.target.value)}
                  >
                    <option value="7days">7 Days</option>
                    <option value="30days">30 Days</option>
                    <option value="90days">90 Days</option>
                    <option value="1year">1 Year</option>
                    <option value="forever">Forever</option>
                  </Select>
                </SettingControl>
              </SettingItem>
            </SettingSection>
          </>
        );

      case 'advanced':
        return (
          <>
            <SettingSection>
              <SectionTitle>⚙️ Advanced Settings</SectionTitle>
              
              <SettingItem>
                <SettingLabel>
                  Debug Mode
                  <Toggle
                    active={settings.advanced.debugMode}
                    onClick={() => updateSetting('advanced', 'debugMode', !settings.advanced.debugMode)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Show debug information and developer tools
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel>
                  Experimental Features
                  <Toggle
                    active={settings.advanced.experimentalFeatures}
                    onClick={() => updateSetting('advanced', 'experimentalFeatures', !settings.advanced.experimentalFeatures)}
                  >
                    <div className="toggle-thumb" />
                  </Toggle>
                </SettingLabel>
                <SettingDescription>
                  Enable beta features that may be unstable
                </SettingDescription>
              </SettingItem>

              <SettingItem>
                <SettingLabel htmlFor="cacheSize">
                  Cache Size: {settings.advanced.cacheSize}MB
                </SettingLabel>
                <SettingDescription>
                  Amount of data to cache for faster performance
                </SettingDescription>
                <SettingControl>
                  <Slider
                    id="cacheSize"
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={settings.advanced.cacheSize}
                    onChange={(e) => updateSetting('advanced', 'cacheSize', parseInt(e.target.value))}
                  />
                </SettingControl>
              </SettingItem>

              <SettingItem>
                <SettingLabel htmlFor="refreshInterval">
                  Auto-Refresh: {settings.advanced.refreshInterval}s
                </SettingLabel>
                <SettingDescription>
                  How often to automatically refresh data
                </SettingDescription>
                <SettingControl>
                  <Slider
                    id="refreshInterval"
                    type="range"
                    min="10"
                    max="300"
                    step="10"
                    value={settings.advanced.refreshInterval}
                    onChange={(e) => updateSetting('advanced', 'refreshInterval', parseInt(e.target.value))}
                  />
                </SettingControl>
              </SettingItem>
            </SettingSection>
          </>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <SettingsOverlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <SettingsContainer
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <SettingsSidebar>
          <TabList>
            {tabs.map(tab => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="icon">{tab.icon}</span>
                {tab.label}
              </TabButton>
            ))}
          </TabList>
        </SettingsSidebar>

        <SettingsContent>
          <SettingsHeader>
            <SettingsTitle>Settings</SettingsTitle>
            <CloseButton
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
            >
              ✕
            </CloseButton>
          </SettingsHeader>

          {renderTabContent()}

          <ButtonGroup>
            <Button
              variant="primary"
              onClick={saveSettings}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Save Settings
            </Button>
            <Button
              onClick={resetSettings}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Cancel
            </Button>
          </ButtonGroup>
        </SettingsContent>
      </SettingsContainer>
    </SettingsOverlay>
  );
};

export default SettingsPanel;