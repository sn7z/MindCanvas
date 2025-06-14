# 🧠 MindCanvas - Simple AI Knowledge Graph

Turn your browsing history into smart, searchable knowledge with vector embeddings.

## ⚡ Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Get API Keys (Free)

- **Groq**: [console.groq.com](https://console.groq.com) (fast, free)
- **OpenAI**: [platform.openai.com](https://platform.openai.com) (backup)

### 3. Set Environment Variables

Create `.env` file:

```env
GROQ_API_KEY=your_groq_key_here
OPENAI_API_KEY=your_openai_key_here
```

### 4. Run Setup

```bash
python setup.py
```

### 5. Start Application

```bash
python main.py
```

Open: `http://localhost:8090/static/index.html`

**Note**: Using port 8090 to avoid Windows port conflicts.

### 6. Install Chrome Extension

1. Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. "Load unpacked" → Select `extension-exporter` folder
4. Use extension to export history

## 🎯 Features

- **Vector Search**: Find content by meaning, not just keywords
- **Smart Processing**: Groq Llama + OpenAI dual LLM system
- **Auto Clustering**: Group similar content automatically
- **Quality Scoring**: Rate content usefulness 1-10
- **Trending Topics**: See what you're learning about
- **Export Data**: Download your knowledge graph

## 📊 API Endpoints

- `POST /api/ingest` - Process browser history
- `POST /api/search/semantic` - Vector search
- `GET /api/content` - Get all content
- `GET /api/trending` - Trending topics
- `GET /api/analytics` - Learning analytics

## 🛠️ Simple Architecture

```
Chrome Extension → FastAPI Backend → Supabase Database
     ↓                    ↓                  ↓
History URLs → Content Extraction → Vector Storage
     ↓                    ↓                  ↓
LLM Processing → Semantic Search → Knowledge Graph
```

## 💾 Database

Uses Supabase (PostgreSQL + pgvector) for:

- Content storage with metadata
- Vector embeddings (384 dimensions)
- Similarity search
- Analytics tracking

## 🚨 Troubleshooting

**No results in search?**

- Export more content via Chrome extension
- Check that API keys are set correctly

**Extension not working?**

- Make sure backend is running on port 8090
- Check browser console for errors

**Database errors?**

- Database auto-creates tables as needed
- Restart application if issues persist

## 🔧 Configuration

Edit `main.py` for settings:

```python
BATCH_SIZE = 10              # URLs processed at once
MAX_CONTENT_LENGTH = 1500    # Max text length
MIN_CONTENT_LENGTH = 30      # Min text length
```

Edit `supabase_db.py` for vector settings:

```python
# Embedding model (384 dimensions, fast)
SentenceTransformer('all-MiniLM-L6-v2')
```

## 📈 Usage Tips

1. **Export regularly** - Use Chrome extension daily
2. **Quality content** - Focus on educational/reference sites
3. **Use semantic search** - Try "machine learning concepts" vs exact phrases
4. **Check trending** - See what topics you're exploring
5. **Export data** - Backup your knowledge graph

## 🎮 Demo Flow

1. Install extension and export 20-50 URLs
2. Wait for processing (watch logs)
3. Try semantic search: "python tutorials"
4. Browse clusters and trending topics
5. Export your knowledge graph

## 📁 Project Structure

```
mindcanvas/
├── main.py              # FastAPI backend
├── supabase_db.py       # Vector database
├── requirements.txt     # Dependencies
├── setup.py            # Database setup
├── .env                # API keys
├── static/
│   └── index.html      # Dashboard
└── extension-exporter/  # Chrome extension
    ├── manifest.json
    ├── background.js
    ├── popup.html
    └── popup.js
```

## 🚀 Production Deploy

For production use:

1. Use proper environment variables
2. Add authentication middleware
3. Configure CORS properly
4. Use production Supabase plan
5. Add rate limiting
6. Enable HTTPS

---

**Simple, working, and powerful. Start building your AI knowledge graph today!**
