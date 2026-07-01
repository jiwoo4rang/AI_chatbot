const API_SERVER = window.location.origin;

let selectedModel = '';
let lastResponseId = null;
let chatHistory = [];
let isLoading = false;
let zoomLevel = 1;
let currentConversationId = null;
let conversations = [];
let currentUser = null;
let currentAbortController = null;
let shouldStopResponse = false;
let isComposingText = false;
let submitAfterComposition = false;
let sidebarDrag = null;
const MODEL_LABELS = {
  ai_chatbot: '재정용어 및 예산편성에 대해 답변드립니다',
  ai_chatbot_cn: '충남도청 예산과 사업설명서에 대해 답변드립니다',
  ai_chatbot_cnedu: '충남도교육청 예산과 사업설명서에 대해 답변드립니다'
};
const MODEL_ORDER = Object.keys(MODEL_LABELS);

const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const userChip = document.getElementById('user-chip');
const logoutBtn = document.getElementById('logout-btn');
const adminOpen = document.getElementById('admin-open');
const adminModal = document.getElementById('admin-modal');
const adminClose = document.getElementById('admin-close');
const adminUsers = document.getElementById('admin-users');
const userCreateForm = document.getElementById('user-create-form');
const newUsername = document.getElementById('new-username');
const newDisplayName = document.getElementById('new-display-name');
const newPassword = document.getElementById('new-password');
const newRole = document.getElementById('new-role');
const messagesEl = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const composer = document.getElementById('composer');
const modelBar = document.getElementById('model-bar');
const workArea = document.getElementById('work-area');
const previewPanel = document.getElementById('preview-panel');
const previewFrame = document.getElementById('html-preview-frame');
const previewClose = document.getElementById('preview-close');
const welcomeEl = document.getElementById('welcome');
const scrollArea = document.getElementById('scroll-area');
const conversationList = document.getElementById('conversation-list');
const sidebar = document.querySelector('.sidebar');
const historyToggle = document.getElementById('history-toggle');
const historyClose = document.getElementById('history-close');
const adminMenuBtn = document.getElementById('admin-menu-btn');
const quickCards = document.querySelectorAll('.quick-card');
const textStylePanel = document.getElementById('text-style-panel');
const themePanel = document.getElementById('theme-panel');
const menuFeature = document.getElementById('menu-feature');
const menuTools = document.getElementById('menu-tools');
const menuHistory = document.getElementById('menu-history');
const menuTheme = document.getElementById('menu-theme');
const inputFontSize = document.getElementById('input-font-size');
const inputFontFamily = document.getElementById('input-font-family');

sendBtn.disabled = true;

function syncMobileViewportHeight() {
  const viewport = window.visualViewport;
  const keyboardInset = viewport
    ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    : 0;
  const isKeyboardOpen = keyboardInset > 80;
  const composerHeight = composer?.offsetHeight || 0;

  document.documentElement.style.setProperty('--keyboard-inset', `${isKeyboardOpen ? keyboardInset : 0}px`);
  document.documentElement.style.setProperty('--composer-height', `${composerHeight}px`);
  document.body.classList.toggle('keyboard-open', isKeyboardOpen);
}

