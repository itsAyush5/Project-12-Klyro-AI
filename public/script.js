console.log("Klyro SVG v4.0 Loaded");
// API key is loaded from config.js (gitignored) — never hardcode here
const MY_API_KEY = (window.KLYRO_CONFIG && window.KLYRO_CONFIG.apiKey) || '';
const AI_NAME = "Klyro"; // Change this variable to rename your AI everywhere

// ─────────────────────────────────────────────────────────────

let history = [];
let attachedFiles = [];
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

  if (role === 'user') {
    actions.appendChild(createActionBtn('edit', 'Edit message', () => editMessage(msgIdx, row)));
  } else {
    actions.appendChild(createActionBtn('regenerate', 'Regenerate', () => regenerateResponse(msgIdx)));
    actions.appendChild(createActionBtn('pdf', 'Export to PDF', () => exportToPDF(text, msgIdx)));
  }

  actions.appendChild(createActionBtn('copy', 'Copy to clipboard', () => copyToClipboard(text)));

  body.appendChild(actions);
  row.appendChild(av);
  row.appendChild(body);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
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
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4"
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  // ── Claude-style Header ──
  doc.setFillColor(248, 250, 252); 
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); 
  doc.text("Klyro AI", margin, 20);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
  doc.text(`Response Export • ${dateStr}`, margin, 32);
  
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 40, pageWidth - margin, 40);
  
  // ── Main Content ──
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "normal");
  
  // Use a slightly larger line height for better readability
  const lines = doc.splitTextToSize(text, contentWidth);
  let y = 55;
  const lineHeight = 7.5;
  
  lines.forEach(line => {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  });
  
  // ── Footer ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages} • Generated by Klyro AI`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  
  doc.save(`klyro-response-${index}.pdf`);
  showToast('PDF Exported Successfully! 📄');
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
  'openrouter/auto',
  'meta-llama/llama-3.3-70b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'google/gemma-3-27b-it:free'
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
  if (res.status === 401) throw new Error('API Key is Invalid or Deleted. Please update MY_API_KEY in script.js.');
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
  const apiKey = MY_API_KEY;

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

    try {
      reply = await callModel(apiKey, model, history);
    } catch (e) {
      if (e.name === 'AbortError') return;
      const msg = e.message.toLowerCase();
      const isModelError = msg.includes('no endpoints') ||
        msg.includes('not found') ||
        msg.includes('provider') ||
        msg.includes('404') || msg.includes('502') || msg.includes('503') || msg.includes('429') || msg.includes('rate limit');

      if (!isModelError) throw e;

      showToast('Model busy/offline — trying fallback…', false, 2000);
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
    addMessage('ai', reply, usedModel, history.length - 1);
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
