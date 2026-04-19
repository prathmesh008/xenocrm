# 🚀 XENO – AI-Powered CRM Campaign Platform

> 💡 *Crafted with love for XENO as part of a special assignment. I aimed to blend AI, clean architecture, and modern tools to simplify campaign management for everyone.*
---

## 🌐 Live Demo

👉 [Explore the Live App](https://arjunxenocrm-6ogq.vercel.app/)

---

## 📖 Table of Contents

- [Features](#features)
- [Tech Stack & AI Tools](#tech-stack--ai-tools)
- [Architecture Diagram](#architecture-diagram)
- [Local Setup Instructions](#local-setup-instructions)
- [Known Limitations](#known-limitations)
- [License](#license)
- [Final Note](#final-note)
- [Contact](#contact)

---

## ✨ Features

XENO CRM enables campaign managers to launch and manage highly targeted campaigns using the power of AI — with almost zero manual effort.

- 🔍 Define audience using natural language
- 🎯 AI-generated campaign objectives
- 📐 Campaign generation from rules
- 🖼️ Generate campaign images with AI (Unsplash)
- 👁️ Audience preview before launch
- 🏷️ Auto-tagging of campaigns using AI
- 📊 Summarized insights from campaign data via AI
- ⚡ Lightning-fast performance powered by Redis

---

## 🧠 Tech Stack & AI Tools

| Category     | Tech Used                                                                 |
|--------------|---------------------------------------------------------------------------|
| Frontend     | Next.js, Tailwind CSS                                                     |
| Backend/API  | RESTful APIs (Next.js API Routes)                                         |
| Database     | MongoDB                                                                   |
| Caching      | Redis                                                                     |
| Authentication | NextAuth.js with Google OAuth                                           |
| Hosting      | Vercel                                                                    |
| AI Models    | Google Gemini API (Text AI)                                               |
| Image AI     | Unsplash API (Image generation)                           |

---

## 🏗️ Architecture Diagram

```text
  [ User ]
     ↓
[ Next.js Frontend ]
     ↓        ↘
 [API Routes]  ↘-----------------------↘
     ↓            ↘                    ↘
[Gemini AI API]  [MongoDB]         [Redis Cache]
     ↓               ↑
[Campaign Logic] ←-- AI Summary, Tags, Images, etc.
````

---

## ⚙️ Local Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/xeno-crm.git
cd xeno-crm
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file with the following values:

```env
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_GEMINI_API_KEY=your_key
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
MONGODB_URI=your_uri
GOOGLE_CLOUD_PROJECT=your_project
GOOGLE_CLOUD_LOCATION=your_location
GOOGLE_CLIENT_EMAIL=your_email
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=your_key
```

> ⚠️ Never commit this file to version control.

### 4. Start the Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to view the app locally.

---

## ⚠️ Known Limitations / Assumptions

* 🧪 The app uses **10,000 dummy customers** for simulation and testing.
* 🌐 Only **Google OAuth login** is implemented.
* 🤖 Gemini prompts may need optimization for long or edge-case queries.
* 🔐 Ensure secret keys remain safe and unexposed in public repos.

---

## 📄 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

---

## ❤️ Final Note

> This project was developed as part of an assignment for **XENO**. It’s a representation of how deeply I love technology. Building this helped me grow Technically and creatively, and I’d love to keep improving it.

---

## 📬 Contact

* 💼 [LinkedIn – Arjun Kumar](https://www.linkedin.com/in/arjunbiznishub)
* 🌐 [hello.arjun.dev.gmail.com](hello.arjun.dev.gmail.com)

