const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");
require("dotenv").config();

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.render("upload");
});

app.post("/upload", upload.single("resume"), async (req, res) => {
  const pdfPath = path.join(__dirname, req.file.path);
  const dataBuffer = fs.readFileSync(pdfPath);

  try {
    const data = await pdfParse(dataBuffer);
    const resumeText = data.text;

    const groqRes = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `**System Prompt:**\nYou are an expert career coach and professional ATS reviewer. When given structured resume data, you will:\n1. Evaluate the resume content and assign an ATS score (0–100).\n2. Identify keywords found and missing (based on common industry terms).\n3. Write a detailed summary evaluation.\n4. Provide 4–6 actionable, prioritized resume-tips.\n5. Generate 12–14 tailored interview questions an interviewer might ask, with each question focused on actual resume points.\n6. Suggest 8 “next steps” (e.g., practice, review, update).\nOutput **only** a single JSON object with these exact properties:\njson\n{\n  "ats_score": 0,\n  "keywords_found": [],\n  "keywords_missing": [],\n  "summary": "",\n  "resume_tips": [],\n "resume_suggestions_and_errors:[], "interview_questions": [],\n  "next_steps": []\n}`,
        },
        {
          role: "user",
          content: `Here is a resume:\n\n${resumeText}`,
        },
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.7,
    });

    const groqOutput = groqRes.choices[0].message.content;

    res.render("result", {
      resumeText,
      groqOutput,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing resume.");
  } finally {
    fs.unlinkSync(pdfPath); 
  }
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});