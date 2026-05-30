console.log("Klyro SVG v4.0 Loaded");
// API requests are securely proxied through Cloudflare Workers.
const PROXY_URL = 'https://summer-limit-c821.ayushkunkulol5.workers.dev';
const AI_NAME = "Klyro"; // Change this variable to rename your AI everywhere

// ─────────────────────────────────────────────────────────────

let history = [];
let attachedFiles = [];
let isLoading = false;
let abortController = null;
let currentChatId = Date.now().toString();
let currentChatTitle = null; // will be set from first user message
let isSearchEnabled = false;

function copyCode(btn) {
  const codeWrap = btn.closest('.code-wrap');
  const codeEl = codeWrap.querySelector('code');
  const text = codeEl.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('copied');
    }, 2000);
  });
}

function clearAllChats() {
  if (confirm('Delete all chat history? This cannot be undone.')) {
    localStorage.removeItem('nexai_saved_chats');
    renderPreviousChats();
    createNewChat();
    showToast('Chat history cleared 🗑️');
  }
}

function toggleSearch() {
  isSearchEnabled = !isSearchEnabled;
  const btn = document.getElementById('search-btn');
  if (isSearchEnabled) {
    btn.classList.add('active');
    showToast('Internal Web Search Enabled 🌐', false, 2000);
  } else {
    btn.classList.remove('active');
    showToast('Web Search Disabled 🌑', false, 2000);
  }
}

async function performInternalSearch(query) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const targetUrl = encodeURIComponent(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);

    const response = await fetch(proxyUrl + targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const results = [];

    const entries = doc.querySelectorAll('.result');
    entries.forEach((entry, i) => {
      if (i >= 5) return;
      const title = entry.querySelector('.result__title')?.innerText.trim();
      const snippet = entry.querySelector('.result__snippet')?.innerText.trim();
      const link = entry.querySelector('.result__url')?.innerText.trim();
      if (title && snippet) {
        results.push(`[Source: ${link}] Title: ${title} - Snippet: ${snippet}`);
      }
    });

    return results.length > 0 ? results.join('\n\n') : 'No real-time results found for this query.';
  } catch (err) {
    console.error('Search error:', err);
    clearTimeout(timeoutId);
    return 'Search service timed out or failed. Proceeding with general knowledge.';
  }
}

// ── Name Management ──
function getUserName() {
  return localStorage.getItem('nexai_user_name') || '';
}

function applyAIName() {
  document.title = AI_NAME;
  const logoName = document.getElementById('logo-name');
  if (logoName) logoName.textContent = AI_NAME;
  const nameSub = document.getElementById('name-modal-sub');
  if (nameSub) nameSub.textContent = AI_NAME + ' will use it to personalise your experience.';
}

// ── Cookie Consent ──
function acceptCookies() {
  localStorage.setItem('klyro_cookie_consent', 'true');
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.classList.remove('show');
}

function initCookies() {
  if (!localStorage.getItem('klyro_cookie_consent')) {
    setTimeout(() => {
      const banner = document.getElementById('cookie-banner');
      if (banner) banner.classList.add('show');
    }, 1500); // Show shortly after load
  }
}


function applyName(name) {
  // Update header chip
  const chip = document.getElementById('user-chip');
  const chipName = document.getElementById('user-chip-name');
  const chipAvatar = document.getElementById('user-chip-avatar');
  if (name) {
    chipName.textContent = name;
    chipAvatar.textContent = name.charAt(0).toUpperCase();
    if (chip) chip.classList.add('has-name');
  }
  // Update welcome title if visible
  const wt = document.getElementById('welcome-title');
  if (wt && name) {
    wt.innerHTML = `Hey ${name},<br>what can I help<br>you with?`;
  }
}

function saveName() {
  const input = document.getElementById('name-input');
  const name = (input ? input.value.trim() : '') || '';
  if (!name) {
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);
    return;
  }
  localStorage.setItem('nexai_user_name', name);
  applyName(name);
  // Hide modal
  const overlay = document.getElementById('name-modal-overlay');
  overlay.classList.remove('open');
  setTimeout(() => overlay.style.display = 'none', 300);
  showToast('Welcome, ' + name + '! 👋');
}

function promptChangeName() {
  const overlay = document.getElementById('name-modal-overlay');
  const input = document.getElementById('name-input');
  const title = overlay.querySelector('.name-modal-title');
  const sub = overlay.querySelector('.name-modal-sub');
  const btn = document.getElementById('name-modal-btn');
  title.textContent = 'Change your name';
  sub.textContent = 'Update how Klyro addresses you.';
  btn.textContent = 'Save →';
  input.value = getUserName();
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('open'));
  setTimeout(() => input.focus(), 200);
}

function initName() {
  applyAIName();
  const name = getUserName();
  if (name) {
    applyName(name);
    // Hide modal
    const overlay = document.getElementById('name-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  } else {
    // Show modal on first visit
    const overlay = document.getElementById('name-modal-overlay');
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('open'));
    setTimeout(() => {
      const inp = document.getElementById('name-input');
      if (inp) inp.focus();
    }, 200);
  }
}

function scrollToBottom() {
  const chat = document.getElementById('chat');
  chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
}

let scrollTicking = false;
function handleScroll() {
  if (!scrollTicking) {
    requestAnimationFrame(() => {
      const chat = document.getElementById('chat');
      const btn = document.getElementById('scroll-bottom-btn');
      if (chat && btn) {
        const isFar = chat.scrollHeight - chat.scrollTop - chat.clientHeight > 300;
        if (isFar) btn.classList.add('show');
        else btn.classList.remove('show');
      }
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('name-input');
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveName();
    });
  }

  const chat = document.getElementById('chat');
  if (chat) chat.addEventListener('scroll', handleScroll, { passive: true });

  // Focus scroll assist for mobile keyboards
  const mainInput = document.getElementById('input');
  if (mainInput) {
    mainInput.addEventListener('focus', () => {
      setTimeout(scrollToBottom, 150);
    });
  }

  // Mobile sidebar overlay close handler
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      const prevChats = document.getElementById('prev-chats');
      if (prevChats) prevChats.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  initName();
  initCookies();
});

function onModelChange() {
  const label = document.getElementById('model-select').selectedOptions[0].text;
  showToast('Switched to ' + label);
}

function hideWelcome() {
  const w = document.getElementById('welcome');
  if (w) w.remove();
}

function addMessage(role, text, modelName, historyIndex) {
  hideWelcome();
  const chat = document.getElementById('chat');

  const row = document.createElement('div');
  row.className = 'message ' + role;
  const msgIdx = historyIndex !== undefined ? historyIndex : history.length;
  row.dataset.index = msgIdx;

  const av = document.createElement('div');
  av.className = 'av ' + role;
  if (role === 'ai') {
    const img = document.createElement('img');
    img.src = 'artificial-intelligence.svg';
    img.alt = AI_NAME;
    av.appendChild(img);
  } else {
    const storedName = getUserName();
    av.textContent = storedName ? storedName.charAt(0).toUpperCase() : '↑';
  }

  const body = document.createElement('div');
  body.className = 'msg-body';

  const bub = document.createElement('div');
  bub.className = 'bubble ' + role;
  bub.innerHTML = formatText(text);
  body.appendChild(bub);

  if (role === 'ai' && modelName) {
    const tag = document.createElement('div');
    tag.className = 'model-tag';
    tag.textContent = modelName;
    body.appendChild(tag);
  }

  // ── Actions Toolbar ──
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const getText = () => {
    if (role === 'ai' && history[msgIdx]) return history[msgIdx].content;
    return text;
  };

  if (role === 'user') {
    actions.appendChild(createActionBtn('edit', 'Edit message', () => editMessage(msgIdx, row)));
  } else {
    actions.appendChild(createActionBtn('regenerate', 'Regenerate', () => regenerateResponse(msgIdx)));
    actions.appendChild(createActionBtn('pdf', 'Export to PDF', () => exportToPDF(getText(), msgIdx)));
  }

  actions.appendChild(createActionBtn('copy', 'Copy to clipboard', () => copyToClipboard(getText())));

  body.appendChild(actions);
  row.appendChild(av);
  row.appendChild(body);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
  return { row, bub, actions };
}

function createActionBtn(type, title, onClick) {
  const btn = document.createElement('button');
  btn.className = 'action-btn';
  btn.title = title;
  btn.onclick = onClick;

  let iconPath = '';
  if (type === 'edit') iconPath = 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z';
  if (type === 'copy') iconPath = 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6v4H9z';
  if (type === 'regenerate') iconPath = 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15';
  if (type === 'pdf') iconPath = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8';

  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPath}"></path></svg>`;
  return btn;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard! 📋');
  }).catch(() => {
    showToast('Failed to copy', true);
  });
}

async function exportToPDF(text, index) {
  if (typeof html2pdf === 'undefined') {
    showToast('PDF library is still loading. Please try again.', true);
    return;
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.padding = '40px';
  container.style.background = '#ffffff';
  container.style.color = '#334155';
  container.style.fontFamily = 'Helvetica, Arial, sans-serif';
  container.style.boxSizing = 'border-box';

  const header = document.createElement('div');
  header.style.backgroundColor = '#f8fafc';
  header.style.padding = '30px';
  header.style.borderBottom = '1px solid #e2e8f0';
  header.style.marginBottom = '30px';
  header.style.borderRadius = '8px';

  const title = document.createElement('h1');
  title.textContent = 'Klyro AI';
  title.style.margin = '0 0 8px 0';
  title.style.color = '#1e293b';
  title.style.fontSize = '28px';

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const subTitle = document.createElement('div');
  subTitle.textContent = `Response Export • ${dateStr}`;
  subTitle.style.color = '#64748b';
  subTitle.style.fontSize = '13px';

  header.appendChild(title);
  header.appendChild(subTitle);
  container.appendChild(header);

  const content = document.createElement('div');
  content.style.fontSize = '15px';
  content.style.lineHeight = '1.7';
  content.style.color = '#1e293b';
  content.style.wordBreak = 'break-word';

  content.innerHTML = formatText(text);

  const style = document.createElement('style');
  style.textContent = `
    .pdf-content { font-family: 'Helvetica', Arial, sans-serif; }
    .pdf-content h1, .pdf-content h2, .pdf-content h3 { color: #0f172a; margin-top: 24px; margin-bottom: 12px; font-weight: 600; }
    .pdf-content table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; table-layout: fixed; }
    .pdf-content th { background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; text-align: left; font-weight: 600; }
    .pdf-content td { padding: 12px; border: 1px solid #e2e8f0; vertical-align: top; word-break: break-word; overflow-wrap: break-word; }
    .pdf-content pre { background: #1e293b; color: #f8fafc; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; line-height: 1.5; margin: 16px 0; white-space: pre-wrap; word-break: break-all; overflow-wrap: break-word; }
    .pdf-content code { font-family: monospace; background: #f1f5f9; color: #8b5cf6; padding: 2px 5px; border-radius: 4px; font-size: 13px; word-break: break-word; }
    .pdf-content p { margin-bottom: 16px; }
    .pdf-content blockquote { border-left: 4px solid #8b5cf6; padding: 12px 20px; margin: 16px 0; background: #f8fafc; color: #475569; font-style: italic; }
    .pdf-content img { max-width: 100%; height: auto; }
  `;
  content.className = 'pdf-content';
  content.appendChild(style);

  container.appendChild(content);

  const footer = document.createElement('div');
  footer.style.marginTop = '50px';
  footer.style.paddingTop = '20px';
  footer.style.borderTop = '1px solid #e2e8f0';
  footer.style.textAlign = 'center';
  footer.style.fontSize = '12px';
  footer.style.color = '#94a3b8';
  footer.innerHTML = 'Generated by Klyro AI • <a href="https://klyro-ai-assistant.web.app" style="color: #64748b; text-decoration: none;">klyro-ai-assistant.web.app</a>';
  container.appendChild(footer);

  document.body.appendChild(container);

  const safeTitle = currentChatTitle ? currentChatTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'klyro-chat';

  const opt = {
    margin: [15, 15, 15, 15],
    filename: `${safeTitle}-export.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 800,
      windowWidth: 800
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  showToast('Preparing PDF...', false, 2000);

  html2pdf().set(opt).from(container).save().then(() => {
    showToast('PDF Exported Successfully! 📄');
    document.body.removeChild(container);
  }).catch(err => {
    console.error("PDF Export Error:", err);
    showToast('PDF Export Failed', true);
    document.body.removeChild(container);
  });
}

function regenerateResponse(index) {
  if (isLoading) return;

  const userIdx = index - 1;
  if (userIdx < 0 || history[userIdx].role !== 'user') {
    showToast('Could not find original prompt to regenerate.', true);
    return;
  }

  // Truncate history to just before the AI response we want to regenerate
  history = history.slice(0, index);

  // Clear DOM messages from the AI response onwards
  const chat = document.getElementById('chat');
  const rows = Array.from(chat.querySelectorAll('.message'));
  rows.forEach(row => {
    if (parseInt(row.dataset.index) >= index) row.remove();
  });

  // Call processResponse directly without clearing input or adding new user message
  processResponse();
}

function formatText(t) {
  if (typeof marked !== 'undefined') {
    const renderer = new marked.Renderer();
    renderer.code = (code, lang) => {
      const rawCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="code-wrap">
        <div class="code-header">
          <span>${lang || 'code'}</span>
          <button class="copy-code-btn" onclick="copyCode(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
        </div>
        <pre><code>${rawCode}</code></pre>
      </div>`;
    };
    return marked.parse(t, { renderer });
  }
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const rawCode = code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="code-wrap">
      <div class="code-header">
        <span>${lang || 'code'}</span>
        <button class="copy-code-btn" onclick="copyCode(this)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy
        </button>
      </div>
      <pre><code>${rawCode}</code></pre>
    </div>`;
  });
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.*?)\*/g, '<em>$1</em>');
  t = t.replace(/\n/g, '<br/>');
  return t;
}

function showTyping() {
  hideWelcome();
  const chat = document.getElementById('chat');
  const row = document.createElement('div');
  row.className = 'typing-row'; row.id = 'typing-msg';
  const av = document.createElement('div');
  av.className = 'av ai';
  const img = document.createElement('img');
  img.src = 'artificial-intelligence.svg';
  img.alt = AI_NAME;
  av.appendChild(img);
  const bub = document.createElement('div');
  bub.className = 'typing-bubble';
  bub.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  row.appendChild(av); row.appendChild(bub);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing-msg');
  if (t) t.remove();
}

function showToast(msg, isError = false, d = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), d);
}

const FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
  'z-ai/glm-4.5-air:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free'
];

async function callModel(model, messages, onChunk) {
  try {
    abortController = new AbortController();

    // Create real-time context system message
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const systemMessage = {
      role: 'system',
      content: `You are Klyro AI, a sophisticated AI assistant. 
Today's Date: ${dateStr}. 
Current Time: ${timeStr}.
Knowledge Cutoff: Your base knowledge may have a cutoff, but you are aware that today is ${dateStr}. Use this information to provide the most relevant and up-to-date responses possible. If asked about current events beyond your cutoff, acknowledge the current date and provide the best available context.
Developer: Klyro was built and designed by Ayush Kunkulol, also known as Ayush Devspace. His portfolio is at https://ayush-devspace5.web.app. If anyone asks who created you, who your developer is, or who built Klyro, always credit Ayush Kunkulol as your creator and developer.`
    };

    // Combine system message with conversation history without mutating the original objects
    const augmentedMessages = messages.map(m => ({ ...m }));
    const existingSysIdx = augmentedMessages.findIndex(m => m.role === 'system');

    const isGemma = model.toLowerCase().includes('gemma');
    const roleName = isGemma ? 'user' : 'system';

    if (existingSysIdx !== -1) {
      if (isGemma) {
        augmentedMessages[existingSysIdx].role = 'user';
      }
      augmentedMessages[existingSysIdx].content = `${systemMessage.content}\n\n${augmentedMessages[existingSysIdx].content}`;
    } else {
      augmentedMessages.unshift({
        role: roleName,
        content: systemMessage.content
      });
    }

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json'
      },
      body: JSON.stringify({
        model,
        messages: augmentedMessages,
        max_tokens: 2048,
        stream: !!onChunk
      })
    });

    if (res.status === 401) throw new Error('API Key is Invalid or Deleted in the Cloudflare Proxy.');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || 'HTTP ' + res.status;
      window.lastApiError = errMsg;
      throw new Error(errMsg);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!onChunk || contentType.includes('application/json')) {
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'API Error');
      const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.delta?.content || 'No response received.';
      if (onChunk) onChunk(content, content);
      return content;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let reply = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);

        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          let data = null;
          try {
            data = JSON.parse(line.substring(6));
          } catch (e) { }

          if (data && data.choices && data.choices[0].delta && typeof data.choices[0].delta.content === 'string') {
            const content = data.choices[0].delta.content;
            reply += content;
            if (onChunk) onChunk(content, reply);
          } else if (data && data.error) {
            throw new Error(data.error.message || 'API Error during stream');
          }
        }
        boundary = buffer.indexOf('\n');
      }
    }
    return reply || 'No response received.';
  } catch (err) {
    window.lastApiError = err.message;
    throw err;
  }
}

function stopResponse() {
  if (abortController) abortController.abort();
  removeTyping();
  isLoading = false;
  abortController = null;
  document.getElementById('send-btn').disabled = false;
  document.getElementById('send-btn').style.display = 'flex';
  document.getElementById('stop-btn').classList.remove('show');
}

async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('input');
  let text = input.value.trim();
  if (!text && attachedFiles.length === 0) return;

  const modelLabel = document.getElementById('model-select').selectedOptions[0].text;

  let uiText = text;
  let apiText = text;

  if (attachedFiles.length > 0) {
    const fileNames = attachedFiles.map(f => f.name).join(', ');
    uiText = uiText ? `[Attached: ${fileNames}]\n${uiText}` : `[Attached: ${fileNames}]`;
    const fileContentStr = attachedFiles.map(f => `=== File: ${f.name} ===\n${f.content}\n`).join('\n');
    apiText = `${fileContentStr}\n\n${text}`;
  }

  addMessage('user', uiText);
  history.push({ role: 'user', content: apiText });

  if (!currentChatTitle) {
    const titleText = text || 'File Context';
    currentChatTitle = titleText.length > 50 ? titleText.substring(0, 50) + '…' : titleText;
  }

  if (attachedFiles.length > 0) {
    attachedFiles = [];
    renderAttachedFiles();
  }

  input.value = '';
  input.style.height = 'auto';

  await processResponse(modelLabel);
}

