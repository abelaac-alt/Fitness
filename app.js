// Estado inicial
let state = {
    profile: JSON.parse(localStorage.getItem('fitTrack_profile')) || { age: '', gender: 'M', height: 175 },
    metrics: JSON.parse(localStorage.getItem('fitTrack_metrics')) || [],
    workouts: JSON.parse(localStorage.getItem('fitTrack_workouts')) || []
};

let weightChartInstance = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();
    updateDashboard();
    initChart();
});

// Navegación
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-600');
        btn.classList.add('text-slate-400');
        if(btn.dataset.target === tabId) {
            btn.classList.remove('text-slate-400');
            btn.classList.add('text-blue-600');
        }
    });

    if (tabId === 'dashboard') updateDashboard();
}

// Formularios
document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.profile = {
        age: document.getElementById('profile-age').value,
        gender: document.getElementById('profile-gender').value,
        height: document.getElementById('profile-height').value
    };
    saveData();
    alert('Perfil actualizado');
});

document.getElementById('metrics-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const weight = parseFloat(document.getElementById('metric-weight').value);
    const date = new Date().toISOString().split('T')[0];
    
    // Evitar duplicados el mismo día
    const existingIndex = state.metrics.findIndex(m => m.date === date);
    if(existingIndex >= 0) {
        state.metrics[existingIndex].weight = weight;
    } else {
        state.metrics.push({ date, weight });
    }
    
    saveData();
    alert('Medición registrada');
    updateDashboard();
    switchTab('dashboard');
});

document.getElementById('workout-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const workout = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        exercise: document.getElementById('exercise-name').value,
        weight: parseFloat(document.getElementById('exercise-weight').value),
        reps: parseInt(document.getElementById('exercise-reps').value)
    };
    
    state.workouts.unshift(workout);
    saveData();
    e.target.reset();
    alert('Serie guardada');
});

// Funciones de utilidad y UI
function saveData() {
    localStorage.setItem('fitTrack_profile', JSON.stringify(state.profile));
    localStorage.setItem('fitTrack_metrics', JSON.stringify(state.metrics));
    localStorage.setItem('fitTrack_workouts', JSON.stringify(state.workouts));
}

function loadProfileData() {
    if(state.profile.age) document.getElementById('profile-age').value = state.profile.age;
    if(state.profile.gender) document.getElementById('profile-gender').value = state.profile.gender;
    if(state.profile.height) document.getElementById('profile-height').value = state.profile.height;
    
    const latestMetric = state.metrics[state.metrics.length - 1];
    if(latestMetric) document.getElementById('metric-weight').value = latestMetric.weight;
}

function updateDashboard() {
    const latestMetric = state.metrics[state.metrics.length - 1];
    const weightEl = document.getElementById('dashboard-peso');
    const imcEl = document.getElementById('dashboard-imc');
    const imcLabel = document.getElementById('dashboard-imc-label');

    if (latestMetric) {
        weightEl.textContent = `${latestMetric.weight} kg`;
        
        if (state.profile.height) {
            const heightM = state.profile.height / 100;
            const imc = (latestMetric.weight / (heightM * heightM)).toFixed(1);
            imcEl.textContent = imc;
            
            let status = '';
            if(imc < 18.5) { status = 'Bajo peso'; imcEl.className = 'text-2xl font-bold text-yellow-500'; }
            else if(imc < 24.9) { status = 'Saludable'; imcEl.className = 'text-2xl font-bold text-green-500'; }
            else if(imc < 29.9) { status = 'Sobrepeso'; imcEl.className = 'text-2xl font-bold text-orange-500'; }
            else { status = 'Obesidad'; imcEl.className = 'text-2xl font-bold text-red-500'; }
            
            imcLabel.textContent = status;
        }
    }

    // Actualizar historial
    const historyContainer = document.getElementById('workout-history');
    historyContainer.innerHTML = '';
    const recentWorkouts = state.workouts.slice(0, 5);
    
    if(recentWorkouts.length === 0) {
        historyContainer.innerHTML = '<p class="text-slate-400">Aún no hay entrenamientos.</p>';
    } else {
        recentWorkouts.forEach(w => {
            historyContainer.innerHTML += `
                <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div>
                        <p class="font-semibold text-slate-700">${w.exercise}</p>
                        <p class="text-xs text-slate-400">${w.date}</p>
                    </div>
                    <div class="text-right">
                        <span class="bg-blue-100 text-blue-700 py-1 px-2 rounded font-bold">${w.weight} kg x ${w.reps}</span>
                    </div>
                </div>
            `;
        });
    }

    updateChart();
}

function initChart() {
    const ctx = document.getElementById('weightChart').getContext('2d');
    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Peso (kg)', data: [], borderColor: '#3b82f6', tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    updateChart();
}

function updateChart() {
    if(!weightChartInstance) return;
    
    // Tomar los últimos 6 meses/registros
    const recentMetrics = state.metrics.slice(-6);
    weightChartInstance.data.labels = recentMetrics.map(m => m.date.slice(5)); // Mostrar MM-DD
    weightChartInstance.data.datasets[0].data = recentMetrics.map(m => m.weight);
    weightChartInstance.update();
}
