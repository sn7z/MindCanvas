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
        
        # The _ensure_match_function will be called from async init_db
    
    async def _ensure_match_function(self):
        """Ensure the vector similarity search function exists in Supabase"""
        try:
            # Check if function exists by trying a dummy query
            try:
                await asyncio.to_thread(
                    self.client.rpc(
                        'match_processed_content', 
                        {'query_embedding': [0.0] * 1536, 'match_count': 1}
                    ).execute
                )
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
        # Assuming DB is configured for 1536 dimensions (OpenAI's text-embedding-ada-002)
        target_dimension = 1536 
        text_preview = text[:80] + "..." if len(text) > 80 else text

        try:
            if use_openai and self.openai_embedder:
                logger.info(f"Attempting OpenAI embedding (dim {target_dimension}) for: \"{text_preview}\"")
                try:
                    embedding = await asyncio.to_thread(
                        self.openai_embedder.embed_query, text
                    )
                    if len(embedding) != target_dimension:
                        logger.error(f"OpenAI embedding dimension mismatch! Expected {target_dimension}, got {len(embedding)} for \"{text_preview}\". Returning zero vector.")
                        return [0.0] * target_dimension
                    logger.info(f"OpenAI embedding successful for \"{text_preview}\", dimension: {len(embedding)}")
                    return embedding
                except Exception as e:
                    logger.warning(f"OpenAI embedding failed for \"{text_preview}\": {e}. OpenAI API key might be missing or invalid.")
                    logger.info(f"Cannot fall back to SentenceTransformer for \"{text_preview}\" due to dimension mismatch (384 vs {target_dimension}). Returning zero vector.")
                    return [0.0] * target_dimension
            else:
                # This path is taken if use_openai is False OR self.openai_embedder is None (e.g. no API key)
                # If the database strictly requires 1536-dim, using ST (384-dim) here is problematic.
                logger.warning(
                    f"OpenAI embedding not attempted or not available for \"{text_preview}\". "
                    f"Current DB schema expects {target_dimension}-dim. "
                    f"Using SentenceTransformer (384-dim) will lead to incompatibility."
                )
                # Forcing a zero vector of the target dimension if OpenAI isn't used/available,
                # as ST would produce incompatible dimensions for a 1536-dim DB.
                logger.error(f"Returning {target_dimension}-dim zero vector for \"{text_preview}\" as incompatible fallback was attempted.")
                return [0.0] * target_dimension
                
        except Exception as e:
            logger.error(f"Critical embedding generation failure for \"{text_preview}\": {e}")
            return [0.0] * target_dimension

    async def store_content(self, item: ContentItem) -> bool:
        """Store content with vector embedding"""
        try:
            if not item.embedding:
                text = f"{item.title} {item.summary}"
                item.embedding = await self.generate_embedding(text, use_openai=bool(self.openai_embedder))
            
            data = asdict(item)
            
            if isinstance(data['visit_timestamp'], datetime):
                data['visit_timestamp'] = data['visit_timestamp'].isoformat()
            
            result = await asyncio.to_thread(
                self.client.table('processed_content').upsert(data).execute
            )
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Store failed for {item.url}: {e}")
            return False

    async def semantic_search(self, query: str, limit: int = 20, threshold: float = 0.3) -> List[Dict]:
        """Search using vector similarity"""
        query_preview = query[:80] + "..." if len(query) > 80 else query
        logger.info(f"Semantic search initiated for query: \"{query_preview}\"")
        try:
            query_embedding = await self.generate_embedding(query, use_openai=bool(self.openai_embedder))
            
            if not query_embedding or len(query_embedding) != 1536: # Critical check for OpenAI dimension
                logger.error(f"Failed to generate a valid 1536-dim query embedding for \"{query_preview}\". Aborting search.")
                return []
            logger.info(f"Query embedding generated for \"{query_preview}\", dimension: {len(query_embedding)}")

            try:
                logger.info(f"Attempting RPC 'match_processed_content' for \"{query_preview}\"")
                response = await asyncio.to_thread(
                    self.client.rpc(
                        'match_processed_content',
                        {
                            'query_embedding': query_embedding, 
                            'match_count': limit, 
                            'match_threshold': threshold
                        }
                    ).execute
                )
                
                if response.data:
                    logger.info(f"RPC search successful for \"{query_preview}\", found {len(response.data)} items.")
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
                else:
                    logger.info(f"RPC search for \"{query_preview}\" returned no data.")
                    return [] # Explicitly return empty list
            except Exception as e:
                logger.warning(f"RPC search for \"{query_preview}\" failed: {e}. Falling back to manual search.")
            
            logger.info(f"Attempting manual vector search for \"{query_preview}\"...")
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'id, url, title, summary, content_type, key_topics, quality_score, embedding'
                ).filter(
                    'embedding', 'isnot', 'null' # Ensure we only fetch rows with embeddings
                ).execute # Add a limit here if table is very large, e.g., .limit(1000)
            )
            
            if not response.data:
                return []
            
            # Calculate similarities
            results = []
            logger.info(f"Manual search: Fetched {len(response.data)} items with embeddings to compare against \"{query_preview}\".")
            for item in response.data:
                item_embedding = item.get('embedding')
                if not item_embedding or len(item_embedding) != 1536: # Check dimension
                    logger.warning(f"Skipping item ID {item.get('id')} due to missing or invalid dimension embedding during manual search.")
                    continue
                
                similarity = self._cosine_similarity(query_embedding, item_embedding)
                
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
            logger.info(f"Manual search for \"{query_preview}\" yielded {len(results)} results after filtering and sorting.")
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Outer semantic_search failed for \"{query_preview}\": {e}", exc_info=True)
            return [] # Ensure a list is always returned

    async def get_related_content(self, content_id: int, limit: int = 10) -> List[Dict]:
        """Find content similar to given content"""
        try:
            # Get source content embedding
            source_response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'embedding, title, summary'
                ).eq('id', content_id).execute
            )
            source = source_response.data
            
            if not source or not source[0].get('embedding'):
                return []
            
            source_embedding = source[0]['embedding']
            
            # Try to use the match function first
            try:
                response = await asyncio.to_thread(
                    self.client.rpc(
                        'match_processed_content',
                        {
                            'query_embedding': source_embedding, 
                            'match_count': limit + 1, # Fetch one more to exclude self
                            'match_threshold': 0.3
                        }
                    ).execute
                )
                
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
            all_content_response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'id, url, title, summary, content_type, embedding'
                ).neq('id', content_id).execute
            )
            
            results = []
            for item in all_content_response.data or []:
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
        """Simple and clean clustering by content type with quality weighting"""
        try:
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'id, title, content_type, quality_score, key_topics'
                ).execute
            )
            
            if not response.data:
                return []
            
            # Group by content type (primary clustering)
            type_clusters = {}
            for item in response.data:
                content_type = item.get('content_type', 'Unknown')
                if content_type not in type_clusters:
                    type_clusters[content_type] = {
                        'items': [],
                        'total_quality': 0,
                        'topic_frequency': {}
                    }
                
                type_clusters[content_type]['items'].append(item)
                type_clusters[content_type]['total_quality'] += item.get('quality_score', 5)
                
                # Count topic frequencies within each type
                topics = item.get('key_topics', [])
                if topics:
                    for topic in topics:
                        if topic not in type_clusters[content_type]['topic_frequency']:
                            type_clusters[content_type]['topic_frequency'][topic] = 0
                        type_clusters[content_type]['topic_frequency'][topic] += 1
            
            # Create clean cluster objects
            clusters = []
            for cluster_id, (content_type, cluster_data) in enumerate(type_clusters.items(), 1):
                item_count = len(cluster_data['items'])
                if item_count >= 1:  # Include all clusters, even single items
                    avg_quality = cluster_data['total_quality'] / item_count
                    
                    # Get top 3 topics for this cluster
                    top_topics = sorted(
                        cluster_data['topic_frequency'].items(),
                        key=lambda x: x[1],
                        reverse=True
                    )[:3]
                    
                    clusters.append({
                        'id': cluster_id,
                        'name': f"{content_type} Collection",
                        'description': f"{item_count} {content_type.lower()} items with avg quality {avg_quality:.1f}",
                        'content_count': item_count,
                        'content_type': content_type,
                        'average_quality': round(avg_quality, 1),
                        'top_topics': [topic for topic, count in top_topics],
                        'quality_range': {
                            'min': min(item.get('quality_score', 5) for item in cluster_data['items']),
                            'max': max(item.get('quality_score', 5) for item in cluster_data['items'])
                        }
                    })
            
            # Sort clusters by quality and size
            clusters.sort(key=lambda x: (x['average_quality'], x['content_count']), reverse=True)
            
            logger.info(f"Created {len(clusters)} clean content clusters")
            return clusters
            
        except Exception as e:
            logger.error(f"Clean clustering failed: {e}")
            return []

    async def get_trending_topics(self, limit: int = 10) -> List[Dict]:
        """Get most frequent topics"""
        try:
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'key_topics, quality_score'
                ).execute
            )
            
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

    # Also add this method for topic-based sub-clustering if needed
    async def get_topic_clusters(self, content_type: str = None) -> List[Dict]:
        """Get clusters based on topics within a content type"""
        try:
            query = self.client.table('processed_content').select(
                'id, title, content_type, quality_score, key_topics'
            )
            
            if content_type:
                query = query.eq('content_type', content_type)
            
            response = await asyncio.to_thread(query.execute)
            
            if not response.data:
                return []
            
            # Group by most frequent topic
            topic_clusters = {}
            for item in response.data:
                topics = item.get('key_topics', [])
                if not topics:
                    continue
                
                # Use the first topic as primary cluster
                primary_topic = topics[0]
                
                if primary_topic not in topic_clusters:
                    topic_clusters[primary_topic] = []
                
                topic_clusters[primary_topic].append(item)
            
            # Create topic cluster objects
            clusters = []
            for cluster_id, (topic, items) in enumerate(topic_clusters.items(), 1):
                if len(items) >= 2:  # Only clusters with 2+ items
                    avg_quality = sum(item.get('quality_score', 5) for item in items) / len(items)
                    
                    clusters.append({
                        'id': f"topic_{cluster_id}",
                        'name': f"{topic} Topics",
                        'description': f"{len(items)} items related to {topic}",
                        'content_count': len(items),
                        'topic': topic,
                        'average_quality': round(avg_quality, 1),
                        'content_types': list(set(item.get('content_type', 'Unknown') for item in items))
                    })
            
            clusters.sort(key=lambda x: x['content_count'], reverse=True)
            return clusters
            
        except Exception as e:
            logger.error(f"Topic clustering failed: {e}")
            return []
    
    async def get_analytics(self) -> Dict:
        """Basic analytics"""
        try:
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'processing_method, content_type, quality_score, created_at'
                ).execute
            )
            
            data = response.data if response and response.data else []
            
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
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'id, title, summary, content_type, key_topics, quality_score, url'
                ).execute
            )
            
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
        db_connected_status = False
        error_message = None
        try:
            # Test database connection with a very simple query
            await asyncio.to_thread(
                self.client.table('processed_content').select('id').limit(1).execute
            )
            db_connected_status = True
        except Exception as e:
            logger.error(f"Database health check connection failed: {e}")
            error_message = str(e)
            # Fall through to return unhealthy status

        embedding_service_configured = bool(self.openai_embedder) and bool(self.openai_embedder.openai_api_key)

        status = 'healthy' if db_connected_status and embedding_service_configured else 'degraded'
        if error_message: # If DB connection failed, it's unhealthy
            status = 'unhealthy'

        return_payload = {
            'status': status,
            'database_connected': db_connected_status,
            'embedding_service_configured': embedding_service_configured,
            'timestamp': datetime.now().isoformat()
        }
        if error_message:
            return_payload['error'] = error_message
            return {
                'status': 'unhealthy', 'error': str(e), 'timestamp': datetime.now().isoformat()
            }
        return return_payload

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            vec_a = np.array(a)
            vec_b = np.array(b)

            if len(vec_a) != len(vec_b):
                logger.error(f"Cosine similarity: Vector dimensions mismatch! {len(vec_a)} vs {len(vec_b)}. Returning 0.")
                return 0.0
            if len(vec_a) == 0: # Handles empty lists if they somehow get here
                return 0.0
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
    await db._ensure_match_function() # Call the async version here
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