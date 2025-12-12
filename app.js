import express from "express";
import axios from "axios";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middlewares
app.use(express.json({ limit: "1mb" }));
app.use(cors());
app.use(morgan("tiny"));

// ENV
const API_KEY = process.env.OPENROUTER_API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error("❌ OPENROUTER_API_KEY missing in .env");
}

// -------------------------------
// ALL FREE MODELS (OpenRouter)
// -------------------------------
const MODELS = {
  "deepseek-chat": "deepseek/deepseek-chat",
  "qwen2.5-7b": "qwen/qwen2.5-7b-instruct",
  "qwen2.5-14b": "qwen/qwen2.5-14b-instruct",
  "llama3.2-3b": "meta-llama/llama-3.2-3b-instruct",
  "llama3.1-8b": "meta-llama/llama-3.1-8b-instruct",
  "gemma2-9b": "google/gemma-2-9b-it",
  "phi3.5": "microsoft/phi-3.5-mini-instruct",
  "mistral-nemo": "mistralai/mistral-nemo-instruct",
  "nemotron-mini": "nvidia/nemotron-mini-4b-instruct",
};

// Fallback list (auto switch if a model fails)
const FALLBACK_ORDER = [
  "deepseek-chat",
  "llama3.1-8b",
  "gemma2-9b",
  "qwen2.5-7b",
  "phi3.5",
];

// -------------------------------
// Root Route — HTML Tester
// -------------------------------
app.get("/", (req, res) => {
  res.send(`
<html>
  <body style="font-family: Arial; padding: 20px;">
    <h2>NGAI Backend Tester</h2>
    <textarea id="msg" rows="4" cols="50" placeholder="Type message..."></textarea><br><br>
    <select id="model">
      ${Object.keys(MODELS)
        .map((m) => `<option value="${m}">${m}</option>`)
        .join("")}
    </select>
    <button onclick="send()">Send</button>

    <pre id="out" style="background:#eee; padding:10px; margin-top:20px;"></pre>

<script>
async function send() {
  document.getElementById("out").innerText = "Loading...";
  const res = await fetch("/chat", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      message: document.getElementById("msg").value,
      model: document.getElementById("model").value
    })
  });
  const data = await res.json();
  document.getElementById("out").innerText = JSON.stringify(data, null, 2);
}
</script>

  </body>
</html>
`);
});

// -------------------------------
// Chat Endpoint (unbreakable)
// -------------------------------
async function callModel(modelKey, message) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODELS[modelKey],
        messages: [{ role: "user", content: message }],
      },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      reply: response.data?.choices?.[0]?.message?.content || "",
    };
  } catch (err) {
    return {
      success: false,
      status: err.response?.status,
      error: err.response?.data?.error?.message || err.message,
    };
  }
}

app.post("/chat", async (req, res) => {
  const start = Date.now();
  const { message, model } = req.body;

  // Validation
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message required" });
  }
  if (message.length > 10000) {
    return res.status(400).json({ error: "Message too long" });
  }
  if (!model || !MODELS[model]) {
    return res.status(400).json({ error: "Invalid model" });
  }

  // Try main model
  let result = await callModel(model, message);

  // Auto fallback if main fails
  if (!result.success) {
    console.log(`⚠️ Model failed: ${model}, switching...`);

    for (const alt of FALLBACK_ORDER) {
      if (alt === model) continue;
      console.log(`➡️ Trying fallback: ${alt}`);

      result = await callModel(alt, message);
      if (result.success) break;
    }
  }

  // If still failed
  if (!result.success) {
    return res.status(500).json({
      error: "API failed after all fallbacks",
      details: result.error,
    });
  }

  console.log(`✔️ Request done in ${Date.now() - start}ms`);

  return res.json({
    reply: result.reply,
    used: model,
  });
});

// -------------------------------
app.listen(PORT, () =>
  console.log(`🚀 NGAI backend running on port ${PORT}`)
);