async function processResponse(modelLabel) {
  const model = document.getElementById('model-select').value;




  isLoading = true;
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  const input = document.getElementById('input');

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.display = 'none';
  }
  if (stopBtn) stopBtn.classList.add('show');

  showTyping();

  try {
    let reply = null;
    let usedModel = modelLabel || document.getElementById('model-select').selectedOptions[0].text;

    // Internal Web Search logic - Built-in native integration
    let searchContext = null;
    if (isSearchEnabled) {
      const lastUserMsg = history.filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        try {
          showToast('Searching the web...', false, 2000);
          const searchResults = await performInternalSearch(lastUserMsg.content);
          searchContext = {
            role: 'system',
            content: `[NATIVE KLYRO SEARCH ENABLED]\n\nToday's Date: ${new Date().toLocaleDateString()}\n\nVerified Real-Time Search Results:\n${searchResults}\n\nINSTRUCTION: You are currently augmented with Klyro's internal web search tool. Use the real-time data above to provide an accurate, up-to-date answer. Acknowledge search findings in your response if helpful.`
          };
        } catch (searchErr) {
          console.error('Search failed to inject:', searchErr);
        }
      }
      usedModel += ' (Internal Web Search)';
    }

    removeTyping();
    const msgObj = addMessage('ai', '', usedModel, history.length);
    if (msgObj && msgObj.actions) msgObj.actions.style.display = 'none';

    const onChunk = (chunk, fullText) => {
      msgObj.bub.innerHTML = formatText(fullText);
      const chat = document.getElementById('chat');
      // Scroll if near bottom
      if (chat.scrollHeight - chat.scrollTop - chat.clientHeight < 120) {
        chat.scrollTop = chat.scrollHeight;
      }
    };

    try {
      let messagesToSend = searchContext ? [searchContext, ...history] : history;
      reply = await callModel(model, messagesToSend, onChunk);
    } catch (e) {
      if (e.name === 'AbortError') return;
      const msg = e.message.toLowerCase();
      if (msg.includes('api key is invalid')) throw e;
      if (msg.includes('402') || msg.includes('payment') || msg.includes('balance') || msg.includes('credit')) {
        throw new Error('This premium model requires OpenRouter account credits to use. Please top up your account or select a free model.');
      }

      for (const fb of FALLBACK_MODELS) {
        if (fb === model) continue;
        try {
          reply = await callModel(fb, messagesToSend, onChunk);
          break;
        } catch (e2) { continue; }
      }
    }

    if (!reply) {
      msgObj.row.remove();
      const lastErr = window.lastApiError || 'Unknown Error';
      throw new Error(`All models failed. Last Error: ${lastErr}`);
    }

    if (msgObj && msgObj.actions) msgObj.actions.style.display = 'flex';
    history.push({ role: 'assistant', content: reply });
    saveCurrentChat();

  } catch (err) {
    if (err.name === 'AbortError') return;
    removeTyping();
    addMessage('ai', err.message, null, history.length);
    showToast(err.message.substring(0, 80), true);
  } finally {
    isLoading = false;
    abortController = null;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.style.display = 'flex';
    }
    if (stopBtn) stopBtn.classList.remove('show');
    if (input) input.focus();
  }
}

