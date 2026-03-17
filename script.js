    const RAG_SERVER = 'http://115.137.55.154:30';

    let selectedModel = '';
    let lastResponseId = null;
    let chatHistory = [];
    let isLoading = false;
    let zoomLevel = 1;

    const messagesEl = document.getElementById('messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    const welcomeEl = document.getElementById('welcome');
    const scrollArea = document.getElementById('scroll-area');
    const welcomeTime = document.getElementById('welcome-time');
    const themeButtons = document.querySelectorAll('.theme-btn');

    const sidebar = document.querySelector(".sidebar");
    const toggleBtn = document.getElementById("sidebarToggle");
    const closeBtn = document.getElementById("sidebarClose");
    const overlay = document.getElementById("sidebarOverlay");
   
    /* 사이드바 
    function openSidebar() {
      sidebar.classList.add("open");
      overlay.classList.add("show");
    }

    function closeSidebar() {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    } */
  
    function openSidebar() {
      sidebar.classList.add("open");
      overlay.classList.add("show");
      document.body.style.overflow = "hidden"; // 🔥
    }

    function closeSidebar() {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
      document.body.style.overflow = "";
    }

    toggleBtn.addEventListener("click", openSidebar);
    closeBtn.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);
    
    function applyTheme(theme) {
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('selectedTheme', theme);

      themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
      });
    }

    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(btn.dataset.theme);
      });
    });

    const savedTheme = localStorage.getItem('selectedTheme') || 'default';
    applyTheme(savedTheme);

    function nowStamp() {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function nowMeta() {
      return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    function applyZoom() {
      const sizes = zoomLevel === 3 ? ['19px','14px','18px','14px']
                  : zoomLevel === 2 ? ['17px','13px','16px','13px']
                  : ['15px','12px','14px','12px'];
      document.querySelectorAll('.bubble').forEach(el => el.style.fontSize = sizes[0]);
      document.querySelectorAll('.meta').forEach(el => el.style.fontSize = sizes[1]);
      document.querySelectorAll('.guide-bubble').forEach(el => el.style.fontSize = sizes[2]);
      document.querySelectorAll('.timestamp').forEach(el => el.style.fontSize = sizes[3]);
    }

    function zoomText() {
      zoomLevel = zoomLevel >= 3 ? 1 : zoomLevel + 1;
      applyZoom();
    }

    welcomeTime.textContent = nowStamp();

    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
    });

    userInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    async function loadModels() {
      try {
        const res = await fetch(`${RAG_SERVER}/models`);
        const data = await res.json();
        const list = (data.models || data.data || []).filter(m => m.type === 'llm' || m.object === 'model');
        if (!list.length) throw new Error('모델 없음');
        selectedModel = list[0].key || list[0].id;
        statusDot.className = 'status-dot on';
        statusText.textContent = '실시간 채팅 가능';
        addSys('연결됨 · 서버 상태가 정상입니다.');
      } catch (e) {
        statusDot.className = 'status-dot err';
        statusText.textContent = '채팅 불가';
        addSys('서버 연결에 실패했습니다.');
      }
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
      applyZoom();
    }

    function fmt(text) {
      return String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    }

    function addMsg(role, text) {
      hideWelcome();
      const wrap = document.createElement('div');
      wrap.className = `message ${role}`;

      const avatar = document.createElement('div');
      avatar.className = `avatar ${role}`;
      avatar.innerHTML = role === 'ai'
        ? '<img src="백룡이.png" class="avatar-img" alt="백룡이">'
        : '<img src="충랑이.png" class="avatar-img" alt="충랑이">';

      const bubbleWrap = document.createElement('div');
      bubbleWrap.className = 'bubble-wrap';

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${role === 'ai' ? '의정브레인' : '사용자'} · ${nowMeta()}`;

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerHTML = fmt(text);

      bubbleWrap.appendChild(meta);
      bubbleWrap.appendChild(bubble);
      wrap.appendChild(avatar);
      wrap.appendChild(bubbleWrap);
      messagesEl.appendChild(wrap);
      scrollToBottom();
      applyZoom();
      return bubble;
    }

    function showTyping() {
      hideWelcome();
      const wrap = document.createElement('div');
      wrap.className = 'message ai';
      wrap.id = 'typing';

      const avatar = document.createElement('div');
      avatar.className = 'avatar ai';
      avatar.innerHTML = '<img src="백룡이.png" class="avatar-img" alt="백룡이">';

      const bubbleWrap = document.createElement('div');
      bubbleWrap.className = 'bubble-wrap';

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `의정브레인 · ${nowMeta()}`;

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

      bubbleWrap.appendChild(meta);
      bubbleWrap.appendChild(bubble);
      wrap.appendChild(avatar);
      wrap.appendChild(bubbleWrap);
      messagesEl.appendChild(wrap);
      scrollToBottom();
      applyZoom();
    }

    function hideTyping() {
      const el = document.getElementById('typing');
      if (el) el.remove();
    }

    function addSources(sources) {
      const d = document.createElement('div');
      d.className = 'sources';
      d.innerHTML = '📎 출처: ' + sources.map(s => `<span>${String(s)}</span>`).join(', ');
      messagesEl.appendChild(d);
      scrollToBottom();
      applyZoom();
    }

    function clearChat() {
      lastResponseId = null;
      chatHistory = [];
      messagesEl.innerHTML = '';
      if (welcomeEl) {
        welcomeEl.style.display = '';
        messagesEl.appendChild(welcomeEl);
      }
      welcomeTime.textContent = nowStamp();
      scrollToBottom();
      applyZoom();
    }

    function sendChipText(text) {
      userInput.value = text;
      userInput.dispatchEvent(new Event('input'));
      sendMessage();
    }

    async function sendMessage() {
      const text = userInput.value.trim();
      if (!text || isLoading) return;
      if (!selectedModel) { addSys('모델을 먼저 선택해 주세요.'); return; }

      userInput.value = '';
      userInput.style.height = 'auto';
      isLoading = true;
      sendBtn.disabled = true;

      addMsg('user', text);
      chatHistory.push({ role: 'user', content: text });
      showTyping();

      try {
        const chatBody = {
          message: text,
          model: selectedModel,
          history: chatHistory.slice(-6)
        };
        if (lastResponseId) chatBody.previous_response_id = lastResponseId;

        const res = await fetch(`${RAG_SERVER}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatBody)
        });

        const resText = await res.text();
        let data;
        try {
          data = JSON.parse(resText);
        } catch (e) {
          hideTyping();
          addSys(`JSON 파싱 실패: ${resText.slice(0, 100)}`);
          isLoading = false;
          sendBtn.disabled = false;
          return;
        }

        hideTyping();

        if (!res.ok || data.error) {
          addSys(`오류: ${data.error?.message || data.error || JSON.stringify(data)}`);
        } else {
          const reply = data.reply || '(응답 없음)';
          if (data.response_id) lastResponseId = data.response_id;
          addMsg('ai', reply);
          chatHistory.push({ role: 'assistant', content: reply });
          if (data.sources && data.sources.length > 0) addSources(data.sources);
        }
      } catch (e) {
        hideTyping();
        addSys(`요청 실패: ${e.message}`);
      }

      isLoading = false;
      sendBtn.disabled = false;
      userInput.focus();
    }

    loadModels();
    applyZoom();