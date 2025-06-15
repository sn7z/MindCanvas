// src/components/ChatbotPanel.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from '../store/knowledgeStore';

const ChatContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.1) 0%, 
    rgba(118, 75, 162, 0.1) 100%);
  border-radius: ${props => props.theme.borderRadius.lg};
  overflow: hidden;
`;

const ChatHeader = styled.div`
  padding: ${props => props.theme.spacing.md};
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(10px);
`;

const ChatTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: ${props => props.theme.colors.text};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.isOnline ? props.theme.colors.success : props.theme.colors.error};
    animation: ${props => props.isOnline ? 'pulse 2s infinite' : 'none'};
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

const ChatControls = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
`;

const ControlButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.sm};
  cursor: pointer;
  font-size: 0.9rem;
  transition: all ${props => props.theme.animations.fast};
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${props => props.theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
`;

const Message = styled(motion.div)`
  display: flex;
  align-items: flex-start;
  gap: ${props => props.theme.spacing.sm};
  
  &.user {
    flex-direction: row-reverse;
    
    .message-bubble {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      margin-left: 20%;
    }
  }
  
  &.assistant {
    .message-bubble {
      background: rgba(255, 255, 255, 0.1);
      color: ${props => props.theme.colors.text};
      margin-right: 20%;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  }
  
  &.system {
    justify-content: center;
    
    .message-bubble {
      background: rgba(255, 193, 7, 0.2);
      color: ${props => props.theme.colors.warning};
      border: 1px solid rgba(255, 193, 7, 0.3);
      font-size: 0.9rem;
      max-width: 80%;
      text-align: center;
    }
  }
`;

const MessageBubble = styled.div`
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.md};
  max-width: 80%;
  word-wrap: break-word;
  line-height: 1.5;
  backdrop-filter: blur(10px);
  
  .message-meta {
    font-size: 0.8rem;
    opacity: 0.7;
    margin-top: ${props => props.theme.spacing.sm};
    display: flex;
    align-items: center;
    gap: ${props => props.theme.spacing.sm};
  }
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
  
  &.user {
    background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  }
  
  &.assistant {
    background: linear-gradient(135deg, #4ecdc4, #44a08d);
  }
`;

const InputContainer = styled.div`
  padding: ${props => props.theme.spacing.md};
  background: rgba(255, 255, 255, 0.05);
  border-top: 1px solid ${props => props.theme.colors.border};
  backdrop-filter: blur(10px);
`;

const InputRow = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  align-items: flex-end;
`;

const MessageInput = styled.textarea`
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius.md};
  padding: ${props => props.theme.spacing.md};
  color: ${props => props.theme.colors.text};
  font-family: ${props => props.theme.fonts.primary};
  font-size: 0.9rem;
  line-height: 1.4;
  resize: none;
  min-height: 40px;
  max-height: 120px;
  
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }
`;

const SendButton = styled(motion.button)`
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: white;
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.md};
  cursor: pointer;
  font-size: 1.1rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SuggestionsContainer = styled(motion.div)`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  flex-wrap: wrap;
  margin-bottom: ${props => props.theme.spacing.sm};
`;

const SuggestionChip = styled(motion.button)`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: ${props => props.theme.colors.text};
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.xl};
  cursor: pointer;
  font-size: 0.8rem;
  transition: all ${props => props.theme.animations.fast};
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
`;

const TypingIndicator = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  padding: ${props => props.theme.spacing.md};
  color: ${props => props.theme.colors.textSecondary};
  font-style: italic;
  
  .dots {
    display: flex;
    gap: 2px;
    
    .dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: ${props => props.theme.colors.primary};
      animation: typing 1.4s infinite ease-in-out;
      
      &:nth-child(1) { animation-delay: -0.32s; }
      &:nth-child(2) { animation-delay: -0.16s; }
    }
  }
  
  @keyframes typing {
    0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }
`;

const SourcesContainer = styled(motion.div)`
  margin-top: ${props => props.theme.spacing.sm};
  
  .sources-header {
    font-size: 0.8rem;
    color: ${props => props.theme.colors.textSecondary};
    margin-bottom: ${props => props.theme.spacing.sm};
  }
  
  .sources-list {
    display: flex;
    flex-direction: column;
    gap: ${props => props.theme.spacing.sm};
  }
`;

const SourceItem = styled.div`
  background: rgba(255, 255, 255, 0.05);
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.sm};
  border-left: 3px solid ${props => props.theme.colors.accent};
  font-size: 0.8rem;
  
  .source-title {
    font-weight: 600;
    margin-bottom: 2px;
    color: ${props => props.theme.colors.text};
  }
  
  .source-meta {
    color: ${props => props.theme.colors.textSecondary};
    display: flex;
    gap: ${props => props.theme.spacing.sm};
    align-items: center;
  }
`;

const ChatbotPanel = ({ graphData }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Check chatbot health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:8090/api/chat/health');
        const health = await response.json();
        setIsOnline(health.status === 'healthy');
      } catch (error) {
        setIsOnline(false);
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Load suggestions
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const response = await fetch('http://localhost:8090/api/chat/suggestions?limit=5');
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      }
    };
    
    if (messages.length === 0) {
      loadSuggestions();
    }
  }, [messages.length]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: '👋 Hi! I\'m your AI knowledge assistant. I can help you explore your browsing history, answer questions about your saved content, and discover insights from your personal knowledge graph. What would you like to know?',
          timestamp: new Date(),
          confidence: 1.0
        }
      ]);
    }
  }, [messages.length]);
  
  const sendMessage = async (content) => {
    if (!content.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false);
    
    try {
      const response = await fetch('http://localhost:8090/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          conversation_history: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
          })),
          use_rag: true,
          max_context_items: 5,
          similarity_threshold: 0.3
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const chatResponse = await response.json();
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: chatResponse.response,
        timestamp: new Date(),
        sources: chatResponse.sources || [],
        confidence: chatResponse.confidence || 0,
        processingTime: chatResponse.processing_time || 0,
        tokensUsed: chatResponse.tokens_used || 0
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '😔 Sorry, I encountered an error while processing your message. Please make sure the backend is running and try again.',
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };
  
  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };
  
  const clearChat = () => {
    setMessages([]);
    setShowSuggestions(true);
  };
  
  const exportChat = () => {
    const chatData = {
      messages,
      timestamp: new Date().toISOString(),
      totalMessages: messages.length
    };
    
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindcanvas-chat-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <ChatContainer>
      <ChatHeader>
        <ChatTitle isOnline={isOnline}>
          🤖 MindCanvas AI
          <div className="status-indicator" />
        </ChatTitle>
        <ChatControls>
          <ControlButton
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={clearChat}
            disabled={isLoading}
          >
            🗑️
          </ControlButton>
          <ControlButton
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={exportChat}
            disabled={messages.length === 0}
          >
            💾
          </ControlButton>
        </ChatControls>
      </ChatHeader>

      <MessagesContainer>
        <AnimatePresence>
          {messages.map((message) => (
            <Message
              key={message.id}
              className={message.role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Avatar className={message.role}>
                {message.role === 'user' ? '👤' : '🤖'}
              </Avatar>
              
              <MessageBubble className="message-bubble">
                {message.content}
                
                {message.sources && message.sources.length > 0 && (
                  <SourcesContainer
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="sources-header">📚 Sources ({message.sources.length}):</div>
                    <div className="sources-list">
                      {message.sources.map((source, index) => (
                        <SourceItem key={index}>
                          <div className="source-title">{source.title}</div>
                          <div className="source-meta">
                            <span>{source.content_type}</span>
                            <span>Quality: {source.quality_score}/10</span>
                            <span>Relevance: {(source.similarity * 100).toFixed(1)}%</span>
                          </div>
                        </SourceItem>
                      ))}
                    </div>
                  </SourcesContainer>
                )}
                
                {message.role === 'assistant' && !message.isError && (
                  <div className="message-meta">
                    {message.confidence && (
                      <span>🎯 Confidence: {(message.confidence * 100).toFixed(0)}%</span>
                    )}
                    {message.processingTime && (
                      <span>⚡ {message.processingTime.toFixed(2)}s</span>
                    )}
                  </div>
                )}
              </MessageBubble>
            </Message>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <TypingIndicator
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Avatar className="assistant">🤖</Avatar>
            <span>MindCanvas AI is thinking</span>
            <div className="dots">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
          </TypingIndicator>
        )}
        
        <div ref={messagesEndRef} />
      </MessagesContainer>

      <InputContainer>
        {showSuggestions && suggestions.length > 0 && (
          <SuggestionsContainer
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <SuggestionChip
                key={index}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isLoading}
              >
                {suggestion}
              </SuggestionChip>
            ))}
          </SuggestionsContainer>
        )}
        
        <InputRow>
          <MessageInput
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isOnline ? "Ask me about your knowledge..." : "Chatbot offline - check backend connection"}
            disabled={isLoading || !isOnline}
            rows={1}
          />
          <SendButton
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim() || !isOnline}
          >
            {isLoading ? '⏳' : '🚀'}
          </SendButton>
        </InputRow>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatbotPanel;