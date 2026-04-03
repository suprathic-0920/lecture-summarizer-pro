async function testOllama() {
    console.log("Connecting to local Ollama...");
    
    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'phi3', // Make sure this matches the model you downloaded
            prompt: 'Summarize this in one sentence: Hackathons are 24-hour coding events where developers build projects from scratch.',
            stream: false
        })
    });

    const data = await response.json();
    console.log("Ollama Response:", data.response);
}

testOllama();