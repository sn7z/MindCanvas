// src/components/NodeDetailsModal.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from '../store/knowledgeStore';

const ModalBackdrop = styled(motion.div)`
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

const ModalContainer = styled(motion.div)`
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.1) 0%, 
    rgba(118, 75, 162, 0.1) 100%);
  backdrop-filter: blur(20px);
  border-radius: ${props => props.theme.borderRadius.xl};
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: ${props => props.theme.shadows.lg};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  padding: ${props => props.theme.spacing.xl};
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: relative;
`;

const NodeTitle = styled.h2`
  margin: 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.3;
  flex: 1;
  margin-right: ${props => props.theme.spacing.lg};
`;

const NodeMeta = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  align-items: center;
  margin-top: ${props => props.theme.spacing.md};
  flex-wrap: wrap;
`;

const MetaBadge = styled.span`
  background: ${props => props.color || props.theme.colors.primary};
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
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
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const ModalContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${props => props.theme.spacing.xl};
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: ${props => props.theme.spacing.xl};
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: ${props => props.theme.spacing.lg};
  }
`;

const MainInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.lg};
`;

const SideInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.lg};
`;

const InfoSection = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${props => props.theme.borderRadius.md};
  padding: ${props => props.theme.spacing.lg};
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const SectionTitle = styled.h3`
  margin: 0 0 ${props => props.theme.spacing.md} 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  .icon {
    font-size: 1.2rem;
  }
`;

const NodeDescription = styled.p`
  margin: 0;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  font-size: 0.95rem;
`;

const NodeContent = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${props => props.theme.borderRadius.sm};
  padding: ${props => props.theme.spacing.lg};
  margin: ${props => props.theme.spacing.md} 0;
  border-left: 3px solid ${props => props.theme.colors.primary};
  
  .content-text {
    color: ${props => props.theme.colors.textSecondary};
    line-height: 1.6;
    font-size: 0.9rem;
    max-height: 200px;
    overflow-y: auto;
  }
`;

const TopicsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${props => props.theme.spacing.sm};
`;

const TopicTag = styled(motion.span)`
  background: rgba(102, 126, 234, 0.2);
  color: ${props => props.theme.colors.primary};
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all ${props => props.theme.animations.fast};
  
  &:hover {
    background: rgba(102, 126, 234, 0.3);
    transform: translateY(-1px);
  }
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${props => props.theme.spacing.md};
`;

const StatItem = styled.div`
  text-align: center;
  
  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: ${props => props.theme.colors.text};
    margin-bottom: ${props => props.theme.spacing.xs};
  }
  
  .stat-label {
    font-size: 0.8rem;
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const RelatedNodesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.sm};
  max-height: 300px;
  overflow-y: auto;
`;

const RelatedNodeItem = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${props => props.theme.borderRadius.sm};
  padding: ${props => props.theme.spacing.md};
  cursor: pointer;
  transition: all ${props => props.theme.animations.fast};
  border: 1px solid rgba(255, 255, 255, 0.1);
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(4px);
  }
  
  .node-name {
    font-weight: 600;
    color: ${props => props.theme.colors.text};
    font-size: 0.9rem;
    margin-bottom: ${props => props.theme.spacing.xs};
  }
  
  .node-type {
    font-size: 0.8rem;
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  flex-wrap: wrap;
`;

const ActionButton = styled(motion.button)`
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: white;
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.borderRadius.md};
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  &.secondary {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.xl};
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid ${props => props.theme.colors.primary};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${props => props.theme.spacing.xl};
  color: ${props => props.theme.colors.textSecondary};
  
  .empty-icon {
    font-size: 2rem;
    margin-bottom: ${props => props.theme.spacing.md};
    opacity: 0.5;
  }
