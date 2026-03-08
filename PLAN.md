# **GYAANSETU — Hackathon Build Plan**

---

# PS1 Objectives Checklist

*Everything judges will evaluate — verify before submission.*

## Mandatory

* [ ] **Detection Module** — implement at least ONE method:

  * [x] Online proctoring anomaly detection → Writing Oracle (paste, tab switching, typing cadence)
  * [x] AI-generated content detection → Socratic Engine + Honeypot scoring
  * [ ] Text/code similarity detection → optional honeypot semantic similarity (bonus)

* [ ] **Functional Interface** — web interface where users can submit work

  * [ ] Teacher selects mode when creating assignment: **Proactive** or **Reactive**
  * [ ] Proactive → Student writes inside platform editor (no upload)
  * [ ] Reactive → Student uploads `.txt` / `.pdf` / `.docx` file
  * [ ] Results display with confidence/ownership scores (0–100)

* [ ] **Testing & Accuracy**

  * [ ] Test on at least 20 sample cases
  * [ ] Achieve minimum 75% accuracy
  * [ ] Document testing methodology in `testing/methodology.md`

* [ ] **Documentation**

  * [ ] `README.md` — how to run the system
  * [ ] `algorithm.md` — explanation of detection logic

## Bonus

* [ ] Multiple detection methods working together ← GYAANSETU does all three pillars
* [ ] Privacy-preserving features — anonymize student names in evidence reports, store only behavioral metadata not keystrokes

---

# What We're Building

A **3-pillar academic integrity system** that proves **student ownership** instead of detecting AI.

---

# Teacher Mode Selection

When creating an assignment, teacher picks one mode:

| Mode          | Approach                           | Student Experience          |
| ------------- | ---------------------------------- | --------------------------- |
| **Proactive** | Prevent cheating before it happens | Writes inside locked editor |
| **Reactive**  | Detect cheating after submission   | Uploads a file              |

Store `mode: "proactive" | "reactive"` on the `assignments` table.

Route the submission flow based on this flag.

---

# Proactive Mode — Pillars

## Pillar 1 — Assignment DNA Engine

* [ ] Build **Gemini API call** that takes `{ topic, difficulty, student_id }` and returns `{ assignment_text, honeypot_phrase, expected_interpretations }`
* [ ] Store assignment variant + honeypot phrase + student ID in DB
* [ ] Each student gets a unique assignment variant on fetch

---

## Pillar 2 — Writing Oracle (Behavioral Analysis)

* [ ] Build custom writing editor (React) — no file upload, typing only
* [ ] Implement paste event listener → log paste size (word count)
* [ ] Implement typing cadence tracker → log typing events, pauses, backspaces
* [ ] Implement Page Visibility API → log tab switches + idle time
* [ ] POST behavioral log
  `{ typing_events, paste_events, largest_paste, tab_switches, idle_time }`
  to backend on submission
* [ ] Python/Flask ML endpoint that takes behavioral log → returns `behavior_score (0–100)`

---

## Pillar 3 — Socratic Engine

* [ ] On submission, send essay to **Gemini → extract key claim → generate challenge question**
* [ ] Display challenge to student with **90-second countdown timer**
* [ ] Capture student response → send to **Gemini for follow-up question** (optional: second turn)
* [ ] Gemini scores response on:

  * depth
  * consistency
  * specificity
  * counterargument engagement

Returns:

```
{
socratic_score,
analysis
}
```

---

# Reactive Mode — Cosine TF-IDF Similarity

## File Upload Interface

* [ ] Student-facing upload page — accepts `.txt`, `.pdf`, `.docx`
* [ ] Parse uploaded file → extract plain text on backend
* [ ] Show upload confirmation + filename before submission

---

## Similarity Detection Engine (Python/Flask)

* [ ] Build a **reference corpus of known AI-generated essays (20+ samples)**
* [ ] On upload: vectorize submission using **TF-IDF (`sklearn.TfidfVectorizer`)**
* [ ] Compute **cosine similarity** against every document in corpus
* [ ] Return

```
{
similarity_score (0–1),
closest_match_id,
confidence_percent
}
```

Thresholds:

