# 🚀 Xeno CRM — AI-Powered Campaign Management System

> **Round 1 Assignment — LangImmerse Co-founder**  
> Submitted by: **Prathmesh Upadhyay**, ABS Engineering College  
> Live Demo: [xenocrm-tau.vercel.app](https://xenocrm-tau.vercel.app)  
> GitHub: [github.com/prathmesh008/xenocrm](https://github.com/prathmesh008/xenocrm)

-----

## 📌 Table of Contents

- [Project Overview](#-project-overview)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
  - [Phase 1 — Fixed & Working](#phase-1--fixed--working)
  - [Phase 2 — New Features Added](#phase-2--new-features-added)
- [Architecture & How It Works](#-architecture--how-it-works)
- [Local Setup](#-local-setup)
- [Environment Variables](#-environment-variables)
- [Fixed Issues](#-fixed-issues)
- [My Learning Curve](#-my-learning-curve)
- [Folder Structure](#-folder-structure)

-----

## 🧠 Project Overview

Xeno CRM is a full-stack AI-powered Customer Relationship Management system. It allows businesses to:

- **Segment customers** using flexible rule-based filters — powered by Google Gemini AI
- **Run targeted campaigns** with personalized messages delivered to thousands of customers
- **Monitor delivery in real-time** with live message tracking via Server-Sent Events (SSE)
- **Analyze campaign performance** through a visual analytics dashboard
- **Browse and understand** their customer base with intelligent AI-driven insights

The original submission was broken across multiple features. I took full ownership of this project, fixed all issues end-to-end, seeded 10,000 realistic customer records, and added meaningful Phase 2 features on top.

-----

## 🛠 Tech Stack

|Layer            |Technology                      |
|-----------------|--------------------------------|
|**Framework**    |Next.js 15 (App Router)         |
|**Styling**      |Tailwind CSS + shadcn/ui        |
|**Database**     |MongoDB (via Mongoose)          |
|**Cache / Queue**|Redis (ioredis)                 |
|**Auth**         |NextAuth.js v4 with Google OAuth|
|**AI**           |Google Gemini 2.0 Flash         |
|**Charts**       |Recharts                        |
|**Deployment**   |Vercel                          |

-----

## ✅ Features

### Phase 1 — Fixed & Working

#### 1. 🔐 Google OAuth Authentication

- Sign in with any Google account
- Session persists across pages
- Protected routes redirect unauthenticated users to `/auth/signin`
- Custom branded sign-in page with gradient UI

#### 2. 👥 10,000 Customer Records Seeded

- Realistic dummy data generated via Python script (`src/scripts/seedCustomers.ts`)
- Each customer has: `name`, `email`, `phone`, `spend`, `visits`, `orders`, `avg_order_value`, `clv`, `lastActive`
- Indexed fields for fast query performance on MongoDB

#### 3. 🎯 AI-Powered Segment Creation

- Natural language prompt → Gemini generates MongoDB filter rules automatically
- Manual rule builder with AND/OR connectors as fallback
- Fields supported: Total Spend, Number of Visits, Inactive Days
- **Preview Audience** — runs rules against MongoDB, returns exact count in real time
- **Generate Objective** — Gemini writes a campaign objective based on the rules
- **Generate Message** — Gemini creates a personalized notification message for the segment

#### 4. 📬 Campaign Execution with Redis Batching

- On segment save, a campaign is created and processing starts immediately
- Customers are processed in **batches of 50** via Redis queuing
- Vendor API simulates message delivery with realistic ~90% success rate
- Background processing — API returns instantly, processing happens asynchronously

#### 5. 📡 Live Message Delivery Tracking (SSE)

- **Server-Sent Events (SSE)** stream real-time progress to the browser
- While a campaign is sending, the table shows live `Sent` and `Failed` counts updating every 300ms
- A pulsing green dot indicates an active campaign
- A mini progress bar shows batch completion percentage
- Once done, SSE closes and DB values take over automatically

#### 6. 📋 Campaign History

- Sortable, searchable, paginated campaign table
- AI-generated summary per campaign (click the ℹ️ icon)
- Auto-tagged campaigns (VIP, General, etc.)
- Success rate calculated and displayed per campaign

-----

### Phase 2 — New Features Added

#### 🆕 Feature 1 — Enhanced Analytics Dashboard

Replaced the plain 3-card dashboard with a full visual analytics hub:

- **Summary cards** — Total messages sent, total failed, overall success rate — with gradient styling
- **Bar chart** — Sent vs Failed per recent campaign (last 7), built with Recharts
- **Pie chart** — Customer spend tier distribution (VIP / High / Mid / Low) with live counts
- **Skeleton loading states** — Animated shimmer placeholders while data loads
- Fully responsive layout

#### 🆕 Feature 2 — Customer Intelligence Page (`/dashboard/customers`)

A brand new page to browse and understand the customer base:

- **Searchable table** — search by name or email across 10,000 records
- **Paginated** — 15 customers per page with previous/next navigation
- **Spend Tier Badges** — each customer is automatically labeled:
  - 🟣 **VIP** — spend ≥ ₹5,000
  - 🔵 **High** — spend ₹2,000–₹5,000
  - 🟢 **Mid** — spend ₹500–₹2,000
  - 🟡 **Low** — spend < ₹500
- **AI Segment Suggestion** — one click sends a customer data snapshot to Gemini, which returns:
1. WHO to target (specific audience description)
1. WHY this segment makes business sense
1. WHAT message angle to use
  - Links directly to the segment creator to act on the suggestion

#### 🆕 Feature 3 — AI Campaign Banner Generator

- Integrated into the Segment creation form
- Click **“Generate AI Banner”** to create 3 unique SVG marketing banners
- Gemini generates headline + tagline copy for each banner
- Banners rendered as gradient SVGs with different color schemes
- Select your preferred banner before saving the segment

#### 🆕 Feature 4 — UX Polish

- **Custom Sign Out page** — replaces the ugly default NextAuth signout screen with a branded modal matching the purple gradient theme
- **Skeleton loading rows** — campaign and customer tables show animated skeleton rows while data loads instead of plain “Loading…” text
- **Toast notifications** — success/error/loading toasts throughout the app for segment creation, campaign launch, and AI generation actions
- **“View all →” links** on dashboard cards for quick navigation

-----

## 🏗 Architecture & How It Works

```
User creates a Segment
        ↓
POST /api/segments  →  saves rules + message to MongoDB
        ↓
POST /api/campaigns →  creates Campaign doc, initializes progressStore
        ↓
processCampaignInBackground() fires (non-blocking)
        ↓
  ┌─────────────────────────────────────────┐
  │  For each batch of 50 customers:        │
  │  vendorApi.sendMessage() × 50           │
  │  → ~90% SENT, ~10% FAILED (simulated)  │
  │  → progressStore.set(campaignId, {...}) │
  │  → wait 300ms                           │
  └─────────────────────────────────────────┘
        ↓
GET /api/campaigns/progress?campaignId=xxx  (SSE)
  → polls progressStore every 300ms
  → streams { sent, failed, total, done } to browser
        ↓
Frontend EventSource receives updates
  → updates table row live (sent/failed counts + progress bar)
        ↓
When done=true:
  → SSE closes
  → Campaign.findByIdAndUpdate() saves final counts to MongoDB
  → Frontend fetches fresh DB values
```

-----

## 💻 Local Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local or Upstash)
- Google Cloud project with OAuth credentials
- Google Gemini API key

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/prathmesh008/xenocrm.git
cd xenocrm

# 2. Install dependencies
npm install

# 3. Set up environment variables (see below)
cp .env.example .env.local
# Fill in your values in .env.local

# 4. Seed the database with 10,000 customers
npx ts-node src/scripts/seedCustomers.ts

# 5. Run the development server
npm run dev
```

Open <http://localhost:3000> and sign in with Google.

-----

## 🔐 Environment Variables

Create a `.env.local` file in the root with these values:

```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/xenocrm

# Redis
REDIS_URL=redis://localhost:6379
# For Upstash: rediss://<user>:<password>@<host>:6379

# NextAuth
NEXTAUTH_SECRET=your-random-secret-string-here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
# Get from: console.cloud.google.com → APIs & Services → Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Google Gemini AI
# Get from: aistudio.google.com/app/apikey
GEMINI_API_KEY=your-gemini-api-key
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
1. Create a project → Enable Google+ API
1. Go to Credentials → Create OAuth 2.0 Client ID
1. Add Authorized redirect URIs:
- `http://localhost:3000/api/auth/callback/google` (local)
- `https://your-vercel-url.vercel.app/api/auth/callback/google` (production)

-----

## 🐛 Fixed Issues

|Issue                                   |What Was Wrong                                  |Fix Applied                                      |
|----------------------------------------|------------------------------------------------|-------------------------------------------------|
|Campaign processing blocked API response|`processCampaignInBackground` was awaited       |Made it fire-and-forget (no `await`)             |
|No live delivery updates                |Frontend only polled DB every 3s                |Added SSE endpoint + EventSource in campaign list|
|`progressStore` not shared across routes|Each route import got its own Map instance      |Used `globalThis.__progressStore` singleton      |
|Session `user.id` TypeScript error      |NextAuth session type missing `id` field        |Added `src/types/next-auth.d.ts` type declaration|
|Next.js 15 `params` breaking change     |`params.id` accessed synchronously              |Changed to `const { id } = await params`         |
|`vertexai.ts` missing package           |Unused file importing uninstalled package       |Deleted the file                                 |
|Invalid `eslint` key in `next.config.ts`|Not a valid Next.js 15 config key               |Removed the key                                  |
|Campaign stats only updated at end      |DB write only happened after all batches        |Write to `progressStore` after every 10 messages |
|Recharts tooltip type error             |`value` typed as `number` but can be `undefined`|Changed to `Number(value)` cast                  |
|Sign out shows default NextAuth page    |No custom signout page existed                  |Created `/auth/signout` with branded UI          |

-----

## 📈 My Learning Curve

This assignment pushed me significantly beyond my comfort zone. Here’s what I learned building it:

### 1. Server-Sent Events (SSE)

I had never implemented SSE before. Understanding that SSE is a one-way persistent HTTP connection — unlike WebSockets — was the key insight. The pattern of writing to an in-memory store from one route and reading it from an SSE stream in another route clicked after some debugging. The trickiest part was handling the `done` signal to cleanly close both the server stream and the client `EventSource`.

### 2. Next.js 15 Breaking Changes

Next.js 15 made `params` in dynamic routes asynchronous — meaning you must `await params` before accessing route parameters like `id`. This broke the build in a non-obvious way because the error message pointed at the type, not the real cause.

### 3. Redis as a Progress Store vs. Queue

I initially assumed Redis was only useful as a message queue (pushing/popping items). This project showed me a second pattern: using Redis as a **shared ephemeral state store** — writing progress snapshots that multiple route handlers can read independently. The `progressStore` in-memory approach works for single-instance deployments; Redis would scale this across multiple Vercel serverless instances.

### 4. Background Processing in Serverless

Running background tasks in Next.js API routes is tricky — the function can be killed once the response is sent. For this project, the fire-and-forget pattern worked locally. In production, the proper solution would be a queue worker (like a separate service or Vercel’s background functions). Understanding this limitation was an important architectural lesson.

### 5. TypeScript Declaration Files

I learned how to extend third-party module types using `.d.ts` declaration files. The `next-auth.d.ts` trick — using `declare module "next-auth"` to add `id` to the `Session.user` type — eliminated 5+ type errors across the project cleanly, without any `as any` casts.

### 6. Recharts in a Server/Client Split Architecture

Using Recharts required understanding Next.js’s server/client boundary. Charts need browser APIs, so they must live in `'use client'` components. I learned to keep data fetching in server components and pass it down, or have client components fetch their own data via API routes — which is the pattern I used for `DashboardCharts.tsx`.

### 7. Prompt Engineering with Gemini

Getting consistent, structured output from Gemini required careful prompt design. Key techniques I applied:

- Asking for JSON-only output and stripping markdown fences before `JSON.parse()`
- Giving explicit format instructions (“respond in exactly this format”)
- Including real data snapshots (customer tier counts, avg spend) so Gemini gives specific, actionable suggestions rather than generic ones
- Setting word limits to prevent runaway responses

-----

## 📁 Folder Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth handler
│   │   ├── campaigns/              # Campaign CRUD + SSE progress
│   │   │   ├── route.ts            # GET list, POST create
│   │   │   ├── [id]/route.ts       # GET single campaign + AI summary
│   │   │   └── progress/route.ts   # SSE live progress stream
│   │   ├── customers/
│   │   │   ├── route.ts            # Paginated customer list
│   │   │   ├── preview/route.ts    # Audience size preview
│   │   │   └── ai-suggest/route.ts # Gemini segment suggestion
│   │   ├── dashboard/
│   │   │   └── stats/route.ts      # Chart data + spend tiers
│   │   ├── delivery-receipt/       # Vendor delivery webhook
│   │   ├── images-generate/        # AI SVG banner generation
│   │   └── segments/               # Segment CRUD + AI rules
│   ├── auth/
│   │   ├── signin/page.tsx         # Custom sign-in page
│   │   └── signout/page.tsx        # Custom sign-out page
│   └── dashboard/
│       ├── page.tsx                # Main dashboard + analytics
│       ├── campaigns/page.tsx      # Campaign history
│       ├── customers/page.tsx      # Customer intelligence
│       └── segments/page.tsx       # Segment creator
├── components/
│   ├── DashboardCharts.tsx         # Recharts bar + pie charts
│   ├── CampaignList.tsx            # Campaign table (was ViewCampaign)
│   ├── SegmentForm.tsx             # AI segment + banner creator
│   ├── ViewCampaign.tsx            # Live SSE campaign tracker
│   └── unsplash.tsx                # AI banner selector
├── lib/
│   ├── ai.ts                       # Gemini helper functions
│   ├── authOptions.ts              # NextAuth configuration
│   ├── batchProcessor.ts           # Redis batch queue processor
│   ├── mongoose.ts                 # MongoDB connection
│   ├── progressStore.ts            # Global in-memory progress Map
│   ├── redis.ts                    # ioredis client
│   └── vendorApi.ts                # Message delivery simulator
├── models/
│   ├── Campaign.ts                 # Campaign schema
│   ├── CommunicationLog.ts         # Delivery log schema
│   ├── Customer.ts                 # Customer schema
│   └── Segment.ts                  # Segment schema
├── scripts/
│   └── seedCustomers.ts            # Seeds 10,000 customers
└── types/
    └── next-auth.d.ts              # Extends Session type with user.id
```

-----

## 🙏 Acknowledgements

Thanks to the LangImmerse team for designing an assignment that actually challenged me to build something real — not just a CRUD app, but a system with async processing, real-time streaming, AI integration, and production deployment. Every bug I fixed taught me something I’ll carry forward.

-----

*Built with ❤️ by Prathmesh Upadhyay — April 2026*
