require('dotenv').config();
const fs = require('fs');
const FormData = require('form-data');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios'); 

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: 'uploads/' }); 

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function normalizeArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
            const vals = Object.values(item).filter(v => typeof v === 'string');
            return vals.length > 0 ? vals.join(' — ') : JSON.stringify(item);
        }
        return String(item);
    }).filter(s => s.length > 0);
}

function normalizeString(val) {
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
        const vals = Object.values(val).filter(v => typeof v === 'string');
        return vals.length > 0 ? vals.join(' ') : JSON.stringify(val);
    }
    return String(val || '');
}

function buildResult(parsed, transcription) {
    const result = {
        summary: normalizeString(parsed.summary) || "Summary could not be generated.",
        key_points: normalizeArray(parsed.key_points),
        action_items: normalizeArray(parsed.action_items),
        difficulty_level: normalizeString(parsed.difficulty_level) || "Beginner",
        prerequisites: normalizeArray(parsed.prerequisites),
        related_topics: normalizeArray(parsed.related_topics)
    };
    if (transcription) result.transcription = transcription;
    return result;
}

// ─────────────────────────────────────────────────────────
// PROMPT WITH CONCRETE EXAMPLE (key fix for local LLMs)
// ─────────────────────────────────────────────────────────

function buildPrompt(text) {
    return `Analyze this lecture transcript and return a JSON object. You MUST fill ALL six fields. Do not leave any array empty.

Here is an EXAMPLE of the EXACT JSON format you must follow:

{
  "summary": "This lecture covered the fundamentals of photosynthesis, the process by which plants convert sunlight into chemical energy. The instructor explained that photosynthesis occurs in two stages: the light-dependent reactions in the thylakoid membranes and the Calvin cycle in the stroma. During light reactions, water molecules are split to produce oxygen, ATP, and NADPH. The Calvin cycle then uses ATP and NADPH to fix carbon dioxide into glucose through a series of enzyme-catalyzed reactions. Key enzymes discussed include RuBisCO, which catalyzes carbon fixation, and ATP synthase, which produces ATP via chemiosmosis. The lecture also covered factors affecting photosynthesis rates including light intensity, CO2 concentration, and temperature, with detailed graphs showing saturation points for each factor.",
  "key_points": [
    "Photosynthesis occurs in two stages: light-dependent reactions and the Calvin cycle",
    "Light reactions happen in thylakoid membranes and produce ATP, NADPH, and oxygen",
    "The Calvin cycle occurs in the stroma and fixes CO2 into glucose using RuBisCO enzyme",
    "ATP synthase produces ATP through chemiosmosis across the thylakoid membrane",
    "Photosynthesis rate is affected by light intensity, CO2 concentration, and temperature"
  ],
  "action_items": [
    "Draw and label a detailed diagram of the chloroplast showing thylakoid and stroma",
    "Practice tracing the flow of electrons through Photosystem II and Photosystem I",
    "Review Chapter 10 and complete the practice problems on Calvin cycle reactions",
    "Prepare for the lab experiment on measuring photosynthesis rates under different light conditions"
  ],
  "difficulty_level": "Intermediate",
  "prerequisites": [
    "Basic cell biology and organelle structure",
    "Introduction to biochemistry and enzyme function",
    "Understanding of ATP and cellular energy"
  ],
  "related_topics": [
    "Cellular respiration and glycolysis",
    "Carbon cycle and climate change",
    "Plant anatomy and leaf structure",
    "Chemiosmosis in mitochondria"
  ]
}

IMPORTANT RULES:
- "summary" must be a detailed paragraph with at least 150 words
- "key_points" must have 5 to 8 strings, each being a complete factual sentence
- "action_items" must have 3 to 5 strings, each being a specific study task
- "difficulty_level" must be exactly one of: "Beginner", "Intermediate", or "Advanced"
- "prerequisites" must have 2 to 4 strings
- "related_topics" must have 3 to 5 strings
- Every array MUST contain items. Do NOT return empty arrays.
- Return ONLY the JSON object, nothing else.

Now analyze this transcript:

${text}`;
}

// ─────────────────────────────────────────────────────────
// CALL OLLAMA (shared helper with retry)
// ─────────────────────────────────────────────────────────

async function callOllama(text, attempt = 1) {
    console.log(`🧠 Ollama call attempt ${attempt}...`);
    
    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama3',
            prompt: buildPrompt(text),
            stream: false,
            format: 'json',
            options: {
                temperature: 0.3,
                num_predict: 4096,
                top_p: 0.9
            }
        })
    });

    const data = await response.json();
    
    console.log("📦 Raw Ollama response length:", data.response?.length || 0);
    
    let parsed;
    try {
        parsed = JSON.parse(data.response);
    } catch (e) {
        console.error("❌ JSON parse failed:", e.message);
        console.error("Raw response (first 500 chars):", data.response?.substring(0, 500));
        throw new Error("Ollama returned invalid JSON");
    }

    // Log what fields we got
    console.log("📊 Fields received:", {
        summary: (parsed.summary || '').length + ' chars',
        key_points: Array.isArray(parsed.key_points) ? parsed.key_points.length + ' items' : typeof parsed.key_points,
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items.length + ' items' : typeof parsed.action_items,
        difficulty_level: parsed.difficulty_level || 'MISSING',
        prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites.length + ' items' : typeof parsed.prerequisites,
        related_topics: Array.isArray(parsed.related_topics) ? parsed.related_topics.length + ' items' : typeof parsed.related_topics
    });

    // Check if critical fields are empty — retry once with focused prompt
    const keyPointsEmpty = !parsed.key_points || (Array.isArray(parsed.key_points) && parsed.key_points.length === 0);
    const actionItemsEmpty = !parsed.action_items || (Array.isArray(parsed.action_items) && parsed.action_items.length === 0);
    
    if ((keyPointsEmpty || actionItemsEmpty) && attempt < 2) {
        console.log("⚠️ Key fields empty, retrying with focused prompt...");
        return callOllamaFocused(text, parsed);
    }

    return parsed;
}

