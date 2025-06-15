# backend/main.py - Fixed RAG chatbot integration
"""
MindCanvas - Fixed Implementation with Working RAG Chatbot
Clean FastAPI backend with Supabase vector database and functional chat
"""

import asyncio
import httpx
import json
import os
import logging
import re
import hashlib
from typing import List, Dict, Any
from datetime import datetime
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bs4 import BeautifulSoup
from openai import OpenAI
from groq import Groq

# Add LangChain imports
from langchain_community.chat_models import ChatOpenAI
from langchain_community.embeddings import OpenAIEmbeddings

import asyncio
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict, Counter
import numpy as np

# Import the fixed RAG chatbot and Supabase DB
from rag_chatbot import RAGChatbot, ChatRequest, ChatResponse, ChatMessage
from supabase_db import SimpleVectorDB, ContentItem, init_db

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Simple settings
BATCH_SIZE = 10
MAX_CONTENT_LENGTH = 1500
MIN_CONTENT_LENGTH = 30

# Excluded domains
EXCLUDED_DOMAINS = {
    'google.com', 'bing.com', 'facebook.com', 'twitter.com', 'x.com',
    'instagram.com', 'linkedin.com', 'tiktok.com', 'reddit.com'
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global database and RAG chatbot
db: SimpleVectorDB = None
rag_chatbot: RAGChatbot = None

# Models
class HistoryItem(BaseModel):
    url: str
    title: str
    lastVisitTime: float

class SearchRequest(BaseModel):
    query: str
    limit: int = 20

# Utility functions
def is_valid_url(url: str) -> bool:
    """Check if URL should be processed"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower().replace('www.', '')
        
        if domain in EXCLUDED_DOMAINS:
            return False
        
        if not parsed.scheme in ['http', 'https']:
            return False
            
        return True
    except:
        return False

def get_content_hash(content: str) -> str:
    """Generate hash for content deduplication"""
    return hashlib.sha256(content[:500].encode()).hexdigest()[:16]

def clean_title(title: str) -> str:
    """Clean up page title"""
    if not title:
        return "Untitled"
    
    # Remove common suffixes
    for suffix in [' - Google Search', ' - Bing', ' | Facebook']:
        if title.endswith(suffix):
            title = title[:-len(suffix)]
    
    return title.strip()[:100] or "Untitled"

def calculate_quality_score(title: str, content: str, url: str) -> int:
    """Simple quality scoring 1-10"""
    score = 5  # Base score
    
    if len(title) > 10:
        score += 1
    if len(content) > 200:
        score += 1
    if len(content) > 500:
        score += 1
    if any(word in url.lower() for word in ['tutorial', 'guide', 'docs']):
        score += 1
    if len(content) < MIN_CONTENT_LENGTH:
        score -= 2
    
    return max(1, min(10, score))

# Content extraction
async def fetch_html(url: str) -> str:
    """Fetch HTML content from URL"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; MindCanvas/1.0)'
            })
            response.raise_for_status()
            return response.text
    except Exception as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return ""

def extract_content(html: str, url: str, title: str) -> Dict[str, str]:
    """Extract main content from HTML"""
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()
        
        # Try to find main content
        main_content = None
        for selector in ['article', 'main', '.content', '.post-content']:
            element = soup.select_one(selector)
            if element and len(element.get_text(strip=True)) > 50:
                main_content = element
                break
        
        if not main_content:
            main_content = soup.body or soup
        
        # Extract text
        content_text = main_content.get_text(separator=' ', strip=True)
        content_text = re.sub(r'\s+', ' ', content_text)
        
        if len(content_text) < MIN_CONTENT_LENGTH:
            return None
        
        return {
            'url': url,
            'title': clean_title(title),
            'content': content_text[:MAX_CONTENT_LENGTH],
            'domain': urlparse(url).netloc
        }
        
    except Exception as e:
        logger.error(f"Content extraction failed for {url}: {e}")
        return None

