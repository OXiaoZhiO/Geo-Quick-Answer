// 游戏状态变量
let questions = [];                  // 题库数组
let currentQuestionIndex = 0;        // 当前题目索引
let score = 0;                       // 当前分数
let timeLeft = 60;                   // 剩余时间(秒)
let timerInterval = null;            // 计时器间隔ID
let startTime = null;                // 游戏开始时间
let completionTime = null;           // 游戏完成时间
let correctAnswers = 0;              // 正确答案数量
let incorrectAnswers = 0;            // 错误答案数量
let totalAnswered = 0;               // 总答题数量
const leaderboardKey = 'leaderboard';// 本地存储排行榜的键名
const selectedLibraryKey = 'selectedLibrary'; // 存储选中的题库
let availableLibraries = [];         // 可用题库列表
let currentLibrary = {               // 当前选中的题库
    file: '',
    name: '加载中...',
    questionCount: 0
};
let currentLeaderboardEntry = null;  // 当前游戏的排行榜记录
let explanations = [];               // 解析记录

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 显示加载界面
    showLoadingScreen();
    
    // 创建解析列表容器
    createExplanationList();
    
    // 绑定按钮事件
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('view-leaderboard-btn').addEventListener('click', () => {
        viewLeaderboard();
        populateLibraryFilter();
    });
    document.getElementById('restart-game-btn').addEventListener('click', backToMenu); // 返回主界面
    document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('select-library-btn').addEventListener('click', showLibrarySelector);
    document.getElementById('back-from-library-btn').addEventListener('click', hideLibrarySelector);
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    
    // 绑定悬浮按钮事件
    document.getElementById('float-back-btn').addEventListener('click', backToMenu);
    document.getElementById('float-clear-btn').addEventListener('click', clearLeaderboard);
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 绑定知识卡片点击事件
    document.getElementById('knowledge-card').addEventListener('click', showRandomKnowledge);
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 初始化文件拖放上传
    setupFileDrop();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 加载可用题库列表
    loadAvailableLibraries();
});

/**
 * 显示加载中界面
 */
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
        // 确保加载中字样和加载圈圈居中
        const loadingContent = loadingScreen.querySelector('.loading-content');
        if (loadingContent) {
            loadingContent.style.display = 'flex';
            loadingContent.style.flexDirection = 'column';
            loadingContent.style.alignItems = 'center';
            loadingContent.style.justifyContent = 'center';
        }
    }
}

/**
 * 隐藏加载中界面
 */
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

/**
 * 加载可用的题库列表
 */
async function loadAvailableLibraries() {
    try {
        // 显式列出所有已知的题库文件
        const knownLibraries = [
            '1.json',
            '2.json',
            '3.json',
            'csp-j-s.json',  // 替换为你的实际文件名
            '山川风物-地理-中阶.json',
            '湖光山色-地理-初阶.json'
            // 添加更多你的题库文件名
        ];
        
        availableLibraries = [];
        
        // 网页模式下
        if (window.location.protocol !== 'file:') {
            for (const fileName of knownLibraries) {
                const filePath = `data/${fileName}`;
                try {
                    await fetch(filePath, { method: 'HEAD' });
                    availableLibraries.push({ id: fileName.replace('.json', ''), file: filePath });
                } catch (error) {
                    console.warn(`题库文件 ${filePath} 不存在，已跳过`);
                }
            }
        } else {
            // 本地模式下
            for (const fileName of knownLibraries) {
                availableLibraries.push({ id: fileName.replace('.json', ''), file: `data/${fileName}` });
            }
        }
        
        // 如果没有找到可用题库且当前没有选中的题库，使用第一个可用的
        if (availableLibraries.length > 0 && !currentLibrary.file) {
            currentLibrary.file = availableLibraries[0].file;
        }
        
        // 加载当前选中的题库
        await loadCurrentLibrary();
        
        // 隐藏加载界面
        hideLoadingScreen();
        
        // 显示随机知识
        showRandomKnowledge();
    } catch (error) {
        console.error('加载题库列表失败:', error);
        showToast('加载题库失败: ' + error.message, 'error');
        hideLoadingScreen();
    }
}

