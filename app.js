let state = {
    profile: JSON.parse(localStorage.getItem('fitTrack_profile')) || { age: '', gender: 'M', height: 175 },
    metrics: JSON.parse(localStorage.getItem('fitTrack_metrics')) || [],
    workouts: JSON.parse(localStorage.getItem('fitTrack_workouts')) || []
};

let weightChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();
    updateDashboard();
    initChart();
});

// Navegación con efectos visuales
function switchTab(tabId) {
    // Esconder todas las pestañas
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Mostrar la seleccionada
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Actualizar botones del menú inferior
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-emerald-400', 'bg-slate-800/50');
        btn.classList.add('text-slate-400');
        if(btn.dataset.target === tabId) {
            btn.classList.remove('text-slate-400');
            btn.classList.add('text-emerald-400', 'bg-slate-800/50');
        }
    });

    if (tabId === 'dashboard') updateDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    showToast('Perfil actualizado correctamente');
});

document.getElementById('metrics-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const weight = parseFloat(document.getElementById('metric-weight').value);
    const date = new Date().toISOString().split('T')[0];
    
    const existingIndex = state.metrics.findIndex(m => m.date === date);
    if(existingIndex >= 0) {
        state.metrics[existingIndex].weight = weight;
    } else {
        state.metrics.push({ date, weight });
    }
    
    saveData();
    showToast('Peso registrado');
    updateDashboard();
    setTimeout(() => switchTab('dashboard'), 500);
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
    showToast('¡Serie guardada con éxito!');
    updateDashboard();
});

// Utilidades
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
        weightEl.innerHTML = `${latestMetric.weight} <span class="text-lg text-slate-500 font-normal">kg</span>`;
        
        if (state.profile.height) {
            const heightM = state.profile.height / 100;
            const imc = (latestMetric.weight / (heightM * heightM)).toFixed(1);
            imcEl.textContent = imc;
            
            // Colores comerciales para IMC
            if(imc < 18.5) { imcEl.className = 'text-3xl font-bold text-cyan-400'; imcLabel.textContent = 'Bajo peso'; }
            else if(imc < 24.9) { imcEl.className = 'text-3xl font-bold text-emerald-400'; imcLabel.textContent = 'Saludable'; }
            else if(imc < 29.9) { imcEl.className = 'text-3xl font-bold text-amber-400'; imcLabel.textContent = 'Sobrepeso'; }
            else { imcEl.className = 'text-3xl font-bold text-rose-500'; imcLabel.textContent = 'Obesidad'; }
        }
    }

    // Historial con diseño de tarjetas pequeñas
    const historyContainer = document.getElementById('workout-history');
    historyContainer.innerHTML = '';
    const recentWorkouts = state.workouts.slice(0, 5);
    
    if(recentWorkouts.length === 0) {
        historyContainer.innerHTML = '<div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500">Aún no hay entrenamientos registrados</div>';
    } else {
        recentWorkouts.forEach(w => {
            historyContainer.innerHTML += `
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center hover:border-slate-700 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                            <i class="fa-solid fa-dumbbell text-sm"></i>
                        </div>
                        <div>
                            <p class="font-bold text-white text-sm">${w.exercise}</p>
                            <p class="text-xs text-slate-500">${w.date}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-1 px-3 rounded-lg font-bold text-sm">
                            ${w.weight}kg &times; ${w.reps}
                        </span>
                    </div>
                </div>
            `;
        });
    }
    updateChart();
}

function initChart() {
    const ctx = document.getElementById('weightChart').getContext('2d');
    
    // Crear gradiente para la gráfica
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); // Emerald 500 transparente
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: [], 
            datasets: [{ 
                label: 'Peso', 
                data: [], 
                borderColor: '#10b981', // Emerald 500
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#020617',
                pointBorderColor: '#10b981',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.4 // Curvas suaves
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748b' } },
                y: { grid: { color: '#1e293b', borderDash: [5, 5] }, border: { display: false }, ticks: { color: '#64748b' } }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
    updateChart();
}

function updateChart() {
    if(!weightChartInstance || state.metrics.length === 0) return;
    
    const recentMetrics = state.metrics.slice(-7);
    weightChartInstance.data.labels = recentMetrics.map(m => m.date.slice(5));
    weightChartInstance.data.datasets[0].data = recentMetrics.map(m => m.weight);
    weightChartInstance.update();
}

// Pequeño sistema de notificaciones (Toast)
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-5 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl border border-slate-700 z-[100] text-sm font-medium transition-all duration-300 translate-y-[-20px] opacity-0';
    toast.textContent = msg;
    document.body.appendChild(toast);
    
    setTimeout(() => { toast.classList.remove('translate-y-[-20px]', 'opacity-0'); }, 10);
    setTimeout(() => { 
        toast.classList.add('translate-y-[-20px]', 'opacity-0'); 
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