# LLM Processing
class LLMProcessor:
    def __init__(self):
        self.groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
    
    async def process_content(self, content_items: List[Dict]) -> List[Dict]:
        """Process content with LLM"""
        results = []
        
        for item in content_items:
            try:
                processed = await self._process_single_item(item)
                if processed:
                    results.append(processed)
            except Exception as e:
                logger.error(f"Failed to process {item['url']}: {e}")
                # Fallback to basic processing
                results.append(self._basic_process(item))
        
        return results
    
    async def _process_single_item(self, item: Dict) -> Dict:
        """Process single item with LLM"""
        prompt = f"""Analyze this webpage and respond with JSON only:

URL: {item['url']}
Title: {item['title']}
Content: {item['content']}

Response format:
{{
    "title": "cleaned title",
    "summary": "2-3 sentence summary",
    "content_type": "Article|Tutorial|Documentation|News|Blog",
    "key_topics": ["topic1", "topic2", "topic3"]
}}

JSON only:"""

        # Try Groq first
        if self.groq_client:
            try:
                response = self.groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=500,
                    temperature=0.1
                )
                
                result = response.choices[0].message.content.strip()
                return self._parse_llm_response(item, result, 'groq')
                
            except Exception as e:
                logger.warning(f"Groq failed: {e}")
        
        # Fallback to OpenAI
        if self.openai_client:
            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=500,
                    temperature=0.1
                )
                
                result = response.choices[0].message.content.strip()
                return self._parse_llm_response(item, result, 'openai')
                
            except Exception as e:
                logger.warning(f"OpenAI failed: {e}")
        
        # Basic fallback
        return self._basic_process(item)
    
    def _parse_llm_response(self, item: Dict, response: str, method: str) -> Dict:
        """Parse LLM JSON response"""
        try:
            # Clean JSON
            json_str = response.strip()
            if '```json' in json_str:
                json_str = json_str.split('```json')[1].split('```')[0]
            elif '{' in json_str and '}' in json_str:
                start = json_str.find('{')
                end = json_str.rfind('}') + 1
                json_str = json_str[start:end]
            
            parsed = json.loads(json_str)
            
            quality_score = calculate_quality_score(
                parsed.get('title', item['title']),
                item['content'],
                item['url']
            )
            
            return {
                'url': item['url'],
                'title': parsed.get('title', item['title'])[:100],
                'summary': parsed.get('summary', '')[:400],
                'content_type': parsed.get('content_type', 'Web Content'),
                'key_topics': parsed.get('key_topics', ['General'])[:3],
                'quality_score': quality_score,
                'processing_method': method,
                'content_hash': get_content_hash(item['content']),
                'content': item['content']
            }
            
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return self._basic_process(item)
    
    def _basic_process(self, item: Dict) -> Dict:
        """Basic processing without LLM"""
        # Detect content type from URL
        url_lower = item['url'].lower()
        if 'tutorial' in url_lower or 'guide' in url_lower:
            content_type = 'Tutorial'
        elif 'docs' in url_lower or 'documentation' in url_lower:
            content_type = 'Documentation'
        elif 'blog' in url_lower or 'article' in url_lower:
            content_type = 'Article'
        else:
            content_type = 'Web Content'
        
        # Extract basic topics
        content_lower = item['content'].lower()
        topics = []
        tech_terms = ['python', 'javascript', 'react', 'ai', 'machine learning']
        for term in tech_terms:
            if term in content_lower:
                topics.append(term.title())
        
        if not topics:
            topics = ['General']
        
        # Basic summary (first sentence or two)
        sentences = item['content'].split('.')[:2]
        summary = '. '.join(s.strip() for s in sentences if s.strip())[:200]
        
        quality_score = calculate_quality_score(item['title'], item['content'], item['url'])
        
        return {
            'url': item['url'],
            'title': item['title'],
            'summary': summary or f"Content from {item['domain']}",
            'content_type': content_type,
            'key_topics': topics[:3],
            'quality_score': quality_score,
            'processing_method': 'basic',
            'content_hash': get_content_hash(item['content']),
            'content': item['content']
        }

# Initialize components
llm_processor = LLMProcessor()