`;

const NodeDetailsModal = ({ node, onClose, graphData }) => {
  const [relatedNodes, setRelatedNodes] = useState([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  const { 
    setSelectedNode, 
    findRelatedContent, 
    getNodeNeighbors,
    performSemanticSearch 
  } = useKnowledgeStore();

  // Load related content
  useEffect(() => {
    if (!node) return;
    
    const loadRelatedNodes = async () => {
      setIsLoadingRelated(true);
      try {
        // Get graph neighbors
        const neighbors = getNodeNeighbors(node.id);
        
        // Get API-based related content
        let apiRelated = [];
        if (node.id) {
          apiRelated = await findRelatedContent(node.id, 5);
        }
        
        // Combine and deduplicate
        const allRelated = [
          ...neighbors.map(n => ({ ...n, source: 'graph' })),
          ...apiRelated.map(n => ({ ...n, source: 'api' }))
        ];
        
        const uniqueRelated = allRelated.filter((node, index, self) => 
          index === self.findIndex(n => n.id === node.id)
        );
        
        setRelatedNodes(uniqueRelated.slice(0, 10));
      } catch (error) {
        console.error('Failed to load related content:', error);
      } finally {
        setIsLoadingRelated(false);
      }
    };
    
    loadRelatedNodes();
  }, [node, getNodeNeighbors, findRelatedContent]);

  if (!node) return null;

  const handleNodeClick = (clickedNode) => {
    setSelectedNode(clickedNode);
  };

  const handleTopicClick = async (topic) => {
    try {
      await performSemanticSearch(topic, 10);
      onClose();
    } catch (error) {
      console.error('Topic search failed:', error);
    }
  };

  const handleOpenUrl = () => {
    if (node.url) {
      window.open(node.url, '_blank');
    }
  };

  const handleExploreConnections = () => {
    // This could trigger a focused view of the node's connections
    onClose();
  };

  const getNodeTypeColor = (type) => {
    const colorMap = {
      'Tutorial': '#ff6b6b',
      'Documentation': '#4ecdc4',
      'Article': '#9b59b6',
      'Blog': '#f39c12',
      'Research': '#e67e22',
      'News': '#e74c3c'
    };
    return colorMap[type] || '#667eea';
  };

  const getQualityColor = (quality) => {
    if (quality >= 8) return '#2ecc71';
    if (quality >= 6) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <ModalBackdrop
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <ModalContainer
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <ModalHeader>
          <div>
            <NodeTitle>{node.title || node.name}</NodeTitle>
            <NodeMeta>
              <MetaBadge color={getNodeTypeColor(node.type || node.content_type)}>
                {node.type || node.content_type || 'Unknown Type'}
              </MetaBadge>
              {(node.quality || node.quality_score) && (
                <MetaBadge color={getQualityColor(node.quality || node.quality_score)}>
                  Quality: {node.quality || node.quality_score}/10
                </MetaBadge>
              )}
              {node.processing_method && (
                <MetaBadge color="#9b59b6">
                  {node.processing_method}
                </MetaBadge>
              )}
            </NodeMeta>
          </div>
          <CloseButton
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
          >
            ✕
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          <MainInfo>
            {/* Overview Section */}
            <InfoSection>
              <SectionTitle>
                <span className="icon">📋</span>
                Overview
              </SectionTitle>
              <NodeDescription>
                {node.summary || node.description || 'No description available for this content.'}
              </NodeDescription>
              
              {node.content && (
                <NodeContent>
                  <div className="content-text">
                    {node.content.substring(0, 500)}
                    {node.content.length > 500 && '...'}
                  </div>
                </NodeContent>
              )}
            </InfoSection>

            {/* Topics Section */}
            {(node.topics || node.key_topics) && (
              <InfoSection>
                <SectionTitle>
                  <span className="icon">🏷️</span>
                  Topics & Keywords
                </SectionTitle>
                <TopicsList>
                  {(node.topics || node.key_topics || []).map((topic, index) => (
                    <TopicTag
                      key={index}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTopicClick(topic)}
                    >
                      {topic}
                    </TopicTag>
                  ))}
                </TopicsList>
              </InfoSection>
            )}

            {/* Actions Section */}
            <InfoSection>
              <SectionTitle>
                <span className="icon">⚡</span>
                Actions
              </SectionTitle>
              <ActionButtons>
                {node.url && (
                  <ActionButton
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleOpenUrl}
                  >
                    🔗 Open URL
                  </ActionButton>
                )}
                <ActionButton
                  className="secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExploreConnections}
                >
                  🕸️ Explore Connections
                </ActionButton>
                <ActionButton
                  className="secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTopicClick(node.title || node.name)}
                >
                  🔍 Find Similar
                </ActionButton>
              </ActionButtons>
            </InfoSection>
          </MainInfo>

          <SideInfo>
            {/* Statistics Section */}
            <InfoSection>
              <SectionTitle>
                <span className="icon">📊</span>
                Statistics
              </SectionTitle>
              <StatGrid>
                <StatItem>
                  <div className="stat-value">{node.quality || node.quality_score || 'N/A'}</div>
                  <div className="stat-label">Quality Score</div>
                </StatItem>
                <StatItem>
                  <div className="stat-value">{relatedNodes.length}</div>
                  <div className="stat-label">Connections</div>
                </StatItem>
                <StatItem>
                  <div className="stat-value">{(node.topics || node.key_topics || []).length}</div>
                  <div className="stat-label">Topics</div>
                </StatItem>
                <StatItem>
                  <div className="stat-value">
                    {node.visit_timestamp ? new Date(node.visit_timestamp).toLocaleDateString() : 'Unknown'}
                  </div>
                  <div className="stat-label">Last Visited</div>
                </StatItem>
              </StatGrid>
            </InfoSection>

            {/* Related Nodes Section */}
            <InfoSection>
              <SectionTitle>
                <span className="icon">🔗</span>
                Related Content ({relatedNodes.length})
              </SectionTitle>
              
              {isLoadingRelated ? (
                <LoadingSpinner>
                  <div className="spinner" />
                </LoadingSpinner>
              ) : relatedNodes.length === 0 ? (
                <EmptyState>
                  <div className="empty-icon">🔍</div>
                  <div>No related content found</div>
                </EmptyState>
              ) : (
                <RelatedNodesList>
                  {relatedNodes.map((relatedNode, index) => (
                    <RelatedNodeItem
                      key={relatedNode.id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleNodeClick(relatedNode)}
                    >
                      <div className="node-name">
                        {relatedNode.title || relatedNode.name}
                      </div>
                      <div className="node-type">
                        {relatedNode.type || relatedNode.content_type} 
                        {relatedNode.similarity && ` • ${(relatedNode.similarity * 100).toFixed(0)}% similar`}
                      </div>
                    </RelatedNodeItem>
                  ))}
                </RelatedNodesList>
              )}
            </InfoSection>
          </SideInfo>
        </ModalContent>
      </ModalContainer>
    </ModalBackdrop>
  );
};

export default NodeDetailsModal;