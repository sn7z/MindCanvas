// src/components/SearchOverlay.js - Simplified with backend-controlled filtering
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from '../store/knowledgeStore';
import Fuse from 'fuse.js';

const OverlayBackdrop = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
`;

const SearchContainer = styled(motion.div)`
  width: 90%;
  max-width: 800px;
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.1) 0%, 
    rgba(118, 75, 162, 0.1) 100%);
  backdrop-filter: blur(20px);
  border-radius: ${props => props.theme.borderRadius.xl};
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: ${props => props.theme.shadows.lg};
  overflow: hidden;
  max-height: 80vh;
`;

const SearchHeader = styled.div`
  padding: ${props => props.theme.spacing.xl};
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const SearchInputContainer = styled.div`
  position: relative;
  margin-bottom: ${props => props.theme.spacing.lg};
`;

const SearchInput = styled.input`
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.lg};
  padding: ${props => props.theme.spacing.lg} ${props => props.theme.spacing.xl};
  padding-left: 60px;
  color: ${props => props.theme.colors.text};
  font-family: ${props => props.theme.fonts.primary};
  font-size: 1.2rem;
  transition: all ${props => props.theme.animations.normal};
  
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
    background: rgba(255, 255, 255, 0.15);
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: ${props => props.theme.spacing.lg};
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.5rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const CloseButton = styled(motion.button)`
  position: absolute;
  top: ${props => props.theme.spacing.lg};
  right: ${props => props.theme.spacing.lg};
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

const SearchFilters = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.md};
  flex-wrap: wrap;
  align-items: center;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  label {
    font-size: 0.9rem;
    color: ${props => props.theme.colors.textSecondary};
    font-weight: 500;
  }
`;

const FilterSelect = styled.select`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.sm};
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  color: ${props => props.theme.colors.text};
  font-size: 0.9rem;
  
  option {
    background: #1a1a2e;
    color: white;
  }
`;

const SearchStats = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: ${props => props.theme.spacing.lg};
  padding-top: ${props => props.theme.spacing.lg};
  border-top: 1px solid ${props => props.theme.colors.border};
  font-size: 0.9rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const QuickActions = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
`;

const QuickActionButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.sm};
  cursor: pointer;
  font-size: 0.8rem;
  transition: all ${props => props.theme.animations.fast};
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
`;

const ResultsContainer = styled.div`
  max-height: 50vh;
  overflow-y: auto;
  padding: ${props => props.theme.spacing.lg};
`;

const ResultItem = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${props => props.theme.borderRadius.md};
  padding: ${props => props.theme.spacing.lg};
  margin-bottom: ${props => props.theme.spacing.md};
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all ${props => props.theme.animations.fast};
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ResultHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${props => props.theme.spacing.sm};
`;

const ResultTitle = styled.h4`
  margin: 0;
  color: ${props => props.theme.colors.text};
  font-size: 1rem;
  font-weight: 600;
  flex: 1;
  line-height: 1.3;
`;

const ResultMeta = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  align-items: center;
  flex-shrink: 0;
  margin-left: ${props => props.theme.spacing.md};
`;

const ResultBadge = styled.span`
  background: ${props => props.color || props.theme.colors.primary};
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
`;

const ResultDescription = styled.p`
  margin: 0;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: ${props => props.theme.spacing.sm};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ResultFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const ResultTopics = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.xs};
  flex-wrap: wrap;
`;

const TopicTag = styled.span`
  background: rgba(102, 126, 234, 0.2);
  color: ${props => props.theme.colors.primary};
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${props => props.theme.spacing.xxl};
  color: ${props => props.theme.colors.textSecondary};
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: ${props => props.theme.spacing.lg};
    opacity: 0.5;
  }
  
  .empty-title {
    font-size: 1.2rem;
    margin-bottom: ${props => props.theme.spacing.md};
    color: ${props => props.theme.colors.text};
  }
  
  .empty-description {
    line-height: 1.5;
  }
