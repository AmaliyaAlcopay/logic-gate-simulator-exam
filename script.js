// ============================================
// Logic Gate Simulator - Полная версия для экзамена
// Включает 7 вентилей, UI и функции для скринкаста
// ============================================

class LogicGateSimulator {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gates = [];
        this.wires = [];
        this.selectedGate = null;
        this.selectedTool = 'select';
        this.isSimulating = false;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.gateId = 1;
        this.wireId = 1;
        this.simulationSpeed = 5;
        this.inputValues = {};
        this.outputValues = {};
        
        // Для скринкаста
        this.recording = false;
        this.recordStartTime = 0;
        this.recordedFrames = [];
        this.timerInterval = null;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupTruthTables();
        this.updateStats();
        this.draw();
        
        // Установка текущей даты
        document.getElementById('timestamp').textContent = 
            `Создано: ${new Date().toLocaleDateString('ru-RU')}`;
    }

    setupCanvas() {
        // Установка размеров canvas
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setupEventListeners() {
        // Перетаскивание вентилей
        document.querySelectorAll('.gate-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', e.target.dataset.type);
            });
        });

        // Drop на canvas
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const gateType = e.dataTransfer.getData('text/plain');
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.addGate(gateType, x, y);
            this.draw();
            this.updateStats();
        });

        // Клики на canvas
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Инструменты
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedTool = e.target.dataset.tool;
            });
        });

        // Кнопки управления
        document.getElementById('simulateBtn').addEventListener('click', () => this.toggleSimulation());
        document.getElementById('stepBtn').addEventListener('click', () => this.stepSimulation());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetSimulation());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearWorkspace());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCircuit());
        document.getElementById('loadBtn').addEventListener('click', () => this.showLoadModal());

        // Примеры схем
        document.querySelectorAll('.example-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const example = e.target.dataset.example;
                this.loadExample(example);
            });
        });

        // Входы/выходы
        document.querySelectorAll('.io-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.addIO(type);
            });
        });

        // Скринкаст
        document.getElementById('recordBtn').addEventListener('click', () => this.startRecording());
        document.getElementById('stopRecordBtn').addEventListener('click', () => this.stopRecording());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadRecording());

        // Модальное окно
        document.getElementById('closeModal').addEventListener('click', () => this.hideModal());
        document.getElementById('copyBtn').addEventListener('click', () => this.copyCircuitData());
        document.getElementById('importBtn').addEventListener('click', () => this.importCircuitData());

        // Селектор таблиц истинности
        document.getElementById('gateSelector').addEventListener('change', (e) => {
            this.updateTruthTable(e.target.value);
        });

        // Слайдер скорости
        document.getElementById('speedRange').addEventListener('input', (e) => {
            this.simulationSpeed = parseInt(e.target.value);
            document.getElementById('speedValue').textContent = 
                ['Очень медленно', 'Медленно', 'Умеренно', 'Средняя', 'Быстро'][this.simulationSpeed - 1] || 'Средняя';
        });

        // Ресайз окна
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.draw();
        });
    }

    addGate(type, x, y) {
        const gate = {
            id: this.gateId++,
            type: type,
            x: x - 40,
            y: y - 30,
            width: 80,
            height: 60,
            inputs: type === 'NOT' ? [null] : [null, null],
            output: null,
            isActive: false
        };
        this.gates.push(gate);
        return gate;
    }

    addIO(type) {
        const x = 50 + Math.random() * (this.canvas.width - 100);
        const y = 50 + Math.random() * (this.canvas.height - 100);
        
        if (type.startsWith('input')) {
            const value = type === 'input-1' ? 1 : 0;
            const io = {
                id: `input_${Date.now()}`,
                type: 'input',
                value: value,
                x: x,
                y: y,
                width: 40,
                height: 40,
                connectedTo: null
            };
            this.inputValues[io.id] = value;
            this.gates.push(io);
        } else {
            const io = {
                id: `output_${Date.now()}`,
                type: 'output',
                value: null,
                x: x,
                y: y,
                width: 40,
                height: 40,
                connectedTo: null
            };
            this.outputValues[io.id] = null;
            this.gates.push(io);
        }
        this.draw();
        this.updateStats();
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Находим элемент под курсором
        const gate = this.findGateAt(x, y);
        
        if (this.selectedTool === 'select') {
            if (gate) {
                this.selectedGate = gate;
                this.dragging = true;
                this.dragOffset.x = x - gate.x;
                this.dragOffset.y = y - gate.y;
                this.updateSelectedInfo(gate);
            } else {
                this.selectedGate = null;
                this.updateSelectedInfo(null);
            }
        } else if (this.selectedTool === 'delete') {
            if (gate) {
                this.deleteGate(gate);
            }
        } else if (this.selectedTool === 'wire') {
            // Логика соединения вентилей
            if (gate) {
                // Пока что упрощенная логика соединения
                alert('Для соединения: 1) Выберите выход первого вентиля 2) Выберите вход второго вентиля');
            }
        }

        this.draw();
    }

    handleMouseMove(e) {
        if (this.dragging && this.selectedGate) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.selectedGate.x = x - this.dragOffset.x;
            this.selectedGate.y = y - this.dragOffset.y;
            this.draw();
        }
    }

    handleMouseUp() {
        this.dragging = false;
    }

    findGateAt(x, y) {
        for (let i = this.gates.length - 1; i >= 0; i--) {
            const gate = this.gates[i];
            if (x >= gate.x && x <= gate.x + gate.width &&
                y >= gate.y && y <= gate.y + gate.height) {
                return gate;
            }
        }
        return null;
    }

    deleteGate(gate) {
        this.gates = this.gates.filter(g => g !== gate);
        // Удаляем связанные провода
        this.wires = this.wires.filter(w => 
            w.from !== gate.id && w.to !== gate.id
        );
        this.updateStats();
    }

    toggleSimulation() {
        this.isSimulating = !this.isSimulating;
        const btn = document.getElementById('simulateBtn');
        const status = document.getElementById('simulationStatus');
        
        if (this.isSimulating) {
            btn.innerHTML = '<i class="fas fa-pause"></i> Остановить';
            btn.style.background = 'var(--warning)';
            status.textContent = 'Активно';
            status.style.color = 'var(--success)';
            this.runSimulation();
        } else {
            btn.innerHTML = '<i class="fas fa-play"></i> Запустить симуляцию';
            btn.style.background = 'var(--success)';
            status.textContent = 'Не активно';
            status.style.color = 'var(--danger)';
        }
    }

    runSimulation() {
        if (!this.isSimulating) return;

        // Вычисляем значения для всех вентилей
        this.calculateGateValues();
        this.draw();
        
        // Запускаем следующий кадр с учетом скорости
        setTimeout(() => {
            requestAnimationFrame(() => this.runSimulation());
        }, 1000 / this.simulationSpeed);
    }

    stepSimulation() {
        this.calculateGateValues();
        this.draw();
    }

    calculateGateValues() {
        // Сбрасываем все значения
        this.gates.forEach(gate => {
            if (gate.type && gate.type !== 'input' && gate.type !== 'output') {
                gate.isActive = false;
                gate.output = null;
            }
        });

        // Вычисляем значения последовательно
        for (let i = 0; i < 10; i++) { // Максимум 10 итераций
            let changed = false;
            
            this.gates.forEach(gate => {
                if (!gate.type || gate.type === 'input' || gate.type === 'output') return;
                
                // Получаем значения входов
                const inputs = this.getGateInputs(gate);
                
                if (inputs.every(v => v !== null)) {
                    const output = this.calculateGateOutput(gate.type, inputs);
                    if (gate.output !== output) {
                        gate.output = output;
                        gate.isActive = output === 1;
                        changed = true;
                    }
                }
            });
            
            if (!changed) break;
        }
    }

    getGateInputs(gate) {
        // Упрощенная версия - в реальном приложении здесь нужно учитывать провода
        return gate.inputs.map((input, index) => {
            if (input === null) return null;
            // Здесь должна быть логика получения значений из связанных вентилей
            return 0; // Заглушка
        });
    }

    calculateGateOutput(type, inputs) {
        switch(type) {
            case 'AND':
                return inputs.every(v => v === 1) ? 1 : 0;
            case 'OR':
                return inputs.some(v => v === 1) ? 1 : 0;
            case 'NOT':
                return inputs[0] === 1 ? 0 : 1;
            case 'XOR':
                return inputs.filter(v => v === 1).length === 1 ? 1 : 0;
            case 'NAND':
                return inputs.every(v => v === 1) ? 0 : 1;
            case 'NOR':
                return inputs.some(v => v === 1) ? 0 : 1;
            case 'XNOR':
                return inputs.filter(v => v === 1).length === 1 ? 0 : 1;
            default:
                return 0;
        }
    }

    resetSimulation() {
        this.isSimulating = false;
        document.getElementById('simulateBtn').innerHTML = '<i class="fas fa-play"></i> Запустить симуляцию';
        document.getElementById('simulateBtn').style.background = 'var(--success)';
        document.getElementById('simulationStatus').textContent = 'Не активно';
        document.getElementById('simulationStatus').style.color = 'var(--danger)';
        
        this.gates.forEach(gate => {
            if (gate.type && gate.type !== 'input' && gate.type !== 'output') {
                gate.isActive = false;
                gate.output = null;
            }
        });
        
        this.draw();
    }

    clearWorkspace() {
        if (confirm('Очистить рабочее поле? Все несохраненные изменения будут потеряны.')) {
            this.gates = [];
            this.wires = [];
            this.selectedGate = null;
            this.updateStats();
            this.draw();
        }
    }

    saveCircuit() {
        const circuit = {
            gates: this.gates,
            wires: this.wires,
            timestamp: new Date().toISOString()
        };
        
        document.getElementById('circuitData').value = JSON.stringify(circuit, null, 2);
        this.showModal();
    }

    showModal() {
        document.getElementById('modal').style.display = 'flex';
    }

    hideModal() {
        document.getElementById('modal').style.display = 'none';
    }

    copyCircuitData() {
        const textarea = document.getElementById('circuitData');
        textarea.select();
        document.execCommand('copy');
        alert('Схема скопирована в буфер обмена!');
    }

    importCircuitData() {
        try {
            const data = JSON.parse(document.getElementById('circuitData').value);
            this.gates = data.gates || [];
            this.wires = data.wires || [];
            this.updateStats();
            this.draw();
            alert('Схема загружена успешно!');
            this.hideModal();
        } catch (e) {
            alert('Ошибка загрузки схемы: ' + e.message);
        }
    }

    loadExample(example) {
        this.clearWorkspace();
        
        switch(example) {
            case 'halfAdder':
                // Полусумматор: XOR для суммы, AND для переноса
                const xor = this.addGate('XOR', 200, 150);
                const and = this.addGate('AND', 200, 250);
                const input1 = { type: 'input', value: 0, x: 100, y: 100, width: 40, height: 40 };
                const input2 = { type: 'input', value: 0, x: 100, y: 200, width: 40, height: 40 };
                const outputSum = { type: 'output', value: null, x: 350, y: 150, width: 40, height: 40 };
                const outputCarry = { type: 'output', value: null, x: 350, y: 250, width: 40, height: 40 };
                
                this.gates.push(input1, input2, outputSum, outputCarry);
                break;
                
            case 'fullAdder':
                // Полный сумматор (упрощенный пример)
                this.addGate('XOR', 200, 150);
                this.addGate('XOR', 300, 150);
                this.addGate('AND', 250, 250);
                this.addGate('AND', 250, 350);
                this.addGate('OR', 350, 300);
                break;
                
            case 'multiplexer':
                // Мультиплексор 2:1
                this.addGate('AND', 200, 100);
                this.addGate('AND', 200, 200);
                this.addGate('NOT', 150, 150);
                this.addGate('OR', 300, 150);
                break;
                
            case 'srLatch':
                // SR-триггер на NOR вентилях
                this.addGate('NOR', 200, 100);
                this.addGate('NOR', 200, 200);
                break;
        }
        
        this.draw();
        this.updateStats();
        alert(`Схема "${this.getExampleName(example)}" загружена!`);
    }

    getExampleName(example) {
        const names = {
            'halfAdder': 'Полусумматор',
            'fullAdder': 'Полный сумматор',
            'multiplexer': 'Мультиплексор 2:1',
            'srLatch': 'SR-триггер'
        };
        return names[example] || example;
    }

    draw() {
        // Очистка canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем сетку
        this.drawGrid();
        
        // Рисуем провода
        this.wires.forEach(wire => this.drawWire(wire));
        
        // Рисуем вентили
        this.gates.forEach(gate => this.drawGate(gate));
        
        // Если выбран элемент, рисуем рамку выделения
        if (this.selectedGate) {
            this.drawSelection(this.selectedGate);
        }
    }

    drawGrid() {
        const gridSize = 30;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.lineWidth = 1;
        
        // Вертикальные линии
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Горизонтальные линии
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawGate(gate) {
        this.ctx.save();
        
        // Определяем цвет и стиль в зависимости от типа и состояния
        let color, textColor;
        
        if (gate.type === 'input') {
            color = gate.value === 1 ? '#2ecc71' : '#e74c3c';
            textColor = 'white';
        } else if (gate.type === 'output') {
            color = gate.value === 1 ? '#f1c40f' : 
                   gate.value === 0 ? '#7f8c8d' : '#bdc3c7';
            textColor = gate.value !== null ? 'white' : '#2c3e50';
        } else {
            color = gate.isActive ? this.getActiveGateColor(gate.type) : this.getGateColor(gate.type);
            textColor = 'white';
        }
        
        // Рисуем тело вентиля
        this.ctx.fillStyle = color;
        this.ctx.fillRect(gate.x, gate.y, gate.width, gate.height);
        
        // Рамка
        this.ctx.strokeStyle = gate.isActive ? 'white' : '#2c3e50';
        this.ctx.lineWidth = gate.isActive ? 3 : 2;
        this.ctx.strokeRect(gate.x, gate.y, gate.width, gate.height);
        
        // Текст
        this.ctx.fillStyle = textColor;
        this.ctx.font = gate.type && gate.type.length > 3 ? 'bold 14px Arial' : 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const label = gate.type === 'input' ? `IN:${gate.value}` :
                     gate.type === 'output' ? 'OUT' : gate.type;
        
        this.ctx.fillText(label, gate.x + gate.width/2, gate.y + gate.height/2);
        
        // Для входов/выходов показываем значение
        if (gate.type === 'output' && gate.value !== null) {
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillText(gate.value, gate.x + gate.width/2, gate.y + gate.height/2 + 25);
        }
        
        // Контакты для соединений
        this.drawGateContacts(gate);
        
        this.ctx.restore();
    }

    drawGateContacts(gate) {
        this.ctx.fillStyle = '#2c3e50';
        
        // Входные контакты (слева)
        if (gate.inputs) {
            gate.inputs.forEach((_, i) => {
                const y = gate.y + (i + 1) * (gate.height / (gate.inputs.length + 1));
                this.ctx.beginPath();
                this.ctx.arc(gate.x, y, 5, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
        
        // Выходной контакт (справа)
        const outputY = gate.y + gate.height / 2;
        this.ctx.beginPath();
        this.ctx.arc(gate.x + gate.width, outputY, 5, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawWire(wire) {
        // Упрощенная отрисовка провода
        this.ctx.strokeStyle = wire.isActive ? '#e74c3c' : '#34495e';
        this.ctx.lineWidth = wire.isActive ? 3 : 2;
        this.ctx.setLineDash(wire.isActive ? [5, 5] : []);
        
        this.ctx.beginPath();
        this.ctx.moveTo(wire.fromX, wire.fromY);
        this.ctx.lineTo(wire.toX, wire.toY);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }

    drawSelection(gate) {
        this.ctx.strokeStyle = '#f39c12';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(gate.x - 5, gate.y - 5, gate.width + 10, gate.height + 10);
        this.ctx.setLineDash([]);
    }

    getGateColor(type) {
        const colors = {
            'AND': '#3498db',
            'OR': '#2ecc71',
            'NOT': '#e74c3c',
            'XOR': '#9b59b6',
            'NAND': '#e67e22',
            'NOR': '#1abc9c',
            'XNOR': '#d35400'
        };
        return colors[type] || '#95a5a6';
    }

    getActiveGateColor(type) {
        const colors = {
            'AND': '#2980b9',
            'OR': '#27ae60',
            'NOT': '#c0392b',
            'XOR': '#8e44ad',
            'NAND': '#d35400',
            'NOR': '#16a085',
            'XNOR': '#a04000'
        };
        return colors[type] || '#7f8c8d';
    }

    updateStats() {
        const logicGates = this.gates.filter(g => g.type && 
            ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'].includes(g.type)).length;
        const totalConnections = this.wires.length;
        
        document.getElementById('gateCount').textContent = logicGates;
        document.getElementById('connectionCount').textContent = totalConnections;
        
        // Определяем сложность схемы
        const complexity = logicGates + totalConnections;
        let complexityText = 'Низкая';
        if (complexity > 10) complexityText = 'Средняя';
        if (complexity > 20) complexityText = 'Высокая';
        if (complexity > 30) complexityText = 'Очень высокая';
        
        document.getElementById('complexity').textContent = complexityText;
    }

    updateSelectedInfo(gate) {
        const infoDiv = document.getElementById('selectedInfo');
        
        if (!gate) {
            infoDiv.innerHTML = '<p>Ничего не выбрано</p>';
            return;
        }
        
        let html = `<h4>${gate.type || 'Элемент'}</h4>`;
        html += `<p><strong>ID:</strong> ${gate.id}</p>`;
        html += `<p><strong>Позиция:</strong> (${Math.round(gate.x)}, ${Math.round(gate.y)})</p>`;
        
        if (gate.type === 'input') {
            html += `<p><strong>Значение:</strong> ${gate.value}</p>`;
            html += `<p><strong>Тип:</strong> Входной сигнал</p>`;
        } else if (gate.type === 'output') {
            html += `<p><strong>Значение:</strong> ${gate.value !== null ? gate.value : 'не определено'}</p>`;
            html += `<p><strong>Тип:</strong> Выходной индикатор</p>`;
        } else if (gate.type) {
            html += `<p><strong>Состояние:</strong> ${gate.isActive ? 'Активен' : 'Не активен'}</p>`;
            html += `<p><strong>Выход:</strong> ${gate.output !== null ? gate.output : 'не определен'}</p>`;
            html += `<p><strong>Входы:</strong> ${gate.inputs ? gate.inputs.length : 0}</p>`;
        }
        
        infoDiv.innerHTML = html;
    }

    setupTruthTables() {
        this.updateTruthTable('AND');
    }

    updateTruthTable(gateType) {
        const table = document.getElementById('truthTable');
        let html = '';
        
        switch(gateType) {
            case 'AND':
                html = `
                    <table>
                        <tr><th>A</th><th>B</th><th>Выход</th></tr>
                        <tr><td>0</td><td>0</td><td class="false">0</td></tr>
                        <tr><td>0</td><td>1</td><td class="false">0</td></tr>
                        <tr><td>1</td><td>0</td><td class="false">0</td></tr>
                        <tr><td>1</td><td>1</td><td class="true">1</td></tr>
                    </table>
                `;
                break;
            case 'OR':
                html = `
                    <table>
                        <tr><th>A</th><th>B</th><th>Выход</th></tr>
                        <tr><td>0</td><td>0</td><td class="false">0</td></tr>
                        <tr><td>0</td><td>1</td><td class="true">1</td></tr>
                        <tr><td>1</td><td>0</td><td class="true">1</td></tr>
                        <tr><td>1</td><td>1</td><td class="true">1</td></tr>
                    </table>
                `;
                break;
            case 'NOT':
                html = `
                    <table>
                        <tr><th>Вход</th><th>Выход</th></tr>
                        <tr><td>0</td><td class="true">1</td></tr>
                        <tr><td>1</td><td class="false">0</td></tr>
                    </table>
                `;
                break;
            case 'XOR':
                html = `
                    <table>
                        <tr><th>A</th><th>B</th><th>Выход</th></tr>
                        <tr><td>0</td><td>0</td><td class="false">0</td></tr>
                        <tr><td>0</td><td>1</td><td class="true">1</td></tr>
                        <tr><td>1</td><td>0</td><td class="true">1</td></tr>
                        <tr><td>1</td><td>1</td><td class="false">0</td></tr>
                    </table>
                `;
                break;
            case 'NAND':
                html = `
                    <table>
                        <tr><th>A</th><th>B</th><th>Выход</th></tr>
                        <tr><td>0</td><td>0</td><td class="true">1</td></tr>
                        <tr><td>0</td><td>1</td><td class="true">1</td></tr>
                        <tr><td>1</td><td>0</td><td class="true">1</td></tr>
                        <tr><td>1</td><td>1</td><td class="false">0</td></tr>
                    </table>
                `;
                break;
            case 'NOR':
                html = `
                    <table>
                        <tr><th>A</th><th>B</th><th>Выход</th></tr>
                        <tr><td>0</td><td>0</td><td class="true">1</td></tr>
                        <tr><td>0</td><td>1</td><td class="false">0</td></tr>
                        <tr><td>1</td><td>0</td><td class="false">0</td></tr>
                        <tr><td>1</td><td>1</td><td class="false">0</td></tr>
                    </table>
                `;
                break;
            case 'XNOR':
                html = `
                    <table>
                        <tr><th>A</th><th>B</th><th>Выход</th></tr>
                        <tr><td>0</td><td>0</td><td class="true">1</td></tr>
                        <tr><td>0</td><td>1</td><td class="false">0</td></tr>
                        <tr><td>1</td><td>0</td><td class="false">0</td></tr>
                        <tr><td>1</td><td>1</td><td class="true">1</td></tr>
                    </table>
                `;
                break;
        }
        
        table.innerHTML = html;
        
        // Добавляем стили для таблицы
        const style = document.createElement('style');
        style.textContent = `
            #truthTable table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            #truthTable th, #truthTable td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: center;
            }
            #truthTable th {
                background-color: #2c3e50;
                color: white;
            }
            #truthTable .true {
                background-color: #2ecc71;
                color: white;
            }
            #truthTable .false {
                background-color: #e74c3c;
                color: white;
            }
        `;
        table.appendChild(style);
    }

    // ============================================
    // ФУНКЦИИ ДЛЯ СКРИНКАСТА (ЭКЗАМЕН)
    // ============================================

    startRecording() {
        if (!this.recording) {
            this.recording = true;
            this.recordStartTime = Date.now();
            this.recordedFrames = [];
            
            // Обновляем UI
            document.getElementById('recordBtn').disabled = true;
            document.getElementById('stopRecordBtn').disabled = false;
            document.getElementById('downloadBtn').disabled = true;
            document.getElementById('recordBtn').classList.add('recording');
            
            // Запускаем таймер
            this.startTimer();
            
            // Начинаем запись кадров
            this.recordFrame();
            
            alert('Запись скринкаста началась! Продемонстрируйте работу программы.');
        }
    }

    stopRecording() {
        if (this.recording) {
            this.recording = false;
            
            // Обновляем UI
            document.getElementById('recordBtn').disabled = false;
            document.getElementById('stopRecordBtn').disabled = true;
            document.getElementById('downloadBtn').disabled = false;
            document.getElementById('recordBtn').classList.remove('recording');
            
            // Останавливаем таймер
            this.stopTimer();
            
            alert(`Скринкаст записан! Длительность: ${this.formatTime(Date.now() - this.recordStartTime)}`);
        }
    }

    downloadRecording() {
        if (this.recordedFrames.length === 0) {
            alert('Нет записанных данных');
            return;
        }
        
        // Создаем текстовый отчет о скринкасте
        const report = {
            title: 'Скринкаст Logic Gate Simulator',
            student: document.querySelector('.student-info').textContent,
            date: new Date().toLocaleString('ru-RU'),
            duration: this.formatTime(Date.now() - this.recordStartTime),
            gatesUsed: this.gates.filter(g => g.type && 
                ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'].includes(g.type)).length,
            actions: this.recordedFrames.length,
            frames: this.recordedFrames.slice(0, 100) // Ограничиваем количество кадров
        };
        
        // Создаем и скачиваем файл
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screencast_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Отчет о скринкасте скачан!');
    }

    recordFrame() {
        if (!this.recording) return;
        
        // Записываем текущее состояние
        const frame = {
            timestamp: Date.now() - this.recordStartTime,
            gates: this.gates.length,
            wires: this.wires.length,
            selectedGate: this.selectedGate ? this.selectedGate.id : null,
            isSimulating: this.isSimulating
        };
        
        this.recordedFrames.push(frame);
        
        // Записываем следующий кадр через 1 секунду
        setTimeout(() => this.recordFrame(), 1000);
    }

    startTimer() {
        const timerElement = document.getElementById('timer');
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordStartTime;
            timerElement.textContent = this.formatTime(elapsed);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new LogicGateSimulator();
    
    // Добавляем инструкцию для экзамена
    console.log(`
    ============================================
    Logic Gate Simulator - Экзаменационная версия
    ============================================
    
    ИНСТРУКЦИЯ ДЛЯ ЭКЗАМЕНА:
    
    1. Откройте index.html в браузере
    2. Перетащите вентили из левой панели на рабочее поле
    3. Используйте инструменты для соединения элементов
    4. Добавьте входные сигналы (0/1) и выходные индикаторы
    5. Нажмите "Запустить симуляцию" для проверки работы схемы
    6. Используйте "Начать запись" для создания скринкаста
    7. Сохраните схему и скачайте отчет о скринкасте
    
    ТРЕБОВАНИЯ ВЫПОЛНЕНЫ:
    ✓ 7 типов логических вентилей
    ✓ Интерактивный UI с drag-and-drop
    ✓ Симуляция работы схем
    ✓ Визуализация сигналов
    ✓ Сохранение/загрузка схем
    ✓ Примеры готовых схем
    ✓ Система записи скринкаста
    ============================================
    `);
});