/**
 * 设置文件拖放上传功能
 */
function setupFileDrop() {
    const fileUploadSection = document.getElementById('local-file-upload');
    const fileInput = document.getElementById('library-file-input');
    
    if (!fileUploadSection || !fileInput) return;
    
    // 拖放事件
    fileUploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadSection.classList.add('dragover');
    });
    
    fileUploadSection.addEventListener('dragleave', () => {
        fileUploadSection.classList.remove('dragover');
    });
    
    fileUploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadSection.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                handleDroppedFile(file);
            } else {
                showToast('请上传JSON格式的题库文件', 'error');
            }
        }
    });
    
    // 点击上传区域也触发文件选择
    const fileLabel = document.querySelector('.file-label');
    if (fileLabel) {
        fileLabel.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });
    }
}

/**
 * 处理拖放的文件
 * @param {File} file - 拖放的文件
 */
function handleDroppedFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = JSON.parse(e.target.result);
            processLibraryContent(content, file.name);
            
            // 保存为当前选中的题库
            currentLibrary = {
                file: file.name,
                name: content.name || file.name,
                questionCount: content.questions ? content.questions.length : 0
            };
            
            localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
            const currentLibraryName = document.getElementById('current-library-name');
            if (currentLibraryName) {
                currentLibraryName.textContent = currentLibrary.name;
            }
            
            showToast(`成功加载题库: ${currentLibrary.name}`, 'success');
        } catch (error) {
            showToast('解析题库文件失败: ' + error.message, 'error');
            console.error('解析题库文件失败:', error);
        }
    };
    reader.readAsText(file);
}