# Main processing function
async def process_urls(items: List[HistoryItem]) -> Dict[str, int]:
    """Process URLs and store in vector database"""
    
    # Filter valid URLs
    valid_items = [item for item in items if is_valid_url(item.url)]
    logger.info(f"Processing {len(valid_items)}/{len(items)} valid URLs")
    
    if not valid_items:
        return {"processed": 0, "total": len(items), "new": 0}
    
    # Check existing URLs
    new_items = []
    existing_count = 0
    
    for item in valid_items:
        try:
            existing = db.client.table('processed_content').select('id').eq('url', item.url).execute()
            if existing.data:
                existing_count += 1
                continue
        except:
            pass
        new_items.append(item)
    
    if not new_items:
        return {"processed": existing_count, "total": len(items), "new": 0}
    
    logger.info(f"Processing {len(new_items)} new URLs")
    
    # Fetch and extract content
    content_items = []
    for item in new_items:
        html = await fetch_html(item.url)
        if html:
            extracted = extract_content(html, item.url, item.title)
            if extracted:
                extracted['visit_time'] = item.lastVisitTime
                content_items.append(extracted)
    
    logger.info(f"Extracted content from {len(content_items)} URLs")
    
    if not content_items:
        return {"processed": existing_count, "total": len(items), "new": 0}
    
    # Process with LLM
    processed_items = await llm_processor.process_content(content_items)
    
    # Store in database
    stored_count = 0
    for original_item, processed_item in zip(content_items, processed_items):
        try:
            content_item = ContentItem(
                url=processed_item['url'],
                title=processed_item['title'],
                summary=processed_item['summary'],
                content=processed_item['content'],
                content_type=processed_item['content_type'],
                key_topics=processed_item['key_topics'],
                quality_score=processed_item['quality_score'],
                processing_method=processed_item['processing_method'],
                visit_timestamp=datetime.fromtimestamp(original_item['visit_time'] / 1000.0),
                content_hash=processed_item['content_hash']
            )
            
            # Also generate and store embedding
            embedding = await db.generate_embedding(
                f"{content_item.title} {content_item.summary}", 
                use_openai=bool(OPENAI_API_KEY)
            )
            content_item.embedding = embedding
            
            success = await db.store_content(content_item)
            if success:
                stored_count += 1
            
        except Exception as e:
            logger.error(f"Failed to store {processed_item['url']}: {e}")
    
    logger.info(f"Stored {stored_count} items in vector database")
    
    return {
        "processed": stored_count + existing_count,
        "total": len(items),
        "new": stored_count,
        "existing": existing_count
    }

# Startup - Fixed deprecation warning
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global db, rag_chatbot
    
    # Initialize database with OpenAI API key for embeddings
    db = await init_db(OPENAI_API_KEY)
    
    # Initialize RAG chatbot with better error handling
    try:
        rag_chatbot = RAGChatbot(db, OPENAI_API_KEY, GROQ_API_KEY)
        logger.info("✅ RAG Chatbot initialized successfully")
    except Exception as e:
        logger.error(f"❌ RAG Chatbot initialization failed: {e}")
        rag_chatbot = None
    
    logger.info("✅ MindCanvas started")
    yield
    # Shutdown (if needed)

# Initialize app with lifespan
app = FastAPI(title="MindCanvas", version="1.0", lifespan=lifespan)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Endpoints
@app.post("/api/ingest")
async def ingest_history(items: List[HistoryItem]):
    """Process browser history URLs"""
    if not items:
        return {"status": "success", "processed": 0, "total": 0}
    
    try:
        results = await process_urls(items)
        return {
            "status": "success",
            **results,
            "message": f"Processed {results['processed']} URLs ({results['new']} new)"
        }
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "processed": 0,
            "total": len(items)
        }

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_knowledge_base(request: ChatRequest):
    """Chat with AI using knowledge base context"""
    try:
        if not rag_chatbot:
            return ChatResponse(
                response="I'm sorry, the AI assistant is currently unavailable. Please ensure OpenAI API key is configured.",
                sources=[],
                confidence=0.1,
                processing_time=0.0,
                tokens_used=0,
                conversation_id=""
            )
        
        response = await rag_chatbot.process_chat_request(request)
        return response
    except Exception as e:
        logger.error(f"Chat request failed: {e}")
        return ChatResponse(
            response=f"I encountered an error: {str(e)}. Please try again.",
            sources=[],
            confidence=0.1,
            processing_time=0.0,
            tokens_used=0,
            conversation_id=""
        )