// ── Message Editing Logic ──
function editMessage(index, row) {
  if (isLoading) return;
  const body = row.querySelector('.msg-body');
  const bub = body.querySelector('.bubble');
  const originalHtml = bub.innerHTML;

  // Find raw text from history if possible, else use bubble text
  // history[index].content might contain file contents
  let rawText = history[index] ? history[index].content : bub.textContent;

  // If apiText has file contents, try to extract just the user message
  if (rawText.includes('=== File:')) {
    const parts = rawText.split('\n\n');
    rawText = parts[parts.length - 1]; // last part is the user text
  }

  body.classList.add('editing');
  const originalBubbleDisplay = bub.style.display;
  bub.style.display = 'none';
  const editBtn = body.querySelector('.action-btn[title="Edit message"]');
  if (editBtn) editBtn.style.display = 'none';
  const actionsToolbar = body.querySelector('.message-actions');
  if (actionsToolbar) actionsToolbar.style.display = 'none';

  const container = document.createElement('div');
  container.className = 'edit-container';
  container.innerHTML = `
    <textarea class="edit-textarea" placeholder="Edit your message…">${escHtml(rawText)}</textarea>
    <div class="edit-actions">
      <button class="edit-btn-cancel">Cancel</button>
      <button class="edit-btn-save">Save & Submit</button>
    </div>
  `;
  body.appendChild(container);

  const textarea = container.querySelector('.edit-textarea');
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  autoResize(textarea);
  textarea.oninput = () => autoResize(textarea);

  container.querySelector('.edit-btn-cancel').onclick = () => {
    container.remove();
    bub.style.display = originalBubbleDisplay;
    if (actionsToolbar) actionsToolbar.style.display = 'flex';
    body.classList.remove('editing');
  };

  container.querySelector('.edit-btn-save').onclick = () => {
    const newText = textarea.value.trim();
    if (newText && (newText !== rawText)) {
      commitEdit(index, newText);
    } else {
      // Just cancel if no change
      container.remove();
      bub.style.display = originalBubbleDisplay;
      if (actionsToolbar) actionsToolbar.style.display = 'flex';
      body.classList.remove('editing');
    }
  };

  textarea.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      container.querySelector('.edit-btn-save').click();
    }
    if (e.key === 'Escape') {
      container.querySelector('.edit-btn-cancel').click();
    }
  };
}

function commitEdit(index, newText) {
  // 1. Truncate history to the edited message
  // history is [user0, ai0, user1, ai1, ...]
  // If we edit user1 (index 2), we keep [user0, ai0] and then send user1-new
  history = history.slice(0, index);

  // 2. Clear DOM messages from that point onwards
  const chat = document.getElementById('chat');
  const rows = Array.from(chat.querySelectorAll('.message'));
  rows.forEach(row => {
    if (parseInt(row.dataset.index) >= index) {
      row.remove();
    }
  });

  // 3. Put new text in input and send
  const input = document.getElementById('input');
  input.value = newText;
  autoResize(input);
  sendMessage();
}

function quickSend(t) {
  document.getElementById('input').value = t;
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}
// ── LocalStorage chat persistence ──
function getSavedChats() {
  try {
    return JSON.parse(localStorage.getItem('nexai_chats') || '[]');
  } catch (e) { return []; }
}

function saveCurrentChat() {
  if (!history.length || !currentChatTitle) return;
  const chats = getSavedChats();
  const idx = chats.findIndex(c => c.id === currentChatId);
  const model = document.getElementById('model-select').value;
  const entry = {
    id: currentChatId,
    title: currentChatTitle,
    model,
    timestamp: Date.now(),
    history: history.slice()
  };
  if (idx >= 0) chats[idx] = entry;
  else chats.unshift(entry);
  // Keep only 50 most recent chats
  if (chats.length > 50) chats.length = 50;
  localStorage.setItem('nexai_chats', JSON.stringify(chats));
  updateHeaderChatName(currentChatTitle);
}

function loadChat(chatId) {
  const chats = getSavedChats();
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;

  // Save current chat before switching
  saveCurrentChat();

  currentChatId = chat.id;
  currentChatTitle = chat.title;
  history = chat.history.slice();

  // Set model
  const sel = document.getElementById('model-select');
  if (chat.model) sel.value = chat.model;

  // Re-render messages
  const chatEl = document.getElementById('chat');
  chatEl.innerHTML = '';
  history.forEach((msg, idx) => {
    if (msg.role === 'user') addMessage('user', msg.content, null, idx);
    else if (msg.role === 'assistant') addMessage('ai', msg.content, chat.model ? chat.model.split('/').pop().replace(':free', '') : '', idx);
  });

  document.getElementById('prev-chats').classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.remove('show');
  showToast('Chat loaded: ' + chat.title.substring(0, 30));
}

