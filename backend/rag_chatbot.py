"""
RAG-based Chatbot Backend for MindCanvas
Implements intelligent Q&A using knowledge graph content
"""

import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass

from fastapi import HTTPException
from pydantic import BaseModel
from openai import OpenAI
from groq import Groq
import numpy as np
from sentence_transformers import SentenceTransformer

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

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]] = []
    confidence: float = 0.0
    processing_time: float = 0.0
    tokens_used: int = 0
    conversation_id: str = ""

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
        self.openai_client = OpenAI(api_key=openai_key) if openai_key else None
        self.groq_client = Groq(api_key=groq_key) if groq_key else None
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        
        # System prompts
        self.system_prompt = """You are MindCanvas AI, an intelligent knowledge assistant that helps users explore and understand their personal knowledge graph.

Your capabilities:
- Answer questions using the user's browsing history and saved content
- Provide insights about learning patterns and knowledge gaps
- Suggest related content and learning paths
- Summarize complex topics from multiple sources
- Help with research and knowledge discovery

Guidelines:
- Always cite sources when providing information
- Be conversational but precise
- If information is not in the knowledge base, clearly state this
- Suggest related topics when appropriate
- Help users discover connections between different concepts
- Provide actionable insights and recommendations

Context: You have access to the user's processed web content including summaries, topics, and quality scores."""

        self.rag_system_prompt = """You are answering based on the user's personal knowledge base. Use the provided context to give accurate, helpful responses.

IMPORTANT RULES:
1. Only use information from the provided context
2. Always cite sources with [Source: Title/URL]
3. If the context doesn't contain enough information, say so clearly
4. Connect related concepts when possible
5. Provide practical insights and actionable advice
6. Be conversational but accurate

The context includes content the user has previously browsed, with summaries and quality ratings."""

    async def process_chat_request(self, request: ChatRequest) -> ChatResponse:
        """Main chat processing pipeline"""
        start_time = datetime.now()
        
        try:
            # Step 1: Retrieve relevant context
            context_items = []
            sources = []
            
            if request.use_rag:
                context_items = await self._retrieve_relevant_context(
                    request.message, 
                    request.max_context_items,
                    request.similarity_threshold
                )
                sources = [self._format_source(item) for item in context_items]
            
            # Step 2: Generate response
            response_text, tokens_used, confidence = await self._generate_response(
                request.message,
                context_items,
                request.conversation_history
            )
            
            # Step 3: Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return ChatResponse(
                response=response_text,
                sources=sources,
                confidence=confidence,
                processing_time=processing_time,
                tokens_used=tokens_used,
                conversation_id=f"chat_{int(datetime.now().timestamp())}"
            )
            
        except Exception as e:
            logger.error(f"Chat processing failed: {e}")
            raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

    async def _retrieve_relevant_context(self, query: str, max_items: int, threshold: float) -> List[KnowledgeContext]:
        """Retrieve relevant content using vector similarity"""
        try:
            # Generate query embedding
            query_embedding = self.embedder.encode(query).tolist()
            
            # Get all content with embeddings
            response = self.db.client.table('processed_content').select(
                'id, url, title, summary, content, content_type, quality_score, embedding'
            ).execute()
            
            if not response.data:
                return []
            
            # Calculate similarities and filter
            context_items = []
            for item in response.data:
                if not item.get('embedding'):
                    continue
                
                similarity = self._cosine_similarity(query_embedding, item['embedding'])
                
                if similarity >= threshold:
                    context_items.append(KnowledgeContext(
                        content=item['content'][:1500],  # Limit content length
                        title=item['title'],
                        url=item['url'],
                        content_type=item['content_type'],
                        quality_score=item['quality_score'],
                        similarity=similarity,
                        summary=item['summary']
                    ))
            
            # Sort by similarity and quality, return top results
            context_items.sort(key=lambda x: (x.similarity * 0.7 + x.quality_score * 0.3), reverse=True)
            return context_items[:max_items]
            
        except Exception as e:
            logger.error(f"Context retrieval failed: {e}")
            return []

    async def _generate_response(self, query: str, context_items: List[KnowledgeContext], 
                               history: List[ChatMessage]) -> tuple[str, int, float]:
        """Generate response using LLM with RAG context"""
        
        # Build context string
        context_str = self._build_context_string(context_items)
        
        # Build conversation history
        messages = [{"role": "system", "content": self.rag_system_prompt if context_items else self.system_prompt}]
        
        # Add conversation history
        for msg in history[-6:]:  # Last 6 messages for context
            messages.append({"role": msg.role, "content": msg.content})
        
        # Add current query with context
        if context_items:
            user_message = f"Context from my knowledge base:\n{context_str}\n\nQuestion: {query}"
        else:
            user_message = f"Question: {query}\n\nNote: I don't have specific content in my knowledge base related to this question. Please provide general guidance or let me know if you'd like me to search for something specific."
        
        messages.append({"role": "user", "content": user_message})
        
        # Try Groq first (faster), fallback to OpenAI
        try:
            if self.groq_client:
                response = self.groq_client.chat.completions.create(
                    model="llama-3.1-70b-versatile",
                    messages=messages,
                    max_tokens=1000,
                    temperature=0.3,
                    stream=False
                )
                
                response_text = response.choices[0].message.content
                tokens_used = response.usage.total_tokens if response.usage else 0
                confidence = self._calculate_confidence(context_items, response_text)
                
                return response_text, tokens_used, confidence
                
        except Exception as e:
            logger.warning(f"Groq failed, trying OpenAI: {e}")
        
        # Fallback to OpenAI
        if self.openai_client:
            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    max_tokens=1000,
                    temperature=0.3
                )
                
                response_text = response.choices[0].message.content
                tokens_used = response.usage.total_tokens
                confidence = self._calculate_confidence(context_items, response_text)
                
                return response_text, tokens_used, confidence
                
            except Exception as e:
                logger.error(f"OpenAI also failed: {e}")
        
        # Fallback response
        return self._generate_fallback_response(query, context_items), 0, 0.3

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

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            vec_a = np.array(a)
            vec_b = np.array(b)
            
            dot_product = np.dot(vec_a, vec_b)
            norm_a = np.linalg.norm(vec_a)
            norm_b = np.linalg.norm(vec_b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            return dot_product / (norm_a * norm_b)
            
        except Exception:
            return 0.0

    async def get_suggested_questions(self, limit: int = 5) -> List[str]:
        """Generate suggested questions based on knowledge base content"""
        try:
            # Get recent and high-quality content
            response = self.db.client.table('processed_content').select(
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