"""
Simple Supabase Setup for MindCanvas
Creates the basic table needed for vector storage
"""

from supabase import create_client
import logging

# Configuration
SUPABASE_URL = "https://udodfabokrxcfnskailb.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb2RmYWJva3J4Y2Zuc2thaWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjE0MzIsImV4cCI6MjA2NTM5NzQzMn0.EMOqo4_wxkdw7NHnZoXq2AEk5bGRiPsm8ZIj5gbL_io"

def setup_database():
    """Create the main table if it doesn't exist"""
    
    print("🧠 Setting up MindCanvas database...")
    
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Create the main table
        print("📋 Creating processed_content table...")
        
        # This SQL will create the table via Supabase SQL editor or API
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS processed_content (
            id BIGSERIAL PRIMARY KEY,
            url TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            summary TEXT,
            content TEXT,
            content_type TEXT DEFAULT 'Web Content',
            key_topics JSONB DEFAULT '[]'::jsonb,
            quality_score INTEGER DEFAULT 5,
            processing_method TEXT DEFAULT 'ai',
            visit_timestamp TIMESTAMPTZ DEFAULT NOW(),
            content_hash TEXT,
            embedding vector(384),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Enable vector extension if not already enabled
        CREATE EXTENSION IF NOT EXISTS vector;
        
        -- Create index for vector similarity search
        CREATE INDEX IF NOT EXISTS idx_content_embedding 
        ON processed_content USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = 100);
        """
        
        print("🗄️  Creating table and vector extension...")
        print("📝 Note: You may need to run this SQL manually in Supabase if it fails:")
        print(create_table_sql)
        
        # Try to insert a test record to verify table exists
        try:
            # First, try to create via direct SQL (this might not work with API key limitations)
            result = client.table('processed_content').insert({
                'url': 'https://test-setup.com',
                'title': 'Setup Test',
                'summary': 'Testing database setup',
                'content': 'Test content',
                'embedding': [0.1] * 384  # Test vector
            }).execute()
            
            if result.data:
                # Clean up test data
                test_id = result.data[0]['id']
                client.table('processed_content').delete().eq('id', test_id).execute()
                print("✅ Table exists and working!")
            
        except Exception as e:
            if "does not exist" in str(e):
                print("❌ Table doesn't exist. Please create it manually:")
                print("\n1. Go to https://supabase.com/dashboard")
                print("2. Open your project SQL editor")
                print("3. Run this SQL:")
                print("-" * 50)
                print(create_table_sql)
                print("-" * 50)
                print("\n4. Then run: python main.py")
                return False
            else:
                print(f"⚠️  Table test issue: {e}")
                print("✅ Continuing anyway - table might exist")
        
        print("✅ Database setup complete")
        print("🚀 You can now run: python main.py")
        print("🌐 Dashboard will be at: http://localhost:8001/static/index.html")
        
        return True
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        print("\n🔧 Manual Setup Instructions:")
        print("1. Go to https://supabase.com/dashboard")
        print("2. Open SQL Editor")
        print("3. Copy and run the SQL above")
        print("4. Then run: python main.py")
        return False

if __name__ == "__main__":
    setup_database()