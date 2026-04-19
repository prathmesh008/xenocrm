import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Generate a beautiful SVG marketing banner server-side
function generateSVGBanner(title: string, subtitle: string, colorScheme: number): string {
  const schemes = [
    { bg1: '#667eea', bg2: '#764ba2', accent: '#f093fb', text: '#ffffff' },
    { bg1: '#f093fb', bg2: '#f5576c', accent: '#fda085', text: '#ffffff' },
    { bg1: '#4facfe', bg2: '#00f2fe', accent: '#43e97b', text: '#ffffff' },
  ];
  const s = schemes[colorScheme % schemes.length];
  const id = `grad${colorScheme}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
  <defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${s.bg1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${s.bg2};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="600" height="300" fill="url(#${id})" rx="12"/>
  <circle cx="520" cy="60" r="80" fill="${s.accent}" opacity="0.15"/>
  <circle cx="80" cy="240" r="60" fill="${s.accent}" opacity="0.1"/>
  <rect x="40" y="120" width="520" height="2" fill="${s.text}" opacity="0.1" rx="1"/>
  <text x="300" y="100" font-family="system-ui, sans-serif" font-size="28" font-weight="700" 
    fill="${s.text}" text-anchor="middle" dominant-baseline="middle">${escapeXml(title)}</text>
  <text x="300" y="155" font-family="system-ui, sans-serif" font-size="15" 
    fill="${s.text}" text-anchor="middle" dominant-baseline="middle" opacity="0.85">${escapeXml(subtitle)}</text>
  <rect x="220" y="195" width="160" height="40" fill="${s.text}" opacity="0.2" rx="20"/>
  <text x="300" y="215" font-family="system-ui, sans-serif" font-size="14" font-weight="600"
    fill="${s.text}" text-anchor="middle" dominant-baseline="middle">Shop Now</text>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 40); // truncate long titles
}

export async function POST(request: Request) {
  try {
    const { prompt, imageCount = 3 } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }

    // Use Gemini to generate banner copy
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const geminiPrompt = `For a marketing campaign about: "${prompt}"
Generate exactly ${imageCount} banner variations as a JSON array.
Each item: {"title": "short headline max 5 words", "subtitle": "tagline max 8 words"}
Return ONLY the JSON array, no markdown.`;

    const result = await model.generateContent(geminiPrompt);
    let text = result.response.text().replace(/```json|```/gi, '').trim();
    
    let bannerData: { title: string; subtitle: string }[] = [];
    try {
      bannerData = JSON.parse(text);
    } catch {
      bannerData = Array.from({ length: imageCount }, (_, i) => ({
        title: prompt.slice(0, 30),
        subtitle: 'Exclusive offer just for you'
      }));
    }

    // Generate SVG banners as data URIs
    const images = bannerData.slice(0, imageCount).map((banner, i) => {
      const svg = generateSVGBanner(banner.title, banner.subtitle, i);
      const base64 = Buffer.from(svg).toString('base64');
      return `data:image/svg+xml;base64,${base64}`;
    });

    return NextResponse.json({ images });
  } catch (error: any) {
    console.error('Error generating banners:', error);
    return NextResponse.json({ error: 'Failed to generate banners' }, { status: 500 });
  }
}