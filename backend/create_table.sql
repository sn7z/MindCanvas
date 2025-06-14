-- MindCanvas Database Table Creation
-- Run this in Supabase SQL Editor
-- Enable vector extension first
CREATE EXTENSION IF NOT EXISTS vector;
-- Create main content table with vector support
CREATE TABLE IF NOT EXISTS processed_content (
    id BIGSERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    content_type TEXT DEFAULT 'Web Content',
    key_topics JSONB DEFAULT '[]'::jsonb,
    quality_score INTEGER DEFAULT 5 CHECK (
        quality_score >= 1
        AND quality_score <= 10
    ),
    processing_method TEXT DEFAULT 'ai',
    visit_timestamp TIMESTAMPTZ DEFAULT NOW(),
    content_hash TEXT,
    embedding vector(384),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create vector similarity index for fast search
CREATE INDEX IF NOT EXISTS idx_content_embedding ON processed_content USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- Create other useful indexes
CREATE INDEX IF NOT EXISTS idx_content_quality ON processed_content(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_type ON processed_content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_created ON processed_content(created_at DESC);
-- Test the setup
INSERT INTO processed_content (url, title, summary, content, embedding)
VALUES (
        'https://test.com',
        'Test Content',
        'This is a test',
        'Test content for setup verification',
        array_fill(0.1::real, ARRAY [384])::vector
    );
-- Remove test data
DELETE FROM processed_content
WHERE url = 'https://test.com';
-- Verify table structure
SELECT column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'processed_content';
-- Success message
SELECT 'MindCanvas table created successfully!' as status;