function updateSendButton() {
  if (!sendBtn) return;
  sendBtn.classList.remove('stopping');
  sendBtn.setAttribute('aria-label', '전송');
  sendBtn.disabled = userInput.disabled || isLoading;
}

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nowMeta() {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function applyZoom() {
  const baseSize = parseInt(inputFontSize?.value || '14', 10);
  const bubbleSize = zoomLevel === 3 ? baseSize + 4
    : zoomLevel === 2 ? baseSize + 2
      : baseSize;
  const mainSize = `${bubbleSize}px`;
  const helperSize = `${Math.max(11, bubbleSize - 3)}px`;
  const smallSize = `${Math.max(10, bubbleSize - 4)}px`;

  document.documentElement.style.setProperty('--chat-main-font-size', mainSize);
  document.documentElement.style.setProperty('--chat-helper-font-size', helperSize);
  document.documentElement.style.setProperty('--chat-small-font-size', smallSize);

  document.querySelectorAll([
    '.bubble',
    '.welcome-bubble',
    '.welcome-help',
    '.quick-card',
    '.quick-card strong',
    '.sys-msg',
    '.sources',
    '.sources a',
    '#user-input',
  ].join(',')).forEach(el => {
    el.style.fontSize = mainSize;
  });

  document.querySelectorAll([
    '.quick-card small',
    '.quick-sub',
    '.meta',
    '.timestamp',
  ].join(',')).forEach(el => {
    el.style.fontSize = smallSize;
  });

  document.querySelectorAll([
    '.notice-line',
    '.notice-tag',
    '.model-btn',
  ].join(',')).forEach(el => {
    el.style.fontSize = helperSize;
  });
}

function applyInputTextStyle() {
  if (!userInput) return;
  const fontSize = inputFontSize?.value || '14px';
  const fontFamily = inputFontFamily?.value || "'RoundedFixedsys', system-ui, sans-serif";
  document.documentElement.style.setProperty('--chat-font-family', fontFamily);
  document.querySelectorAll([
    '.chat-stage',
    '#messages',
    '.welcome-block',
    '.welcome-bubble',
    '.welcome-help',
    '.service-menu',
    '.quick-card',
    '.quick-card strong',
    '.quick-card small',
    '.quick-sub',
    '.message',
    '.bubble-wrap',
    '.bubble',
    '.meta',
    '.timestamp',
    '.sys-msg',
    '.sources',
    '.model-bar',
    '.model-btn',
    '.composer',
    '#user-input',
    '#send-btn',
  ].join(',')).forEach(el => {
    el.style.fontFamily = fontFamily;
  });
  applyZoom();
  syncInputHeight();
  localStorage.setItem('chatInputFontSize', fontSize);
  localStorage.setItem('chatInputFontFamily', fontFamily);
}

function loadInputTextStyle() {
  const savedSize = localStorage.getItem('chatInputFontSize') === '8px'
    ? '10px'
    : localStorage.getItem('chatInputFontSize');
  const savedFamily = localStorage.getItem('chatInputFontFamily')?.includes('Yangjin')
    ? "'RoundedFixedsys', system-ui, sans-serif"
    : localStorage.getItem('chatInputFontFamily');
  if (savedSize && inputFontSize) inputFontSize.value = savedSize;
  if (savedFamily && inputFontFamily) inputFontFamily.value = savedFamily;
  applyInputTextStyle();
}

function positionPanelBelowButton(panel, button) {
  if (!panel || !button) return;
  const header = button.closest('.chat-header');
  const headerRect = header?.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 180;
  const containerWidth = headerRect?.width || window.innerWidth;
  const relativeLeft = headerRect ? buttonRect.left - headerRect.left : buttonRect.left;
  const relativeTop = headerRect ? buttonRect.bottom - headerRect.top : buttonRect.bottom;
  const maxLeft = Math.max(8, containerWidth - panelWidth - 8);
  const left = Math.min(Math.max(relativeLeft, 8), maxLeft);

  panel.style.left = `${left}px`;
  panel.style.top = `${relativeTop}px`;
}

function setTextStylePanel(open) {
  if (!textStylePanel) return;
  if (open && menuTools) {
    textStylePanel.classList.remove('hidden');
    positionPanelBelowButton(textStylePanel, menuTools);
  }
  textStylePanel.classList.toggle('hidden', !open);
  menuTools?.classList.toggle('active', open);
  menuTools?.setAttribute('aria-expanded', String(open));
}

function applyTheme(theme, options = {}) {
  const validThemes = ['retro', 'basic', 'document'];
  const nextTheme = validThemes.includes(theme) ? theme : 'retro';
  const previousTheme = document.body.classList.contains('theme-basic') ? 'basic'
    : document.body.classList.contains('theme-document') ? 'document'
      : 'retro';
  document.body.classList.toggle('theme-basic', nextTheme === 'basic');
  document.body.classList.toggle('theme-retro', nextTheme === 'retro');
  document.body.classList.toggle('theme-document', nextTheme === 'document');
  themePanel?.querySelectorAll('[data-theme]').forEach(button => {
    button.classList.toggle('active', button.dataset.theme === nextTheme);
  });
  localStorage.setItem('chatTheme', nextTheme);
  if (options.resetDefaults && previousTheme !== 'basic' && nextTheme === 'basic') {
    if (inputFontSize) inputFontSize.value = '12px';
    if (inputFontFamily) inputFontFamily.value = 'system-ui, sans-serif';
    applyInputTextStyle();
  }
}

function setThemePanel(open) {
  if (!themePanel) return;
  if (open && menuTheme) {
    themePanel.classList.remove('hidden');
    positionPanelBelowButton(themePanel, menuTheme);
  }
  themePanel.classList.toggle('hidden', !open);
  menuTheme?.classList.toggle('active', open);
  menuTheme?.setAttribute('aria-expanded', String(open));
}

function loadTheme() {
  applyTheme(localStorage.getItem('chatTheme') || 'retro');
}

function syncInputHeight() {
  if (!userInput) return;
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 148) + 'px';
  syncMobileViewportHeight();
}

function zoomText() {
  zoomLevel = zoomLevel >= 3 ? 1 : zoomLevel + 1;
  applyZoom();
}

function hideWelcome() {
  if (welcomeEl) welcomeEl.style.display = 'none';
}

function scrollToBottom() {
  scrollArea.scrollTop = scrollArea.scrollHeight;
}

function addSys(text) {
  const d = document.createElement('div');
  d.className = 'sys-msg';
  d.textContent = text;
  messagesEl.appendChild(d);
  scrollToBottom();
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_SERVER}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  if (!res.ok) {
    const fallback = res.status === 404 || res.status === 405
      ? '서버가 아직 로그인 기능으로 재시작되지 않았습니다.'
      : '요청을 처리하지 못했습니다.';
    throw new Error(data.error || fallback);
  }
  return data;
}

async function loadConversationStore() {
  const data = await apiFetch('/api/conversations');
  conversations = data.conversations || [];
}

function saveConversationStore() {
  const conversation = conversations.find(item => item.id === currentConversationId);
  if (!conversation) return;
  apiFetch('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ conversation })
  }).catch(error => addSys(`대화 저장 실패: ${error.message}`));
}

function makeConversationTitle(text) {
  const title = String(text || '').replace(/\s+/g, ' ').trim();
  return title.length > 24 ? `${title.slice(0, 24)}...` : title || '새 대화';
}