`;

const SearchOverlay = ({ onClose, onSearch, graphData }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState('semantic');
  
  const inputRef = useRef(null);
  const { performSemanticSearch, performTextSearch } = useKnowledgeStore();
  
  // Fuse.js for local search
  const fuse = React.useMemo(() => {
    if (!graphData?.nodes) return null;
    
    return new Fuse(graphData.nodes, {
      keys: ['name', 'title', 'summary', 'topics'],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true
    });
  }, [graphData]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchType]);

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    
    try {
      let searchResults = [];
      
      if (searchType === 'local' && fuse) {
        // Local search using Fuse.js
        const fuseResults = fuse.search(searchQuery);
        searchResults = fuseResults.map(result => ({
          ...result.item,
          similarity: 1 - result.score,
          matches: result.matches
        }));
      } else if (searchType === 'semantic') {
        // Semantic search via API (backend handles filtering)
        searchResults = await performSemanticSearch(searchQuery, 20);
      } else {
        // Text search via API (backend handles filtering)
        searchResults = await performTextSearch(searchQuery, 20);
      }
      
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultClick = (result) => {
    onSearch(query);
    onClose();
    
    // Trigger node selection if it's a graph node
    if (result.id && graphData?.nodes) {
      const node = graphData.nodes.find(n => n.id === result.id);
      if (node) {
        useKnowledgeStore.getState().setSelectedNode(node);
      }
    }
    
    // Open URL if available
    if (result.url) {
      window.open(result.url, '_blank');
    }
  };

  const handleQuickSearch = (quickQuery) => {
    setQuery(quickQuery);
  };

  const getResultColor = (contentType) => {
    const colorMap = {
      'Tutorial': '#ff6b6b',
      'Documentation': '#4ecdc4',
      'Article': '#9b59b6',
      'Blog': '#f39c12',
      'Research': '#e67e22',
      'News': '#e74c3c'
    };
    return colorMap[contentType] || '#667eea';
  };

  return (
    <OverlayBackdrop
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <SearchContainer
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <SearchHeader>
          <CloseButton
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
          >
            ✕
          </CloseButton>
          
          <SearchInputContainer>
            <SearchIcon>🔍</SearchIcon>
            <SearchInput
              ref={inputRef}
              type="text"
              placeholder="Search your knowledge graph..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && results.length > 0) {
                  handleResultClick(results[0]);
                }
              }}
            />
          </SearchInputContainer>

          <SearchFilters>
            <FilterGroup>
              <label>Search Type:</label>
              <FilterSelect
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
              >
                <option value="semantic">🧠 Semantic</option>
                <option value="text">📝 Text</option>
                <option value="local">⚡ Local</option>
              </FilterSelect>
            </FilterGroup>
          </SearchFilters>

          <SearchStats>
            <div>
              {isLoading ? 'Searching...' : `${results.length} results found`}
            </div>
            <QuickActions>
              <QuickActionButton onClick={() => handleQuickSearch('machine learning')}>
                🤖 ML
              </QuickActionButton>
              <QuickActionButton onClick={() => handleQuickSearch('tutorial')}>
                📚 Tutorials
              </QuickActionButton>
              <QuickActionButton onClick={() => handleQuickSearch('documentation')}>
                📖 Docs
              </QuickActionButton>
            </QuickActions>
          </SearchStats>
        </SearchHeader>

        <ResultsContainer>
          {results.length === 0 && !isLoading && query.trim() && (
            <EmptyState>
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No results found</div>
              <div className="empty-description">
                Try adjusting your search terms.<br />
                Use semantic search for concept-based queries.
              </div>
            </EmptyState>
          )}

          {results.length === 0 && !query.trim() && (
            <EmptyState>
              <div className="empty-icon">💡</div>
              <div className="empty-title">Intelligent Search</div>
              <div className="empty-description">
                Search across your entire knowledge graph using semantic understanding.<br />
                Try searching for concepts, topics, or specific content.
              </div>
            </EmptyState>
          )}

          <AnimatePresence>
            {results.map((result, index) => (
              <ResultItem
                key={result.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleResultClick(result)}
              >
                <ResultHeader>
                  <ResultTitle>{result.title || result.name}</ResultTitle>
                  <ResultMeta>
                    {result.similarity && (
                      <ResultBadge color="#4ecdc4">
                        {(result.similarity * 100).toFixed(0)}% match
                      </ResultBadge>
                    )}
                    <ResultBadge color={getResultColor(result.content_type || result.type)}>
                      {result.content_type || result.type || 'Unknown'}
                    </ResultBadge>
                    {(result.quality_score || result.quality) && (
                      <ResultBadge color="#f39c12">
                        {result.quality_score || result.quality}/10
                      </ResultBadge>
                    )}
                  </ResultMeta>
                </ResultHeader>

                <ResultDescription>
                  {result.summary || result.description || 'No description available'}
                </ResultDescription>

                <ResultFooter>
                  <ResultTopics>
                    {(result.key_topics || result.topics || []).slice(0, 3).map((topic, i) => (
                      <TopicTag key={i}>{topic}</TopicTag>
                    ))}
                  </ResultTopics>
                  <div>
                    {result.url && '🔗 Has Link'}
                  </div>
                </ResultFooter>
              </ResultItem>
            ))}
          </AnimatePresence>
        </ResultsContainer>
      </SearchContainer>
    </OverlayBackdrop>
  );
};

export default SearchOverlay;