@app.get("/api/chat/suggestions")
async def get_chat_suggestions(limit: int = 5):
    """Get suggested questions based on knowledge base"""
    try:
        if not rag_chatbot:
            return {
                "suggestions": [
                    "What topics have I been learning about?",
                    "Can you help me explore my knowledge?",
                    "What would you recommend I learn next?",
                    "Show me my recent browsing patterns"
                ],
                "timestamp": datetime.now().isoformat()
            }
        
        suggestions = await rag_chatbot.get_suggested_questions(limit)
        return {
            "suggestions": suggestions,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get suggestions: {e}")
        return {
            "suggestions": ["How can I help you today?"],
            "timestamp": datetime.now().isoformat()
        }


@app.post("/api/chat/insights")
async def get_conversation_insights(conversation_history: List[ChatMessage]):
    """Analyze conversation for insights"""
    if not rag_chatbot:
        raise HTTPException(status_code=503, detail="RAG chatbot not available")
    
    try:
        insights = await rag_chatbot.get_conversation_insights(conversation_history)
        return {
            "insights": insights,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to analyze conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/context/{query}")
async def get_chat_context(query: str, limit: int = 5, threshold: float = 0.3):
    """Get relevant context for a query (for debugging/preview)"""
    if not rag_chatbot:
        raise HTTPException(status_code=503, detail="RAG chatbot not available")
    
    try:
        # Get the documents from the vector database
        docs = await db.get_documents_by_query(query, limit, threshold)
        
        formatted_context = []
        for doc in docs:
            formatted_context.append({
                "title": doc.metadata.get("title", "Unknown"),
                "summary": doc.metadata.get("summary", ""),
                "content_type": doc.metadata.get("content_type", "Unknown"),
                "quality_score": doc.metadata.get("quality_score", 0),
                "similarity": round(doc.metadata.get("similarity", 0), 3),
                "url": doc.metadata.get("url", ""),
                "content_preview": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content
            })
        
        return {
            "query": query,
            "context_items": formatted_context,
            "total_found": len(formatted_context)
        }
    except Exception as e:
        logger.error(f"Failed to get context: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/health")
async def chat_health_check():
    """Check chatbot system health"""
    try:
        openai_ok = bool(OPENAI_API_KEY)
        rag_ok = rag_chatbot is not None
        vector_ok = db is not None
        
        try:
            test_query = db.client.table('processed_content').select('id').limit(1).execute()
            db_ok = test_query is not None
        except:
            db_ok = False
        
        # Try to get an embedding to verify the LangChain integration is working
        embeddings_ok = False
        if openai_ok:
            try:
                embedder = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
                embedding = embedder.embed_query("test")
                embeddings_ok = len(embedding) > 0
            except Exception as e:
                logger.error(f"Embedding test failed: {e}")
                embeddings_ok = False
        
        status = "healthy" if all([openai_ok, rag_ok, db_ok, embeddings_ok]) else "degraded"
        
        return {
            "status": status,
            "components": {
                "openai_api": "ok" if openai_ok else "error",
                "rag_chatbot": "ok" if rag_ok else "error", 
                "vector_store": "ok" if vector_ok else "error",
                "database": "ok" if db_ok else "error",
                "embeddings": "ok" if embeddings_ok else "error"
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        } 
    
@app.get("/api/content")
async def get_content(limit: int = 100):
    """Get processed content"""
    try:
        response = db.client.table('processed_content').select(
            'id, url, title, summary, content_type, key_topics, quality_score, processing_method'
        ).order('quality_score', desc=True).limit(limit).execute()
        
        content = []
        for row in response.data or []:
            content.append({
                "id": row['id'],
                "url": row['url'],
                "title": row['title'],
                "description": row['summary'],
                "content_type": row['content_type'],
                "key_details": row['key_topics'] or [],
                "quality_score": row['quality_score'],
                "processing_method": row['processing_method']
            })
        
        return {"content": content, "total": len(content)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search/semantic")
async def semantic_search(request: SearchRequest):
    """Vector similarity search"""
    try:
        results = await db.semantic_search(request.query, request.limit)
        return {
            "results": results,
            "total": len(results),
            "query": request.query,
            "search_type": "semantic"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def text_search(q: str, limit: int = 50):
    """Basic text search"""
    try:
        response = db.client.table('processed_content').select(
            'id, url, title, summary, content_type, key_topics, quality_score'
        ).or_(
            f'title.ilike.%{q}%, summary.ilike.%{q}%'
        ).limit(limit).execute()
        
        results = []
        for row in response.data or []:
            results.append({
                "id": row['id'],
                "url": row['url'],
                "title": row['title'],
                "description": row['summary'],
                "content_type": row['content_type'],
                "key_details": row['key_topics'] or [],
                "quality_score": row['quality_score']
            })
        
        return {
            "results": results,
            "total": len(results),
            "query": q,
            "search_type": "text"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/related/{content_id}")
async def get_related(content_id: int, limit: int = 10):
    """Find related content"""
    try:
        results = await db.get_related_content(content_id, limit)
        return {
            "related_content": results,
            "total": len(results),
            "source_id": content_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cluster")
async def cluster_content():
    """Cluster content"""
    try:
        clusters = await db.cluster_content()
        return {
            "clusters": clusters,
            "total": len(clusters)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trending")
async def get_trending(limit: int = 15):
    """Get trending topics"""
    try:
        trending = await db.get_trending_topics(limit)
        return {
            "trending_topics": trending,
            "total": len(trending)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics")
async def get_analytics():
    """Get analytics"""
    try:
        analytics = await db.get_analytics()
        return analytics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recommendations")
async def get_recommendations(limit: int = 10):
    """Get content recommendations"""
    try:
        # Just return high-quality recent content
        response = db.client.table('processed_content').select(
            'id, url, title, summary, content_type, quality_score'
        ).gte('quality_score', 7).order('quality_score', desc=True).limit(limit).execute()
        
        recommendations = []
        for row in response.data or []:
            recommendations.append({
                "id": row['id'],
                "url": row['url'],
                "title": row['title'],
                "summary": row['summary'],
                "content_type": row['content_type'],
                "quality_score": row['quality_score']
            })
        
        return {
            "recommendations": recommendations,
            "total": len(recommendations)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/knowledge-graph/export")
async def export_knowledge_graph():
    """Export knowledge graph"""
    try:
        data = await db.export_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    """Get processing statistics"""
    try:
        analytics = await db.get_analytics()
        return {
            "total_content": analytics.get("total_content", 0),
            "by_processing_method": analytics.get("by_processing_method", {}),
            "by_content_type": analytics.get("by_content_type", {}),
            "quality_distribution": {},
            "average_quality": analytics.get("average_quality", 0),
            "database": "supabase_vector"
        }
    except Exception as e:
        return {
            "total_content": 0,
            "error": str(e),
            "database": "supabase_vector"
        }

@app.delete("/api/reset")
async def reset_database():
    """Reset all data"""
    try:
        db.client.table('processed_content').delete().neq('id', 0).execute()
        return {
            "status": "success",
            "message": "Database reset successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Check system health"""
    try:
        health = await db.health_check()
        return health
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Mount static files for frontend
try:
    app.mount("/static", StaticFiles(directory="frontend/build"), name="static")
    logger.info("✅ Static files mounted")
except Exception as e:
    logger.warning(f"⚠️ Static files not mounted: {e}")

@app.get("/")
async def root():
    return {
        "message": "MindCanvas - AI Knowledge Graph with RAG Chatbot",
        "version": "1.0",
        "features": [
            "vector_search",
            "content_clustering", 
            "dual_llm_processing",
            "supabase_database",
            "rag_chatbot"
        ],
        "endpoints": {
            "ingest": "POST /api/ingest",
            "search": "POST /api/search/semantic",
            "content": "GET /api/content",
            "chat": "POST /api/chat",
            "chat_health": "GET /api/chat/health"
        },
        "chat_status": "available" if rag_chatbot else "unavailable"
    }

if __name__ == "__main__":
    import uvicorn
    # Use different port if 8000 is blocked
    uvicorn.run("main:app", host="127.0.0.1", port=8090, reload=True)