// Yardımcı fonksiyonlar
async function waitForElement(selector, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const element = document.querySelector(selector);
        if (element) return element;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
}

let subtitles = [];
let currentSubtitleIndex = 0;
let subtitlePanel = null;
let isDisplayingSubtitles = false;
let isInitialized = false;

// Panel oluştur
async function createSubtitlePanel() {
    if (subtitlePanel) return;

    subtitlePanel = document.createElement('div');
    subtitlePanel.id = 'subtitle-panel';
    subtitlePanel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 600px;
        height: 200px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
        position: absolute;
        right: 0;
        bottom: 0;
        width: 15px;
        height: 15px;
        cursor: se-resize;
        z-index: 10000;
    `;

    // Başlık çubuğu
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        padding: 8px;
        background: #f0f0f0;
        cursor: move;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
    `;
    titleBar.innerHTML = '<div>Altyazılar</div>';

    // Kapatma butonu
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
        border: none;
        background: none;
        cursor: pointer;
        font-size: 16px;
        color: #666;
    `;
    closeButton.onclick = toggleSubtitles;
    titleBar.appendChild(closeButton);

    // İlerleme çubuğu container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
        padding: 8px;
        border-bottom: 1px solid #eee;
    `;
    
    const progress = document.createElement('div');
    progress.id = 'subtitle-progress';
    progress.style.cssText = `
        width: 100%;
        height: 4px;
        background: #eee;
        border-radius: 2px;
        overflow: hidden;
    `;
    
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        transition: width 0.3s;
    `;
    progress.appendChild(progressBar);
    progressContainer.appendChild(progress);

    // Altyazı içeriği
    const content = document.createElement('div');
    content.id = 'subtitle-content';
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    `;

    subtitlePanel.appendChild(titleBar);
    subtitlePanel.appendChild(progressContainer);
    subtitlePanel.appendChild(content);
    subtitlePanel.appendChild(resizeHandle);
    document.body.appendChild(subtitlePanel);

    // Event listeners
    const dragState = {
        isDragging: false,
        isResizing: false,
        currentX: 0,
        currentY: 0,
        initialX: 0,
        initialY: 0,
        xOffset: 0,
        yOffset: 0,
        initialWidth: 0,
        initialHeight: 0
    };

    titleBar.addEventListener('mousedown', (e) => dragStart(e, dragState));
    resizeHandle.addEventListener('mousedown', (e) => resizeStart(e, dragState));
    document.addEventListener('mousemove', async (e) => {
        await Promise.all([
            drag(e, dragState),
            resize(e, dragState)
        ]);
    });
    document.addEventListener('mouseup', () => {
        dragEnd(dragState);
        resizeEnd(dragState);
    });
}

// Sürükleme işlemleri
async function dragStart(e, state) {
    state.initialX = e.clientX - state.xOffset;
    state.initialY = e.clientY - state.yOffset;

    if (e.target.style.cursor === 'move') {
        state.isDragging = true;
    }
}

async function drag(e, state) {
    if (state.isDragging) {
        e.preventDefault();
        state.currentX = e.clientX - state.initialX;
        state.currentY = e.clientY - state.initialY;

        state.xOffset = state.currentX;
        state.yOffset = state.currentY;

        await setTranslate(state.currentX, state.currentY, subtitlePanel);
    }
}

async function dragEnd(state) {
    state.initialX = state.currentX;
    state.initialY = state.currentY;
    state.isDragging = false;
}

async function resizeStart(e, state) {
    e.preventDefault();
    state.isResizing = true;
    state.initialWidth = subtitlePanel.offsetWidth;
    state.initialHeight = subtitlePanel.offsetHeight;
    state.initialX = e.clientX;
    state.initialY = e.clientY;
}

async function resize(e, state) {
    if (state.isResizing) {
        e.preventDefault();
        const width = state.initialWidth + (e.clientX - state.initialX);
        const height = state.initialHeight + (e.clientY - state.initialY);
        
        if (width > 300) {
            subtitlePanel.style.width = `${width}px`;
        }
        if (height > 150) {
            subtitlePanel.style.height = `${height}px`;
        }
    }
}

async function resizeEnd(state) {
    state.isResizing = false;
}

async function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

// Altyazı öğesi oluştur
async function createSubtitleElement(subtitle) {
    const subtitleElement = document.createElement('div');
    subtitleElement.className = 'subtitle-item';
    subtitleElement.dataset.start = subtitle.start;
    subtitleElement.dataset.end = subtitle.start + subtitle.duration;
    subtitleElement.style.cssText = `
        padding: 12px 16px;
        margin: 4px 0;
        border-radius: 4px;
        transition: background-color 0.2s, border-left 0.2s;
        border-left: 4px solid transparent;
    `;
    subtitleElement.innerHTML = `
        <div style="margin-bottom: 6px; color: #666;">${subtitle.text}</div>
        <div style="color: #000;">${subtitle.translated_text}</div>
    `;
    return subtitleElement;
}