function renderConversationList() {
  if (!conversationList) return;
  conversationList.innerHTML = '';

  if (!conversations.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-history';
    empty.textContent = '아직 저장된 채팅 기록이 없습니다.';
    conversationList.appendChild(empty);
    return;
  }

  conversations
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .forEach(conversation => {
      const item = document.createElement('div');
      item.className = `conversation-item${conversation.id === currentConversationId ? ' active' : ''}`;

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'conversation-open';
      openBtn.textContent = conversation.title || '저장된 대화';
      openBtn.addEventListener('click', () => openConversation(conversation.id));

      const menuWrap = document.createElement('div');
      menuWrap.className = 'conversation-menu';

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'conversation-menu-btn';
      menuBtn.setAttribute('aria-label', '대화 메뉴 열기');
      menuBtn.textContent = '...';
      menuBtn.addEventListener('click', event => {
        event.stopPropagation();
        document.querySelectorAll('.conversation-menu.open').forEach(menu => {
          if (menu !== menuWrap) menu.classList.remove('open');
        });
        menuWrap.classList.remove('drop-up');
        menuWrap.classList.toggle('open');
        if (menuWrap.classList.contains('open')) {
          const menuRect = menuWrap.getBoundingClientRect();
          const listRect = conversationList.getBoundingClientRect();
          const needsDropUp = listRect.bottom - menuRect.bottom < 38;
          menuWrap.classList.toggle('drop-up', needsDropUp);
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'conversation-delete';
      deleteBtn.textContent = '삭제';
      deleteBtn.addEventListener('click', event => {
        event.stopPropagation();
        deleteConversation(conversation.id);
      });

      menuWrap.appendChild(menuBtn);
      menuWrap.appendChild(deleteBtn);
      item.appendChild(openBtn);
      item.appendChild(menuWrap);
      conversationList.appendChild(item);
    });
}

function ensureCurrentConversation(firstMessage) {
  if (currentConversationId) return;

  currentConversationId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  conversations.unshift({
    id: currentConversationId,
    title: makeConversationTitle(firstMessage),
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

function updateCurrentConversation() {
  if (!currentConversationId) return;
  const conversation = conversations.find(item => item.id === currentConversationId);
  if (!conversation) return;

  conversation.messages = chatHistory.slice();
  conversation.updatedAt = Date.now();
  if (!conversation.title && chatHistory[0]) {
    conversation.title = makeConversationTitle(chatHistory[0].content);
  }

  saveConversationStore();
  renderConversationList();
}

function deleteConversation(id) {
  conversations = conversations.filter(item => item.id !== id);
  apiFetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
    .catch(error => addSys(`대화 삭제 실패: ${error.message}`));

  if (currentConversationId === id) {
    clearChat();
  } else {
    renderConversationList();
  }
}

function openConversation(id) {
  if (isLoading) return;
  const conversation = conversations.find(item => item.id === id);
  if (!conversation) return;

  currentConversationId = id;
  lastResponseId = null;
  chatHistory = (conversation.messages || []).slice();
  messagesEl.innerHTML = '';

  if (!chatHistory.length) {
    if (welcomeEl) {
      welcomeEl.style.display = '';
      messagesEl.appendChild(welcomeEl);
    }
  } else {
    chatHistory.forEach(item => {
      const role = item.role === 'assistant' ? 'ai' : 'user';
      addMsg(role, item.content);
    });
  }

  renderConversationList();
  scrollToBottom();
  applyZoom();
}

function setHistoryPanel(open) {
  if (!sidebar) return;
  if (open && window.matchMedia('(max-width: 900px)').matches) {
    sidebar.style.left = '';
    sidebar.style.top = '';
  }
  sidebar.classList.toggle('open', open);
  document.body.classList.toggle('history-open', open);
  menuHistory?.classList.toggle('active', open);
  menuHistory?.setAttribute('aria-expanded', String(open));
}

function closeHistoryPanel() {
  setHistoryPanel(false);
}

function clampSidebarPosition(left, top) {
  if (!sidebar) return { left, top };
  const rect = sidebar.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);
  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}

function startSidebarDrag(event) {
  if (!sidebar || event.button !== 0) return;
  if (event.target.closest('button')) return;

  const rect = sidebar.getBoundingClientRect();
  const isTitleBar = event.clientY - rect.top <= 24;
  if (!isTitleBar) return;

  sidebarDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  sidebar.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function moveSidebarDrag(event) {
  if (!sidebar || !sidebarDrag || event.pointerId !== sidebarDrag.pointerId) return;
  const next = clampSidebarPosition(
    event.clientX - sidebarDrag.offsetX,
    event.clientY - sidebarDrag.offsetY
  );
  sidebar.style.left = `${next.left}px`;
  sidebar.style.top = `${next.top}px`;
}

function endSidebarDrag(event) {
  if (!sidebar || !sidebarDrag || event.pointerId !== sidebarDrag.pointerId) return;
  sidebar.releasePointerCapture(event.pointerId);
  sidebarDrag = null;
}

function fmt(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function looksLikeHtml(text) {
  return /<!doctype\s+html|<html[\s>]|<body[\s>]|<head[\s>]|<(style|script|div|section|article|main|header|footer|table|form|button|canvas|svg)[\s>]/i
    .test(String(text || ''));
}

function extractHtmlPreview(text) {
  const raw = String(text || '').trim();
  const fences = [...raw.matchAll(/```(\w*)\n?([\s\S]*?)```/g)];

  for (const match of fences) {
    const lang = (match[1] || '').toLowerCase();
    const code = (match[2] || '').trim();
    if ((lang === 'html' || !lang) && looksLikeHtml(code)) {
      return {
        html: code,
        note: raw.replace(match[0], '').trim()
      };
    }
  }

  if (looksLikeHtml(raw)) {
    return { html: raw, note: '' };
  }

  return null;
}

function showHtmlPreview(preview) {
  if (!previewPanel || !previewFrame || !workArea) return;
  previewFrame.srcdoc = preview.html;
  previewPanel.classList.remove('hidden');
  workArea.classList.add('split');
}

function closeHtmlPreview() {
  if (!previewPanel || !previewFrame || !workArea) return;
  previewFrame.srcdoc = '';
  previewPanel.classList.add('hidden');
  workArea.classList.remove('split');
}

function renderHtmlPreviewNotice(bubble, text) {
  const preview = extractHtmlPreview(text);
  if (!preview) return false;

  bubble.classList.add('html-preview-linked');
  bubble.innerHTML = '';

  if (preview.note) {
    const note = document.createElement('div');
    note.className = 'html-preview-note';
    note.innerHTML = fmt(preview.note);
    bubble.appendChild(note);
  }

  const frameWrap = document.createElement('div');
  frameWrap.className = 'inline-html-preview';

  const frameHead = document.createElement('div');
  frameHead.className = 'inline-html-preview-head';
  frameHead.textContent = 'HTML 미리보기';

  const frame = document.createElement('iframe');
  frame.className = 'inline-html-preview-frame';
  frame.title = 'HTML 미리보기';
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
  frame.srcdoc = preview.html;

  frameWrap.appendChild(frameHead);
  frameWrap.appendChild(frame);
  bubble.appendChild(frameWrap);
  return true;
}

function typeText(bubble, text) {
  const chars = Array.from(String(text || ''));
  let index = 0;

  return new Promise(resolve => {
    const tick = () => {
      if (shouldStopResponse) {
        resolve(false);
        return;
      }

      index += 1;
      bubble.innerHTML = fmt(chars.slice(0, index).join(''));
      scrollToBottom();

      if (index >= chars.length) {
        bubble.innerHTML = fmt(text);
        resolve(true);
        return;
      }

      const delay = /[.!?。！？\n]/.test(chars[index - 1]) ? 80 : 18;
      setTimeout(tick, delay);
    };

    tick();
  });
}

function addMsg(role, text, options = {}) {
  hideWelcome();

  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = role === 'ai' ? `충청남도의회AI의정브레인 · ${nowMeta()}` : nowMeta();

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const renderedPreview = role === 'ai' && renderHtmlPreviewNotice(bubble, text);
  if (!renderedPreview) {
    bubble.innerHTML = options.typewriter ? '' : fmt(text);
  }

  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(bubble);
  wrap.appendChild(bubbleWrap);
  messagesEl.appendChild(wrap);

  scrollToBottom();
  applyZoom();

  if (options.typewriter && !renderedPreview) {
    return typeText(bubble, text);
  }

  return bubble;
}

function showTyping() {
  hideWelcome();

  const wrap = document.createElement('div');
  wrap.className = 'message ai';
  wrap.id = 'typing';

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `충청남도의회AI의정브레인 · ${nowMeta()}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `
    <div class="typing-loader" role="status" aria-label="답변 생성 준비 중">
      <div class="typing-loader-head">
        <span>LOADING...</span>
      </div>
      <div class="typing-loader-track">
        ${Array.from({ length: 10 }, () => '<span></span>').join('')}
      </div>
    </div>
  `;

  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(bubble);
  wrap.appendChild(bubbleWrap);
  messagesEl.appendChild(wrap);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typing');
  if (el) el.remove();
}

function addSources(sources) {
  const d = document.createElement('div');
  d.className = 'sources';
  const title = document.createElement('div');
  title.textContent = '답변에 활용된 출처입니다.';
  d.appendChild(title);

  sources.forEach(source => {
    const row = document.createElement('div');
    const link = document.createElement('a');
    const label = typeof source === 'string' ? source : source.title;
    link.textContent = label || '출처 파일';
    link.href = typeof source === 'string' ? '#' : source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    row.appendChild(link);
    d.appendChild(row);
  });
  messagesEl.appendChild(d);
  scrollToBottom();
}

function clearChat() {
  lastResponseId = null;
  chatHistory = [];
  currentConversationId = null;
  messagesEl.innerHTML = '';

  if (welcomeEl) {
    welcomeEl.style.display = '';
    messagesEl.appendChild(welcomeEl);
  }

  scrollToBottom();
  applyZoom();
  renderConversationList();
}

function stopResponse() {
  if (!isLoading) return;
  shouldStopResponse = true;
  if (currentAbortController) {
    currentAbortController.abort();
  }
  hideTyping();
}

function selectModel(key, resetChat = true) {
  if (isLoading || !MODEL_LABELS[key]) return;
  selectedModel = key;
  if (resetChat) clearChat();
  document.querySelectorAll('.model-btn').forEach(item => {
    item.classList.toggle('active', item.dataset.model === key);
  });
  document.querySelectorAll('.quick-card').forEach(item => {
    item.classList.toggle('active', item.dataset.model === key);
  });
  userInput.focus();
}

function syncQuickCards(models) {
  quickCards.forEach(card => {
    const key = card.dataset.model;
    card.classList.remove('hidden');
    card.classList.toggle('active', key === selectedModel);
    card.disabled = false;
  });
}

function applyUser(user) {
  currentUser = user;
  if (loginScreen) loginScreen.classList.toggle('hidden', Boolean(user));
  if (userChip) userChip.textContent = user ? `${user.display_name}님 계정` : '';
  if (adminOpen) adminOpen.classList.toggle('hidden', user?.role !== 'admin');
  if (adminMenuBtn) adminMenuBtn.classList.toggle('hidden', user?.role !== 'admin');
}

function renderModelButtons(models) {
  if (!modelBar) return;
  modelBar.innerHTML = '';
  syncQuickCards(models);

  models
    .filter(model => MODEL_LABELS[model.key || model.id])
    .sort((a, b) => MODEL_ORDER.indexOf(a.key || a.id) - MODEL_ORDER.indexOf(b.key || b.id))
    .forEach(model => {
    const key = model.key || model.id;
    const label = MODEL_LABELS[key] || model.display_name || model.name || key;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `model-btn${key === selectedModel ? ' active' : ''}`;
    btn.dataset.model = key;
    btn.textContent = label;
    btn.addEventListener('click', () => selectModel(key));
    modelBar.appendChild(btn);
  });
}

async function checkSession() {
  try {
    const data = await apiFetch('/api/session');
    applyUser(data.user);
    if (data.user) {
      await loadConversationStore();
      renderConversationList();
      await loadModels();
    }
  } catch (e) {
    applyUser(null);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (loginError) loginError.textContent = '';
  try {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: loginUsername.value.trim(),
        password: loginPassword.value
      })
    });
    loginPassword.value = '';
    applyUser(data.user);
    await loadConversationStore();
    renderConversationList();
    clearChat();
    await loadModels();
  } catch (e) {
    if (loginError) loginError.textContent = e.message;
  }
}

async function handleLogout() {
  await apiFetch('/api/logout', { method: 'POST', body: '{}' }).catch(() => {});
  applyUser(null);
  conversations = [];
  selectedModel = '';
  if (modelBar) modelBar.innerHTML = '';
  userInput.disabled = true;
  updateSendButton();
  userInput.placeholder = '잠시만 기다려주세요. 연결중입니다.';
  clearChat();
  renderConversationList();
}

async function loadAdminUsers() {
  const data = await apiFetch('/api/admin/users');
  adminUsers.innerHTML = '';
  (data.users || []).forEach(user => {
    const row = document.createElement('div');
    row.className = 'admin-user';
    row.innerHTML = `
      <div><strong>${fmt(user.display_name)}</strong><br><span>${fmt(user.username)}</span></div>
      <span>${user.role === 'admin' ? '관리자' : '일반 사용자'}</span>
      <span>${user.is_active ? '사용 중' : '중지'}</span>
      <button type="button" data-action="toggle">${user.is_active ? '중지' : '복구'}</button>
      <button type="button" class="danger" data-action="delete">삭제</button>
    `;
    row.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !user.is_active })
      });
      await loadAdminUsers();
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      await apiFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      await loadAdminUsers();
    });
    adminUsers.appendChild(row);
  });
}

async function loadModels() {
  try {
    const res = await fetch(`${API_SERVER}/models`);
    const data = await res.json();
    const list = (data.models || data.data || []).filter(m => m.type === 'llm' || m.object === 'model');
    const visibleModels = list
      .filter(model => MODEL_LABELS[model.key || model.id])
      .sort((a, b) => MODEL_ORDER.indexOf(a.key || a.id) - MODEL_ORDER.indexOf(b.key || b.id));
    if (!visibleModels.length) throw new Error('모델 없음');

    if (!MODEL_LABELS[selectedModel]) {
      selectedModel = visibleModels[0].key || visibleModels[0].id;
    }
    renderModelButtons(visibleModels);
    userInput.disabled = false;
    updateSendButton();
    userInput.placeholder = '무엇이든 물어보세요.';
  } catch (e) {
    if (modelBar) modelBar.innerHTML = '';
    syncQuickCards([]);
    userInput.disabled = true;
    updateSendButton();
    userInput.placeholder = '잠시만 기다려주세요. 연결중입니다.';
    addSys('서버 연결에 실패했습니다.');
  }
}

async function sendMessage() {
  if (isLoading) {
    return;
  }

  const typedText = userInput.value.trim();
  if (!typedText) return;
  const text = typedText;

  if (!selectedModel) {
    addSys('모델 연결을 확인한 뒤 다시 질문해 주세요.');
    return;
  }

  userInput.value = '';
  userInput.style.height = 'auto';
  isLoading = true;
  shouldStopResponse = false;
  currentAbortController = new AbortController();
  updateSendButton();

  addMsg('user', text);
  ensureCurrentConversation(text);
  chatHistory.push({ role: 'user', content: text });
  updateCurrentConversation();
  showTyping();

  try {
    const chatBody = {
      message: text,
      model: selectedModel,
      history: chatHistory.slice(-6)
    };
    if (lastResponseId) chatBody.previous_response_id = lastResponseId;

    const res = await fetch(`${API_SERVER}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatBody),
      signal: currentAbortController.signal
    });

    const resText = await res.text();
    let data;
    try {
      data = JSON.parse(resText);
    } catch (e) {
      hideTyping();
      addSys(`응답을 읽지 못했습니다: ${resText.slice(0, 100)}`);
      return;
    }

    hideTyping();

    if (!res.ok || data.error) {
      addSys(`오류: ${data.error?.message || data.error || JSON.stringify(data)}`);
    } else {
      const reply = data.reply || '(응답 없음)';
      if (data.response_id) lastResponseId = data.response_id;
      const completed = await addMsg('ai', reply, { typewriter: true });
      if (!completed) {
        addSys('답변을 중지했습니다.');
        return;
      }
      chatHistory.push({ role: 'assistant', content: reply });
      updateCurrentConversation();
      if (data.sources && data.sources.length > 0) addSources(data.sources);
    }
  } catch (e) {
    hideTyping();
    if (e.name === 'AbortError' || shouldStopResponse) {
      addSys('답변을 중지했습니다.');
    } else {
      addSys(`요청 실패: ${e.message}`);
    }
  } finally {
    isLoading = false;
    currentAbortController = null;
    shouldStopResponse = false;
    updateSendButton();
    userInput.focus();
  }
}

renderConversationList();

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', handleLogout);
}

if (adminOpen) {
  adminOpen.addEventListener('click', async () => {
    adminModal.classList.remove('hidden');
    await loadAdminUsers();
  });
}

if (adminMenuBtn) {
  adminMenuBtn.addEventListener('click', async () => {
    adminModal.classList.remove('hidden');
    await loadAdminUsers();
  });
}

if (adminClose) {
  adminClose.addEventListener('click', () => adminModal.classList.add('hidden'));
}

if (previewClose) {
  previewClose.addEventListener('click', closeHtmlPreview);
}

if (userCreateForm) {
  userCreateForm.addEventListener('submit', async event => {
    event.preventDefault();
    await apiFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        username: newUsername.value.trim(),
        display_name: newDisplayName.value.trim(),
        password: newPassword.value,
        role: newRole.value
      })
    });
    userCreateForm.reset();
    await loadAdminUsers();
  });
}

