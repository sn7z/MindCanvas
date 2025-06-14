"""
MindCanvas - Simple & Working Implementation
Clean FastAPI backend with Supabase vector database
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

import asyncio
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict, Counter
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity

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

app = FastAPI(title="MindCanvas", version="1.0")

# Global database
db: SimpleVectorDB = None

rag_chatbot = RAGChatbot(db, OPENAI_API_KEY, GROQ_API_KEY)
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
    global db
    db = await init_db()
    logger.info("✅ MindCanvas started")
    yield
    # Shutdown (if needed)

# Update app with lifespan
app = FastAPI(title="MindCanvas", version="1.0", lifespan=lifespan) # Initialize app with lifespan

# Add CORS to the correct app instance
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# # Serve static files from the correct app instance
# import os
# static_dir = os.path.join(os.path.dirname(__file__), "static")
# if not os.path.exists(static_dir):
#     os.makedirs(static_dir) # This will create backend/static if it doesn't exist
#     logger.info(f"Created static directory: {static_dir}")

# try:
#     app.mount("/static", StaticFiles(directory=static_dir), name="static")
#     logger.info(f"Serving static files from: {static_dir}")
# except Exception as e:
#     logger.error(f"Failed to mount static files: {e}")

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
        response = await rag_chatbot.process_chat_request(request)
        return response
    except Exception as e:
        logger.error(f"Chat request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/suggestions")
async def get_chat_suggestions(limit: int = 5):
    """Get suggested questions based on knowledge base"""
    try:
        suggestions = await rag_chatbot.get_suggested_questions(limit)
        return {
            "suggestions": suggestions,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/insights")
async def get_conversation_insights(conversation_history: List[ChatMessage]):
    """Analyze conversation for insights"""
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
    try:
        context_items = await rag_chatbot._retrieve_relevant_context(query, limit, threshold)
        
        formatted_context = []
        for item in context_items:
            formatted_context.append({
                "title": item.title,
                "summary": item.summary,
                "content_type": item.content_type,
                "quality_score": item.quality_score,
                "similarity": round(item.similarity, 3),
                "url": item.url
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
        # Test embeddings
        test_embedding = rag_chatbot.embedder.encode("test query")
        embedding_ok = len(test_embedding) > 0
        
        # Test LLM connections
        groq_ok = rag_chatbot.groq_client is not None
        openai_ok = rag_chatbot.openai_client is not None
        
        # Test database connection
        test_query = rag_chatbot.db.client.table('processed_content').select('id').limit(1).execute()
        db_ok = test_query is not None
        
        return {
            "status": "healthy" if all([embedding_ok, (groq_ok or openai_ok), db_ok]) else "degraded",
            "components": {
                "embeddings": "ok" if embedding_ok else "error",
                "groq_llm": "ok" if groq_ok else "unavailable",
                "openai_llm": "ok" if openai_ok else "unavailable",
                "database": "ok" if db_ok else "error"
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

@app.get("/api/analytics/advanced")
async def get_advanced_analytics(days: int = 30, include_trends: bool = True):
    """Get comprehensive analytics with trend analysis"""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get content data
        response = db.client.table('processed_content').select(
            'id, title, content_type, quality_score, key_topics, visit_timestamp, processing_method, embedding'
        ).gte('visit_timestamp', start_date.isoformat()).execute()
        
        content_data = response.data or []
        
        if not content_data:
            return {
                "period": f"{days} days",
                "total_content": 0,
                "analytics": {},
                "trends": {},
                "insights": []
            }
        
        # Basic statistics
        total_content = len(content_data)
        avg_quality = sum(item.get('quality_score', 0) for item in content_data) / total_content
        
        # Content type distribution
        content_types = Counter(item.get('content_type', 'Unknown') for item in content_data)
        
        # Processing method distribution
        processing_methods = Counter(item.get('processing_method', 'unknown') for item in content_data)
        
        # Quality distribution
        quality_scores = [item.get('quality_score', 0) for item in content_data]
        quality_distribution = {
            "excellent": len([q for q in quality_scores if q >= 8]),
            "good": len([q for q in quality_scores if 6 <= q < 8]),
            "average": len([q for q in quality_scores if 4 <= q < 6]),
            "poor": len([q for q in quality_scores if q < 4])
        }
        
        # Topic frequency
        all_topics = []
        for item in content_data:
            if item.get('key_topics'):
                all_topics.extend(item['key_topics'])
        topic_frequency = dict(Counter(all_topics).most_common(20))
        
        # Temporal trends
        trends = {}
        if include_trends:
            daily_counts = defaultdict(int)
            daily_quality = defaultdict(list)
            
            for item in content_data:
                if item.get('visit_timestamp'):
                    date = datetime.fromisoformat(item['visit_timestamp']).date()
                    daily_counts[date.isoformat()] += 1
                    daily_quality[date.isoformat()].append(item.get('quality_score', 0))
            
            trends = {
                "daily_content": dict(daily_counts),
                "daily_avg_quality": {
                    date: sum(scores) / len(scores) if scores else 0
                    for date, scores in daily_quality.items()
                }
            }
        
        # Learning velocity
        recent_week = [item for item in content_data 
                      if datetime.fromisoformat(item['visit_timestamp']) > end_date - timedelta(days=7)]
        previous_week = [item for item in content_data 
                        if end_date - timedelta(days=14) < datetime.fromisoformat(item['visit_timestamp']) <= end_date - timedelta(days=7)]
        
        learning_velocity = {
            "recent_week_count": len(recent_week),
            "previous_week_count": len(previous_week),
            "growth_rate": ((len(recent_week) - len(previous_week)) / max(len(previous_week), 1)) * 100 if previous_week else 0
        }
        
        # Generate insights
        insights = []
        
        if learning_velocity["growth_rate"] > 20:
            insights.append("🚀 Your learning pace has increased significantly this week!")
        elif learning_velocity["growth_rate"] < -20:
            insights.append("📉 Your content consumption has decreased this week.")
        
        if avg_quality > 7:
            insights.append("⭐ You're consistently finding high-quality content!")
        
        most_common_type = content_types.most_common(1)[0] if content_types else ("Unknown", 0)
        if most_common_type[1] > total_content * 0.5:
            insights.append(f"📚 You're focused heavily on {most_common_type[0]} content.")
        
        if len(set(all_topics)) > 20:
            insights.append("🌐 You're exploring a diverse range of topics!")
        
        return {
            "period": f"{days} days",
            "total_content": total_content,
            "analytics": {
                "average_quality": round(avg_quality, 2),
                "content_types": dict(content_types),
                "processing_methods": dict(processing_methods),
                "quality_distribution": quality_distribution,
                "topic_frequency": topic_frequency,
                "learning_velocity": learning_velocity
            },
            "trends": trends,
            "insights": insights,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Advanced analytics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clustering/advanced")
async def perform_advanced_clustering(
    method: str = "dbscan",
    min_cluster_size: int = 3,
    eps: float = 0.3,
    include_embeddings: bool = True
):
    """Perform advanced clustering using machine learning algorithms"""
    try:
        # Get content with embeddings
        response = db.client.table('processed_content').select(
            'id, title, summary, content_type, key_topics, quality_score, embedding'
        ).execute()
        
        content_data = response.data or []
        
        if len(content_data) < min_cluster_size:
            return {
                "clusters": [],
                "method": method,
                "total_items": len(content_data),
                "message": f"Not enough content for clustering (minimum: {min_cluster_size})"
            }
        
        # Prepare data for clustering
        embeddings = []
        items = []
        
        for item in content_data:
            if item.get('embedding') and include_embeddings:
                embeddings.append(item['embedding'])
                items.append(item)
        
        if len(embeddings) < min_cluster_size:
            return {
                "clusters": [],
                "method": method,
                "total_items": len(content_data),
                "message": "Not enough items with embeddings for clustering"
            }
        
        embeddings_array = np.array(embeddings)
        
        # Perform clustering
        if method == "dbscan":
            clustering = DBSCAN(eps=eps, min_samples=min_cluster_size, metric='cosine')
            cluster_labels = clustering.fit_predict(embeddings_array)
        else:
            raise ValueError(f"Unsupported clustering method: {method}")
        
        # Group items by cluster
        clusters = defaultdict(list)
        for item, label in zip(items, cluster_labels):
            if label != -1:  # -1 is noise in DBSCAN
                clusters[int(label)].append(item)
        
        # Format clusters
        formatted_clusters = []
        for cluster_id, cluster_items in clusters.items():
            if len(cluster_items) >= min_cluster_size:
                # Analyze cluster characteristics
                content_types = Counter(item.get('content_type', 'Unknown') for item in cluster_items)
                all_topics = []
                for item in cluster_items:
                    if item.get('key_topics'):
                        all_topics.extend(item['key_topics'])
                
                common_topics = [topic for topic, count in Counter(all_topics).most_common(5)]
                avg_quality = sum(item.get('quality_score', 0) for item in cluster_items) / len(cluster_items)
                
                # Generate cluster name
                most_common_type = content_types.most_common(1)[0][0] if content_types else "Mixed"
                primary_topic = common_topics[0] if common_topics else "General"
                cluster_name = f"{most_common_type} - {primary_topic}"
                
                formatted_clusters.append({
                    "id": cluster_id,
                    "name": cluster_name,
                    "description": f"Cluster of {len(cluster_items)} items focused on {primary_topic}",
                    "size": len(cluster_items),
                    "items": [
                        {
                            "id": item['id'],
                            "title": item.get('title', 'Untitled'),
                            "content_type": item.get('content_type', 'Unknown'),
                            "quality_score": item.get('quality_score', 0)
                        }
                        for item in cluster_items
                    ],
                    "characteristics": {
                        "content_types": dict(content_types),
                        "common_topics": common_topics,
                        "average_quality": round(avg_quality, 2),
                        "quality_range": [
                            min(item.get('quality_score', 0) for item in cluster_items),
                            max(item.get('quality_score', 0) for item in cluster_items)
                        ]
                    }
                })
        
        # Sort clusters by size
        formatted_clusters.sort(key=lambda x: x['size'], reverse=True)
        
        return {
            "clusters": formatted_clusters,
            "method": method,
            "parameters": {
                "eps": eps,
                "min_cluster_size": min_cluster_size
            },
            "total_items": len(content_data),
            "clustered_items": sum(len(cluster["items"]) for cluster in formatted_clusters),
            "noise_items": len(items) - sum(len(cluster["items"]) for cluster in formatted_clusters),
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Advanced clustering failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recommendations/personalized")
async def get_personalized_recommendations(
    user_interests: Optional[str] = None,
    content_types: Optional[str] = None,
    min_quality: int = 6,
    limit: int = 10,
    diversity_factor: float = 0.3
):
    """Get personalized content recommendations"""
    try:
        # Parse parameters
        interest_topics = user_interests.split(',') if user_interests else []
        allowed_types = content_types.split(',') if content_types else []
        
        # Get all content
        response = db.client.table('processed_content').select(
            'id, title, summary, content_type, key_topics, quality_score, url, embedding'
        ).gte('quality_score', min_quality).execute()
        
        content_data = response.data or []
        
        if not content_data:
            return {
                "recommendations": [],
                "total_available": 0,
                "method": "personalized",
                "parameters": {
                    "min_quality": min_quality,
                    "diversity_factor": diversity_factor
                }
            }
        
        # Filter by content type if specified
        if allowed_types:
            content_data = [item for item in content_data 
                          if item.get('content_type') in allowed_types]
        
        # Calculate recommendation scores
        recommendations = []
        
        for item in content_data:
            score = item.get('quality_score', 0) * 0.4  # Base quality score
            
            # Interest alignment
            item_topics = item.get('key_topics', [])
            if interest_topics and item_topics:
                topic_overlap = len(set(interest_topics) & set(item_topics))
                score += topic_overlap * 2  # Bonus for topic relevance
            
            # Content type preference (if specified)
            if allowed_types and item.get('content_type') in allowed_types:
                score += 1
            
            # Recency bonus (newer content gets slight preference)
            if item.get('visit_timestamp'):
                days_old = (datetime.now() - datetime.fromisoformat(item['visit_timestamp'])).days
                recency_bonus = max(0, 1 - (days_old / 30))  # Bonus decreases over 30 days
                score += recency_bonus
            
            recommendations.append({
                "id": item['id'],
                "title": item.get('title', 'Untitled'),
                "summary": item.get('summary', ''),
                "content_type": item.get('content_type', 'Unknown'),
                "quality_score": item.get('quality_score', 0),
                "url": item.get('url'),
                "topics": item.get('key_topics', []),
                "recommendation_score": round(score, 2),
                "reasons": []
            })
        
        # Sort by recommendation score
        recommendations.sort(key=lambda x: x['recommendation_score'], reverse=True)
        
        # Apply diversity filter
        if diversity_factor > 0:
            diverse_recommendations = []
            seen_types = set()
            seen_topics = set()
            
            for rec in recommendations:
                diversity_penalty = 0
                
                # Penalize repeated content types
                if rec['content_type'] in seen_types:
                    diversity_penalty += diversity_factor
                
                # Penalize repeated topics
                topic_overlap = len(set(rec['topics']) & seen_topics)
                diversity_penalty += topic_overlap * diversity_factor * 0.5
                
                rec['recommendation_score'] -= diversity_penalty
                diverse_recommendations.append(rec)
                
                seen_types.add(rec['content_type'])
                seen_topics.update(rec['topics'])
            
            recommendations = diverse_recommendations
            recommendations.sort(key=lambda x: x['recommendation_score'], reverse=True)
        
        # Add recommendation reasons
        for rec in recommendations[:limit]:
            reasons = []
            if rec['quality_score'] >= 8:
                reasons.append("High quality content")
            if interest_topics and set(interest_topics) & set(rec['topics']):
                matching_topics = list(set(interest_topics) & set(rec['topics']))
                reasons.append(f"Matches your interests: {', '.join(matching_topics)}")
            if rec['content_type'] in allowed_types:
                reasons.append(f"Preferred content type: {rec['content_type']}")
            
            rec['reasons'] = reasons
        
        return {
            "recommendations": recommendations[:limit],
            "total_available": len(content_data),
            "method": "personalized",
            "parameters": {
                "user_interests": interest_topics,
                "content_types": allowed_types,
                "min_quality": min_quality,
                "diversity_factor": diversity_factor
            },
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Personalized recommendations failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/network/analysis")
async def analyze_content_network():
    """Analyze the content network structure"""
    try:
        # Get all content and relationships
        content_response = db.client.table('processed_content').select(
            'id, title, content_type, key_topics, quality_score'
        ).execute()
        
        content_data = content_response.data or []
        
        if len(content_data) < 2:
            return {
                "network_stats": {},
                "centrality_scores": {},
                "communities": [],
                "message": "Not enough content for network analysis"
            }
        
        # Build adjacency matrix based on topic similarity
        nodes = {item['id']: item for item in content_data}
        edges = []
        adjacency = defaultdict(list)
        
        for i, item1 in enumerate(content_data):
            topics1 = set(item1.get('key_topics', []))
            for j, item2 in enumerate(content_data[i+1:], i+1):
                topics2 = set(item2.get('key_topics', []))
                
                # Calculate topic overlap
                overlap = len(topics1 & topics2)
                total_topics = len(topics1 | topics2)
                
                if overlap > 0 and total_topics > 0:
                    similarity = overlap / total_topics
                    if similarity >= 0.2:  # Minimum similarity threshold
                        edges.append({
                            "source": item1['id'],
                            "target": item2['id'],
                            "weight": similarity,
                            "shared_topics": list(topics1 & topics2)
                        })
                        adjacency[item1['id']].append(item2['id'])
                        adjacency[item2['id']].append(item1['id'])
        
        # Calculate network statistics
        num_nodes = len(nodes)
        num_edges = len(edges)
        density = (2 * num_edges) / (num_nodes * (num_nodes - 1)) if num_nodes > 1 else 0
        
        # Calculate degree centrality
        degree_centrality = {}
        for node_id in nodes:
            degree_centrality[node_id] = len(adjacency[node_id])
        
        # Find connected components
        visited = set()
        components = []
        
        def dfs(node_id, component):
            if node_id in visited:
                return
            visited.add(node_id)
            component.append(node_id)
            for neighbor in adjacency[node_id]:
                dfs(neighbor, component)
        
        for node_id in nodes:
            if node_id not in visited:
                component = []
                dfs(node_id, component)
                if component:
                    components.append(component)
        
        # Find communities (simple modularity-based)
        communities = []
        for i, component in enumerate(components):
            if len(component) >= 3:  # Minimum community size
                community_nodes = [nodes[node_id] for node_id in component]
                
                # Analyze community characteristics
                content_types = Counter(node.get('content_type', 'Unknown') for node in community_nodes)
                all_topics = []
                for node in community_nodes:
                    if node.get('key_topics'):
                        all_topics.extend(node['key_topics'])
                
                common_topics = [topic for topic, count in Counter(all_topics).most_common(3)]
                avg_quality = sum(node.get('quality_score', 0) for node in community_nodes) / len(community_nodes)
                
                communities.append({
                    "id": i,
                    "name": f"Community {i + 1}",
                    "size": len(component),
                    "nodes": component,
                    "characteristics": {
                        "content_types": dict(content_types),
                        "common_topics": common_topics,
                        "average_quality": round(avg_quality, 2)
                    }
                })
        
        # Top central nodes
        top_central_nodes = sorted(
            degree_centrality.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return {
            "network_stats": {
                "num_nodes": num_nodes,
                "num_edges": num_edges,
                "density": round(density, 4),
                "num_components": len(components),
                "largest_component": max(len(comp) for comp in components) if components else 0,
                "average_degree": round(sum(degree_centrality.values()) / len(degree_centrality), 2) if degree_centrality else 0
            },
            "centrality_scores": {
                str(node_id): score for node_id, score in top_central_nodes
            },
            "communities": communities,
            "edges": edges[:100],  # Limit for performance
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Network analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/export/formats")
async def export_in_multiple_formats(
    format_type: str = "json",
    include_embeddings: bool = False,
    include_content: bool = False
):
    """Export data in various formats (JSON, CSV, GraphML, etc.)"""
    try:
        # Select fields based on parameters
        fields = 'id, url, title, summary, content_type, key_topics, quality_score, processing_method, visit_timestamp'
        
        if include_embeddings:
            fields += ', embedding'
        if include_content:
            fields += ', content'
        
        response = db.client.table('processed_content').select(fields).execute()
        data = response.data or []
        
        if format_type == "json":
            export_data = {
                "version": "2.0.0",
                "exported_at": datetime.now().isoformat(),
                "total_items": len(data),
                "includes_embeddings": include_embeddings,
                "includes_content": include_content,
                "items": data
            }
            return export_data
            
        elif format_type == "csv":
            # Convert to CSV-friendly format
            csv_data = []
            for item in data:
                csv_row = {
                    "id": item['id'],
                    "url": item.get('url', ''),
                    "title": item.get('title', ''),
                    "summary": item.get('summary', ''),
                    "content_type": item.get('content_type', ''),
                    "topics": '; '.join(item.get('key_topics', [])),
                    "quality_score": item.get('quality_score', 0),
                    "processing_method": item.get('processing_method', ''),
                    "visit_timestamp": item.get('visit_timestamp', '')
                }
                
                if include_content:
                    csv_row["content"] = item.get('content', '')
                
                csv_data.append(csv_row)
            
            return {
                "format": "csv",
                "data": csv_data,
                "exported_at": datetime.now().isoformat()
            }
            
        elif format_type == "graphml":
            # Create GraphML structure
            nodes = []
            edges = []
            
            # Process nodes
            for item in data:
                nodes.append({
                    "id": str(item['id']),
                    "title": item.get('title', ''),
                    "type": item.get('content_type', ''),
                    "quality": item.get('quality_score', 0),
                    "url": item.get('url', '')
                })
            
            # Create edges based on topic similarity
            for i, item1 in enumerate(data):
                topics1 = set(item1.get('key_topics', []))
                for j, item2 in enumerate(data[i+1:], i+1):
                    topics2 = set(item2.get('key_topics', []))
                    
                    overlap = len(topics1 & topics2)
                    if overlap > 0:
                        edges.append({
                            "source": str(item1['id']),
                            "target": str(item2['id']),
                            "weight": overlap,
                            "shared_topics": list(topics1 & topics2)
                        })
            
            return {
                "format": "graphml",
                "nodes": nodes,
                "edges": edges,
                "metadata": {
                    "exported_at": datetime.now().isoformat(),
                    "total_nodes": len(nodes),
                    "total_edges": len(edges)
                }
            }
            
        else:
            raise ValueError(f"Unsupported export format: {format_type}")
            
    except Exception as e:
        logger.error(f"Export failed: {e}")
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

@app.get("/")
async def root():
    return {
        "message": "MindCanvas - Simple AI Knowledge Graph",
        "version": "1.0",
        "features": [
            "vector_search",
            "content_clustering", 
            "dual_llm_processing",
            "supabase_database"
        ],
        "endpoints": {
            "ingest": "POST /api/ingest",
            "search": "POST /api/search/semantic",
            "content": "GET /api/content",
            "dashboard": "GET /static/index.html"
        }
    }

if __name__ == "__main__":
    import uvicorn
    # Use different port if 8000 is blocked
    uvicorn.run("main:app", host="127.0.0.1", port=8090, reload=True)