// Kontrol butonu ekle
async function addControlButton() {
    const controls = document.querySelector('.ytp-right-controls');
    if (!controls || document.getElementById('subtitle-button')) return;

    const button = document.createElement('button');
    button.id = 'subtitle-button';
    button.className = 'ytp-button';
    button.innerHTML = '🔄TR';
    button.onclick = toggleSubtitles;
    button.style.cssText = `
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: white;
    `;

    controls.insertBefore(button, controls.firstChild);
}

// Progress bar güncelle
async function updateProgress(current, total) {
    const progressFill = document.getElementById('subtitle-progress');
    const progressBar = progressFill.querySelector('div');
    
    if (progressBar) {
        const percentage = (current / total) * 100;
        progressBar.style.width = `${percentage}%`;
    }
}

// Video elementini izle ve altyazı takibini başlat
function initializeVideoTracking() {
    if (isInitialized) return;
    
    const video = document.querySelector('video');
    if (!video) return;
    
    video.addEventListener('timeupdate', updateSubtitles);
    isInitialized = true;
}

// Sayfa yüklendiğinde ve URL değiştiğinde kontrol butonunu ekle
async function init() {
    await addControlButton();
    initializeVideoTracking();
}

// Altyazıları güncelle
async function updateSubtitles() {
    if (!subtitles || subtitles.length === 0) {
        return;
    }

    const video = document.querySelector('video');
    if (!video) return;

    const currentTime = video.currentTime;
    const content = document.getElementById('subtitle-content');
    
    // Panel yoksa ve altyazılar varsa paneli oluştur
    if (!content && !isDisplayingSubtitles) {
        await toggleSubtitles();
    }
    
    if (!content) {
        console.error('Altyazı içerik elementi bulunamadı');
        return;
    }

    // Aktif altyazıyı bul
    let activeSubtitle = null;
    const subtitleElements = content.getElementsByClassName('subtitle-item');
    
    for (let element of subtitleElements) {
        const start = parseFloat(element.dataset.start);
        const end = parseFloat(element.dataset.end);

        if (currentTime >= start && currentTime <= end) {
            element.style.backgroundColor = '#e8f5e9';
            element.style.borderLeft = '4px solid #4CAF50';
            element.style.fontWeight = '500';
            activeSubtitle = element;
        } else {
            element.style.backgroundColor = 'transparent';
            element.style.borderLeft = 'none';
            element.style.fontWeight = 'normal';
        }
    }

    // Scroll işlemi
    if (activeSubtitle) {
        const containerHeight = content.offsetHeight;
        const elementOffset = activeSubtitle.offsetTop;
        const elementHeight = activeSubtitle.offsetHeight;

        content.scrollTop = elementOffset - (containerHeight / 2) + (elementHeight / 2);
        
        // Progress bar'ı güncelle
        updateProgress(currentTime, video.duration);
    }
}

// Altyazıları göster/gizle
async function toggleSubtitles() {
    if (!isDisplayingSubtitles) {
        const videoUrl = window.location.href;
        try {
            await createSubtitlePanel();
            const content = document.getElementById('subtitle-content');
            content.innerHTML = '';
            subtitles = [];
            
            const eventSource = new EventSource(`http://localhost:5000/get_subtitles?video_url=${encodeURIComponent(videoUrl)}`);
            
            eventSource.onmessage = async function(event) {
                const data = JSON.parse(event.data);
                
                if (data.error) {
                    console.error('Backend hatası:', data.error);
                    return;
                }
                
                if (data.progress) {
                    await updateProgress(data.progress.current, data.progress.total);
                }
                
                if (data.subtitle) {
                    subtitles.push(data.subtitle);
                    const subtitleElement = await createSubtitleElement(data.subtitle);
                    content.appendChild(subtitleElement);
                }
                
                if (data.completed) {
                    eventSource.close();
                    const progressContainer = document.getElementById('subtitle-progress').parentElement;
                    progressContainer.style.display = 'none';
                }
            };
            
            eventSource.onerror = function(error) {
                console.error('SSE bağlantı hatası:', error);
                eventSource.close();
            };
            
            isDisplayingSubtitles = true;
        } catch (error) {
            console.error('Altyazı yükleme hatası:', error);
        }
    } else {
        isDisplayingSubtitles = false;
        if (subtitlePanel) {
            subtitlePanel.remove();
            subtitlePanel = null;
        }
    }
}

// URL değişikliklerini izle
let lastUrl = location.href; 
new MutationObserver(async () => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        await init();
    }
}).observe(document, {subtree: true, childList: true});

// İlk yükleme
init();
