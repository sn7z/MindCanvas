#!/usr/bin/env python3
"""
MindCanvas Data Clearing Script
Clears data while preserving database schema and structure
"""

import sqlite3
import os
import requests
from datetime import datetime

DATABASE_PATH = "mindcanvas.db"
BACKEND_URL = "http://localhost:8001"

def clear_all_data():
    """Clear all data from all tables but keep schema"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🗑️  Clearing all data...")
    
    # Clear main content table
    cursor.execute("DELETE FROM processed_content")
    deleted_content = cursor.rowcount
    
    # Clear cache tables
    cursor.execute("DELETE FROM content_cache")
    deleted_cache = cursor.rowcount
    
    # Clear old cache table if exists
    try:
        cursor.execute("DELETE FROM url_cache")
        deleted_old_cache = cursor.rowcount
    except:
        deleted_old_cache = 0
    
    # Reset auto-increment counters
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='processed_content'")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='content_cache'")
    
    conn.commit()
    conn.close()
    
    print(f"✅ Cleared {deleted_content} content items")
    print(f"✅ Cleared {deleted_cache} cache entries")
    if deleted_old_cache:
        print(f"✅ Cleared {deleted_old_cache} old cache entries")
    print("✅ Schema preserved")

def clear_content_only():
    """Clear only processed content, keep cache"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🗑️  Clearing content only (keeping cache)...")
    
    cursor.execute("DELETE FROM processed_content")
    deleted = cursor.rowcount
    
    # Reset auto-increment
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='processed_content'")
    
    conn.commit()
    conn.close()
    
    print(f"✅ Cleared {deleted} content items")
    print("✅ Cache preserved")

def clear_cache_only():
    """Clear only cache, keep processed content"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🗑️  Clearing cache only...")
    
    cursor.execute("DELETE FROM content_cache")
    deleted_cache = cursor.rowcount
    
    try:
        cursor.execute("DELETE FROM url_cache")
        deleted_old = cursor.rowcount
    except:
        deleted_old = 0
    
    # Reset auto-increment
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='content_cache'")
    
    conn.commit()
    conn.close()
    
    print(f"✅ Cleared {deleted_cache} cache entries")
    if deleted_old:
        print(f"✅ Cleared {deleted_old} old cache entries")
    print("✅ Content preserved")

def clear_expired_cache():
    """Clear only expired cache entries"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🗑️  Clearing expired cache...")
    
    cursor.execute("DELETE FROM content_cache WHERE expires_at <= ?", (datetime.now(),))
    deleted = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    print(f"✅ Cleared {deleted} expired cache entries")

def clear_low_quality():
    """Clear content with quality score below threshold"""
    threshold = input("Enter minimum quality score to keep (1-10): ")
    try:
        threshold = int(threshold)
        if threshold < 1 or threshold > 10:
            raise ValueError
    except ValueError:
        print("❌ Invalid quality score")
        return
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print(f"🗑️  Clearing content with quality < {threshold}...")
    
    cursor.execute("DELETE FROM processed_content WHERE quality_score < ?", (threshold,))
    deleted = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    print(f"✅ Cleared {deleted} low quality items")

def clear_by_method():
    """Clear content by processing method"""
    print("Available processing methods:")
    print("1. groq")
    print("2. openai") 
    print("3. pattern")
    print("4. cached")
    
    method = input("Enter method to clear (or 'all' for all): ")
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    if method.lower() == 'all':
        cursor.execute("DELETE FROM processed_content")
        deleted = cursor.rowcount
        print(f"🗑️  Cleared all {deleted} items")
    else:
        cursor.execute("DELETE FROM processed_content WHERE processing_method = ?", (method,))
        deleted = cursor.rowcount
        print(f"🗑️  Cleared {deleted} items processed with {method}")
    
    conn.commit()
    conn.close()

def show_database_stats():
    """Show current database statistics"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("\n📊 Current Database Statistics:")
    print("=" * 40)
    
    # Total content
    cursor.execute("SELECT COUNT(*) FROM processed_content")
    total_content = cursor.fetchone()[0]
    print(f"Total Content Items: {total_content}")
    
    # By processing method
    cursor.execute("SELECT processing_method, COUNT(*) FROM processed_content GROUP BY processing_method")
    methods = cursor.fetchall()
    print("\nBy Processing Method:")
    for method, count in methods:
        print(f"  {method}: {count}")
    
    # By quality score
    cursor.execute("SELECT quality_score, COUNT(*) FROM processed_content GROUP BY quality_score ORDER BY quality_score")
    quality = cursor.fetchall()
    print("\nBy Quality Score:")
    for score, count in quality:
        print(f"  Score {score}: {count}")
    
    # Cache stats
    cursor.execute("SELECT COUNT(*) FROM content_cache WHERE expires_at > ?", (datetime.now(),))
    active_cache = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM content_cache WHERE expires_at <= ?", (datetime.now(),))
    expired_cache = cursor.fetchone()[0]
    
    print(f"\nCache Statistics:")
    print(f"  Active Cache Entries: {active_cache}")
    print(f"  Expired Cache Entries: {expired_cache}")
    
    conn.close()

def clear_via_api():
    """Clear data using the API endpoint"""
    try:
        print("🗑️  Clearing via API...")
        response = requests.delete(f"{BACKEND_URL}/api/reset")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ {result['message']}")
        else:
            print(f"❌ API Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Failed to connect to API: {e}")
        print("Make sure backend is running on http://localhost:8001")

def vacuum_database():
    """Optimize database after clearing data"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🔧 Optimizing database...")
    
    # Vacuum to reclaim space
    cursor.execute("VACUUM")
    
    # Analyze to update statistics
    cursor.execute("ANALYZE")
    
    conn.close()
    print("✅ Database optimized")

def main():
    """Main menu for data clearing operations"""
    
    if not os.path.exists(DATABASE_PATH):
        print(f"❌ Database not found: {DATABASE_PATH}")
        print("Make sure you're in the correct directory")
        return
    
    while True:
        print("\n🧠 MindCanvas Data Management")
        print("=" * 35)
        print("1. 📊 Show database statistics")
        print("2. 🗑️  Clear ALL data (keep schema)")
        print("3. 📄 Clear content only (keep cache)")
        print("4. 💾 Clear cache only (keep content)")
        print("5. ⏰ Clear expired cache only")
        print("6. ⭐ Clear low quality content")
        print("7. 🔧 Clear by processing method")
        print("8. 🌐 Clear via API (backend must be running)")
        print("9. 🔧 Optimize database")
        print("0. ❌ Exit")
        
        choice = input("\nEnter your choice (0-9): ").strip()
        
        if choice == "0":
            print("👋 Goodbye!")
            break
        elif choice == "1":
            show_database_stats()
        elif choice == "2":
            confirm = input("⚠️  Clear ALL data? This cannot be undone! (yes/no): ")
            if confirm.lower() == "yes":
                clear_all_data()
                vacuum_database()
        elif choice == "3":
            clear_content_only()
        elif choice == "4":
            clear_cache_only()
        elif choice == "5":
            clear_expired_cache()
        elif choice == "6":
            clear_low_quality()
        elif choice == "7":
            clear_by_method()
        elif choice == "8":
            clear_via_api()
        elif choice == "9":
            vacuum_database()
        else:
            print("❌ Invalid choice")

if __name__ == "__main__":
    main()