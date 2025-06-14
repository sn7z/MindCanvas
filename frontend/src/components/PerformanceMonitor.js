// src/components/PerformanceMonitor.js
import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const MonitorContainer = styled(motion.div)`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 16px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  z-index: 10000;
  min-width: 200px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  
  ${props => props.isMinimized && `
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `}
`;

const MonitorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  
  .title {
    font-weight: 600;
    color: #4ecdc4;
  }
`;

const ControlButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const MetricRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  
  .label {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .value {
    font-weight: 600;
    color: #2ecc71;
  }
`;

const PerformanceMonitor = ({ 
  isVisible = false, 
  nodeCount = 0, 
  edgeCount = 0 
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Simple mock metrics
  const metrics = {
    fps: 60,
    memory: 45,
    renderTime: 8.2
  };
  
  if (!isVisible) return null;
  
  if (isMinimized) {
    return (
      <MonitorContainer
        isMinimized
        onClick={() => setIsMinimized(false)}
        whileHover={{ scale: 1.1 }}
      >
        📊
      </MonitorContainer>
    );
  }
  
  return (
    <MonitorContainer
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <MonitorHeader>
        <span className="title">Performance</span>
        <ControlButton onClick={() => setIsMinimized(true)}>
          −
        </ControlButton>
      </MonitorHeader>
      
      <MetricRow>
        <span className="label">FPS:</span>
        <span className="value">{metrics.fps}</span>
      </MetricRow>
      
      <MetricRow>
        <span className="label">Memory:</span>
        <span className="value">{metrics.memory}MB</span>
      </MetricRow>
      
      <MetricRow>
        <span className="label">Render:</span>
        <span className="value">{metrics.renderTime}ms</span>
      </MetricRow>
      
      <MetricRow>
        <span className="label">Nodes:</span>
        <span className="value">{nodeCount}</span>
      </MetricRow>
      
      <MetricRow>
        <span className="label">Edges:</span>
        <span className="value">{edgeCount}</span>
      </MetricRow>
    </MonitorContainer>
  );
};

export default PerformanceMonitor;