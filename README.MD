# GYAANSETU — Academic Integrity Detection System

> **BlueBit Hackathon Project**

GYAANSETU is an AI-powered academic integrity detection system designed to identify AI-generated assignments, plagiarism, and suspicious writing behavior. Unlike traditional plagiarism detectors that rely solely on text similarity, GYAANSETU analyzes the **entire writing process** using multiple detection engines — combining behavioral analysis, AI challenge verification, honeypot traps, and similarity detection to determine whether a student genuinely authored their work.

---

## Table of Contents

- [Key Features](#key-features)
- [Detection Architecture](#detection-architecture)
- [Assignment Modes](#assignment-modes)
- [Scoring System](#scoring-system)
- [WritingDNA Replay System](#writingdna-replay-system)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)
- [Use Cases](#use-cases)
- [Future Improvements](#future-improvements)
- [Team](#team)

---

## Key Features

### 1. Text / Code Similarity Detection
Detects plagiarism by comparing assignments using **TF-IDF cosine similarity** and **semantic embeddings**.
- Compares submissions against AI corpus datasets
- Detects high similarity between student submissions
- Works for reactive (uploaded) document submissions

### 2. Online Proctoring Anomaly Detection
Analyzes writing behavior to identify suspicious activity. Behavioral signals include:
- Large paste events
- Tab switching during writing
- Idle time patterns
- Typing behavior

These signals are combined into a **behavioral ownership score**.

### 3. AI-Generated Content Detection
Uses multiple signals to detect AI-generated answers:
- Semantic interpretation matching
- Socratic questioning using LLMs
- Prompt honeypot traps
- Hidden prompt tokens

### 4. Multi-Layer Detection System
Instead of relying on a single technique, GYAANSETU combines multiple detection engines:
- WritingDNA Behavioral Analysis
- Honeypot Prompt Traps
- Socratic AI Verification
- Similarity Detection

All signals are combined into a **final ownership score**.

### 5. Privacy-Preserving Architecture
Student privacy is preserved while detecting misuse:
- Anonymized behavioral signals
- Zero-width encoded tokens
- Minimal text storage
- Secure authentication

---

## Detection Architecture

The system operates on three core pillars:

### Pillar 1 — WritingDNA Behavioral Detection
Captures the student's writing process in real time:
- Keystrokes
- Edits
- Paste events
- Tab switches

Teachers can replay the entire writing timeline to verify authenticity.

### Pillar 2 — Honeypot Trap System
Assignments contain hidden signals designed to catch AI use:
- Hidden instructions embedded in prompts
- Invisible zero-width tokens
- Fake research facts
- Contradictory instructions

AI models often follow hidden prompts while human students ignore them.

### Pillar 3 — Socratic Verification
After submission, students receive a challenge question generated from their own essay. The system checks whether the student:
- Understands their arguments
- Can explain their reasoning
- Can defend their claims

AI-generated submissions frequently fail this step.

---

## Assignment Modes

| Mode | Description | Detection Methods |
|------|-------------|-------------------|
| **Proactive** | Students write directly inside the platform | Writing behavior, typing timeline, paste activity — highest accuracy |
| **Reactive** | Students upload an existing document | Plagiarism detection, AI similarity analysis, optional Socratic verification |

---

## Scoring System

```
Ownership Score =
  40%  Behavioral Analysis
+ 30%  Honeypot Detection
+ 30%  Socratic Verification
```

| Score | Risk Level |
|-------|------------|
| > 70  | Low Risk   |
| 50–70 | Medium Risk |
| < 50  | High Risk  |

---

## WritingDNA Replay System

Teachers can replay the full writing history of any assignment. The system records:
- Snapshots of text changes over time
- Typing events
- Paste actions
- Tab switching

This produces a **timeline playback** of the entire writing process, giving teachers a transparent view of how an assignment was produced.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js, React, TypeScript, Supabase Client |
| **Backend** | FastAPI, Python, Pydantic |
| **AI / ML** | Google Gemini, Sentence Transformers, Scikit-learn TF-IDF |
| **Database** | Supabase (PostgreSQL) |

---

## System Architecture

```
Student / Teacher Browser
         │
         ▼
 Next.js Frontend  (Port 3000)
         │
         ▼
 FastAPI Backend   (Port 8000)
         │
         ▼
 Supabase Database (PostgreSQL)
         │
         ▼
 AI Detection Engines
   ├── Behavioral Analysis
   ├── Honeypot Detection
   ├── Socratic AI Verification
   └── Similarity Detection
```

---

## Project Structure

```
gyaansetu/
│
├── gyaansetu/           # Next.js frontend
│
├── gyaansetu-api/       # FastAPI backend
│
├── extractor-service/   # Document extraction service
│
├── migrations/          # Database migration scripts
│
└── docs/                # Documentation
```

---

## How to Run

### Option 1 — Helper Script (Linux / macOS)

The fastest way to start the entire project:

```bash
# Make the script executable (first time only)
chmod +x run-all.sh

# Start both services
./run-all.sh
```

The script will automatically:
- Install frontend dependencies via `npm`
- Install backend dependencies via `pip`
- Start the Next.js frontend on **port 3000**
- Start the FastAPI backend on **port 8000**

> **Note:** The `run-all.sh` script works only on Linux and macOS environments.

---

### Option 2 — Manual Setup

#### Backend

```bash
cd gyaansetu-api
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at: `http://localhost:8000`

#### Frontend

```bash
cd gyaansetu
npm install
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## Use Cases

GYAANSETU is suited for:
- Universities and colleges
- Coding bootcamps
- Online courses and MOOCs
- Remote examinations
- Hackathons and academic competitions

---

## Future Improvements

- Real-time AI detection models
- Cross-institution plagiarism detection
- Handwriting analysis for physical exams
- Larger AI corpus datasets
- Adaptive behavioral scoring

---

## Team

**BlueBit Hackathon Team**
Project: GYAANSETU — Academic Integrity Detection System
Team Members:
      Mihir Pande
      Aditya Vedpathak
      Nishant Bhakar
      Ashish Suryawanshi




