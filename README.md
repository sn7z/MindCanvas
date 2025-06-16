# MindCanvas - AI Knowledge Graph

Transform your browsing history into an intelligent, searchable knowledge network. MindCanvas uses AI to analyze your web content, extract relationships, and create an interactive knowledge graph you can explore and query.

## 🎯 Problem Statement

In our information-rich digital age, we consume vast amounts of content daily through browsing, reading articles, tutorials, and documentation. However, this knowledge remains scattered and disconnected, making it nearly impossible to:
- Discover relationships between different topics you've learned
- Recall and build upon previous knowledge effectively  
- Identify knowledge gaps in your learning journey
- Leverage AI to understand and connect your personal knowledge

MindCanvas solves this by transforming your browsing history into an intelligent, searchable knowledge network powered by AI.

## ✨ Features

- **AI Content Analysis**: Extracts topics, summaries, and quality scores using GPT-4/Groq
- **Knowledge Graph**: Interactive visualization with multiple layout algorithms
- **Semantic Search**: Find content by meaning using vector embeddings
- **RAG Chatbot**: Ask questions about your knowledge in natural language
- **Chrome Extension**: One-click history export and processing

## Preview:
  
![hp1](https://github.com/user-attachments/assets/9a70a39e-89da-46f3-9bca-dbe945536fea)

![hp2](https://github.com/user-attachments/assets/ce2101b9-3c67-4a44-a19f-8c2310f85bc3)

![hp3](https://github.com/user-attachments/assets/09d94254-2d81-4b9e-ad29-2ef83cf78369)

![hp4](https://github.com/user-attachments/assets/12632190-9177-475e-8162-0f72ed2977f3)

![bg5](https://github.com/user-attachments/assets/74d70fca-4fd0-4a69-b25f-556361c02d4b)



## 🏗️ Architecture

### Backend Stack
- **FastAPI**: High-performance Python web framework
- **Supabase**: Vector database with pgvector for embeddings
- **LangChain**: LLM orchestration and RAG implementation
- **Multiple AI Providers**: OpenAI GPT-4, Groq Llama models

### Frontend Stack
- **React 18**: Modern component-based UI
- **Cytoscape.js**: Advanced graph visualization
- **Framer Motion**: Smooth animations and transitions
- **Styled Components**: Dynamic theming and responsive design

### Browser Extension
- **Manifest V3**: Modern Chrome extension
- **Privacy-First**: All data processing happens locally
- **Batch Processing**: Efficient history export and processing

### Processing Pipeline
```
📄 Raw Content → 🧠 LLM Analysis → 📊 Quality Scoring → 🔗 Relationship Mapping
```

## 📦 Requirements

- Python 3.8+
- Node.js 16+
- Chrome browser
- OpenAI API key (required)
- Groq API key (optional)

## 🚀 Installation (Windows)

### 1. Clone Repository

```cmd
git clone https://github.com/yourusername/MindCanvas.git
cd MindCanvas
```

### 2. Backend Setup

```cmd
cd backend
pip install -r requirements.txt
```

Create `.env` file in `backend` folder or set in the System Env Vars:

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

## 💡 Usage

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

## 🎯 Use Cases

### For Students & Researchers
- Track research across multiple domains
- Discover connections between different papers/topics
- Build comprehensive knowledge maps for thesis work

### For Developers & Engineers
- Connect technical concepts across frameworks
- Build learning paths for new technologies
- Maintain awareness of evolving best practices

### For Content Creators & Writers
- Organize research for articles and content
- Find gaps in coverage for new content ideas
- Track evolution of ideas and topics over time

### For Lifelong Learners
- Visualize learning journey across disciplines
- Identify knowledge gaps and learning opportunities
- Build personal expertise maps

## 🔧 Advanced Features

### RAG-Powered Chatbot
```typescript
// Natural language queries about your knowledge
"What have I learned about React performance?"
"Show me connections between AI and design"
"What should I learn next in machine learning?"
```

### Export & Integration
- **Multiple Formats**: JSON, CSV, graph formats
- **API Access**: RESTful endpoints for external integrations
- **Knowledge Graph Export**: Use your data in other tools

### Privacy & Security
- **Local Processing**: All analysis happens on your machine
- **No Data Sharing**: Your browsing history stays private
- **Open Source**: Full transparency and customization

## 🔗 API Endpoints

- `POST /api/ingest` - Process browser history
- `POST /api/chat` - Chat with knowledge base
- `GET /api/content` - Get processed content
- `POST /api/search/semantic` - Vector search
- `GET /api/knowledge-graph/export` - Export graph data

## ⚙️ Configuration

### API Keys Required
- **OpenAI API Key**: For GPT-4 processing and embeddings
- **Groq API Key**: For Llama model processing (optional)
- **Supabase Credentials**: For vector database storage

### Customization Options
- **Graph Layouts**: Force-directed, hierarchical, circular, grid
- **Processing Models**: Choose between OpenAI, Groq, or hybrid
- **Quality Thresholds**: Filter content by quality scores
- **Refresh Intervals**: Automatic data synchronization settings

## 🗄️ Database Setup (Optional)

For production, set up Supabase:

1. Create Supabase project
2. Enable pgvector extension
3. Run SQL from `backend/supabase_db.py`
4. Update connection string in code

Default: Uses file-based storage

## 🛠️ Development

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

## 🐛 Troubleshooting

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

## 📊 Sample Output

```json
{
  "knowledge_graph": {
    "nodes": 1247,
    "connections": 3891,
    "topics_identified": 89,
    "quality_average": 7.3
  },
  "insights": {
    "top_interests": ["Machine Learning", "React Development", "System Design"],
    "knowledge_gaps": ["Backend Architecture", "Database Design"],
    "learning_velocity": "12 new concepts/week"
  }
}
```

## 🌟 Why MindCanvas?

Transform passive browsing into active knowledge building. MindCanvas doesn't just store your data—it helps you understand it, connect it, and leverage it for continuous learning and discovery.

Built for the AI age: Designed from the ground up to leverage modern AI capabilities for knowledge work, making your personal information as powerful as your professional tools.

---

*Ready to visualize your knowledge? Start building your personal knowledge graph today.*
