"""
RAG-based Chatbot Backend for MindCanvas
Implements intelligent Q&A using knowledge graph content with LangChain
"""

import asyncio
import json
import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass

from fastapi import HTTPException
from pydantic import BaseModel, Field

# FIXED: Updated imports for newer LangChain packages
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.schema import AIMessage, HumanMessage, SystemMessage
from langchain.memory import ConversationBufferMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import ConversationalRetrievalChain
import numpy as np

logger = logging.getLogger(__name__)

# Request/Response Models
class ChatMessage(BaseModel):
    role: str  # 'user', 'assistant', 'system'
    content: str
    timestamp: Optional[datetime] = None

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessage] = []
    use_rag: bool = True
    max_context_items: int = 5
    similarity_threshold: float = 0.3
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]] = []
    confidence: float = 0.0
    processing_time: float = 0.0
    tokens_used: int = 0
    conversation_id: str = ""

class SourceCitation(BaseModel):
    title: str
    url: str
    content_type: str = Field(default="")
    quality_score: float = Field(default=0.0)
    similarity: float = Field(default=0.0)
    summary: str = Field(default="")

@dataclass
class KnowledgeContext:
    content: str
    title: str
    url: str
    content_type: str
    quality_score: float
    similarity: float
    summary: str

class RAGChatbot:
    def __init__(self, db, openai_key: str = None, groq_key: str = None):
        self.db = db
        self.client = db.client
        self.openai_api_key = openai_key
        
        # Initialize LangChain components
        self.embeddings = OpenAIEmbeddings(openai_api_key=openai_key)
        self.llm = ChatOpenAI(
            model_name="gpt-3.5-turbo",  # Use a less expensive model by default
            temperature=0.3,
            openai_api_key=openai_key
        )
        
        # Initialize vector store - will do this manually instead of using LangChain's integration
        self.vector_store = None
        
        # System prompts
        self.system_prompt = """You are MindCanvas AI, an intelligent knowledge assistant that helps users explore and understand their personal knowledge graph.

Your capabilities:
- Answer questions using the user's browsing history and saved content
- Provide insights about learning patterns and knowledge gaps
- Suggest related content and learning paths
- Summarize complex topics from multiple sources
- Help with research and knowledge discovery

Guidelines:
- Always cite sources when providing information using format [Source: Title]
- Be conversational but precise
- If information is not in the knowledge base, clearly state this
- Suggest related topics when appropriate
- Help users discover connections between different concepts
- Provide actionable insights and recommendations

Context: You have access to the user's processed web content including summaries, topics, and quality scores."""

        self.rag_system_prompt = """You are answering based on the user's personal knowledge base. Use the provided context to give accurate, helpful responses.

IMPORTANT RULES:
1. Only use information from the provided context
2. Always cite sources with [Source: Title]
3. If the context doesn't contain enough information, say so clearly
4. Connect related concepts when possible
5. Provide practical insights and actionable advice
6. Be conversational but accurate

The context includes content the user has previously browsed, with summaries and quality ratings."""

        self.conversation_memories = {}

    async def process_chat_request(self, request: ChatRequest) -> ChatResponse:
        """Main chat processing pipeline with LangChain"""
        start_time = datetime.now()
        
        try:
            # Get or create conversation memory
            conversation_id = request.conversation_id or f"chat_{int(datetime.now().timestamp())}"
            if conversation_id not in self.conversation_memories:
                self.conversation_memories[conversation_id] = ConversationBufferMemory(
                    memory_key="chat_history",
                    return_messages=True
                )
            
            memory = self.conversation_memories[conversation_id]
            
            # Convert conversation history to LangChain format if it exists
            if request.conversation_history:
                # Clear existing memory to avoid duplicates
                if hasattr(memory, 'clear'):
                    memory.clear()
                
                # Add history messages to memory
                for msg in request.conversation_history:
                    if msg.role == "user":
                        memory.chat_memory.add_user_message(msg.content)
                    elif msg.role == "assistant":
                        memory.chat_memory.add_ai_message(msg.content)
                    elif msg.role == "system":
                        # System messages are handled differently
                        pass
            
            # Step 1: Retrieve relevant context if RAG is enabled
            context_items = []
            sources = []
            
            if request.use_rag:
                # Use direct DB search since vector store isn't working
                docs = await self._retrieve_relevant_context(
                    request.message, 
                    request.max_context_items,
                    request.similarity_threshold
                )
                
                if docs:
                    # Convert to KnowledgeContext format for consistency
                    context_items = docs
                    
                    # Format sources for the response
                    sources = [self._format_source(item) for item in context_items]
            
            # Step 2: Generate response
            response_text, tokens_used, confidence = await self._generate_response(
                request.message,
                context_items,
                memory
            )
            
            # Step 3: Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return ChatResponse(
                response=response_text,
                sources=sources,
                confidence=confidence,
                processing_time=processing_time,
                tokens_used=tokens_used,
                conversation_id=conversation_id
            )
            
        except Exception as e:
            logger.error(f"Chat processing failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

    async def _retrieve_relevant_context(self, query: str, max_items: int, threshold: float) -> List[KnowledgeContext]:
        """Retrieve relevant content using vector similarity - directly from DB"""
        try:
            # Generate query embedding using our database helper
            query_embedding = await self.db.generate_embedding(query, use_openai=True)
            
            # Use direct DB search from our helper
            results = await self.db.semantic_search(query, max_items, threshold)
            
            if not results:
                logger.info(f"No relevant context found for query: {query}")
                return []
            
            # Convert to KnowledgeContext objects
            context_items = []
            for result in results:
                # Get full content for the item
                content_response = self.db.client.table('processed_content').select(
                    'content'
                ).eq('id', result['id']).execute()
                
                content = ""
                if content_response.data and len(content_response.data) > 0:
                    content = content_response.data[0].get('content', "")
                
                # Create KnowledgeContext object
                context_item = KnowledgeContext(
                    content=content,
                    title=result['title'],
                    url=result['url'],
                    content_type=result['content_type'],
                    quality_score=result['quality_score'],
                    similarity=result['similarity'],
                    summary=result['summary']
                )
                context_items.append(context_item)
            
            logger.info(f"Retrieved {len(context_items)} relevant context items")
            return context_items
            
        except Exception as e:
            logger.error(f"Context retrieval failed: {e}", exc_info=True)
            return []

    async def _generate_response(self, query: str, context_items: List[KnowledgeContext], 
                               memory: ConversationBufferMemory) -> tuple[str, int, float]:
        """Generate response using LangChain with RAG context"""
        
        if not context_items:
            # No context available, use simple chat completion
            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=f"Question: {query}\n\nNote: I don't have specific content in my knowledge base related to this question.")
            ]
            
            try:
                response = await self.llm.ainvoke(messages)
                response_text = response.content
                tokens_used = getattr(response, 'usage', {}).get('total_tokens', 0)
                confidence = 0.3  # Lower confidence without context
                
                return response_text, tokens_used, confidence
            except Exception as e:
                logger.error(f"Chat completion failed: {e}", exc_info=True)
                return self._generate_fallback_response(query, []), 0, 0.1
        
        # Use direct LLM call with context for RAG
        try:
            # Create context string
            context_str = self._build_context_string(context_items)
            
            # Build message history
            chat_history = memory.chat_memory.messages
            
            # Create messages for context and query
            messages = [
                SystemMessage(content=self.rag_system_prompt),
                *chat_history,
                HumanMessage(content=f"Context from my knowledge base:\n{context_str}\n\nQuestion: {query}")
            ]
            
            # Generate response
            response = await self.llm.ainvoke(messages)
            response_text = response.content
            
            # Get token usage if available
            tokens_used = getattr(response, 'usage', {}).get('total_tokens', 0) or 0
            
            # Calculate confidence based on context quality
            confidence = self._calculate_confidence(context_items, response_text)
            
            # Add to memory
            memory.chat_memory.add_user_message(query)
            memory.chat_memory.add_ai_message(response_text)
            
            return response_text, tokens_used, confidence
            
        except Exception as e:
            logger.error(f"RAG response generation failed: {e}", exc_info=True)
            # Fallback to simple response
            return self._generate_fallback_response(query, context_items), 0, 0.2

    def _build_context_string(self, context_items: List[KnowledgeContext]) -> str:
        """Build formatted context string for LLM"""
        if not context_items:
            return ""
        
        context_parts = []
        for i, item in enumerate(context_items, 1):
            context_part = f"""
Source {i}: {item.title}
Type: {item.content_type}
Quality: {item.quality_score}/10
URL: {item.url}
Summary: {item.summary}
Content: {item.content[:800]}...
Relevance: {item.similarity:.2f}
---
"""
            context_parts.append(context_part)
        
        return "\n".join(context_parts)

    def _calculate_confidence(self, context_items: List[KnowledgeContext], response: str) -> float:
        """Calculate confidence score based on context quality and response"""
        if not context_items:
            return 0.3
        
        # Base confidence on context quality and similarity
        avg_similarity = sum(item.similarity for item in context_items) / len(context_items)
        avg_quality = sum(item.quality_score for item in context_items) / len(context_items)
        
        # Adjust based on response length and citation presence
        citation_bonus = 0.1 if "[Source:" in response else 0
        length_factor = min(1.0, len(response) / 500)  # Longer responses might be more comprehensive
        
        confidence = (avg_similarity * 0.4 + avg_quality * 0.1 + length_factor * 0.3 + citation_bonus)
        return min(0.95, max(0.1, confidence))

    def _generate_fallback_response(self, query: str, context_items: List[KnowledgeContext]) -> str:
        """Generate fallback response when LLMs fail"""
        if context_items:
            sources_info = "\n".join([f"- {item.title} ({item.content_type})" for item in context_items[:3]])
            return f"""I found some relevant content in your knowledge base related to "{query}":

{sources_info}

However, I'm currently unable to process this information due to a temporary issue. You can view these sources directly to find the information you're looking for."""
        else:
            return f"""I don't have specific information about "{query}" in your current knowledge base. 

You might want to:
1. Browse and save more content related to this topic
2. Use the search function to explore existing content
3. Check if there are related topics in your knowledge graph

Is there a specific aspect of this topic you'd like me to help you explore?"""

    def _format_source(self, context_item: KnowledgeContext) -> Dict[str, Any]:
        """Format context item as source reference"""
        return {
            "title": context_item.title,
            "url": context_item.url,
            "content_type": context_item.content_type,
            "quality_score": context_item.quality_score,
            "similarity": round(context_item.similarity, 3),
            "summary": context_item.summary[:200] + "..." if len(context_item.summary) > 200 else context_item.summary
        }

    async def get_suggested_questions(self, limit: int = 5) -> List[str]:
        """Generate suggested questions based on knowledge base content"""
        try:
            # Get recent and high-quality content
            response = self.client.table('processed_content').select(
                'title, summary, content_type, key_topics'
            ).gte('quality_score', 7).order('quality_score', desc=True).limit(20).execute()
            
            if not response.data:
                return [
                    "What topics have I been learning about recently?",
                    "Can you summarize my knowledge in a specific area?",
                    "What are some knowledge gaps I should focus on?",
                    "Show me connections between different topics I've studied",
                    "What would you recommend I learn next?"
                ]
            
            # Extract topics and content types
            topics = set()
            content_types = set()
            
            for item in response.data:
                if item.get('key_topics'):
                    topics.update(item['key_topics'])
                content_types.add(item.get('content_type', 'Unknown'))
            
            # Generate questions based on available content
            suggestions = [
                f"What have I learned about {list(topics)[0]}?" if topics else "What topics have I been exploring?",
                f"Can you explain the key concepts in my {list(content_types)[0].lower()} content?" if content_types else "What types of content have I been consuming?",
                "What are the connections between different topics in my knowledge base?",
                "What would you recommend I study next based on my interests?",
                "Can you identify any knowledge gaps in my learning?"
            ]
            
            return suggestions[:limit]
            
        except Exception as e:
            logger.error(f"Failed to generate suggested questions: {e}")
            return [
                "What can you tell me about my learning patterns?",
                "Help me explore my knowledge graph",
                "What topics should I focus on next?",
                "Show me insights from my browsing history",
                "How can I better organize my knowledge?"
            ]

    async def get_conversation_insights(self, conversation_history: List[ChatMessage]) -> Dict[str, Any]:
        """Analyze conversation for insights and patterns"""
        try:
            user_messages = [msg.content for msg in conversation_history if msg.role == 'user']
            
            if not user_messages:
                return {"patterns": [], "topics": [], "suggestions": []}
            
            # Simple analysis - in production, you'd use more sophisticated NLP
            common_words = {}
            for message in user_messages:
                words = message.lower().split()
                for word in words:
                    if len(word) > 3:  # Skip short words
                        common_words[word] = common_words.get(word, 0) + 1
            
            top_topics = sorted(common_words.items(), key=lambda x: x[1], reverse=True)[:5]
            
            return {
                "patterns": [
                    f"You frequently ask about {topic}" for topic, count in top_topics if count > 1
                ],
                "topics": [topic for topic, _ in top_topics],
                "suggestions": [
                    "Try exploring related topics in your knowledge graph",
                    "Consider diving deeper into your most frequently discussed topics",
                    "Look for connections between different areas of interest"
                ]
            }
            
        except Exception as e:
            logger.error(f"Conversation analysis failed: {e}")
            return {"patterns": [], "topics": [], "suggestions": []}