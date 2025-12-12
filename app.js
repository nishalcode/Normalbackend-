import express from "express";
import cors from "cors";
import axios from "axios";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ----------------------
// 1. CONFIG + SECURITY
// ----------------------
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error("❌ Missing OPENROUTER_API_KEY in .env");
  process.exit(1);
}

const MODELS = {
  deepseek: "deepseek/deepseek-r1:free",
  llama: "meta-llama/llama-3.1-8b-instruct:free",
  qwen: "qwen/qwen-2.5-coder-7b:free",
};

// ----------------------
// 2. MIDDLEWARE
// ----------------------
app.use(cors({ origin: "*", methods: ["POST", "GET"] }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

// ----------------------
// 3. ROOT ROUTE (HTML)
// ----------------------
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NGAI Chat Test</title>
    <style>
      body { font-family: Arial, sans-serif; background:#f4f4f4; padding:20px; }
      .container { max-width:600px; margin:auto; background:white; padding:20px; border-radius:10px; }
      textarea { width:100%; height:100px; margin-bottom:10px; padding:10px; font-size:16px; }
      select, button { padding:10px; font-size:16px; margin-right:10px; }
      #response { margin-top:20px; white-space:pre-wrap; background:#eee; padding:10px; border-radius:5px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>NGAI Chat Backend Test</h1>
      <textarea id="message" placeholder="Type your message..."></textarea>
      <br>
      <select id="model">
        <option value="deepseek">DeepSeek</option>
        <option value="llama">Meta Llama 3.1</option>
        <option value="qwen">Qwen 2.5 Coder</option>
      </select>
      <button onclick="sendMessage()">Send</button>
      <div id="response"></div>
    </div>
    <script>
      async function sendMessage() {
        const message = document.getElementById("message").value;
        const model = document.getElementById("model").value;
        const responseDiv = document.getElementById("response");
        responseDiv.innerText = "Loading...";

        try {
          const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, model })
          });

          const data = await res.json();
          if(res.ok) {
            responseDiv.innerText = data.reply;
          } else {
            responseDiv.innerText = "Error: " + data.error;
          }
        } catch (err) {
          responseDiv.innerText = "Error: " + err.message;
        }
      }
    </script>
  </body>
  </html>
  `);
});

// ----------------------
// 4. CHAT ROUTE
// ----------------------
app.post("/chat", async (req, res) => {
  const startTime = Date.now();

  try {
    const { message, model } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (message.length > 10000) {
      return res.status(400).json({ error: "Message too long" });
    }

    if (!model || !MODELS[model]) {
      return res.status(400).json({ error: "Invalid or unknown model" });
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODELS[model],
        messages: [{ role: "user", content: message }],
      },
      {
        timeout: 25000,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ngai.app",
          "X-Title": "NGAI Chat Backend",
        },
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content || "";

    console.log(`Request processed in ${Date.now() - startTime}ms`);

    return res.status(200).json({ reply });

  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data?.error?.message || err.message;

    console.error(`OpenRouter ${status}:`, msg);
    console.log(`Request failed in ${Date.now() - startTime}ms`);

    return res.status(500).json({ error: "Server error. Try again later." });
  }
});

// ----------------------
// 5. START SERVER
// ----------------------
app.listen(PORT, () => {
  console.log(`🚀 NGAI Backend running on port ${PORT}`);
});