/**
 * 显示提示弹窗
 * @param {string} message - 提示消息
 * @param {string} type - 提示类型：success, error, info, warning
 * @param {number} duration - 显示时长(毫秒)，默认3000
 */
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    // 创建弹窗元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // 根据类型设置图标
    let icon = 'info-circle';
    switch (type) {
        case 'success': icon = 'check-circle'; break;
        case 'error': icon = 'times-circle'; break;
        case 'warning': icon = 'exclamation-triangle'; break;
    }
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
        <span class="toast-close">&times;</span>
    `;
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 关闭按钮事件
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        });
    }
    
    // 自动关闭
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
    
    console.log(`${type.toUpperCase()}: ${message}`);
}

/**
 * 显示/隐藏悬浮控制按钮
 * @param {boolean} show - 是否显示
 * @param {string} screen - 当前显示的屏幕
 */
function toggleFloatingControls(show, screen = '') {
    const controls = document.getElementById('floating-controls');
    if (!controls) return;
    
    if (show) {
        controls.classList.remove('hidden');
        
        // 只在显示排行榜时显示清空排行榜按钮
        const clearBtn = document.getElementById('float-clear-btn');
        if (clearBtn) {
            if (screen === 'leaderboard') {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
        }
    } else {
        controls.classList.add('hidden');
    }
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    const startMenu = document.getElementById('start-menu');
    const librarySelector = document.getElementById('library-selector');
    if (startMenu && librarySelector) {
        startMenu.classList.add('hidden');
        librarySelector.classList.remove('hidden');
        renderLibraryList();
        toggleFloatingControls(true);
    }
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    const librarySelector = document.getElementById('library-selector');
    const startMenu = document.getElementById('start-menu');
    if (librarySelector && startMenu) {
        librarySelector.classList.add('hidden');
        startMenu.classList.remove('hidden');
        toggleFloatingControls(false);
    }
}

/**
 * 渲染题库列表
 */
function renderLibraryList() {
    const libraryList = document.getElementById('library-list');
    if (!libraryList) return;
    
    libraryList.innerHTML = '';
    
    // 添加内置题库
    availableLibraries.forEach(library => {
        fetchLibraryInfo(library.file).then(info => {
            const item = document.createElement('div');
            item.className = `library-item ${currentLibrary.file === library.file ? 'selected' : ''}`;
            
            // 从文件名提取题库名（不含路径和扩展名）
            const fileName = library.file.split('/').pop().replace('.json', '');
            const displayName = info.name || fileName;
            
            item.innerHTML = `
                <div>
                    <div>${displayName}</div>
                    <div class="library-meta">${info.questionCount || '未知'} 题</div>
                </div>
                ${currentLibrary.file === library.file ? '<i class="fas fa-check"></i>' : ''}
            `;
            
            item.addEventListener('click', () => {
                selectLibrary(library.file, displayName, info.questionCount);
            });
            
            libraryList.appendChild(item);
        });
    });
    
    // 本地模式下，如果无法使用fetch，只显示上传按钮
    if (window.location.protocol === 'file:') {
        const libraryItems = libraryList.querySelectorAll('.library-item');
        if (libraryItems.length === 0) {
            libraryList.innerHTML = '<p class="small-text">请通过下方上传按钮选择本地题库文件</p>';
        }
    }
}

/**
 * 选择题库
 * @param {string} filePath - 题库文件路径
 * @param {string} name - 题库名称
 * @param {number} questionCount - 题目数量
 */
function selectLibrary(filePath, name, questionCount) {
    currentLibrary = {
        file: filePath,
        name: name || filePath,
        questionCount: questionCount || 0
    };
    
    // 保存到本地存储
    localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
    
    // 更新当前选择显示
    const currentLibraryName = document.getElementById('current-library-name');
    if (currentLibraryName) {
        currentLibraryName.textContent = currentLibrary.name;
    }
    
    // 重新渲染列表以更新选中状态
    renderLibraryList();
    
    // 加载选中的题库
    loadQuestionsFromFile(currentLibrary.file)
        .then(() => {
            showToast(`已选择题库: ${currentLibrary.name}`, 'success');
            // 更新知识卡片
            showRandomKnowledge();
        });
}

/**
 * 从本地存储加载选中的题库
 */
function loadSelectedLibrary() {
    try {
        const savedLibrary = localStorage.getItem(selectedLibraryKey);
        if (savedLibrary) {
            currentLibrary = JSON.parse(savedLibrary);
        }
    } catch (e) {
        console.error('加载保存的题库失败', e);
        showToast('加载保存的题库失败，使用默认设置', 'warning');
        // 加载失败时使用默认题库
        currentLibrary = {
            file: availableLibraries.length > 0 ? availableLibraries[0].file : '',
            name: '默认题库',
            questionCount: 0
        };
    }
    
    // 更新当前选择显示
    const currentLibraryName = document.getElementById('current-library-name');
    if (currentLibraryName) {
        currentLibraryName.textContent = currentLibrary.name;
    }
}

/**
 * 加载当前选中的题库
 */
async function loadCurrentLibrary() {
    if (!currentLibrary.file) {
        if (availableLibraries.length > 0) {
            currentLibrary.file = availableLibraries[0].file;
            return loadQuestionsFromFile(currentLibrary.file);
        }
        return false;
    }
    
    // 检查是否是本地file协议
    if (window.location.protocol === 'file:') {
        console.log('检测到本地文件协议，使用文件选择方式加载题库');
        // 不自动加载，等待用户选择
        return false;
    } else {
        // 网页模式，直接加载
        return loadQuestionsFromFile(currentLibrary.file);
    }
}

/**
 * 处理用户选择本地题库文件
 * @param {Event} event - 文件选择事件
 */
function handleLibraryFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = JSON.parse(e.target.result);
            processLibraryContent(content, file.name);
            
            // 保存为当前选中的题库
            currentLibrary = {
                file: file.name,
                name: content.name || file.name,
                questionCount: content.questions ? content.questions.length : 0
            };
            
            localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
            const currentLibraryName = document.getElementById('current-library-name');
            if (currentLibraryName) {
                currentLibraryName.textContent = currentLibrary.name;
            }
            
            // 清空文件输入，允许重新选择同一个文件
            const fileInput = document.getElementById('library-file-input');
            if (fileInput) {
                fileInput.value = '';
            }
            
            showToast(`成功加载题库: ${currentLibrary.name}`, 'success');
            // 更新知识卡片
            showRandomKnowledge();
        } catch (error) {
            showToast('解析题库文件失败: ' + error.message, 'error');
            console.error('解析题库文件失败:', error);
        }
    };
    reader.readAsText(file);
}

/**
 * 获取题库信息（名称和题数）
 * @param {string} filePath - 题库文件路径
 * @returns {Promise} 包含题库信息的Promise对象
 */
async function fetchLibraryInfo(filePath) {
    try {
        const res = await fetch(filePath);
        if (!res.ok) {
            throw new Error(`HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        return {
            name: content.name || filePath,
            questionCount: content.questions ? content.questions.length : 0
        };
    } catch (error) {
        console.error(`获取题库信息失败 (${filePath}):`, error);
        return {
            name: filePath.split('/').pop().replace('.json', ''),
            questionCount: 0
        };
    }
}

