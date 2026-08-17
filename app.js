const exercisesDB = {
    "Pecho": ["Press de Banca Plana", "Press Inclinado con Mancuernas", "Aperturas con Mancuernas", "Cruce de Poleas", "Flexiones (Push-ups)", "Peck Deck / Máquina"],
    "Espalda": ["Dominadas", "Remo con Barra", "Remo con Mancuerna", "Jalón al Pecho", "Pullover en polea", "Peso Muerto", "Remo Gironda"],
    "Piernas": ["Sentadilla Libre", "Prensa Inclinada", "Extensiones de Cuádriceps", "Curl Femoral Tumbado", "Peso Muerto Rumano", "Elevación de Talones (Gemelos)", "Zancadas (Lunges)", "Hip Thrust"],
    "Hombros": ["Press Militar con Barra", "Press con Mancuernas", "Elevaciones Laterales", "Elevaciones Frontales", "Pájaros (Posterior)", "Encogimientos (Trapecios)"],
    "Brazos": ["Curl de Bíceps con Barra", "Curl Martillo", "Curl Predicador", "Extensiones de Tríceps en Polea", "Press Francés", "Fondos de Tríceps", "Curl Araña"],
    "Core": ["Crunch Abdominal", "Plancha (Plank)", "Rueda Abdominal", "Elevación de Piernas Colgado", "Twist Ruso", "Máquina de Abdomen"]
};

let state = {
    profile: JSON.parse(localStorage.getItem('fitTrack_profile')) || { age: '', gender: 'M', height: 175, weight: 80 },
    workouts: JSON.parse(localStorage.getItem('fitTrack_workouts')) || []
};

let progressChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();
    setupExerciseDropdowns();
    setDefaultDate();
    updateDashboard();
    initChart();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
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

function setupExerciseDropdowns() {
    const catSelect = document.getElementById('exercise-category');
    const exSelect = document.getElementById('exercise-name');
    
    catSelect.innerHTML = '<option value="" disabled selected>Selecciona un grupo...</option>';
    Object.keys(exercisesDB).forEach(cat => {
        catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    catSelect.addEventListener('change', (e) => {
        const category = e.target.value;
        exSelect.innerHTML = '<option value="" disabled selected>Selecciona un ejercicio...</option>';
        if(category) {
            exSelect.disabled = false;
            exSelect.classList.remove('opacity-50');
            exercisesDB[category].forEach(ex => {
                exSelect.innerHTML += `<option value="${ex}">${ex}</option>`;
            });
        }
    });
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('workout-date').value = today;
}

// Formularios
document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.profile = {
        age: document.getElementById('profile-age').value,
        gender: document.getElementById('profile-gender').value,
        height: document.getElementById('profile-height').value,
        weight: document.getElementById('profile-weight').value
    };
    saveData();
    showToast('Perfil actualizado correctamente');
});

document.getElementById('workout-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const workout = {
        id: Date.now(),
        date: document.getElementById('workout-date').value,
        duration: parseInt(document.getElementById('workout-duration').value),
        category: document.getElementById('exercise-category').value,
        exercise: document.getElementById('exercise-name').value,
        sets: parseInt(document.getElementById('exercise-sets').value),
        reps: parseInt(document.getElementById('exercise-reps').value),
        weight: parseFloat(document.getElementById('exercise-weight').value)
    };
    
    state.workouts.unshift(workout);
    // Sort workouts by date descending
    state.workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    saveData();
    
    // Reset solo los campos de repeticiones y peso para facilitar seguir añadiendo
    document.getElementById('exercise-sets').value = '';
    document.getElementById('exercise-reps').value = '';
    document.getElementById('exercise-weight').value = '';
    
    showToast('Serie guardada con éxito');
    updateDashboard();
});

// Utilidades
function saveData() {
    localStorage.setItem('fitTrack_profile', JSON.stringify(state.profile));
    localStorage.setItem('fitTrack_workouts', JSON.stringify(state.workouts));
}

function loadProfileData() {
    if(state.profile.age) document.getElementById('profile-age').value = state.profile.age;
    if(state.profile.gender) document.getElementById('profile-gender').value = state.profile.gender;
    if(state.profile.height) document.getElementById('profile-height').value = state.profile.height;
    if(state.profile.weight) document.getElementById('profile-weight').value = state.profile.weight;
}

