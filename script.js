const MY_API_KEY = "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";
const AI_NAME = "Klyro"; // Change this variable to rename your AI everywhere

// ─────────────────────────────────────────────────────────────

let history = [];
let isLoading = false;
let abortController = null;
let currentChatId = Date.now().toString();
let currentChatTitle = null; // will be set from first user message

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
  sub.textContent = 'Update how NexAI addresses you.';
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

// Allow Enter key in name input
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('name-input');
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveName();
    });
  }
  initName();
  initCookies();
});

function onModelChange() {
  const label = document.getElementById('model-select').selectedOptions[0].text;
  history = [];
  showToast('Switched to ' + label);
}

function hideWelcome() {
  const w = document.getElementById('welcome');
  if (w) w.remove();
}

function addMessage(role, text, modelName) {
  hideWelcome();
  const chat = document.getElementById('chat');

  const row = document.createElement('div');
  row.className = 'message ' + role;

  const av = document.createElement('div');
  av.className = 'av ' + role;
  const storedName = getUserName();
  av.textContent = role === 'ai' ? '✦' : (storedName ? storedName.charAt(0).toUpperCase() : '↑');

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

  row.appendChild(av);
  row.appendChild(body);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function formatText(t) {
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  );
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
  av.className = 'av ai'; av.textContent = '✦';
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
  'google/gemma-3-27b-it:free',
  'openrouter/auto'
];

async function callModel(apiKey, model, messages) {
  abortController = new AbortController();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: abortController.signal,
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.href,
      'X-Title': AI_NAME
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048 })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'HTTP ' + res.status);
  return data?.choices?.[0]?.message?.content || 'No response received.';
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
  const text = input.value.trim();
  if (!text) return;

  const apiKey = MY_API_KEY;
  const model = document.getElementById('model-select').value;
  const modelLabel = document.getElementById('model-select').selectedOptions[0].text;

  addMessage('user', text);
  history.push({ role: 'user', content: text });
  // Use first message as chat title
  if (!currentChatTitle) {
    currentChatTitle = text.length > 50 ? text.substring(0, 50) + '…' : text;
  }

  input.value = '';
  input.style.height = 'auto';
  isLoading = true;
  document.getElementById('send-btn').disabled = true;
  document.getElementById('send-btn').style.display = 'none';
  document.getElementById('stop-btn').classList.add('show');
  showTyping();

  try {
    let reply = null;
    let usedModel = modelLabel;

    try {
      reply = await callModel(apiKey, model, history);
    } catch (e) {
      const isModelError = e.message.toLowerCase().includes('no endpoints') ||
        e.message.toLowerCase().includes('not found') ||
        e.message.toLowerCase().includes('provider') ||
        e.message.includes('404') || e.message.includes('502') || e.message.includes('503');

      if (!isModelError) throw e;

      showToast('Model offline — trying fallback…', false, 2000);
      for (const fb of FALLBACK_MODELS) {
        if (fb === model) continue;
        try {
          reply = await callModel(apiKey, fb, history);
          usedModel = fb.split('/').pop().replace(':free', '') + ' (fallback)';
          break;
        } catch (e2) { continue; }
      }
    }

    if (!reply) throw new Error('All models failed. Please try again later.');

    history.push({ role: 'assistant', content: reply });
    removeTyping();
    addMessage('ai', reply, usedModel);
    saveCurrentChat();

  } catch (err) {
    if (err.name === 'AbortError') return;
    removeTyping();
    addMessage('ai', err.message);
    showToast(err.message.substring(0, 80), true);
  } finally {
    isLoading = false;
    abortController = null;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('send-btn').style.display = 'flex';
    document.getElementById('stop-btn').classList.remove('show');
    input.focus();
  }
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
  history.forEach(msg => {
    if (msg.role === 'user') addMessage('user', msg.content);
    else if (msg.role === 'assistant') addMessage('ai', msg.content, chat.model ? chat.model.split('/').pop().replace(':free', '') : '');
  });

  document.getElementById('prev-chats').classList.remove('open');
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
      <div class="welcome-glyph">
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="40" r="36" stroke="url(#wg1)" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
          <circle cx="40" cy="40" r="26" stroke="url(#wg2)" stroke-width="1.5" opacity="0.7"/>
          <polygon points="40,18 45,34 62,34 48,44 53,60 40,50 27,60 32,44 18,34 35,34" fill="url(#wg3)" opacity="0.9"/>
          <defs>
            <linearGradient id="wg1" x1="4" y1="4" x2="76" y2="76" gradientUnits="userSpaceOnUse">
              <stop stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/>
            </linearGradient>
            <linearGradient id="wg2" x1="14" y1="14" x2="66" y2="66" gradientUnits="userSpaceOnUse">
              <stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#6366f1"/>
            </linearGradient>
            <linearGradient id="wg3" x1="18" y1="18" x2="62" y2="62" gradientUnits="userSpaceOnUse">
              <stop stop-color="#a78bfa"/><stop offset="1" stop-color="#6366f1"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="welcome-title" id="welcome-title">${getUserName() ? 'Hey ' + getUserName() + ',<br>what can I help<br>you with?' : 'What can I help<br>you with?'}</div>
      <p class="welcome-sub">Powered by free AI models via OpenRouter. Ask anything — code, ideas, questions.</p>
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
  const isOpen = prevChats.classList.contains('open');
  if (isOpen) {
    prevChats.classList.remove('open');
  } else {
    prevChats.classList.add('open');
    renderPreviousChats('');
    setTimeout(() => {
      const inp = document.getElementById('prev-chat-search-input');
      if (inp) inp.focus();
    }, 50);
  }
}

document.getElementById('prev-chats-btn').addEventListener('click', showPreviousChats);

// Close dropdown when clicking outside
document.addEventListener('click', function (event) {
  const prevChats = document.getElementById('prev-chats');
  const prevChatsBtn = document.getElementById('prev-chats-btn');
  if (!prevChats.contains(event.target) && !prevChatsBtn.contains(event.target)) {
    prevChats.classList.remove('open');
  }
});
