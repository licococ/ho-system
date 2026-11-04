'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const escapeHtml = value => String(value ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    function loadArray(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.warn(`無法讀取 ${key}，已重設。`, error);
            localStorage.removeItem(key);
            return [];
        }
    }

    // 1. 分頁切換與圖表重繪
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        $(targetId)?.classList.add('active');
        if (targetId === 'dashboard-tab') {
            window.tempChartObj?.resize();
            window.severityChartObj?.resize();
        }
    }));

    // 2. 初始化時間
    const recordTimeInput = $('record-time');
    function initDateTime() {
        if (!recordTimeInput) return;
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        recordTimeInput.value = `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    }
    initDateTime();

    // 3. 症狀滑桿
    const severityInput = $('severity');
    const severityVal = $('severity-val');
    severityInput?.addEventListener('input', e => {
        if (severityVal) severityVal.textContent = `${e.target.value} 分`;
    });

    // 4. API Key 管理
    const apiKeyInput = $('api-key-input');
    const saveKeyBtn = $('save-key-btn');
    let userApiKey = localStorage.getItem('gemini_api_key') || '';
    if (apiKeyInput && userApiKey) apiKeyInput.value = userApiKey;

    saveKeyBtn?.addEventListener('click', () => {
        const newKey = apiKeyInput?.value.trim() || '';
        if (!newKey) {
            userApiKey = '';
            localStorage.removeItem('gemini_api_key');
            alert('API Key 已清空');
            return;
        }
        if (newKey.includes('<') || newKey.includes('>') || newKey.startsWith('http')) {
            alert('API Key 格式錯誤，請只貼上 API Key 本身，不要貼網址或 HTML。');
            return;
        }
        userApiKey = newKey;
        localStorage.setItem('gemini_api_key', newKey);
        alert('Gemini API Key 已成功儲存！');
    });

    // 5. 歷史紀錄與健康日誌
    const historyList = $('history-list');
    let historyData = loadArray('medical_history_data');
    let userRecordLogs = loadArray('medical_record_logs');

    function renderHistory() {
        if (!historyList) return;
        if (!historyData.length) {
            historyList.innerHTML = '<div class="empty-history">目前尚無歷史查詢紀錄</div>';
            return;
        }
        historyList.innerHTML = historyData.map(item => `
            <div class="history-item">
                <p><strong>${escapeHtml(item.desc)}</strong></p>
                <span class="meta">建議科別：${escapeHtml(item.dept)} | 時間：${escapeHtml(item.time)}</span>
            </div>`).join('');
    }

    function addHistoryRecord(desc, dept) {
        const now = new Date();
        const time = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        historyData.unshift({ desc, dept, time });
        historyData = historyData.slice(0, 100);
        localStorage.setItem('medical_history_data', JSON.stringify(historyData));
        renderHistory();
    }

    $('clear-history-btn')?.addEventListener('click', () => {
        historyData = [];
        localStorage.removeItem('medical_history_data');
        renderHistory();
    });
    renderHistory();

    // 6. 健康趨勢儀表板
    function updateDashboardAndCharts() {
        const avgTempEl = $('avg-temp');
        const avgTempTrend = $('avg-temp-trend');
        const avgSeverityEl = $('avg-severity');
        const avgSeverityTrend = $('avg-severity-trend');
        const latestTimeEl = $('latest-time');
        if (!userRecordLogs.length) {
            if (avgTempEl) avgTempEl.textContent = '尚無紀錄';
            if (avgTempTrend) avgTempTrend.textContent = '請先於左側新增健康紀錄';
            if (avgSeverityEl) avgSeverityEl.textContent = '尚無紀錄';
            if (avgSeverityTrend) avgSeverityTrend.textContent = '尚無數據';
            if (latestTimeEl) latestTimeEl.textContent = '尚無紀錄';
            return;
        }
        const validLogs = userRecordLogs.filter(l => Number.isFinite(Number(l.temp)) && Number.isFinite(Number(l.severity)));
        if (!validLogs.length) return;
        const temps = validLogs.map(l => Number(l.temp));
        const severities = validLogs.map(l => Number(l.severity));
        const avgT = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
        const avgS = (severities.reduce((a, b) => a + b, 0) / severities.length).toFixed(1);
        const latest = validLogs.at(-1);
        if (avgTempEl) avgTempEl.textContent = `${avgT} °C`;
        if (avgTempTrend) avgTempTrend.textContent = '即時監測中';
        if (avgSeverityEl) avgSeverityEl.textContent = `${avgS} / 10`;
        if (avgSeverityTrend) avgSeverityTrend.textContent = Number(avgS) > 6 ? '⚠️ 症狀偏重' : '✓ 狀況穩定';
        if (latestTimeEl) latestTimeEl.textContent = `${latest.time} (${latest.temp}°C)`;
        if (window.tempChartObj && window.severityChartObj) {
            const labels = validLogs.map(l => l.time);
            window.tempChartObj.data.labels = labels;
            window.tempChartObj.data.datasets[0].data = temps;
            window.tempChartObj.update();
            window.severityChartObj.data.labels = labels;
            window.severityChartObj.data.datasets[0].data = severities;
            window.severityChartObj.update();
        }
    }

    $('add-record-btn')?.addEventListener('click', () => {
        const temp = Number.parseFloat($('temp')?.value);
        const severity = Number.parseInt($('severity')?.value, 10);
        if (!Number.isFinite(temp) || temp < 30 || temp > 45) {
            alert('請輸入有效體溫，例如 36.5。'); return;
        }
        if (!Number.isInteger(severity) || severity < 0 || severity > 10) {
            alert('症狀程度必須介於 0 到 10。'); return;
        }
        const dateObj = recordTimeInput?.value ? new Date(recordTimeInput.value) : new Date();
        const formattedTime = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        userRecordLogs.push({ temp, severity, time: formattedTime });
        localStorage.setItem('medical_record_logs', JSON.stringify(userRecordLogs));
        updateDashboardAndCharts();
        alert(`✅ 成功新增健康紀錄！\n時間：${formattedTime}\n體溫：${temp}°C\n症狀程度：${severity}分`);
    });

    // 7. 快捷衛教指引
    let selectedCardSymptom = '發燒流鼻水';
    let currentRecommendedDept = '一般內科 / 耳鼻喉科';
    const tagBtns = document.querySelectorAll('.tag-btn');
    tagBtns.forEach(btn => {
        if (btn.dataset.symptom === selectedCardSymptom) btn.classList.add('active-tag');
        btn.addEventListener('click', () => {
            tagBtns.forEach(b => b.classList.remove('active-tag'));
            btn.classList.add('active-tag');
            selectedCardSymptom = btn.dataset.symptom;
        });
    });

    $('generate-preset-btn')?.addEventListener('click', () => {
        const temp = Number.parseFloat($('temp')?.value);
        const shownTemp = Number.isFinite(temp) ? temp : '未提供';
        let level, checklist, script;
        if (selectedCardSymptom === '胸痛呼吸困難') {
            currentRecommendedDept = '急診科 / 心臟內科';
            level = '⚠️ 建議立即至【區域醫院或醫學中心急診室】';
            checklist = `<li>✓ 保持冷靜，立即由家人陪同、叫救護車或前往急診</li><li>✓ 記錄發作持續時間（目前體溫：${shownTemp}°C）</li><li>✓ 攜帶健保卡與身分證</li>`;
            script = '「醫師您好，我突然感到明顯胸痛與呼吸困難，請協助評估急症狀況。」';
        } else if (selectedCardSymptom === '胃痛胃酸逆流') {
            currentRecommendedDept = '腸胃肝膽科';
            level = '建議先至【基層診所】初步診斷';
            checklist = `<li>✓ 記錄腹痛位置與發作時間</li><li>✓ 紀錄體溫（目前：${shownTemp}°C）</li><li>✓ 整理服用藥物清單</li>`;
            script = '「醫師您好，我近期有胃痛與胃酸逆流，想請醫師協助評估。」';
        } else if (selectedCardSymptom === '關節扭傷腫脹') {
            currentRecommendedDept = '骨科 / 復健科';
            level = '建議先至【基層診所】初步診斷';
            checklist = '<li>✓ 局部休息、冰敷及適當固定</li><li>✓ 紀錄受傷經過與活動受限狀況</li><li>✓ 攜帶健保卡</li>';
            script = '「醫師您好，我因關節扭傷導致腫脹疼痛，想請醫師協助評估。」';
        } else {
            currentRecommendedDept = '耳鼻喉科 / 一般內科';
            level = '建議先至【基層診所】初步診斷';
            checklist = `<li>✓ 攜帶健保卡與身分證件</li><li>✓ 紀錄體溫與發燒時間（目前：${shownTemp}°C）</li><li>✓ 整理服用藥物清單</li>`;
            script = `「醫師您好，我從昨天開始出現喉嚨痛與流鼻水，目前體溫約 ${shownTemp}°C，想請醫師協助診治。」`;
        }
        if ($('preset-dept')) $('preset-dept').textContent = currentRecommendedDept;
        if ($('preset-level')) $('preset-level').textContent = level;
        if ($('preset-checklist')) $('preset-checklist').innerHTML = checklist;
        if ($('preset-script')) $('preset-script').textContent = script;
        $('standard-education-card')?.classList.remove('hidden');
        addHistoryRecord(`快捷查詢：${selectedCardSymptom}`, currentRecommendedDept);
        renderClinicsByDept(currentRecommendedDept);
    });

    // 8. AI 對話與 Gemini API
    const chatMessages = $('chat-messages');
    const chatInput = $('chat-input');
    const sendBtn = $('send-btn');
    const emergencyModal = $('emergency-modal');

    $('clear-chat-btn')?.addEventListener('click', () => {
        if (chatMessages) chatMessages.innerHTML = '<div class="message system-msg">👨‍⚕️ 您好！我是 AI 醫療健康助手。請描述身體不適症狀，我將提供衛教與分診參考。此功能不能取代醫師診斷。</div>';
    });

    function appendMessage(role, text) {
        if (!chatMessages) return null;
        const div = document.createElement('div');
        div.className = `message ${role === 'user' ? 'user-msg' : role === 'loading' ? 'loading-msg' : 'ai-msg'}`;
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    async function handleSend() {
        const text = chatInput?.value.trim() || '';
        if (!text || sendBtn?.disabled) return;
        appendMessage('user', text);
        chatInput.value = '';
        if (text.includes('胸痛') || text.includes('呼吸困難')) emergencyModal?.classList.remove('hidden');
        const loadingMsg = appendMessage('loading', 'AI 正在分析症狀...');
        if (sendBtn) sendBtn.disabled = true;
        try {
            const responseText = userApiKey
                ? await fetchGeminiResponse(text)
                : `【提示】尚未輸入 Gemini API Key，以下為系統示範回覆：\n\n${getFallbackAnalysis(text)}`;
            loadingMsg?.remove();
            appendMessage('ai', responseText);
            let dept = '一般內科 / 家醫科';
            if (/[胃腹]|逆流/.test(text)) dept = '腸胃肝膽科';
            if (/胸痛|呼吸|心悸/.test(text)) dept = '急診科 / 心臟內科';
            if (/喉嚨|鼻|發燒/.test(text)) dept = '耳鼻喉科';
            if (/腳|關節|扭傷/.test(text)) dept = '骨科 / 復健科';
            currentRecommendedDept = dept;
            addHistoryRecord(`AI 對話：${text.length > 18 ? `${text.substring(0, 18)}...` : text}`, dept);
            renderClinicsByDept(dept);
        } catch (error) {
            loadingMsg?.remove();
            console.error('Gemini API Error:', error);
            appendMessage('ai', `⚠️ API 發生錯誤：${error.message}\n\n以下為備用醫療建議：\n\n${getFallbackAnalysis(text)}`);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    sendBtn?.addEventListener('click', handleSend);
    chatInput?.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    });

    async function fetchGeminiResponse(userPrompt) {
        const apiKey = userApiKey.trim();
        if (!apiKey) throw new Error('尚未輸入 Gemini API Key');
        const age = $('age')?.value || '未提供';
        const gender = $('gender')?.value || '未提供';
        const temp = $('temp')?.value || '未提供';
        const severity = $('severity')?.value || '未提供';

        // 系統提示詞：限制不使用星號，規範排版格式與字數上限
        const systemInstruction = `你是一位專業且細心的台灣醫療衛教與分診助手。
請使用正體中文回答，嚴禁使用任何 Markdown 粗體符號（如 **），請改用條列與空格排版。
請嚴格依照以下四個區塊格式進行完整輸出，確保內容詳盡且不被截斷：
【建議就診科別】：
【建議醫療層級】：
【看診前準備 CheckList】：
【看診溝通小抄】：
不得宣稱完成診斷；若有胸痛、呼吸困難、意識異常或大量出血時，優先建議立即就醫或撥打 119。`;

        const fullPrompt = `病患基本資料：${age}歲、${gender}、體溫${temp}°C、不適嚴重度 ${severity}/10。\n病患主訴：${userPrompt}`;
        
        // 使用支援 systemInstruction 的 v1beta 穩定端點
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch(url, {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
                })
            });
            const rawText = await response.text();
            let data;
            try { data = JSON.parse(rawText); }
            catch { throw new Error(`API 回傳內容不是 JSON，HTTP ${response.status}`); }
            if (!response.ok) throw new Error(data.error?.message || data.error?.status || `HTTP ${response.status}`);
            const answer = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
            if (answer) return answer;
            throw new Error(`API 未產生回答`);
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('API 呼叫超過 30 秒');
            throw error;
        } finally { clearTimeout(timeoutId); }
    }

    function getFallbackAnalysis(desc) {
        const temp = $('temp')?.value || '未提供';
        if (/胸痛|呼吸困難/.test(desc)) {
            return `【建議就診科別】：急診科 / 心臟內科
【建議醫療層級】：⚠️ 建議立即前往急診，症狀嚴重時撥打 119
【看診前準備 CheckList】：
• 由他人陪同，避免自行駕車
• 攜帶健保卡與身分證
【看診溝通小抄】：
「我突然出現胸痛或呼吸困難，請協助評估。」`;
        }
        return `【建議就診科別】：一般內科 / 家醫科 / 耳鼻喉科
【建議醫療層級】：建議先至基層診所評估
【看診前準備 CheckList】：
• 攜帶健保卡
• 記錄體溫與症狀時間（目前體溫：${temp}°C）
【看診溝通小抄】：
「我最近感到身體不適（${desc}），目前體溫為 ${temp}°C，請協助評估。」`;
    }

    // 9. 附近醫療院所
    const mockClinics = [
        { name: '市立安康診所', dept: '耳鼻喉科 / 一般內科', phone: '(02) 2345-6789', distance: '350公尺 (步行5分鐘)', address: '新北市三重區重新路段' },
        { name: '宏仁耳鼻喉科診所', dept: '耳鼻喉科', phone: '(02) 2987-6543', distance: '650公尺 (步行8分鐘)', address: '新北市三重區正義北路' },
        { name: '健安腸胃科診所', dept: '腸胃肝膽科', phone: '(02) 2288-1234', distance: '800公尺 (步行10分鐘)', address: '新北市三重區三和路' },
        { name: '新北市立聯合醫院 (三重院區)', dept: '急診科 / 內科 / 綜合', phone: '(02) 2982-9111', distance: '1.5公里 (車程5分鐘)', address: '新北市三重區新北大道一段' },
        { name: '善美骨科專科診所', dept: '骨科 / 復健科', phone: '(02) 8981-1122', distance: '500公尺 (步行7分鐘)', address: '新北市三重區中正北路' }
    ];

    function renderClinicsByDept(targetDept) {
        const el = $('clinic-list');
        if (!el) return;
        const keyword = targetDept.split('/')[0].trim();
        let filtered = mockClinics.filter(c => c.dept.includes(keyword) || c.dept.includes('綜合'));
        if (!filtered.length) filtered = mockClinics;
        el.innerHTML = filtered.map(clinic => {
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.name} ${clinic.address}`)}`;
            return `<div class="clinic-item"><div><h4>${escapeHtml(clinic.name)} <span class="tag-sm">${escapeHtml(clinic.dept)}</span></h4><p class="meta">📞 ${escapeHtml(clinic.phone)} | 📍 ${escapeHtml(clinic.address)}</p><p class="distance">距離：${escapeHtml(clinic.distance)}</p></div><a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="nav-btn">🗺️ Google 導航</a></div>`;
        }).join('');
    }

    $('get-location-btn')?.addEventListener('click', () => {
        const status = $('location-status');
        if (!navigator.geolocation) { alert('瀏覽器不支援地理定位功能'); return; }
        if (status) status.textContent = '狀態：正在取得目前位置...';
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude.toFixed(4);
            const lng = position.coords.longitude.toFixed(4);
            if (status) status.textContent = `狀態：定位成功！(緯度: ${lat}, 經度: ${lng}) 已載入「${currentRecommendedDept}」相關院所。`;
            renderClinicsByDept(currentRecommendedDept);
        }, () => {
            if (status) status.textContent = '狀態：無法取得定位，已載入預設院所。';
            renderClinicsByDept(currentRecommendedDept);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
    renderClinicsByDept('耳鼻喉科');

    // 10. 緊急警示彈窗
    $('test-emergency-btn')?.addEventListener('click', () => emergencyModal?.classList.remove('hidden'));
    $('close-modal-btn')?.addEventListener('click', () => emergencyModal?.classList.add('hidden'));

    // 11. Chart.js 初始化
    const tempCanvas = $('tempChart');
    const severityCanvas = $('severityChart');
    if (typeof Chart !== 'undefined' && tempCanvas && severityCanvas) {
        window.tempChartObj = new Chart(tempCanvas.getContext('2d'), {
            type: 'line', data: { labels: [], datasets: [{ label: '體溫 (°C)', data: [], borderColor: '#2b6cb0', backgroundColor: 'rgba(43,108,176,.1)', fill: true, tension: .3 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 35.5, max: 39.5 } } }
        });
        window.severityChartObj = new Chart(severityCanvas.getContext('2d'), {
            type: 'bar', data: { labels: [], datasets: [{ label: '嚴重度評分', data: [], backgroundColor: '#3182ce' }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 10 } } }
        });
    } else {
        console.warn('Chart.js 未載入，或找不到圖表 canvas。');
    }
    updateDashboardAndCharts();
});