function clearData() {
    if(confirm('¿Estás seguro de que quieres borrar todo tu historial? Esta acción no se puede deshacer.')) {
        localStorage.clear();
        state.workouts = [];
        updateDashboard();
        showToast('Datos borrados');
    }
}

function updateDashboard() {
    // Cálculos de Resumen
    let totalVolume = 0;
    let uniqueDays = new Set();
    let totalDuration = 0;

    // Agrupar duración por día para no sumarla por cada serie
    let durationPerDay = {};

    state.workouts.forEach(w => {
        totalVolume += (w.sets * w.reps * w.weight);
        uniqueDays.add(w.date);
        
        if(!durationPerDay[w.date] || w.duration > durationPerDay[w.date]) {
            durationPerDay[w.date] = w.duration;
        }
    });

    for(let date in durationPerDay) {
        totalDuration += durationPerDay[date];
    }

    const hours = (totalDuration / 60).toFixed(1);
    
    // Formatear volumen grande
    let formattedVolume = totalVolume > 1000 ? (totalVolume/1000).toFixed(1) + 'k' : totalVolume;

    document.getElementById('dashboard-volume').innerHTML = `${formattedVolume} <span class="text-lg text-slate-500 font-normal">kg</span>`;
    document.getElementById('dashboard-time').innerHTML = `${hours} <span class="text-lg text-slate-500 font-normal">h</span>`;

    // Historial con diseño de tarjetas pequeñas agrupadas
    const historyContainer = document.getElementById('workout-history');
    historyContainer.innerHTML = '';
    const recentWorkouts = state.workouts.slice(0, 10);
    
    if(recentWorkouts.length === 0) {
        historyContainer.innerHTML = '<div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500">Aún no hay entrenamientos registrados</div>';
    } else {
        recentWorkouts.forEach(w => {
            const vol = w.sets * w.reps * w.weight;
            historyContainer.innerHTML += `
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded mb-1 inline-block">${w.category}</span>
                            <p class="font-bold text-white text-sm leading-tight">${w.exercise}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-slate-500 mb-1"><i class="fa-regular fa-calendar mr-1"></i>${w.date}</p>
                            <span class="bg-slate-800 text-slate-300 py-1 px-2 rounded-lg font-bold text-xs border border-slate-700">
                                ${w.sets}x${w.reps} @ ${w.weight}kg
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    updateChart();
}

function initChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    
    // Gradiente para el área
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.6)'); 
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    progressChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ 
            label: 'Volumen (kg)', 
            data: [], 
            borderColor: '#10b981', 
            backgroundColor: gradient,
            borderWidth: 3,
            pointBackgroundColor: '#020617',
            pointBorderColor: '#10b981',
            pointBorderWidth: 2,
            pointRadius: 4,
            fill: true,
            tension: 0.4
        }]},
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    mode: 'index', 
                    intersect: false,
                    backgroundColor: 'rgba(2, 6, 23, 0.9)',
                    titleColor: '#cbd5e1',
                    bodyColor: '#10b981',
                    borderColor: '#1e293b',
                    borderWidth: 1,
                    padding: 10
                } 
            },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748b', maxRotation: 0 } },
                y: { grid: { color: '#1e293b', borderDash: [5, 5] }, border: { display: false }, ticks: { color: '#64748b' }, beginAtZero: true }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
    updateChart();
}

function updateChart() {
    if(!progressChartInstance || state.workouts.length === 0) return;
    
    // Agrupar volumen por fecha
    let volumePerDate = {};
    // Sort temporal ascending for chart
    let sortedWorkouts = [...state.workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedWorkouts.forEach(w => {
        if(!volumePerDate[w.date]) volumePerDate[w.date] = 0;
        volumePerDate[w.date] += (w.sets * w.reps * w.weight);
    });

    const dates = Object.keys(volumePerDate).slice(-7); // Últimos 7 días activos
    const volumes = dates.map(d => volumePerDate[d]);

    progressChartInstance.data.labels = dates.map(d => d.slice(5)); // Mostrar MM-DD
    progressChartInstance.data.datasets[0].data = volumes;
    progressChartInstance.update();
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-5 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl border border-emerald-500/30 z-[100] text-sm font-medium transition-all duration-300 translate-y-[-20px] opacity-0 flex items-center gap-2';
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> ${msg}`;
    document.body.appendChild(toast);
    
    setTimeout(() => { toast.classList.remove('translate-y-[-20px]', 'opacity-0'); }, 10);
    setTimeout(() => { 
        toast.classList.add('translate-y-[-20px]', 'opacity-0'); 
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