if (historyToggle) {
  historyToggle.addEventListener('click', () => {
    setHistoryPanel(!sidebar?.classList.contains('open'));
  });
}

if (menuHistory) {
  menuHistory.setAttribute('aria-expanded', 'false');
  menuHistory.addEventListener('click', () => {
    setTextStylePanel(false);
    setThemePanel(false);
    setHistoryPanel(!sidebar?.classList.contains('open'));
  });
}

if (historyClose) {
  historyClose.addEventListener('click', event => {
    event.stopPropagation();
    closeHistoryPanel();
  });
}

if (sidebar) {
  sidebar.addEventListener('pointerdown', startSidebarDrag);
  sidebar.addEventListener('pointermove', moveSidebarDrag);
  sidebar.addEventListener('pointerup', endSidebarDrag);
  sidebar.addEventListener('pointercancel', endSidebarDrag);
}

if (textStylePanel) {
  textStylePanel.addEventListener('click', event => event.stopPropagation());
}

if (themePanel) {
  themePanel.addEventListener('click', event => event.stopPropagation());
  themePanel.querySelectorAll('[data-theme]').forEach(button => {
    button.addEventListener('click', () => {
      applyTheme(button.dataset.theme, { resetDefaults: true });
      setThemePanel(false);
    });
  });
}