* similarity ≥ 0.75 → High Risk
* 0.50–0.74 → Medium
* < 0.50 → Low

---

## Reactive Scoring Formula

* [ ] `reactive_score = cosine_similarity * 100`
* [ ] Display as

```
ownership_score = 100 - reactive_score
```

---

## Reactive Dashboard View

Show:

| Student | Similarity % | Closest Match | Risk Level |

Evidence example:

> "Submission is 82% similar to known AI-generated essay on [topic]"

---

# Ownership Score

Formula:

```
0.4 * behavior_score +
0.3 * honeypot_score +
0.3 * socratic_score
```

Honeypot score:

* compare student's handling of honeypot phrase vs expected interpretations
* semantic similarity via **sentence-transformers**

Store:

* three sub-scores
* final ownership score per submission

---

# Educator Dashboard

Table view:

| Student | Behavior | Honeypot | Socratic | Ownership | Risk Level |

Risk Level:

* High (<50)
* Medium (50–75)
* Low (>75)

Evidence report per student:

Examples:

* "600 words pasted"
* "did not engage honeypot"
* "failed Socratic reasoning test"

---

# API Endpoints to Build

## Shared

| Method | Route                         | Purpose                                |
| ------ | ----------------------------- | -------------------------------------- |
| POST   | `/api/assignment/generate`    | Generate assignment (mode stored here) |
| GET    | `/api/assignment/:student_id` | Fetch student's assignment + mode      |
| GET    | `/api/dashboard`              | All submissions with scores            |
| GET    | `/api/report/:submission_id`  | Evidence report for one student        |

---

## Proactive Only

| Method | Route                     | Purpose                                  |
| ------ | ------------------------- | ---------------------------------------- |
| POST   | `/api/behavior/log`       | Save behavioral telemetry                |
| POST   | `/api/submission`         | Submit essay + trigger proactive scoring |
| POST   | `/api/socratic/challenge` | Get challenge question from Gemini       |
| POST   | `/api/socratic/score`     | Score student's Socratic response        |

---

## Reactive Only

| Method | Route                   | Purpose                                     |
| ------ | ----------------------- | ------------------------------------------- |
| POST   | `/api/upload`           | Accept file upload → extract text           |
| POST   | `/api/similarity/score` | Run TF-IDF cosine similarity → return score |

---

# Database Tables

`students`
id, name

`assignments`
id, student_id, assignment_text, honeypot_phrase, expected_interpretations, **mode** (`proactive | reactive`)

`submissions`
id, student_id, essay_text, submitted_at

`behavior_logs`
id, submission_id, typing_events, paste_events, largest_paste, tab_switches, idle_time *(proactive only)*

`scores`
id, submission_id, behavior_score, honeypot_score, socratic_score, similarity_score, ownership_score

`socratic_sessions`
id, submission_id, challenge, student_response, followup, analysis *(proactive only)*

`uploads`
id, submission_id, filename, extracted_text *(reactive only)*

---

# Testing (20 Cases Minimum)

* [ ] 10 cases: simulated AI submissions (large paste, no honeypot engagement, weak Socratic)
* [ ] 10 cases: simulated human submissions (normal typing, honeypot addressed, strong Socratic)
* [ ] Document each test case: input → expected risk → actual risk
* [ ] Calculate accuracy

```
(correct classifications / 20) × 100
```

Target:

```
≥ 75%
```

Write `testing/methodology.md` summarizing approach.

---

# Documentation

* [ ] `README.md` — setup instructions, how to run frontend + backend + ML service
* [ ] `algorithm.md` — brief explanation of each pillar's scoring logic

---

# MVP Priority Order

1. Teacher assignment creation with **mode toggle** (Proactive / Reactive)
2. **Reactive path first** — file upload → text extraction → TF-IDF cosine similarity → score
3. Educator dashboard (works for both modes)
4. **Proactive path** — writing editor with paste + tab detection
5. Assignment DNA Engine (**Gemini API**)
6. Submission flow → behavioral score
7. Socratic challenge (one turn)
8. Ownership score calculation (proactive formula)
9. Honeypot semantic scoring (if time allows)
10. Second Socratic turn (bonus)