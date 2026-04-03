require('dotenv').config();
const fs = require('fs');
const FormData = require('form-data');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios'); // 🔥 NEW: Added axios to perfectly handle file uploads

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' }); 

// ---------------------------------------------------------
// 1. TEXT SUMMARIZATION ENDPOINT 
// ---------------------------------------------------------
app.post('/api/summarize-text', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: "Text is required" });
    }

    const prompt = `Analyze the following lecture transcript. Return a JSON object with strictly three keys: 'summary' (a brief paragraph), 'key_points' (an array of strings), and 'action_items' (an array of strings). Transcript: ${text}`;

    try {
        console.log("Processing text with Ollama...");
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'phi3',
                prompt: prompt,
                stream: false,
                format: 'json' 
            })
        });

        const data = await response.json();
        res.json(JSON.parse(data.response)); 
    } catch (error) {
        console.error("Error connecting to Ollama:", error);
        res.status(500).json({ error: "Summarization failed" });
    }
});

// ---------------------------------------------------------
// 2. AUDIO SUMMARIZATION ENDPOINT 
// ---------------------------------------------------------
app.post('/api/summarize-audio', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Audio file is required" });
    }

    try {
        console.log("🎙️ Audio received:", req.file.path);
        console.log("Converting Speech to Text using Axios & Groq...");
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), req.file.originalname);
        formData.append('model', 'whisper-large-v3'); 

        const API_KEY = process.env.GROQ_API_KEY; 
        
        // 🔥 FIX APPLIED HERE: Using axios.post which correctly handles multipart boundaries
        const sttResponse = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                ...formData.getHeaders() // Axios handles this perfectly
            }
        });

        // Axios automatically parses the JSON response into .data
        const transcribedText = sttResponse.data.text;
        console.log("📝 Transcribed Text:", transcribedText);

        console.log("🧠 Processing transcribed text with Ollama...");
        const prompt = `Analyze the following lecture transcript. Return a JSON object with strictly three keys: 'summary' (a brief paragraph), 'key_points' (an array of strings), and 'action_items' (an array of strings). Transcript: ${transcribedText}`;

        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'phi3',
                prompt: prompt,
                stream: false,
                format: 'json'
            })
        });

        const ollamaData = await ollamaResponse.json();
        
        fs.unlinkSync(req.file.path); // Cleanup temp file
        res.json(JSON.parse(ollamaData.response));

    } catch (error) {
        // Detailed error logging
        if (error.response) {
            console.error("❌ Groq API Error:", error.response.status, error.response.data);
        } else {
            console.error("❌ Error processing audio:", error.message);
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
});