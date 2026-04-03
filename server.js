require('dotenv').config();
const fs = require('fs');
const FormData = require('form-data');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios'); 

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

    const prompt = `You are an expert University Professor and Academic Summarizer. Your task is to analyze the following lecture transcript with maximum factual accuracy. Pay close attention to technical terms, core concepts, and the exact context. Do not make up information. Return a JSON object with STRICTLY three keys: 'summary' (A dense, highly accurate paragraph capturing the main thesis without fluff), 'key_points' (An array of the most critical factual statements and definitions), 'action_items' (An array of practical study tasks or deadlines based on the text). Transcript: ${text}`;

    try {
        console.log("🧠 Processing text with Ollama (Llama 3)...");
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3', 
                prompt: prompt,
                stream: false,
                format: 'json',
                options: { temperature: 0.1 } 
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
        
        const sttResponse = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                ...formData.getHeaders() 
            }
        });

        const transcribedText = sttResponse.data.text;
        console.log("📝 Transcribed Text:", transcribedText);

        console.log("🧠 Processing transcribed text with Ollama (Llama 3)...");
        
        const prompt = `You are an expert University Professor and Academic Summarizer. Your task is to analyze the following lecture transcript with maximum factual accuracy. Pay close attention to technical terms, core concepts, and the exact context. Do not make up information. Return a JSON object with STRICTLY three keys: 'summary' (A dense, highly accurate paragraph capturing the main thesis without fluff), 'key_points' (An array of the most critical factual statements and definitions), 'action_items' (An array of practical study tasks or deadlines based on the text). Transcript: ${transcribedText}`;

        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3', 
                prompt: prompt,
                stream: false,
                format: 'json',
                options: { temperature: 0.1 }
            })
        });

        const ollamaData = await ollamaResponse.json();
        const parsedResponse = JSON.parse(ollamaData.response);
        
        // 🔥 NEW: Add the raw transcription to the final response
        parsedResponse.transcription = transcribedText;
        
        fs.unlinkSync(req.file.path); 
        res.json(parsedResponse);

    } catch (error) {
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