function deleteChat(chatId, e) {
  e.stopPropagation();
  const chats = getSavedChats().filter(c => c.id !== chatId);
  localStorage.setItem('nexai_chats', JSON.stringify(chats));
  renderPreviousChats(document.getElementById('prev-chat-search-input')?.value || '');
  showToast('Chat deleted');
}

// ── Rename helpers ──
function renameChatById(chatId, newTitle) {
  if (!newTitle || !newTitle.trim()) return;
  newTitle = newTitle.trim();
  const chats = getSavedChats();
  const idx = chats.findIndex(c => c.id === chatId);
  if (idx < 0) return;
  chats[idx].title = newTitle;
  localStorage.setItem('nexai_chats', JSON.stringify(chats));
  // If it's the current chat, update in-memory title too
  if (chatId === currentChatId) {
    currentChatTitle = newTitle;
    updateHeaderChatName(newTitle);
  }
}

function renameChat(chatId, e) {
  e.stopPropagation();
  const item = e.currentTarget.closest('.prev-chat-item');
  const titleEl = item.querySelector('.prev-chat-title');
  const currentTitle = titleEl.textContent;

  // Build inline editor
  item.style.pointerEvents = 'none';
  const editor = document.createElement('div');
  editor.className = 'rename-editor';
  editor.innerHTML = `
    <input class="rename-input" value="${escHtml(currentTitle)}" maxlength="80"/>
    <button class="rename-confirm" title="Save"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></button>
    <button class="rename-cancel" title="Cancel"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg></button>
  `;
  item.appendChild(editor);
  const inp = editor.querySelector('.rename-input');
  inp.focus();
  inp.select();

  function commit() {
    const val = inp.value.trim();
    if (val && val !== currentTitle) {
      renameChatById(chatId, val);
      titleEl.textContent = val;
    }
    editor.remove();
    item.style.pointerEvents = '';
  }
  function cancel() {
    editor.remove();
    item.style.pointerEvents = '';
  }

  editor.querySelector('.rename-confirm').addEventListener('click', (ev) => { ev.stopPropagation(); commit(); });
  editor.querySelector('.rename-cancel').addEventListener('click', (ev) => { ev.stopPropagation(); cancel(); });
  inp.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    if (ev.key === 'Escape') cancel();
  });
  inp.addEventListener('click', ev => ev.stopPropagation());
}

// ── Rename current (active) chat via header button ──
function renameCurrentChat() {
  if (!currentChatTitle) { showToast('Start a chat first to name it', false, 2000); return; }
  const btn = document.getElementById('rename-current-btn');
  const existingInput = document.getElementById('rename-current-input-wrap');
  if (existingInput) { existingInput.remove(); return; }
  const wrap = document.createElement('div');
  wrap.id = 'rename-current-input-wrap';
  wrap.innerHTML = `
    <input id="rename-current-input" type="text" value="${escHtml(currentChatTitle)}" maxlength="80" placeholder="Chat name…"/>
    <button id="rename-current-ok" title="Save">✓</button>
    <button id="rename-current-cancel" title="Cancel">✗</button>
  `;
  btn.insertAdjacentElement('afterend', wrap);
  const inp = document.getElementById('rename-current-input');
  inp.focus(); inp.select();

  function commit() {
    const val = inp.value.trim();
    if (val) { renameChatById(currentChatId, val); }
    wrap.remove();
  }
  function cancel() { wrap.remove(); }

  document.getElementById('rename-current-ok').addEventListener('click', commit);
  document.getElementById('rename-current-cancel').addEventListener('click', cancel);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') cancel();
  });
}

function updateHeaderChatName(name) {
  const el = document.getElementById('current-chat-name');
  if (el) el.textContent = name;
}