if (menuFeature) {
  menuFeature.addEventListener('click', () => {
    if (isLoading) return;
    clearChat();
  });
}

if (menuTools) {
  menuTools.setAttribute('aria-expanded', 'false');
  menuTools.addEventListener('click', event => {
    event.stopPropagation();
    setThemePanel(false);
    setTextStylePanel(textStylePanel?.classList.contains('hidden'));
  });
}

if (menuTheme) {
  menuTheme.setAttribute('aria-expanded', 'false');
  menuTheme.addEventListener('click', event => {
    event.stopPropagation();
    setTextStylePanel(false);
    setThemePanel(themePanel?.classList.contains('hidden'));
  });
}

if (inputFontSize) inputFontSize.addEventListener('change', applyInputTextStyle);
if (inputFontFamily) inputFontFamily.addEventListener('change', applyInputTextStyle);

quickCards.forEach(card => {
  card.addEventListener('click', () => selectModel(card.dataset.model));
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeHistoryPanel();
    setTextStylePanel(false);
    setThemePanel(false);
  }
});

document.addEventListener('click', event => {
  if (event.target.closest('.conversation-menu')) return;
  if (!event.target.closest('.text-style-panel') && !event.target.closest('#menu-tools')) {
    setTextStylePanel(false);
  }
  if (!event.target.closest('.theme-panel') && !event.target.closest('#menu-theme')) {
    setThemePanel(false);
  }
  document.querySelectorAll('.conversation-menu.open').forEach(menu => menu.classList.remove('open'));
});

loadTheme();
loadInputTextStyle();
syncMobileViewportHeight();

window.addEventListener('resize', syncMobileViewportHeight);
window.addEventListener('orientationchange', () => {
  setTimeout(syncMobileViewportHeight, 250);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncMobileViewportHeight);
  window.visualViewport.addEventListener('scroll', syncMobileViewportHeight);
}

userInput.addEventListener('input', () => {
  syncInputHeight();
});

userInput.addEventListener('focus', () => {
  syncMobileViewportHeight();
  setTimeout(scrollToBottom, 120);
});

userInput.addEventListener('compositionstart', () => {
  isComposingText = true;
});

userInput.addEventListener('compositionend', () => {
  isComposingText = false;
  if (!submitAfterComposition) return;
  submitAfterComposition = false;
  setTimeout(sendMessage, 0);
});

userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (e.isComposing || isComposingText || e.keyCode === 229) {
      submitAfterComposition = true;
      return;
    }
    sendMessage();
  }
});

sendBtn.addEventListener('click', e => {
  if (!isLoading) return;
  e.preventDefault();
});

composer.addEventListener('submit', e => {
  e.preventDefault();
  sendMessage();
});

applyZoom();
updateSendButton();
checkSession();
