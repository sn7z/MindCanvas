"""
Simple Supabase Vector Database for MindCanvas
Clean, working implementation without overcomplication
"""

import json
import logging
from typing import List, Dict, Any
from datetime import datetime
from dataclasses import dataclass

from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
import numpy as np

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

class SimpleVectorDB:
    def __init__(self):
        self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✅ Connected to Supabase")
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for text"""
        try:
            embedding = self.embedder.encode(text)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            return [0.0] * 384  # Return zero vector on failure

    async def store_content(self, item: ContentItem) -> bool:
        """Store content with vector embedding"""
        try:
            # Generate embedding from title + summary
            text = f"{item.title} {item.summary}"
            embedding = self.generate_embedding(text)
            
            # Store in database
            data = {
                'url': item.url,
                'title': item.title,
                'summary': item.summary,
                'content': item.content,
                'content_type': item.content_type,
                'key_topics': item.key_topics,
                'quality_score': item.quality_score,
                'processing_method': item.processing_method,
                'visit_timestamp': item.visit_timestamp.isoformat(),
                'content_hash': item.content_hash,
                'embedding': embedding
            }
            
            result = self.client.table('processed_content').upsert(data).execute()
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Store failed for {item.url}: {e}")
            return False

    async def semantic_search(self, query: str, limit: int = 20) -> List[Dict]:
        """Search using vector similarity"""
        try:
            # Generate query embedding
            query_embedding = self.generate_embedding(query)
            
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
                
                # Cosine similarity
                similarity = self._cosine_similarity(query_embedding, item['embedding'])
                
                if similarity > 0.1:  # Basic threshold
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
                'embedding'
            ).eq('id', content_id).execute()
            
            if not source.data or not source.data[0].get('embedding'):
                return []
            
            source_embedding = source.data[0]['embedding']
            
            # Find similar content
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
            test_embedding = self.generate_embedding("test")
            
            # Count content
            count_response = self.client.table('processed_content').select('id', count='exact').execute()
            content_count = count_response.count or 0
            
            return {
                'status': 'healthy',
                'database_connected': True,
                'embedding_working': len(test_embedding) == 384,
                'content_count': content_count,
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
            
            dot_product = np.dot(vec_a, vec_b)
            norm_a = np.linalg.norm(vec_a)
            norm_b = np.linalg.norm(vec_b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            return dot_product / (norm_a * norm_b)
            
        except Exception:
            return 0.0

# Initialize function
async def init_db():
    """Initialize the database"""
    db = SimpleVectorDB()
    health = await db.health_check()
    logger.info(f"Database status: {health['status']}")
    return db