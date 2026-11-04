document.addEventListener('DOMContentLoaded', () => {
    // 1. 分頁切換與圖表重繪
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'dashboard-tab') {
                if (window.tempChartObj) window.tempChartObj.resize();
                if (window.severityChartObj) window.severityChartObj.resize();
            }
        });
    });

    // 2. 初始化時間選擇器預設為當下時間
    const recordTimeInput = document.getElementById('record-time');
    function initDateTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        recordTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    initDateTime();

    // 3. 症狀滑桿動態顯示
    const severityInput = document.getElementById('severity');
    const severityVal = document.getElementById('severity-val');
    severityInput.addEventListener('input', (e) => {
        severityVal.textContent = e.target.value + ' 分';
    });

    // 4. API Key 管理 (存於 localStorage)
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');
    let userApiKey = localStorage.getItem('gemini_api_key') || '';

    if (userApiKey) {
        apiKeyInput.value = userApiKey;
    }

    saveKeyBtn.addEventListener('click', () => {
        userApiKey = apiKeyInput.value.trim();
        localStorage.setItem('gemini_api_key', userApiKey);
        alert(userApiKey ? 'Gemini API Key 已成功儲存！' : 'API Key 已清空');
    });

    // 5. 歷史紀錄與健康日誌資料管理
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    let historyData = JSON.parse(localStorage.getItem('medical_history_data')) || [];
    let userRecordLogs = JSON.parse(localStorage.getItem('medical_record_logs')) || [];

    function renderHistory() {
        if (historyData.length === 0) {
            historyList.innerHTML = `<div class="empty-history">目前尚無歷史查詢紀錄</div>`;
            return;
        }

        historyList.innerHTML = historyData.map(item => `
            <div class="history-item">
                <p><strong>${item.desc}</strong></p>
                <span class="meta">建議科別：${item.dept} | 時間：${item.time}</span>
            </div>
        `).join('');
    }

    function addHistoryRecord(desc, dept) {
        const now = new Date();
        const timeStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        historyData.unshift({
            desc: desc,
            dept: dept,
            time: timeStr
        });

        localStorage.setItem('medical_history_data', JSON.stringify(historyData));
        renderHistory();
    }

    clearHistoryBtn.addEventListener('click', () => {
        historyData = [];
        localStorage.removeItem('medical_history_data');
        renderHistory();
    });

    renderHistory();

    // 6. 健康趨勢儀表板與圖表實時連線更新
    function updateDashboardAndCharts() {
        const avgTempEl = document.getElementById('avg-temp');
        const avgTempTrend = document.getElementById('avg-temp-trend');
        const avgSeverityEl = document.getElementById('avg-severity');
        const avgSeverityTrend = document.getElementById('avg-severity-trend');
        const latestTimeEl = document.getElementById('latest-time');

        if (userRecordLogs.length === 0) {
            avgTempEl.textContent = "尚無紀錄";
            avgTempTrend.textContent = "請先於左側新增健康紀錄";
            avgSeverityEl.textContent = "尚無紀錄";
            avgSeverityTrend.textContent = "尚無數據";
            latestTimeEl.textContent = "尚無紀錄";
            return;
        }

        const temps = userRecordLogs.map(l => l.temp);
        const severities = userRecordLogs.map(l => l.severity);
        const avgT = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
        const avgS = (severities.reduce((a, b) => a + b, 0) / severities.length).toFixed(1);
        const latest = userRecordLogs[userRecordLogs.length - 1];

        avgTempEl.textContent = `${avgT} °C`;
        avgTempTrend.textContent = "即時監測中";
        avgSeverityEl.textContent = `${avgS} / 10`;
        avgSeverityTrend.textContent = avgS > 6 ? "⚠️ 症狀偏重" : "✓ 狀況穩定";
        latestTimeEl.textContent = `${latest.time} (${latest.temp}°C)`;

        // 更新 Chart.js 圖表數據與連線
        if (window.tempChartObj && window.severityChartObj) {
            const labels = userRecordLogs.map(l => l.time);
            window.tempChartObj.data.labels = labels;
            window.tempChartObj.data.datasets[0].data = temps;
            window.tempChartObj.update();

            window.severityChartObj.data.labels = labels;
            window.severityChartObj.data.datasets[0].data = severities;
            window.severityChartObj.update();
        }
    }

    // 點擊「記錄自訂時間與體溫」
    const addRecordBtn = document.getElementById('add-record-btn');
    addRecordBtn.addEventListener('click', () => {
        const temp = parseFloat(document.getElementById('temp').value);
        const severity = parseInt(document.getElementById('severity').value);
        const rawTime = recordTimeInput.value;
        
        let formattedTime = '';
        if (rawTime) {
            const dateObj = new Date(rawTime);
            formattedTime = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        } else {
            const now = new Date();
            formattedTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }

        userRecordLogs.push({
            temp: temp,
            severity: severity,
            time: formattedTime
        });

        localStorage.setItem('medical_record_logs', JSON.stringify(userRecordLogs));
        updateDashboardAndCharts();
        alert(`✅ 成功新增健康紀錄！\n時間：${formattedTime}\n體溫：${temp}°C\n症狀程度：${severity}分\n\n(已同步更新至健康趨勢圖表)`);
    });

    // 7. 左側快捷按鈕選擇與生成標準衛教指引
    let selectedCardSymptom = '發燒流鼻水';
    let currentRecommendedDept = '一般內科 / 耳鼻喉科';

    const tagBtns = document.querySelectorAll('.tag-btn');
    tagBtns.forEach(btn => {
        if (btn.getAttribute('data-symptom') === selectedCardSymptom) {
            btn.classList.add('active-tag');
        }

        btn.addEventListener('click', () => {
            tagBtns.forEach(b => b.classList.remove('active-tag'));
            btn.classList.add('active-tag');
            selectedCardSymptom = btn.getAttribute('data-symptom');
        });
    });

    const generatePresetBtn = document.getElementById('generate-preset-btn');
    const standardEduCard = document.getElementById('standard-education-card');
    const presetDept = document.getElementById('preset-dept');
    const presetLevel = document.getElementById('preset-level');
    const presetChecklist = document.getElementById('preset-checklist');
    const presetScript = document.getElementById('preset-script');

    generatePresetBtn.addEventListener('click', () => {
        const temp = parseFloat(document.getElementById('temp').value);

        if (selectedCardSymptom === '胸痛呼吸困難') {
            currentRecommendedDept = '急診科 / 心臟內科';
            presetDept.textContent = currentRecommendedDept;
            presetLevel.textContent = '⚠️ 建議立即至【區域醫院或醫學中心急診室】';
            presetChecklist.innerHTML = `
                <li>✓ 保持冷靜並立即由家人陪同或叫車前往</li>
                <li>✓ 記錄發作持續時間（目前體溫：${temp}°C）</li>
                <li>✓ 攜帶健保卡與身分證</li>
            `;
            presetScript.textContent = `「醫師您好，我突然感到明顯胸痛與呼吸困難，請協助評估急症狀況。」`;
        } else if (selectedCardSymptom === '胃痛胃酸逆流') {
            currentRecommendedDept = '腸胃肝膽科';
            presetDept.textContent = currentRecommendedDept;
            presetLevel.textContent = '建議先至【基層診所】初步診斷';
            presetChecklist.innerHTML = `
                <li>✓ 記錄腹痛具體位置與發作時間（飯前/飯後）</li>
                <li>✓ 紀錄體溫變化（目前：${temp}°C）</li>
                <li>✓ 整理目前服用的常備藥物清單</li>
            `;
            presetScript.textContent = `「醫師您好，我近期有胃痛與胃酸逆流的情形，想請醫師協助評估是否需要開立胃藥。」`;
        } else if (selectedCardSymptom === '關節扭傷腫脹') {
            currentRecommendedDept = '骨科 / 復健科';
            presetDept.textContent = currentRecommendedDept;
            presetLevel.textContent = '建議先至【基層診所】初步診斷';
            presetChecklist.innerHTML = `
                <li>✓ 遵循 RICE 原則進行局部冰敷與固定</li>
                <li>✓ 紀錄受傷經過與活動受限狀況</li>
                <li>✓ 攜帶健保卡</li>
            `;
            presetScript.textContent = `「醫師您好，我因關節扭傷導致腫脹疼痛，想請醫師協助照X光與評估復健方式。」`;
        } else {
            currentRecommendedDept = '耳鼻喉科 / 一般內科';
            presetDept.textContent = currentRecommendedDept;
            presetLevel.textContent = '建議先至【基層診所】初步診斷，避免醫療資源浪費';
            presetChecklist.innerHTML = `
                <li>✓ 攜帶健保卡與身份證件</li>
                <li>✓ 紀錄體溫變化與發燒時間 (目前體溫：${temp}°C)</li>
                <li>✓ 整理目前服用的常備藥物清單</li>
            `;
            presetScript.textContent = `「醫師您好，我從昨天開始出現喉嚨痛與流鼻水，目前體溫約 ${temp}°C，想請醫師協助診治。」`;
        }

        standardEduCard.classList.remove('hidden');
        addHistoryRecord(`快捷查詢：${selectedCardSymptom}`, currentRecommendedDept);
        renderClinicsByDept(currentRecommendedDept);
    });

    // 8. 右側 AI 對話與 Gemini API 互動邏輯 (對話實時寫入歷史與聯動醫院科別)
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const emergencyModal = document.getElementById('emergency-modal');

    clearChatBtn.addEventListener('click', () => {
        chatMessages.innerHTML = `
            <div class="message system-msg">
                👨‍⚕️ 您好！我是 AI 醫療健康助手。請在下方輸入框詳細描述您的身體不適症狀，我將透過雲端 AI 為您提供個性化的分診評估與看診指引。
            </div>
        `;
    });

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');
        if (role === 'user') msgDiv.classList.add('user-msg');
        else if (role === 'ai') msgDiv.classList.add('ai-msg');
        else if (role === 'loading') msgDiv.classList.add('loading-msg');

        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        scrollToBottom();
        return msgDiv;
    }

    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        chatInput.value = '';

        if (text.includes('胸痛') || text.includes('呼吸困難')) {
            emergencyModal.classList.remove('hidden');
        }

        const loadingMsg = appendMessage('loading', 'AI 醫師正在分析您的症狀...');

        try {
            let responseText = '';
            if (userApiKey) {
                responseText = await fetchGeminiResponse(text);
            } else {
                await new Promise(r => setTimeout(r, 800));
                responseText = "【提示】：您目前尚未輸入 Gemini API Key。右上角填入您的 API Key 並點擊「儲存 Key」後，即可解鎖真實的 AI 醫療雲端分析功能！以下為您提供系統示範回覆：\n\n" + getFallbackAnalysis(text);
            }
            loadingMsg.remove();
            appendMessage('ai', responseText);

            // 智慧分析科別並同步寫入歷史紀錄與附近醫院查詢
            let estimatedDept = '一般內科 / 家醫科';
            if (text.includes('胃') || text.includes('腹') || text.includes('逆流')) estimatedDept = '腸胃肝膽科';
            if (text.includes('胸痛') || text.includes('呼吸') || text.includes('心悸')) estimatedDept = '急診科 / 心臟內科';
            if (text.includes('喉嚨') || text.includes('鼻') || text.includes('發燒')) estimatedDept = '耳鼻喉科';
            if (text.includes('腳') || text.includes('關節') || text.includes('扭傷')) estimatedDept = '骨科 / 復健科';

            currentRecommendedDept = estimatedDept;
            addHistoryRecord(`AI 對話：${text.length > 18 ? text.substring(0, 18) + '...' : text}`, estimatedDept);
            renderClinicsByDept(estimatedDept);

        } catch (err) {
            if (loadingMsg) loadingMsg.remove();
            console.error('Gemini API Error details:', err);
            appendMessage('ai', '⚠️ API 發生錯誤，詳細原因：' + err.message + '\n\n以下為系統自動切換的備用醫療建議：\n\n' + getFallbackAnalysis(text));
        }
    }

    sendBtn.addEventListener('click', () => handleSend());
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    async function fetchGeminiResponse(userPrompt) {
        const age = document.getElementById('age').value;
        const gender = document.getElementById('gender').value;
        const temp = document.getElementById('temp').value;
        const severity = document.getElementById('severity').value;

        const systemInstruction = `你是一位專業且細心的台灣醫療 AI 衛教與分診助手。
請依據使用者輸入的症狀進行分類評估，並一律使用正體中文，依照以下四個區域格式進行條列回答：

【建議就診科別】：
【建議醫療層級】：
【看診前準備 CheckList】：
【看診溝通小抄】：`;

        const fullPrompt = `病患基本資料：${age}歲、${gender}、體溫${temp}°C、不適嚴重度 ${severity}/10。
病患主訴：${userPrompt}`;

       const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: `[系統指引: ${systemInstruction}]\n\n${fullPrompt}` }]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0].content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('API 回傳格式異常');
        }
    }

    function getFallbackAnalysis(desc) {
        const temp = document.getElementById('temp').value;
        if (desc.includes('胸痛') || desc.includes('呼吸困難')) {
            return `【建議就診科別】：急診科 / 心臟內科
【建議醫療層級】：⚠️ 建議立即至【區域醫院或醫學中心急診室】
【看診前準備 CheckList】：
• 保持冷靜並立即由家人陪同或叫車前往
• 攜帶健保卡與身分證
【看診溝通小抄】：
「醫師您好，我突然感到明顯胸痛與呼吸困難，請協助評估急症狀況。」`;
        } else {
            return `【建議就診科別】：一般內科 / 耳鼻喉科
【建議醫療層級】：建議先至【基層診所】初步診斷，避免醫療資源浪費
【看診前準備 CheckList】：
• 攜帶健保卡
• 記錄體溫變化與發燒時間 (目前體溫：${temp}°C)
【看診溝通小抄】：
「醫師您好，我最近感到身體不適（${desc}），目前體溫為 ${temp}°C，想請醫師開藥並評估狀況。」`;
        }
    }

    // 9. 附近的醫療院所智慧定位與科別篩選聯動
    const clinicListEl = document.getElementById('clinic-list');
    const locationStatusEl = document.getElementById('location-status');
    const getLocationBtn = document.getElementById('get-location-btn');

    // 模擬資料庫：各科別之附近醫療院所
    const mockClinics = [
        { name: "市立安康診所", dept: "耳鼻喉科 / 一般內科", phone: "(02) 2345-6789", distance: "350公尺 (步行5分鐘)", address: "新北市三重區重新路段" },
        { name: "宏仁耳鼻喉科診所", dept: "耳鼻喉科", phone: "(02) 2987-6543", distance: "650公尺 (步行8分鐘)", address: "新北市三重區正義北路" },
        { name: "健安腸胃科診所", dept: "腸胃肝膽科", phone: "(02) 2288-1234", distance: "800公尺 (步行10分鐘)", address: "新北市三重區三和路" },
        { name: "新北市立聯合醫院 (三重院區)", dept: "急診科 / 內科 / 綜合", phone: "(02) 2982-9111", distance: "1.5公里 (車程5分鐘)", address: "新北市三重區新北大道一段" },
        { name: "善美骨科專科診所", dept: "骨科 / 復健科", phone: "(02) 8981-1122", distance: "500公尺 (步行7分鐘)", address: "新北市三重區中正北路" }
    ];

    function renderClinicsByDept(targetDept) {
        // 簡單關鍵字過濾
        let filtered = mockClinics.filter(c => c.dept.includes(targetDept.split('/')[0].trim()) || c.dept.includes("綜合"));
        if (filtered.length === 0) filtered = mockClinics; // 若無完全符合則顯示全部

        clinicListEl.innerHTML = filtered.map(clinic => {
            const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.name + ' ' + clinic.address)}`;
            return `
                <div class="clinic-item">
                    <div>
                        <h4>${clinic.name} <span class="tag-sm">${clinic.dept}</span></h4>
                        <p class="meta">📞 ${clinic.phone} | 📍 ${clinic.address}</p>
                        <p class="distance">距離：${clinic.distance}</p>
                    </div>
                    <a href="${googleMapUrl}" target="_blank" class="nav-btn">🗺️ Google 導航</a>
                </div>
            `;
        }).join('');
    }

    getLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('您的瀏覽器不支援地理定位功能');
            return;
        }

        locationStatusEl.textContent = "狀態：正在透過 GPS 衛星定位您的目前位置...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(4);
                const lng = position.coords.longitude.toFixed(4);
                locationStatusEl.textContent = `狀態：定位成功！(緯度: ${lat}, 經度: ${lng}) 已為您自動篩選「${currentRecommendedDept}」附近最近診所。`;
                renderClinicsByDept(currentRecommendedDept);
            },
            (error) => {
                locationStatusEl.textContent = "狀態：無法取得 GPS 定位（權限被拒絕或逾時），已載入預設區域醫院與診所。";
                renderClinicsByDept(currentRecommendedDept);
            }
        );
    });

    // 初始化載入預設附近診所
    renderClinicsByDept('耳鼻喉科');

    // 10. 緊急警示彈窗控制
    document.getElementById('test-emergency-btn').addEventListener('click', () => {
        emergencyModal.classList.remove('hidden');
    });
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        emergencyModal.classList.add('hidden');
    });

    // 11. Chart.js 初始化
    const tempCtx = document.getElementById('tempChart').getContext('2d');
    window.tempChartObj = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '體溫 (°C)',
                data: [],
                borderColor: '#2b6cb0',
                backgroundColor: 'rgba(43, 108, 176, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 35.5, max: 39.5 } }
        }
    });

    const severityCtx = document.getElementById('severityChart').getContext('2d');
    window.severityChartObj = new Chart(severityCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '嚴重度評分',
                data: [],
                backgroundColor: '#3182ce'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 10 } }
        }
    });

    updateDashboardAndCharts();
});
