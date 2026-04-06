# Introduction to Klyro

Welcome to **Klyro**, a highly optimized, local-first, premium AI chat interface. Designed with an "Ethereal Command Center" aesthetic, Klyro serves as a beautiful front-end client for connecting with state-of-the-art open source and commercial AI models.

> **Note:** Klyro is a purely front-end interface. All intelligence is provided by the OpenRouter API.

## Getting Started

Using Klyro is designed to be completely frictionless:

### Selecting Models

Use the dropdown in the header to effortlessly switch between a variety of free reasoning and instruct models. By default, Klyro uses `Auto` which selects the best performing free model available at that moment via OpenRouter routing.

### Chatting & Formatting

Start typing in the input area at the bottom. Klyro fully supports **Markdown processing**. If you ask Klyro to write code, it will neatly format it into syntax-highlighted blocks that are highly readable thanks to our bundled `marked.js` processor.

### Fast-track Interactions

If you're on a fresh screen without an active chat, you can click any of the gradient "prompt chips" strategically placed in the center of the welcome screen to instantaneously send a contextual query without typing anything.

## Key Features

- **History Persistence:** All your previous chats are stored seamlessly in your browser. Click the <kbd>Previous Chats</kbd> button on the right edge of the header to view and quickly reload old conversations and context.
- **Title Auto-generation:** Klyro intelligently intercepts your first prompt in any given session, summarizes it into a succinct phrase behind the scenes, and applies it as the saved chat title.
- **Personalization:** Klyro will prompt you for your name upon your initial visit. It remembers this gracefully, applies your initial to your avatar, and updates its welcome dialogue to include your name.
- **Premium Experience:** Complete with glassmorphism overlays, SVG scaling, and high-framerate transitions for a 60fps interaction experience.

## Privacy & Data Security

Klyro prioritizes user privacy inherently through its architectural design:

- **Local Storage:** Your chat history, personalized name, preferences, and cookie consent are saved exclusively within your browser using the `localStorage` API. Klyro does not transmit an ounce of your personal data to any centralized database.
- **Direct Proxy:** Your AI prompts are securely sent directly to OpenRouter's API endpoints using the local API key configured within the application's core JavaScript. We do not inject telemetry, analytics, or trackers into this process.

---

<p align="center" style="margin-top:60px; font-size: 18px;">
Built with ❤️ by <a style="color: white !important; text-decoration: none !important;"href="https://ayush-devspace5.web.app">Ayush Devspace</a>.
</p>

- **Note:** It is under development
