# MindCanvas - AI Knowledge Graph

Transform your browsing history into an intelligent, searchable knowledge network. MindCanvas uses AI to analyze your web content, extract relationships, and create an interactive knowledge graph you can explore and query.

## Features

- **AI Content Analysis**: Extracts topics, summaries, and quality scores using GPT-4/Groq
- **Knowledge Graph**: Interactive visualization with multiple layout algorithms
- **Semantic Search**: Find content by meaning using vector embeddings
- **RAG Chatbot**: Ask questions about your knowledge in natural language
- **Chrome Extension**: One-click history export and processing

## Requirements

- Python 3.8+
- Node.js 16+
- Chrome browser
- OpenAI API key (required)
- Groq API key (optional)

## Installation (Windows)

### 1. Clone Repository

```cmd
git clone https://github.com/yourusername/mindcanvas.git
cd mindcanvas
```

### 2. Backend Setup

```cmd
cd backend
pip install -r requirements.txt
```

Create `.env` file in `backend` folder:

```env
OPENAI_API_KEY=your_openai_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

Start backend server:

```cmd
python main.py
```

Backend runs on `http://localhost:8090`

### 3. Frontend Setup

Open new terminal:

```cmd
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`

### 4. Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. Pin the extension to toolbar

## Usage

### Export Your History

1. Click the MindCanvas extension icon
2. Click "Export History (24h)"
3. Wait for processing to complete

### Explore Your Knowledge

1. Open `http://localhost:3000`
2. View your knowledge graph
3. Click nodes to see details
4. Use search (Ctrl+K) to find content
5. Chat with AI about your knowledge

### Search & Discovery

- **Semantic Search**: "machine learning concepts"
- **Text Search**: "React hooks"
- **Chat Queries**: "What have I learned about Python?"

## API Endpoints

- `POST /api/ingest` - Process browser history
- `POST /api/chat` - Chat with knowledge base
- `GET /api/content` - Get processed content
- `POST /api/search/semantic` - Vector search
- `GET /api/knowledge-graph/export` - Export graph data

## Database Setup (Optional)

For production, set up Supabase:

1. Create Supabase project
2. Enable pgvector extension
3. Run SQL from `backend/supabase_db.py`
4. Update connection string in code

Default: Uses file-based storage

## Configuration

Edit `backend/main.py`:

- `MAX_CONTENT_LENGTH`: Content truncation limit
- `BATCH_SIZE`: Processing batch size
- `EXCLUDED_DOMAINS`: Domains to ignore

Edit `frontend/src/App.js`:

- Theme colors and layout options
- Graph visualization settings

## Troubleshooting

**Backend won't start:**

- Check Python version: `python --version`
- Install dependencies: `pip install -r requirements.txt`
- Verify API keys in `.env` file

**Frontend errors:**

- Check Node version: `node --version`
- Clear cache: `npm cache clean --force`
- Reinstall: `rmdir /s node_modules && npm install`

**Extension not working:**

- Check extension is enabled in Chrome
- Verify backend is running on port 8090
- Check browser console for errors

**No graph data:**

- Export history using Chrome extension first
- Check backend logs for processing errors
- Verify API keys are working

## Development

### Add New Content Types

1. Update content type detection in `backend/main.py`
2. Add colors in `frontend/src/components/KnowledgeGraphViewer.js`
3. Update clustering logic if needed

### Customize AI Processing

1. Modify prompts in `backend/main.py`
2. Adjust quality scoring algorithm
3. Add new LLM providers in processing pipeline

### Extend Graph Features

1. Add new layout algorithms in `frontend/src/components/ControlPanel.js`
2. Implement custom node rendering
3. Add new interaction modes

## Architecture

```
┌─ Chrome Extension ─┐    ┌─ FastAPI Backend ─┐    ┌─ React Frontend ─┐
│ • History Export   │───▶│ • AI Processing   │───▶│ • Graph Viz      │
│ • Privacy-First    │    │ • Vector DB       │    │ • Search/Chat    │
└────────────────────┘    │ • RAG System     │    │ • Analytics      │
                          └───────────────────┘    └──────────────────┘
```

## License

MIT License - see LICENSE file for details.
