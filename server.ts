import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = 3000;

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API endpoint for generating copy
app.post("/api/generate", async (req, res) => {
  try {
    const {
      topic,
      platform = "instagram",
      language = "english",
      tone = "high_energy",
      targetAudience = "",
      offerDetails = "",
    } = req.body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ error: "Please provide a topic or product details." });
    }

    const ai = getAIClient();

    let langInstruction = "";
    if (language === "urdu") {
      langInstruction = "Write the entire copy in authentic, fluent Urdu script (اردو رسم الخط). Use captivating Urdu marketing phrases with suitable emojis.";
    } else if (language === "roman_urdu") {
      langInstruction = "Write the copy in natural Roman Urdu (Urdu written in Latin alphabet, e.g., 'Kya aap bhi pareshan hain?', 'Abhi order karein aur flat 50% discount hasil karein!'). Make it punchy, conversational, and hyper-engaging.";
    } else {
      langInstruction = "Write in crisp, ultra-engaging English.";
    }

    const systemInstruction = `You are "AI Content Creator", a super-fast multi-platform social media copy generator.

STRICT SPEED & OUTPUT RULES:
1. NO GREETINGS OR FILLERS: Do not say "Here are your posts", "Sure!", or introductory/concluding chatter. Output purely the structured copy data.
2. HIGH SPEED FORMAT: Generate extremely short, high-converting, punchy copy.
3. OUTPUT FORMAT: Always return exactly 3 short options:
   - Option 1 (Viral Hook): Fast, catchy, emoji-rich, engineered for high scroll-stopping power.
   - Option 2 (Benefit Focus): Problem + Solution + Irresistible Offer/Value proposition.
   - Option 3 (Direct CTA): Short 2-line urgency pitch driving immediate action.
4. Target Platform: ${platform.toUpperCase()}. Tailor format, vibe, and hashtag style specifically for this platform.
5. Tone: ${tone}.
6. Language Requirement: ${langInstruction}
${targetAudience ? `Target Audience: ${targetAudience}` : ""}
${offerDetails ? `Offer / Price / Deal details: ${offerDetails}` : ""}`;

    const promptText = `Generate 3 high-converting social media copy options for: "${topic}".`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.8,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            option1_viral_hook: {
              type: Type.OBJECT,
              properties: {
                copy: {
                  type: Type.STRING,
                  description: "Viral Hook copy: Fast, catchy, emoji-rich, scroll-stopping.",
                },
                tagline: {
                  type: Type.STRING,
                  description: "A 3-5 word high impact teaser hook.",
                },
                hashtags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Relevant trending hashtags.",
                },
              },
              required: ["copy", "tagline", "hashtags"],
            },
            option2_benefit_focus: {
              type: Type.OBJECT,
              properties: {
                copy: {
                  type: Type.STRING,
                  description: "Benefit Focus copy: Problem + Solution + Offer breakdown.",
                },
                tagline: {
                  type: Type.STRING,
                  description: "A 3-5 word core benefit headline.",
                },
                hashtags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Relevant hashtags.",
                },
              },
              required: ["copy", "tagline", "hashtags"],
            },
            option3_direct_cta: {
              type: Type.OBJECT,
              properties: {
                copy: {
                  type: Type.STRING,
                  description: "Direct CTA copy: Short 2-line urgency pitch directing instant action.",
                },
                tagline: {
                  type: Type.STRING,
                  description: "A 2-4 word direct call-to-action.",
                },
                hashtags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Relevant hashtags.",
                },
              },
              required: ["copy", "tagline", "hashtags"],
            },
          },
          required: ["option1_viral_hook", "option2_benefit_focus", "option3_direct_cta"],
        },
      },
    });

    const textOutput = response.text || "{}";
    const parsedData = JSON.parse(textOutput);

    const formattedOptions = [
      {
        id: "option_1",
        label: "Option 1",
        tag: "Viral Hook",
        tagline: parsedData.option1_viral_hook?.tagline || "Fast, Catchy & Emoji-Rich",
        copy: parsedData.option1_viral_hook?.copy || "",
        hashtags: parsedData.option1_viral_hook?.hashtags || [],
      },
      {
        id: "option_2",
        label: "Option 2",
        tag: "Benefit Focus",
        tagline: parsedData.option2_benefit_focus?.tagline || "Problem + Solution + Offer",
        copy: parsedData.option2_benefit_focus?.copy || "",
        hashtags: parsedData.option2_benefit_focus?.hashtags || [],
      },
      {
        id: "option_3",
        label: "Option 3",
        tag: "Direct CTA",
        tagline: parsedData.option3_direct_cta?.tagline || "Short 2-Line Urgency Pitch",
        copy: parsedData.option3_direct_cta?.copy || "",
        hashtags: parsedData.option3_direct_cta?.hashtags || [],
      },
    ];

    res.json({
      id: "gen_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      topic,
      platform,
      language,
      tone,
      options: formattedOptions,
      createdAt: Date.now(),
    });
  } catch (error: any) {
    console.error("Copy generation failed:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate copy. Please try again.",
    });
  }
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "AI Content Creator" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Content Creator server running on http://localhost:${PORT}`);
  });
}

startServer();