// ─────────────────────────────────────────────────────────
// FOCUSED RETRY: extract missing fields separately
// ─────────────────────────────────────────────────────────

async function callOllamaFocused(text, previousResult) {
    console.log("🔄 Running focused extraction for missing fields...");
    
    const focusedPrompt = `From this lecture transcript, extract the following information. Return ONLY a valid JSON object with ALL fields filled.

EXAMPLE OUTPUT:
{
  "key_points": ["The OSI model has seven layers that handle different aspects of network communication", "TCP provides reliable delivery using a three-way handshake process", "DNS converts domain names to IP addresses using a hierarchical server structure"],
  "action_items": ["Create a comparison chart of TCP vs UDP with use cases for each", "Practice subnetting exercises with IPv4 addresses", "Review the differences between hubs, switches, and routers"],
  "difficulty_level": "Beginner",
  "prerequisites": ["Basic computer literacy", "Understanding of binary numbers"],
  "related_topics": ["Network security and firewalls", "Cloud computing infrastructure", "Wireless networking protocols"]
}

RULES:
- key_points: Extract 5 important facts from the transcript. Each must be a complete sentence.
- action_items: Create 3 practical study tasks based on the content.
- difficulty_level: Choose exactly one of "Beginner", "Intermediate", or "Advanced".
- prerequisites: List 3 topics students should already know.
- related_topics: List 3 topics students should explore next.
- ALL arrays MUST have items. NO empty arrays.

Transcript:
${text}`;

    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama3',
            prompt: focusedPrompt,
            stream: false,
            format: 'json',
            options: {
                temperature: 0.4,
                num_predict: 2048
            }
        })
    });

    const data = await response.json();
    let focused;
    try {
        focused = JSON.parse(data.response);
    } catch (e) {
        console.error("❌ Focused retry JSON parse failed, using first result");
        return previousResult;
    }

    console.log("📊 Focused retry results:", {
        key_points: Array.isArray(focused.key_points) ? focused.key_points.length + ' items' : 'missing',
        action_items: Array.isArray(focused.action_items) ? focused.action_items.length + ' items' : 'missing',
        difficulty_level: focused.difficulty_level || 'missing'
    });

    // Merge: keep good summary from first call, fill everything else from focused call
    return {
        summary: previousResult.summary || focused.summary || '',
        key_points: (Array.isArray(previousResult.key_points) && previousResult.key_points.length > 0) 
            ? previousResult.key_points : (focused.key_points || []),
        action_items: (Array.isArray(previousResult.action_items) && previousResult.action_items.length > 0) 
            ? previousResult.action_items : (focused.action_items || []),
        difficulty_level: (previousResult.difficulty_level && previousResult.difficulty_level !== '') 
            ? previousResult.difficulty_level : (focused.difficulty_level || 'Beginner'),
        prerequisites: (Array.isArray(previousResult.prerequisites) && previousResult.prerequisites.length > 0) 
            ? previousResult.prerequisites : (focused.prerequisites || []),
        related_topics: (Array.isArray(previousResult.related_topics) && previousResult.related_topics.length > 0) 
            ? previousResult.related_topics : (focused.related_topics || [])
    };
}

// ─────────────────────────────────────────────────────────
// 1. TEXT SUMMARIZATION ENDPOINT 
// ─────────────────────────────────────────────────────────
app.post('/api/summarize-text', async (req, res) => {
    const { text } = req.body;

    if (!text || text.trim().length < 20) {
        return res.status(400).json({ error: "Text is required (minimum 20 characters)" });
    }

    try {
        const parsed = await callOllama(text);
        const result = buildResult(parsed);
        console.log("✅ Final result — summary:", result.summary.length, "chars | key_points:", result.key_points.length, "| action_items:", result.action_items.length, "| difficulty:", result.difficulty_level);
        res.json(result); 
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ error: "Summarization failed. Make sure Ollama is running." });
    }
});

// ─────────────────────────────────────────────────────────
// 2. AUDIO SUMMARIZATION ENDPOINT 
// ─────────────────────────────────────────────────────────
app.post('/api/summarize-audio', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Audio file is required" });
    }

    try {
        console.log("🎙️ Audio received:", req.file.path);
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), req.file.originalname);
        formData.append('model', 'whisper-large-v3'); 

        const API_KEY = process.env.GROQ_API_KEY; 
        
        const sttResponse = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                ...formData.getHeaders() 
            }
        });

        const transcribedText = sttResponse.data.text;
        console.log("📝 Transcribed Text:", transcribedText.substring(0, 200) + "...");

        const parsed = await callOllama(transcribedText);
        const result = buildResult(parsed, transcribedText);
        
        console.log("✅ Final result — key_points:", result.key_points.length, "| action_items:", result.action_items.length);
        
        fs.unlinkSync(req.file.path); 
        res.json(result);

    } catch (error) {
        if (error.response) {
            console.error("❌ Groq API Error:", error.response.status, error.response.data);
        } else {
            console.error("❌ Error:", error.message);
        }

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path); 
        }
        res.status(500).json({ error: "Audio processing failed" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
    console.log(`📋 Endpoints:`);
    console.log(`   POST /api/summarize-text`);
    console.log(`   POST /api/summarize-audio`);
});