/**
 * 从文件加载题库
 * @param {string} filePath - 题库文件路径
 * @returns {Promise} 加载是否成功的Promise对象
 */
async function loadQuestionsFromFile(filePath) {
    try {
        // 显示加载界面
        showLoadingScreen();
        
        // 检查是否是本地file协议
        if (window.location.protocol === 'file:') {
            // 本地模式，提示用户选择文件
            const fileInput = document.getElementById('library-file-input');
            if (fileInput) {
                fileInput.click();
            }
            hideLoadingScreen();
            return false;
        }
        
        const res = await fetch(filePath);
        if (!res.ok) {
            throw new Error(`HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        processLibraryContent(content, filePath);
        
        hideLoadingScreen();
        return true;
    } catch (error) {
        console.error('加载题库错误:', error);
        showToast(`加载失败: ${error.message}，请尝试选择其他题库`, 'error');
        hideLoadingScreen();
        return false;
    }
}

/**
 * 处理题库内容
 * @param {Object} content - 题库内容
 * @param {string} filePath - 题库文件路径
 */
function processLibraryContent(content, filePath) {
    // 验证题库格式
    if (!content.questions || !Array.isArray(content.questions)) {
        throw new Error('题库格式错误，预期包含questions数组');
    }
    
    // 更新当前题库信息
    currentLibrary.name = content.name || filePath.split('/').pop().replace('.json', '');
    currentLibrary.questionCount = content.questions.length;
    
    // 处理每道题，过滤无效题目
    questions = content.questions.map((q, idx) => {
        // 验证题目必要字段
        if (!q.question || !q.answer || !q.options || q.difficulty === undefined) {
            console.warn(`题目ID ${idx+1} 格式不完整，已跳过`);
            return null;
        }
        
        // 根据难度设置选项数量和分数
        const diffConf = {
            1: { options: 3, score: 5 },
            2: { options: 4, score: 10 },
            3: { options: 5, score: 15 },
            4: { options: 6, score: 20 }
        }[q.difficulty] || { options: 3, score: 5 };
        
        // 确保正确答案在选项中
        if (!q.options.includes(q.answer)) {
            q.options.push(q.answer);
            console.warn(`题目ID ${q.id || idx+1} 选项中缺少正确答案，已自动添加`);
        }
        
        // 确保有ID字段
        if (!q.id) {
            q.id = idx + 1;
            console.warn(`题目 ${idx+1} 缺少ID，已自动分配`);
        }
        
        return {
            id: q.id,
            question: q.question,
            answer: q.answer,
            options: [...new Set(q.options)], // 去重
            difficulty: q.difficulty,
            score: diffConf.score,
            explanation: q.explanation || '无解析'
        };
    }).filter(q => q !== null); // 过滤掉无效题目
    
    if (questions.length === 0) {
        throw new Error('题库中没有有效的题目');
    }
    
    // 随机排序题库
    shuffleQuestions();
    
    console.log(`成功加载题库: ${currentLibrary.name}，共 ${questions.length} 题`);
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section .explanation-card');
    if (explanationSection) {
        explanationSection.innerHTML = '<h3>答题记录</h3><div id="explanation-list"></div>';
    }
}

/**
 * 添加解析记录 - 新记录放在最上面
 * @param {Object} question - 题目对象
 * @param {boolean} isCorrect - 是否回答正确
 */
function addExplanation(question, isCorrect) {
    const explanationList = document.getElementById('explanation-list');
    if (!explanationList) return;
    
    const item = document.createElement('div');
    item.className = `explanation-item ${isCorrect ? 'explanation-correct' : 'explanation-incorrect'}`;
    
    item.innerHTML = `
        <div>第${question.id}题：${isCorrect ? '回答正确' : '回答错误'}</div>
        <div>题目：${question.question}</div>
        <div>正确答案：${question.answer}</div>
        <div>解析：${question.explanation}</div>
    `;
    
    // 将新记录添加到列表顶部
    if (explanationList.firstChild) {
        explanationList.insertBefore(item, explanationList.firstChild);
    } else {
        explanationList.appendChild(item);
    }
    
    explanations.unshift({
        question: question,
        isCorrect: isCorrect
    });
    
    // 滚动到顶部
    explanationList.scrollTop = 0;
}

/**
 * 显示随机知识点
 */
function showRandomKnowledge() {
    const knowledgeContent = document.getElementById('knowledge-content');
    if (!knowledgeContent || questions.length === 0) {
        knowledgeContent.innerHTML = '请先选择一个题库';
        return;
    }
    
    // 添加淡入淡出效果
    knowledgeContent.style.opacity = '0';
    
    setTimeout(() => {
        // 随机选择一题
        const randomIndex = Math.floor(Math.random() * questions.length);
        const randomQuestion = questions[randomIndex];
        
        knowledgeContent.innerHTML = `
            <div><strong>NO.${randomQuestion.id}</strong> ${randomQuestion.question}</div>
            <div class="answer">答案：${randomQuestion.answer}</div>
            <div class="explanation">解析：${randomQuestion.explanation}</div>
        `;
        
        // 淡入效果
        knowledgeContent.style.transition = 'opacity 0.5s ease';
        knowledgeContent.style.opacity = '1';
    }, 300);
}

/**
 * 开始游戏
 */
function startGame() {
    if (questions.length === 0) {
        showToast('请先选择并加载一个有效的题库', 'warning');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    score = 0;
    timeLeft = 60;
    currentQuestionIndex = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalAnswered = 0;
    explanations = [];
    currentLeaderboardEntry = null;
    
    // 清空解析列表
    const explanationList = document.getElementById('explanation-list');
    if (explanationList) {
        explanationList.innerHTML = '';
    }
    
    // 更新UI
    const scoreValue = document.getElementById('score-value');
    const timeLeftEl = document.getElementById('time-left');
    const accuracyDisplay = document.getElementById('accuracy-display');
    const progressFill = document.getElementById('progress-fill');
    
    if (scoreValue) scoreValue.textContent = '0';
    if (timeLeftEl) timeLeftEl.textContent = '60';
    if (accuracyDisplay) accuracyDisplay.textContent = '0/0/0-0%';
    if (progressFill) progressFill.style.width = '100%';
    
    // 显示游戏界面
    const startMenu = document.getElementById('start-menu');
    const gameScreen = document.getElementById('game');
    
    if (startMenu) startMenu.classList.add('hidden');
    if (gameScreen) {
        gameScreen.classList.remove('hidden');
        toggleFloatingControls(true);
    }
    
    // 显示第一题
    showQuestion();
    
    // 记录开始时间
    startTime = new Date();
    
    // 启动计时器
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

/**
 * 显示当前题目
 */
function showQuestion() {
    if (currentQuestionIndex >= questions.length) {
        // 如果题目用完了，重新随机排序
        shuffleQuestions();
        currentQuestionIndex = 0;
    }
    
    const question = questions[currentQuestionIndex];
    const questionElement = document.getElementById('question');
    const optionsElement = document.getElementById('options');
    
    if (!questionElement || !optionsElement) return;
    
    // 清空反馈
    const feedback = document.getElementById('feedback');
    if (feedback) {
        feedback.classList.add('hidden');
    }
    
    // 显示题目（带题号）
    questionElement.textContent = `NO.${question.id} ${question.question}`;
    
    // 清空并生成选项
    optionsElement.innerHTML = '';
    
    // 根据难度确定选项数量
    const optionCount = {1: 3, 2: 4, 3: 5, 4: 6}[question.difficulty] || 3;
    
    // 确保选项数组包含正确答案
    let selectedOptions = [question.answer];
    
    // 从干扰项中随机选择其他选项
    const distractors = question.options.filter(opt => opt !== question.answer);
    
    // 如果干扰项不足，使用空字符串填充
    while (selectedOptions.length < optionCount && distractors.length > 0) {
        const randomIndex = Math.floor(Math.random() * distractors.length);
        selectedOptions.push(distractors[randomIndex]);
        distractors.splice(randomIndex, 1);
    }
    
    // 随机排序选项
    selectedOptions.sort(() => Math.random() - 0.5);
    
    selectedOptions.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.addEventListener('click', () => checkAnswer(option, question));
        optionsElement.appendChild(optionElement);
    });
}

/**
 * 随机打乱题目顺序
 */
function shuffleQuestions() {
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }
}

/**
 * 检查答案
 * @param {string} selectedOption - 选中的选项
 * @param {Object} question - 题目对象
 */
function checkAnswer(selectedOption, question) {
    // 禁用所有选项
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.removeEventListener('click', () => {});
        option.style.pointerEvents = 'none';
        
        // 标记正确和错误答案
        if (option.textContent === question.answer) {
            option.classList.add('correct');
        } else if (option.textContent === selectedOption) {
            option.classList.add('incorrect');
        }
    });
    
    // 判断是否正确
    const isCorrect = selectedOption === question.answer;
    
    // 更新分数和统计
    if (isCorrect) {
        score += question.score;
        correctAnswers++;
        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = `正确！+${question.score}分`;
            feedback.className = 'feedback-correct';
        }
    } else {
        incorrectAnswers++;
        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = `错误。正确答案是：${question.answer}`;
            feedback.className = 'feedback-incorrect';
        }
    }
    
    totalAnswered++;
    const feedbackEl = document.getElementById('feedback');
    if (feedbackEl) feedbackEl.classList.remove('hidden');
    
    const scoreValue = document.getElementById('score-value');
    if (scoreValue) scoreValue.textContent = score.toString();
    
    updateAccuracyDisplay();
    
    // 添加解析记录
    addExplanation(question, isCorrect);
    
    // 进入下一题
    currentQuestionIndex++;
    setTimeout(showQuestion, 1500);
}

/**
 * 更新正确率显示
 */
function updateAccuracyDisplay() {
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    const accuracyDisplay = document.getElementById('accuracy-display');
    if (accuracyDisplay) {
        accuracyDisplay.textContent = 
            `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    }
}

/**
 * 更新计时器
 */
function updateTimer() {
    timeLeft--;
    const timeLeftEl = document.getElementById('time-left');
    const progressFill = document.getElementById('progress-fill');
    
    if (timeLeftEl) timeLeftEl.textContent = timeLeft.toString();
    if (progressFill) progressFill.style.width = `${(timeLeft / 60) * 100}%`;
    
    if (timeLeft <= 0) {
        endGame();
    }
}

/**
 * 结束游戏
 */
function endGame() {
    // 清除计时器
    clearInterval(timerInterval);
    timerInterval = null;
    
    // 记录完成时间
    completionTime = new Date();
    const timeSpent = Math.round((completionTime - startTime) / 1000);
    
    // 计算正确率
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    
    // 显示游戏结束界面
    const gameScreen = document.getElementById('game');
    const gameOverMenu = document.getElementById('game-over-menu');
    
    if (gameScreen) gameScreen.classList.add('hidden');
    if (gameOverMenu) gameOverMenu.classList.remove('hidden');
    
    const finalScore = document.getElementById('final-score');
    const quizCompletionTime = document.getElementById('quiz-completion-time');
    
    if (finalScore) finalScore.textContent = score.toString();
    if (quizCompletionTime) {
        quizCompletionTime.textContent = 
            `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    }
    
    // 保存记录到排行榜（确保不会重复保存）
    if (!currentLeaderboardEntry) {
        currentLeaderboardEntry = {
            score: score,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            accuracy: accuracy,
            correct: correctAnswers,
            incorrect: incorrectAnswers,
            total: totalAnswered,
            library: currentLibrary.name,
            libraryFile: currentLibrary.file
        };
        
        saveToLeaderboard(currentLeaderboardEntry);
    }
    
    // 显示当前题库的排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
    
    // 检查是否破纪录
    checkRecord(currentLeaderboardEntry);
}

/**
 * 检查是否破纪录
 * @param {Object} entry - 当前游戏记录
 */
function checkRecord(entry) {
    const leaderboard = getLeaderboard();
    // 筛选当前题库的记录
    const libraryEntries = leaderboard.filter(item => item.libraryFile === entry.libraryFile);
    
    // 排序并检查是否是最高分
    libraryEntries.sort((a, b) => b.score - a.score);
    const isRecord = libraryEntries.length === 0 || entry.score > libraryEntries[0].score;
    
    const recordMessage = document.getElementById('record-message');
    const celebrationMessage = document.getElementById('celebration-message');
    
    if (isRecord) {
        if (recordMessage) recordMessage.classList.remove('hidden');
        // 显示庆祝弹窗
        setTimeout(() => {
            if (celebrationMessage) celebrationMessage.classList.remove('hidden');
            // 3秒后隐藏
            setTimeout(() => {
                if (celebrationMessage) celebrationMessage.classList.add('hidden');
            }, 3000);
        }, 500);
    } else {
        if (recordMessage) recordMessage.classList.add('hidden');
    }
}

/**
 * 从本地存储获取排行榜数据
 * @returns {Array} 排行榜数据数组
 */
function getLeaderboard() {
    try {
        const leaderboard = localStorage.getItem(leaderboardKey);
        return leaderboard ? JSON.parse(leaderboard) : [];
    } catch (error) {
        console.error('获取排行榜数据失败:', error);
        showToast('获取排行榜数据失败', 'error');
        return [];
    }
}

/**
 * 保存记录到排行榜
 * @param {Object} entry - 要保存的记录
 */
function saveToLeaderboard(entry) {
    try {
        const leaderboard = getLeaderboard();
        
        // 检查是否已经存在相同记录（避免重复）
        const isDuplicate = leaderboard.some(item => 
            item.score === entry.score &&
            item.date === entry.date &&
            item.time === entry.time &&
            item.libraryFile === entry.libraryFile
        );
        
        if (!isDuplicate) {
            leaderboard.push(entry);
            // 只保留每个用户前100条记录
            if (leaderboard.length > 100) {
                leaderboard.sort((a, b) => b.score - a.score);
                leaderboard.splice(100);
            }
            localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        }
    } catch (error) {
        console.error('保存到排行榜失败:', error);
        showToast('保存记录失败', 'error');
    }
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空排行榜记录吗？此操作不可恢复。')) {
        try {
            localStorage.removeItem(leaderboardKey);
            updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
            updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
            showToast('排行榜已清空', 'info');
        } catch (error) {
            console.error('清空排行榜失败:', error);
            showToast('清空排行榜失败', 'error');
        }
    }
}

/**
 * 显示排行榜
 */
function viewLeaderboard() {
    const startMenu = document.getElementById('start-menu');
    const leaderboardMenu = document.getElementById('leaderboard-menu');
    
    if (startMenu) startMenu.classList.add('hidden');
    if (leaderboardMenu) {
        leaderboardMenu.classList.remove('hidden');
        toggleFloatingControls(true, 'leaderboard');
    }
}

/**
 * 填充题库筛选下拉框
 */
function populateLibraryFilter() {
    const filter = document.getElementById('library-filter');
    if (!filter) return;
    
    // 保存当前选中的值
    const currentValue = filter.value;
    
    // 清空现有选项（保留"所有题库"）
    while (filter.options.length > 1) {
        filter.remove(1);
    }
    
    // 获取所有独特的题库
    const leaderboard = getLeaderboard();
    const libraries = new Set();
    
    // 添加当前选中的题库
    if (currentLibrary.name) {
        libraries.add(currentLibrary.name);
    }
    
    // 添加排行榜中的题库
    leaderboard.forEach(entry => {
        if (entry.library) {
            libraries.add(entry.library);
        }
    });
    
    // 添加到筛选框
    Array.from(libraries).forEach(library => {
        const option = document.createElement('option');
        option.value = library;
        option.textContent = library;
        filter.appendChild(option);
    });
    
    // 恢复选中值
    if (currentValue && filter.querySelector(`option[value="${currentValue}"]`)) {
        filter.value = currentValue;
    }
}

/**
 * 更新排行榜显示
 * @param {string} elementId - 要更新的元素ID
 * @param {string} libraryFilter - 题库筛选条件，"all"表示所有
 */
function updateLeaderboardDisplay(elementId, libraryFilter) {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    
    let leaderboard = getLeaderboard();
    
    // 根据题库筛选
    if (libraryFilter && libraryFilter !== 'all') {
        leaderboard = leaderboard.filter(entry => 
            entry.library === libraryFilter || entry.libraryFile === libraryFilter
        );
    }
    
    // 按分数排序（降序）
    leaderboard.sort((a, b) => b.score - a.score);
    
    // 清空并填充排行榜
    leaderboardElement.innerHTML = '';
    
    if (leaderboard.length === 0) {
        leaderboardElement.innerHTML = '<li>暂无记录</li>';
        return;
    }
    
    leaderboard.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <div>
                <strong>${index + 1}.</strong> ${entry.score}分
                ${libraryFilter === 'all' ? `<div class="library-name-small">${entry.library || '未知题库'}</div>` : ''}
            </div>
            <div>
                <span>${entry.date}</span>
                <span style="margin-left: 10px;">${entry.accuracy}%</span>
            </div>
        `;
        
        // 添加点击事件显示解析
        listItem.addEventListener('click', () => {
            showLeaderboardExplanation(entry);
        });
        
        leaderboardElement.appendChild(listItem);
    });
}

/**
 * 显示排行榜记录的解析
 * @param {Object} entry - 排行榜记录
 */
function showLeaderboardExplanation(entry) {
    const explanationContent = document.getElementById('leaderboard-explanation-content');
    if (!explanationContent) return;
    
    // 这里只是显示记录信息，实际解析需要额外存储
    explanationContent.innerHTML = `
        <div>分数: ${entry.score}</div>
        <div>日期: ${entry.date} ${entry.time}</div>
        <div>正确率: ${entry.accuracy}%</div>
        <div>答题统计: 正确${entry.correct} / 错误${entry.incorrect} / 总计${entry.total}</div>
        <div>题库: ${entry.library || '未知'}</div>
    `;
}

/**
 * 返回主菜单
 */
function backToMenu() {
    // 停止计时器
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 隐藏所有界面，显示主菜单
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    const startMenu = document.getElementById('start-menu');
    if (startMenu) startMenu.classList.remove('hidden');
    
    // 隐藏庆祝弹窗
    const celebrationMessage = document.getElementById('celebration-message');
    if (celebrationMessage) celebrationMessage.classList.add('hidden');
    
    // 隐藏悬浮控制按钮
    toggleFloatingControls(false);
}

/**
 * 初始化游戏说明弹窗
 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const showBtn = document.getElementById('show-instructions-btn');
    const closeBtn = document.querySelector('.close-modal');
    
    if (!modal || !showBtn || !closeBtn) return;
    
    showBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        toggleFloatingControls(true);
    });
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        toggleFloatingControls(false);
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            toggleFloatingControls(false);
        }
    });
}