// write function to handle new chat creation
function createNewChat() {
  // Save existing chat before creating new one
  saveCurrentChat();

  history = [];
  currentChatId = Date.now().toString();
  currentChatTitle = null;

  const chatEl = document.getElementById('chat');
  chatEl.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-title" id="welcome-title">${getUserName() ? 'Hey ' + getUserName() + ',<br>what can I help<br>you with?' : 'What can I help<br>you with?'}</div>
      <p class="welcome-sub">Powered by AI models via OpenRouter. Ask anything — code, ideas, questions.</p>
      <div class="chips">
        <div class="chip" onclick='quickSend("Explain quantum computing simply")'>⚛ Quantum computing</div>
        <div class="chip" onclick='quickSend("Write a Python function to reverse a string")'>🐍 Python code</div>
        <div class="chip" onclick='quickSend("Give me 5 tips to learn programming faster")'>🚀 Learn faster</div>
        <div class="chip" onclick='quickSend("What is the difference between AI and ML?")'>🤖 AI vs ML</div>
        <div class="chip" onclick='quickSend("Tell me something fascinating about black holes")'>🌌 Black holes</div>
        <div class="chip" onclick='quickSend("Write a simple HTML page with a button that shows an alert")'>💻 HTML example</div>
      </div>
    </div>
  `;
}
document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
document.getElementById('model-select').addEventListener('change', onModelChange);

// ── Previous Chats dropdown ──
function renderPreviousChats(filter) {
  filter = (filter || '').toLowerCase();
  const chats = getSavedChats();
  const prevChats = document.getElementById('prev-chats');

  const filtered = chats.filter(c => c.title.toLowerCase().includes(filter));

  const list = filtered.length
    ? filtered.map(c => {
      const ago = timeAgo(c.timestamp);
      return `
          <div class="prev-chat-item" onclick="loadChat('${c.id}')">
            <span class="prev-chat-title">${escHtml(c.title)}</span>
            <span class="prev-chat-meta">${ago}</span>
            <button class="prev-chat-rename" onclick="renameChat('${c.id}', event)" title="Rename">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button class="prev-chat-del" onclick="deleteChat('${c.id}', event)" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </button>
          </div>`;
    }).join('')
    : `<div class="prev-chat-empty">${filter ? 'No matching chats' : 'No saved chats yet'}</div>`;

  prevChats.querySelector('.prev-chat-list').innerHTML = list;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
function showPreviousChats() {
  const prevChats = document.getElementById('prev-chats');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = prevChats.classList.contains('open');
  if (isOpen) {
    prevChats.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  } else {
    prevChats.classList.add('open');
    if (overlay) overlay.classList.add('show');
    renderPreviousChats('');
    setTimeout(() => {
      const inp = document.getElementById('prev-chat-search-input');
      if (inp) inp.focus();
    }, 50);
  }
}

document.getElementById('prev-chats-btn').addEventListener('click', showPreviousChats);
document.getElementById('close-history-btn').addEventListener('click', () => {
  document.getElementById('prev-chats').classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.remove('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', function (event) {
  const prevChats = document.getElementById('prev-chats');
  const prevChatsBtn = document.getElementById('prev-chats-btn');
  const overlay = document.getElementById('sidebar-overlay');
  if (!prevChats.contains(event.target) && !prevChatsBtn.contains(event.target)) {
    prevChats.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }
});
// ── File Attachments ──

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  if (typeof pdfjsLib === 'undefined') throw new Error("PDF.js not loaded");
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    text += strings.join(' ') + '\n';
    if (text.length > 500000) break; // Revert to large 500k chars limit
  }
  return text;
}

const fileInput = document.getElementById('file-input');
if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showToast(`File ${file.name} is too large (>10MB).`, true);
        continue;
      }
      try {
        let content = '';
        if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
          showToast(`Extracting PDF: ${file.name}...`, false, 2000);
          content = await extractTextFromPDF(file);
        } else {
          content = await file.text();
        }

        // Remove illegal unicode control characters that commonly break standard API JSON parsers
        content = content.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

        // Large 500k limit to support large context models
        if (content.length > 500000) {
          content = content.substring(0, 500000) + '\n\n...[FILE TRUNCATED DUE TO EXTREME LENGTH LIMITS]';
          showToast(`File ${file.name} extremely large, truncated.`, false, 3000);
        }

        attachedFiles.push({ name: file.name, content });
      } catch (err) {
        showToast(`Failed to read ${file.name}`, true);
        console.error(err);
      }
    }
    fileInput.value = ''; // clear
    renderAttachedFiles();
  });
}

function removeFile(index) {
  attachedFiles.splice(index, 1);
  renderAttachedFiles();
}

function renderAttachedFiles() {
  const container = document.getElementById('attached-files');
  if (!container) return;
  container.innerHTML = attachedFiles.map((f, i) => `
    <div class="file-chip">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
      ${escHtml(f.name)}
      <button class="remove-file" onclick="removeFile(${i})">&times;</button>
    </div>
  `).join('');
}
