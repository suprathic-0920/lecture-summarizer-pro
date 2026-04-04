# 🧠 Lecture Summarizer Pro

**AI-Powered Smart Notes Generator — Turn any lecture into structured, study-ready material in seconds.**

**Team Members:** Suprathic & Rishikesh

---

## 📌 Problem Statement

Students lose **40–80% of lecture content within 24 hours** (Ebbinghaus forgetting curve). Traditional note-taking is slow, incomplete, and unstructured. Existing tools like ChatGPT require internet, cost money, and send your data to external servers — a privacy concern for students dealing with exam prep and research material.

**We asked:** What if students could paste a transcript or upload a lecture recording and get instant, structured, AI-powered study notes — all running locally with zero cost and full privacy?

---

## 🚀 Solution — Lecture Summarizer Pro

A web application that takes lecture content (text or audio) and generates:

| Output | Description |
|--------|-------------|
| **Lecture Insights** | Difficulty level (Beginner/Intermediate/Advanced), prerequisite topics, and related topics to explore next |
| **Detailed Summary** | 150+ word comprehensive summary with auto-highlighted key terms and word count |
| **Interactive Flashcards** | 3D flip cards for active recall — hover to reveal key concepts |
| **Study Timeline** | AI-generated action items and study tasks based on lecture content |
| **Audio Transcription** | Full transcription displayed when audio input is used |

**Additional Features:**
- 🔊 **Read Aloud** — Text-to-speech for the summary using Web Speech API
- 📲 **WhatsApp Share** — One-click sharing of notes to WhatsApp
- 📄 **PDF Export** — Save notes as a styled PDF with dark theme preserved
- 🔄 **Auto-Retry System** — If the AI misses fields, a focused second call extracts missing data automatically

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                    │
│  Vanilla HTML/CSS/JS • Glassmorphism Dark UI             │
│  3D Flashcards • Timeline • PDF Export • TTS             │
└──────────────┬───────────────────┬───────────────────────┘
               │ Text Input        │ Audio Upload
               ▼                   ▼
┌──────────────────────────────────────────────────────────┐
│                 BACKEND (Node.js + Express)               │
│              API Server on localhost:3000                  │
│                                                          │
│  POST /api/summarize-text ──► Ollama (Llama 3 Local)     │
│  POST /api/summarize-audio ──► Groq Whisper API (STT)    │
│                                  │                        │
│                                  ▼                        │
│                          Ollama (Llama 3 Local)           │
│                                                          │
│  Features: Example-driven prompts, auto-retry,           │
│  JSON normalization, debug logging                        │
└──────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User pastes text or uploads audio file
2. Audio → Groq Whisper API transcribes to text
3. Text → Ollama (Llama 3) generates structured JSON with 6 fields
4. If any fields are empty → auto-retry with focused prompt → merge results
5. Server normalizes response (handles objects/strings) → sends to frontend
6. Frontend renders summary, flashcards, timeline, and metadata

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | HTML5 / CSS3 / Vanilla JS | Responsive dark UI with glassmorphism, 3D card animations |
| Backend | Node.js + Express.js | REST API server handling text and audio endpoints |
| AI Summarization | Ollama + Llama 3 (8B) | 100% local inference — zero API cost, full data privacy |
| Speech-to-Text | Groq Whisper Large V3 API | Fastest Whisper inference for audio transcription |
| PDF Generation | html2canvas + jsPDF | Client-side PDF export preserving dark theme |
| Text-to-Speech | Web Speech API | Built-in browser TTS, zero dependencies |
| File Handling | Multer | Server-side audio file upload handling |

---

## 🤖 GenAI Tools Used in Development

| # | Tool | How We Used It |
|---|------|---------------|
| 1 | **Claude AI (Anthropic)** | Code generation, prompt engineering, debugging, architecture design, retry logic implementation |
| 2 | **Ollama / Llama 3** | Core AI engine — local summarization, key point extraction, metadata generation |
| 3 | **Groq Whisper API** | Speech-to-text transcription for audio lecture input |
| 4 | **Google Gemini** | Initial ideation, feature brainstorming, UX research |

---

## 📦 Installation & Setup

### Prerequisites
- **Node.js** v18+ installed
- **Ollama** installed ([ollama.com](https://ollama.com))
- **Groq API Key** (free at [console.groq.com](https://console.groq.com))

### Step 1: Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/lecture-summarizer-pro.git
cd lecture-summarizer-pro
```

### Step 2: Install dependencies
```bash
npm install express cors multer axios dotenv form-data
```

### Step 3: Pull the Llama 3 model
```bash
ollama pull llama3
```

### Step 4: Configure environment
Create a `.env` file in the root directory:
```
GROQ_API_KEY=your_groq_api_key_here
```

### Step 5: Start the application
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start the backend server
node server.js

# Terminal 3: Open the frontend
# Open index.html in your browser
# Or use Live Server extension in VS Code
```

The server runs at `http://localhost:3000`

---

## 📁 Project Structure

```
lecture-summarizer-pro/
├── index.html          # Frontend UI — dark theme, flashcards, timeline
├── server.js           # Backend API — Ollama + Groq integration
├── test.js             # Test script for Ollama connectivity
├── package.json        # Node.js dependencies
├── .env                # API keys (not committed)
├── .gitignore          # Ignores node_modules, .env, uploads/
├── uploads/            # Temporary audio file storage (auto-cleaned)
└── README.md           # This file
```

---

## 🎯 Key Technical Highlights

### Example-Driven Prompt Engineering
Local LLMs struggle with complex JSON schemas. We solved this by including a complete example JSON output (photosynthesis lecture) in every prompt, so Llama 3 reliably generates all 6 fields.

### Auto-Retry System
If the first Ollama call returns empty arrays for key_points or action_items, a second focused prompt automatically extracts just the missing fields and merges them with the original result.

### Object Normalization
Ollama sometimes returns objects `{text: "..."}` instead of plain strings. Both server-side (`normalizeArray`) and client-side (`toText`) handlers ensure clean string output regardless of format.

### Privacy-First Design
The AI summarization runs entirely on the user's machine via Ollama. No lecture content, exam notes, or research material ever leaves the local environment.

---

## 🖼️ Screenshots

### Main Interface
Dark glassmorphism UI with dual input options (text paste / audio upload)

### Results View
Lecture Insights bar showing difficulty, prerequisites, and related topics. Detailed summary with highlighted terms. Interactive 3D flashcards. Study timeline with action items.

### PDF Export
Full dark-themed PDF export preserving all visual elements.

---

## 🔮 Future Roadmap

- 🎥 **YouTube URL Input** — Paste a lecture URL, auto-extract audio via yt-dlp
- 📝 **Quiz Generator** — Auto-generate MCQ questions from key points
- 🌍 **Multi-Language Support** — Tamil, Hindi, Telugu (Whisper already supports 50+ languages)
- 📅 **Spaced Repetition** — SM-2 algorithm for flashcard review scheduling
- 🗺️ **Concept Mind Map** — Visual knowledge graph using D3.js

---


## 📄 License

This project was built as part of the Vibe Coding Challenge hackathon at TCE Madurai.
