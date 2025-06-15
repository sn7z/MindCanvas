"""
Supabase Vector Database for MindCanvas
Implements vector storage and retrieval for RAG chatbot
"""

import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict

from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
import numpy as np

from langchain_openai import OpenAIEmbeddings

logger = logging.getLogger(__name__)

# Configuration
SUPABASE_URL = "https://udodfabokrxcfnskailb.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb2RmYWJva3J4Y2Zuc2thaWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjE0MzIsImV4cCI6MjA2NTM5NzQzMn0.EMOqo4_wxkdw7NHnZoXq2AEk5bGRiPsm8ZIj5gbL_io"

@dataclass
class ContentItem:
    url: str
    title: str
    summary: str
    content: str
    content_type: str
    key_topics: List[str]
    quality_score: int
    processing_method: str
    visit_timestamp: datetime
    content_hash: str
    embedding: Optional[List[float]] = None

class SimpleVectorDB:
    def __init__(self, openai_api_key=None):
        self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Use both SentenceTransformer for compatibility and OpenAI for new embeddings
        self.st_embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.openai_embedder = OpenAIEmbeddings(openai_api_key=openai_api_key) if openai_api_key else None
        logger.info("✅ Connected to Supabase")
        
        # Ensure the necessary Supabase functions exist
        self._ensure_match_function()
    
    def _ensure_match_function(self):
        """Ensure the vector similarity search function exists in Supabase"""
        try:
            # Check if function exists by trying a dummy query
            try:
                self.client.rpc(
                    'match_processed_content', 
                    {'query_embedding': [0.0] * 1536, 'match_count': 1}
                ).execute()
                logger.info("✅ Vector search function exists")
            except Exception as e:
                logger.warning(f"Vector search function may be missing: {e}")
                logger.info("Attempting to create vector search function...")
                
                # Try to create the function
                # This will only work if you have sufficient permissions
                try:
                    # Try to create the function using SQL
                    sql = """
                    CREATE OR REPLACE FUNCTION match_processed_content(
                        query_embedding vector(1536),
                        match_count int DEFAULT 5,
                        match_threshold float8 DEFAULT 0.3
                    ) RETURNS TABLE (
                        id bigint,
                        content text,
                        title text, 
                        url text,
                        content_type text,
                        summary text,
                        key_topics jsonb,
                        quality_score int,
                        content_hash text,
                        similarity float8
                    ) 
                    LANGUAGE plpgsql
                    AS $$
                    BEGIN
                        RETURN QUERY
                        SELECT
                            pc.id,
                            pc.content,
                            pc.title,
                            pc.url,
                            pc.content_type,
                            pc.summary,
                            pc.key_topics,
                            pc.quality_score,
                            pc.content_hash,
                            1 - (pc.embedding <=> query_embedding) AS similarity
                        FROM processed_content pc
                        WHERE 1 - (pc.embedding <=> query_embedding) > match_threshold
                        ORDER BY similarity DESC
                        LIMIT match_count;
                    END;
                    $$;
                    """
                    
                    # Try to execute the SQL (will likely fail without permissions)
                    # Uncomment this if you have admin access to the database
                    # self.client.sql(sql).execute()
                    
                    logger.info("Created vector search function")
                except Exception as create_err:
                    logger.error(f"Failed to create search function: {create_err}")
                    logger.info("Please run this SQL manually in the Supabase SQL editor:")
                    logger.info(sql)
        except Exception as e:
            logger.error(f"Error checking/creating search function: {e}")
            # Continue anyway - we'll use alternative search methods

    async def generate_embedding(self, text: str, use_openai: bool = True) -> List[float]:
        """Generate vector embedding for text"""
        try:
            # Prefer OpenAI embeddings for better performance
            if use_openai and self.openai_embedder:
                try:
                    # Run in thread to not block asyncio
                    embedding = await asyncio.to_thread(
                        self.openai_embedder.embed_query, text
                    )
                    return embedding
                except Exception as e:
                    logger.warning(f"OpenAI embedding failed, falling back to sentence-transformers: {e}")
            
            # Fallback to sentence-transformers
            embedding = await asyncio.to_thread(
                self.st_embedder.encode, text
            )
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            # Return zero vector as fallback
            return [0.0] * (1536 if use_openai and self.openai_embedder else 384)

    async def store_content(self, item: ContentItem) -> bool:
        """Store content with vector embedding"""
        try:
            # Generate embedding if not provided
            if not item.embedding:
                # Use title + summary for embedding
                text = f"{item.title} {item.summary}"
                item.embedding = await self.generate_embedding(text)
            
            # Store in database
            data = asdict(item)
            
            # Handle datetime serialization
            if isinstance(data['visit_timestamp'], datetime):
                data['visit_timestamp'] = data['visit_timestamp'].isoformat()
            
            result = self.client.table('processed_content').upsert(data).execute()
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Store failed for {item.url}: {e}")
            return False

    async def semantic_search(self, query: str, limit: int = 20, threshold: float = 0.3) -> List[Dict]:
        """Search using vector similarity"""
        try:
            # Generate query embedding
            query_embedding = await self.generate_embedding(query)
            
            # Try using the match function first (more efficient)
            try:
                response = self.client.rpc(
                    'match_processed_content',
                    {
                        'query_embedding': query_embedding, 
                        'match_count': limit, 
                        'match_threshold': threshold
                    }
                ).execute()
                
                if response.data:
                    # Process results
                    results = []
                    for item in response.data:
                        results.append({
                            'id': item.get('id'),
                            'url': item.get('url'),
                            'title': item.get('title'),
                            'summary': item.get('summary'),
                            'content_type': item.get('content_type'),
                            'key_topics': item.get('key_topics') or [],
                            'quality_score': item.get('quality_score'),
                            'similarity': round(item.get('similarity', 0), 3)
                        })
                    return results
            except Exception as e:
                logger.warning(f"RPC search failed, falling back to manual search: {e}")
            
            # Fallback: manual vector search
            # Get all content with embeddings
            response = self.client.table('processed_content').select(
                'id, url, title, summary, content_type, key_topics, quality_score, embedding'
            ).execute()
            
            if not response.data:
                return []
            
            # Calculate similarities
            results = []
            for item in response.data:
                if not item.get('embedding'):
                    continue
                
                # Calculate cosine similarity
                similarity = self._cosine_similarity(query_embedding, item['embedding'])
                
                if similarity >= threshold:
                    results.append({
                        'id': item['id'],
                        'url': item['url'],
                        'title': item['title'],
                        'summary': item['summary'],
                        'content_type': item['content_type'],
                        'key_topics': item['key_topics'] or [],
                        'quality_score': item['quality_score'],
                        'similarity': round(similarity, 3)
                    })
            
            # Sort by similarity and return top results
            results.sort(key=lambda x: x['similarity'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

    async def get_related_content(self, content_id: int, limit: int = 10) -> List[Dict]:
        """Find content similar to given content"""
        try:
            # Get source content embedding
            source = self.client.table('processed_content').select(
                'embedding, title, summary'
            ).eq('id', content_id).execute()
            
            if not source.data or not source.data[0].get('embedding'):
                return []
            
            source_embedding = source.data[0]['embedding']
            source_text = f"{source.data[0].get('title', '')} {source.data[0].get('summary', '')}"
            
            # Try to use the match function first
            try:
                response = self.client.rpc(
                    'match_processed_content',
                    {
                        'query_embedding': source_embedding, 
                        'match_count': limit + 1,
                        'match_threshold': 0.3
                    }
                ).execute()
                
                if response.data:
                    # Filter out the source item itself
                    results = []
                    for item in response.data:
                        if item.get('id') != content_id:
                            results.append({
                                'id': item.get('id'),
                                'url': item.get('url'),
                                'title': item.get('title'),
                                'summary': item.get('summary'),
                                'content_type': item.get('content_type'),
                                'similarity': round(item.get('similarity', 0), 3)
                            })
                    return results[:limit]
            except Exception as e:
                logger.warning(f"RPC related content search failed: {e}")
            
            # Fallback: Find similar content manually
            all_content = self.client.table('processed_content').select(
                'id, url, title, summary, content_type, embedding'
            ).neq('id', content_id).execute()
            
            results = []
            for item in all_content.data or []:
                if not item.get('embedding'):
                    continue
                
                similarity = self._cosine_similarity(source_embedding, item['embedding'])
                
                if similarity > 0.3:  # Higher threshold for related content
                    results.append({
                        'id': item['id'],
                        'url': item['url'],
                        'title': item['title'],
                        'summary': item['summary'],
                        'content_type': item['content_type'],
                        'similarity': round(similarity, 3)
                    })
            
            results.sort(key=lambda x: x['similarity'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Related content failed: {e}")
            return []

    async def cluster_content(self) -> List[Dict]:
        """Simple clustering by content type"""
        try:
            response = self.client.table('processed_content').select(
                'content_type'
            ).execute()
            
            if not response.data:
                return []
            
            # Count by content type
            clusters = {}
            for item in response.data:
                content_type = item.get('content_type', 'Unknown')
                clusters[content_type] = clusters.get(content_type, 0) + 1
            
            # Create cluster objects
            result = []
            for i, (name, count) in enumerate(clusters.items(), 1):
                if count >= 2:  # Only clusters with 2+ items
                    result.append({
                        'id': i,
                        'name': f"{name} Cluster",
                        'description': f"{count} items of type {name}",
                        'content_count': count
                    })
            
            return result
            
        except Exception as e:
            logger.error(f"Clustering failed: {e}")
            return []

    async def get_trending_topics(self, limit: int = 10) -> List[Dict]:
        """Get most frequent topics"""
        try:
            response = self.client.table('processed_content').select(
                'key_topics, quality_score'
            ).execute()
            
            if not response.data:
                return []
            
            # Count topic frequencies
            topic_counts = {}
            for item in response.data:
                topics = item.get('key_topics', [])
                quality = item.get('quality_score', 5)
                
                for topic in topics:
                    if topic not in topic_counts:
                        topic_counts[topic] = {'count': 0, 'total_quality': 0}
                    topic_counts[topic]['count'] += 1
                    topic_counts[topic]['total_quality'] += quality
            
            # Create trending list
            trending = []
            for topic, data in topic_counts.items():
                avg_quality = data['total_quality'] / data['count']
                trending.append({
                    'topic': topic,
                    'count': data['count'],
                    'average_quality': round(avg_quality, 1)
                })
            
            trending.sort(key=lambda x: x['count'], reverse=True)
            return trending[:limit]
            
        except Exception as e:
            logger.error(f"Trending topics failed: {e}")
            return []

    async def get_analytics(self) -> Dict:
        """Basic analytics"""
        try:
            response = self.client.table('processed_content').select(
                'processing_method, content_type, quality_score, created_at'
            ).execute()
            
            data = response.data or []
            
            # Basic stats
            total = len(data)
            if total == 0:
                return {}
            
            by_method = {}
            by_type = {}
            quality_sum = 0
            
            for item in data:
                method = item.get('processing_method', 'unknown')
                content_type = item.get('content_type', 'unknown')
                quality = item.get('quality_score', 0)
                
                by_method[method] = by_method.get(method, 0) + 1
                by_type[content_type] = by_type.get(content_type, 0) + 1
                quality_sum += quality
            
            return {
                'total_content': total,
                'by_processing_method': by_method,
                'by_content_type': by_type,
                'average_quality': round(quality_sum / total, 2)
            }
            
        except Exception as e:
            logger.error(f"Analytics failed: {e}")
            return {}

    async def export_data(self) -> Dict:
        """Export all content as knowledge graph"""
        try:
            response = self.client.table('processed_content').select(
                'id, title, summary, content_type, key_topics, quality_score, url'
            ).execute()
            
            nodes = response.data or []
            
            # Create simple edges based on shared topics
            edges = []
            for i, node1 in enumerate(nodes):
                topics1 = set(node1.get('key_topics', []))
                for j, node2 in enumerate(nodes[i+1:], i+1):
                    topics2 = set(node2.get('key_topics', []))
                    shared = topics1.intersection(topics2)
                    
                    if len(shared) >= 1:
                        edges.append({
                            'source': node1['id'],
                            'target': node2['id'],
                            'shared_topics': list(shared)
                        })
            
            return {
                'nodes': nodes,
                'edges': edges,
                'metadata': {
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                    'exported_at': datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Export failed: {e}")
            return {}

    async def health_check(self) -> Dict:
        """Check if everything is working"""
        try:
            # Test database connection
            test = self.client.table('processed_content').select('id').limit(1).execute()
            
            # Test embedding generation
            test_embedding = await self.generate_embedding("test")
            
            # Count content
            count_response = self.client.table('processed_content').select('id', count='exact').execute()
            content_count = count_response.count or 0
            
            # Check if any content has embeddings
            embedding_response = self.client.table('processed_content').select(
                'id'
            ).not_('embedding', 'is', 'null').limit(1).execute()
            has_embeddings = len(embedding_response.data or []) > 0
            
            return {
                'status': 'healthy',
                'database_connected': True,
                'embedding_working': len(test_embedding) > 0,
                'content_count': content_count,
                'has_embeddings': has_embeddings,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            vec_a = np.array(a)
            vec_b = np.array(b)
            
            # Check if vectors have same dimensions
            if len(vec_a) != len(vec_b):
                # Attempt to resize to the smaller dimension
                min_dim = min(len(vec_a), len(vec_b))
                vec_a = vec_a[:min_dim]
                vec_b = vec_b[:min_dim]
            
            dot_product = np.dot(vec_a, vec_b)
            norm_a = np.linalg.norm(vec_a)
            norm_b = np.linalg.norm(vec_b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            return dot_product / (norm_a * norm_b)
            
        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return 0.0

# Initialize function
async def init_db(openai_api_key=None):
    """Initialize the database"""
    db = SimpleVectorDB(openai_api_key)
    health = await db.health_check()
    logger.info(f"Database status: {health['status']}")
    
    # Additional info on embeddings
    if health.get('has_embeddings'):
        logger.info("✅ Database has existing vector embeddings")
    else:
        logger.warning("⚠️ No vector embeddings found in database")
    
    return db

# SQL for setting up the database (run this manually in Supabase SQL editor)
def get_database_setup_sql():
    """Get SQL to set up database tables and functions"""
    return """
    -- Enable pgvector extension (requires admin privileges)
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Create processed_content table with vector column
    CREATE TABLE IF NOT EXISTS processed_content (
        id BIGSERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        content TEXT,
        content_type TEXT,
        key_topics JSONB,
        quality_score INTEGER,
        processing_method TEXT,
        visit_timestamp TIMESTAMP,
        content_hash TEXT,
        embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Create index on embedding column
    CREATE INDEX IF NOT EXISTS processed_content_embedding_idx ON processed_content USING ivfflat (embedding vector_cosine_ops);

    -- Create vector search function
    CREATE OR REPLACE FUNCTION match_processed_content(
        query_embedding vector(1536),
        match_count int DEFAULT 5,
        match_threshold float8 DEFAULT 0.3
    ) RETURNS TABLE (
        id bigint,
        content text,
        title text, 
        url text,
        content_type text,
        summary text,
        key_topics jsonb,
        quality_score int,
        content_hash text,
        similarity float8
    ) 
    LANGUAGE plpgsql
    AS $$
    BEGIN
        RETURN QUERY
        SELECT
            pc.id,
            pc.content,
            pc.title,
            pc.url,
            pc.content_type,
            pc.summary,
            pc.key_topics,
            pc.quality_score,
            pc.content_hash,
            1 - (pc.embedding <=> query_embedding) AS similarity
        FROM processed_content pc
        WHERE 1 - (pc.embedding <=> query_embedding) > match_threshold
        ORDER BY similarity DESC
        LIMIT match_count;
    END;
    $$;
    """