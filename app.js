// --- DATABASE ---
const db = {
    "Pecho": ["Press de Banca", "Press Inclinado", "Aperturas con Mancuernas", "Cruce de Poleas", "Flexiones", "Peck Deck"],
    "Espalda": ["Dominadas", "Remo con Barra", "Jalón al Pecho", "Remo en Punta", "Peso Muerto", "Pullover en Polea"],
    "Piernas": ["Sentadilla Libre", "Prensa", "Extensión de Cuádriceps", "Curl Femoral", "Peso Muerto Rumano", "Elevación de Gemelos", "Hip Thrust"],
    "Hombros": ["Press Militar", "Elevaciones Laterales", "Pájaros", "Elevaciones Frontales", "Encogimientos"],
    "Brazos": ["Curl de Bíceps", "Curl Martillo", "Extensión de Tríceps Polea", "Press Francés", "Fondos de Tríceps"],
    "Core": ["Crunch Abdominal", "Plancha (Plank)", "Rueda Abdominal", "Elevación de Piernas"]
};

// --- STATE ---
let state = {
    profile: JSON.parse(localStorage.getItem('fitTrackPro_profile')) || { weight: 80, height: 175 },
    workouts: JSON.parse(localStorage.getItem('fitTrackPro_workouts')) || []
};

// Active Workout State
let activeWorkout = null; 
// Structure: { startTime, name, exercises: [ { name, category, sets: [ { kg, reps, done } ] } ] }
let workoutTimerInterval = null;
let workoutSeconds = 0;

// Rest Timer State
let restTimerSeconds = 0;
let restTimerInterval = null;
const DEFAULT_REST = 90; // 90 seconds default

let chartInstance = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadProfile();
    renderDashboard();
    initChart();
    
    // Search listener for modal
    document.getElementById('exercise-search').addEventListener('input', (e) => {
        renderExerciseList(e.target.value);
    });
}

// --- NAVIGATION ---
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-emerald-400');
        btn.classList.add('text-slate-500');
        if(btn.dataset.target === viewId) {
            btn.classList.remove('text-slate-500');
            btn.classList.add('text-emerald-400');
        }
    });

    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'history') renderHistory();
}

// --- ACTIVE WORKOUT LOGIC ---

function startWorkout() {
    activeWorkout = {
        id: Date.now(),
        startTime: Date.now(),
        name: "Entrenamiento de hoy",
        exercises: []
    };
    workoutSeconds = 0;
    document.getElementById('workout-name-input').value = activeWorkout.name;
    document.getElementById('workout-timer-display').innerText = "00:00";
    
    // Start global timer
    clearInterval(workoutTimerInterval);
    workoutTimerInterval = setInterval(() => {
        workoutSeconds++;
        const m = String(Math.floor(workoutSeconds / 60)).padStart(2, '0');
        const s = String(workoutSeconds % 60).padStart(2, '0');
        document.getElementById('workout-timer-display').innerText = `${m}:${s}`;
    }, 1000);

    renderWorkoutCanvas();
    
    // Show Fullscreen UI
    const ui = document.getElementById('workout-active-view');
    ui.classList.remove('hidden');
    ui.classList.add('flex');
}

function finishWorkout() {
    if (activeWorkout.exercises.length === 0) {
        if(confirm("El entrenamiento está vacío. ¿Cancelar?")) {
            closeWorkoutUI();
        }
        return;
    }

    // Update name
    activeWorkout.name = document.getElementById('workout-name-input').value;
    activeWorkout.duration = Math.floor(workoutSeconds / 60); // in minutes
    activeWorkout.date = new Date().toISOString();

    // Clean up empty sets/exercises
    activeWorkout.exercises = activeWorkout.exercises.map(ex => {
        ex.sets = ex.sets.filter(s => s.done); // Only save completed sets
        return ex;
    }).filter(ex => ex.sets.length > 0);

    if (activeWorkout.exercises.length > 0) {
        state.workouts.unshift(activeWorkout);
        saveState();
        showToast("¡Entrenamiento guardado con éxito!");
    } else {
        showToast("Entrenamiento cancelado (sin series completadas)");
    }

    closeWorkoutUI();
    renderDashboard();
}

function closeWorkoutUI() {
    clearInterval(workoutTimerInterval);
    stopRestTimer();
    activeWorkout = null;
    const ui = document.getElementById('workout-active-view');
    ui.classList.add('hidden');
    ui.classList.remove('flex');
}

// --- EXERCISE MODAL ---

function openExerciseModal() {
    const modal = document.getElementById('exercise-modal');
    document.getElementById('exercise-search').value = '';
    renderExerciseList();
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'modal-enter');
    modal.classList.remove('modal-exit');
}

function closeExerciseModal() {
    const modal = document.getElementById('exercise-modal');
    modal.classList.add('modal-exit');
    modal.classList.remove('modal-enter');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function renderExerciseList(filter = '') {
    const container = document.getElementById('exercise-list-container');
    container.innerHTML = '';
    
    const term = filter.toLowerCase();

    Object.keys(db).forEach(category => {
        const exercises = db[category].filter(ex => ex.toLowerCase().includes(term));
        if (exercises.length === 0) return;

        // Group Header
        container.innerHTML += `<p class="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-2 mt-4">${category}</p>`;
        
        exercises.forEach(ex => {
            container.innerHTML += `
                <div onclick="addExerciseToWorkout('${ex}', '${category}')" class="bg-slate-800 p-4 rounded-xl mb-2 flex justify-between items-center active:bg-slate-700 transition cursor-pointer border border-slate-700">
                    <span class="font-semibold text-white">${ex}</span>
                    <i class="fa-solid fa-plus text-emerald-400"></i>
                </div>
            `;
        });
    });
}

function addExerciseToWorkout(name, category) {
    activeWorkout.exercises.push({
        name: name,
        category: category,
        sets: [ { kg: '', reps: '', done: false } ] // Start with 1 empty set
    });
    closeExerciseModal();
    renderWorkoutCanvas();
    
    // Scroll to bottom
    setTimeout(() => {
        const canvas = document.getElementById('workout-canvas');
        canvas.scrollTop = canvas.scrollHeight;
    }, 100);
}

// --- WORKOUT CANVAS RENDERING (THE CORE APP ENGINE) ---

function renderWorkoutCanvas() {
    const canvas = document.getElementById('workout-canvas');
    if (activeWorkout.exercises.length === 0) {
        canvas.innerHTML = `
            <div id="empty-workout-msg" class="text-center text-slate-500 mt-20">
                <i class="fa-solid fa-dumbbell text-5xl mb-4 opacity-20"></i>
                <p class="text-lg font-medium">Tu entrenamiento está vacío.</p>
                <p class="text-sm mt-1">Añade ejercicios para empezar a registrar.</p>
            </div>`;
        return;
    }

    canvas.innerHTML = '';

    activeWorkout.exercises.forEach((ex, exIndex) => {
        let setsHtml = '';
        ex.sets.forEach((set, setIndex) => {
            const isDone = set.done;
            const rowClass = isDone ? 'set-row done transition-colors' : 'set-row transition-colors';
            
            setsHtml += `
                <div class="grid grid-cols-[30px_1fr_1fr_40px] gap-3 items-center p-2 rounded-lg mb-1 ${rowClass}">
                    <div class="text-center font-bold text-slate-500 text-sm">${setIndex + 1}</div>
                    <div>
                        <input type="number" step="0.5" value="${set.kg}" onchange="updateSet(${exIndex}, ${setIndex}, 'kg', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-center text-white font-bold outline-none focus:border-emerald-500 placeholder-slate-600" placeholder="kg">
                    </div>
                    <div>
                        <input type="number" value="${set.reps}" onchange="updateSet(${exIndex}, ${setIndex}, 'reps', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-center text-white font-bold outline-none focus:border-emerald-500 placeholder-slate-600" placeholder="reps">
                    </div>
                    <div class="flex justify-center">
                        <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleSet(${exIndex}, ${setIndex})" class="set-checkbox">
                    </div>
                </div>
            `;
        });

        canvas.innerHTML += `
            <div class="bg-slate-800/80 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
                <div class="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">${ex.category}</p>
                        <h3 class="font-bold text-lg text-white leading-tight">${ex.name}</h3>
                    </div>
                    <button onclick="removeExercise(${exIndex})" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-400 transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                
                <div class="p-3">
                    <div class="grid grid-cols-[30px_1fr_1fr_40px] gap-3 mb-2 px-2">
                        <div class="text-center text-xs font-semibold text-slate-400 uppercase">Set</div>
                        <div class="text-center text-xs font-semibold text-slate-400 uppercase">kg</div>
                        <div class="text-center text-xs font-semibold text-slate-400 uppercase">Reps</div>
                        <div class="text-center text-xs font-semibold text-slate-400 uppercase"><i class="fa-solid fa-check"></i></div>
                    </div>
                    
                    ${setsHtml}
                    
                    <button onclick="addSet(${exIndex})" class="w-full mt-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 font-medium text-sm hover:bg-slate-700 transition">
                        + Añadir serie
                    </button>
                </div>
            </div>
        `;
    });
}

function addSet(exIndex) {
    const ex = activeWorkout.exercises[exIndex];
    // Copy prev set values if exists
    let prevKg = '';
    let prevReps = '';
    if (ex.sets.length > 0) {
        const last = ex.sets[ex.sets.length - 1];
        prevKg = last.kg;
        prevReps = last.reps;
    }
    ex.sets.push({ kg: prevKg, reps: prevReps, done: false });
    renderWorkoutCanvas();
}

function updateSet(exIndex, setIndex, field, value) {
    activeWorkout.exercises[exIndex].sets[setIndex][field] = value;
}

function toggleSet(exIndex, setIndex) {
    const set = activeWorkout.exercises[exIndex].sets[setIndex];
    set.done = !set.done;
    
    // Validate inputs silently
    if(set.done) {
        if(!set.kg) set.kg = '0';
        if(!set.reps) set.reps = '0';
    }

    renderWorkoutCanvas(); // Re-render to highlight row

    if (set.done) {
        startRestTimer(DEFAULT_REST);
    }
}

function removeExercise(exIndex) {
    if(confirm("¿Eliminar ejercicio?")) {
        activeWorkout.exercises.splice(exIndex, 1);
        renderWorkoutCanvas();
    }
}

// --- REST TIMER ---

function startRestTimer(seconds) {
    restTimerSeconds = seconds;
    const bubble = document.getElementById('rest-timer-bubble');
    const timeDisplay = document.getElementById('rest-timer-time');
    
    bubble.classList.remove('hidden');
    bubble.classList.add('flex');
    
    clearInterval(restTimerInterval);
    
    const tick = () => {
        if(restTimerSeconds <= 0) {
            stopRestTimer();
            // Vibrate if supported
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            showToast("¡Tiempo de descanso terminado!");
            return;
        }
        const m = String(Math.floor(restTimerSeconds / 60)).padStart(2, '0');
        const s = String(restTimerSeconds % 60).padStart(2, '0');
        timeDisplay.innerText = `${m}:${s}`;
        restTimerSeconds--;
    };
    
    tick(); // call immediately
    restTimerInterval = setInterval(tick, 1000);
}

function stopRestTimer() {
    clearInterval(restTimerInterval);
    document.getElementById('rest-timer-bubble').classList.add('hidden');
    document.getElementById('rest-timer-bubble').classList.remove('flex');
}


// --- DASHBOARD & HISTORY RENDERING ---

function renderDashboard() {
    let totalWorkouts = state.workouts.length;
    let totalVolume = 0;
    let volumePerDate = {};

    state.workouts.forEach(w => {
        const dStr = w.date.split('T')[0];
        if(!volumePerDate[dStr]) volumePerDate[dStr] = 0;
        
        w.exercises.forEach(ex => {
            ex.sets.forEach(set => {
                const vol = (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0);
                totalVolume += vol;
                volumePerDate[dStr] += vol;
            });
        });
    });

    // Format big numbers
    document.getElementById('stat-workouts').innerText = totalWorkouts;
    document.getElementById('stat-volume').innerText = totalVolume > 1000 ? (totalVolume/1000).toFixed(1) + 'k' : totalVolume;

    updateChart(volumePerDate);
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (state.workouts.length === 0) {
        list.innerHTML = '<div class="text-center p-10 text-slate-500 bg-slate-800/50 rounded-2xl border border-slate-700">Aún no hay historial.</div>';
        return;
    }

    state.workouts.forEach(w => {
        const dateObj = new Date(w.date);
        const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
        
        // Calculate volume for this specific workout
        let wVol = 0;
        let setCounts = 0;
        w.exercises.forEach(ex => {
            ex.sets.forEach(s => {
                wVol += (parseFloat(s.kg)||0) * (parseInt(s.reps)||0);
                setCounts++;
            });
        });

        // Generate small summary of exercises
        const exSummary = w.exercises.map(ex => `<span class="text-slate-400 text-xs mr-2 border border-slate-700 rounded px-1">${ex.sets.length}x ${ex.name}</span>`).join('');

        list.innerHTML += `
            <div class="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 shadow-md">
                <div class="flex justify-between items-start mb-3 border-b border-slate-700/50 pb-2">
                    <div>
                        <h4 class="font-bold text-white">${w.name}</h4>
                        <p class="text-xs text-emerald-400 font-medium mt-1"><i class="fa-regular fa-calendar mr-1"></i>${dateStr} &bull; <i class="fa-regular fa-clock mx-1"></i>${w.duration}m</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold text-slate-300">${wVol} kg</p>
                        <p class="text-xs text-slate-500">${setCounts} series</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-y-2 mt-2">
                    ${exSummary}
                </div>
            </div>
        `;
    });
}

// --- PROFILE ---
function loadProfile() {
    document.getElementById('profile-weight').value = state.profile.weight || '';
    document.getElementById('profile-height').value = state.profile.height || '';
}

document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.profile.weight = document.getElementById('profile-weight').value;
    state.profile.height = document.getElementById('profile-height').value;
    saveState();
    showToast("Perfil actualizado");
});

// --- UTILS & CORE ---

function saveState() {
    localStorage.setItem('fitTrackPro_profile', JSON.stringify(state.profile));
    localStorage.setItem('fitTrackPro_workouts', JSON.stringify(state.workouts));
}

function factoryReset() {
    if(confirm("⚠ CUIDADO: Esto borrará permanentemente todo tu historial. ¿Continuar?")) {
        localStorage.clear();
        state.workouts = [];
        saveState();
        renderDashboard();
        showToast("Datos borrados de fábrica");
    }
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-slate-700 z-[100] text-sm font-bold flex items-center gap-2 transition-all duration-300 -translate-y-10 opacity-0';
    t.innerHTML = `<i class="fa-solid fa-bell text-emerald-400"></i> ${msg}`;
    document.body.appendChild(t);
    
    requestAnimationFrame(() => {
        t.classList.remove('-translate-y-10', 'opacity-0');
    });
    
    setTimeout(() => {
        t.classList.add('-translate-y-10', 'opacity-0');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// --- CHARTJS ---
function initChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    let grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0.4)'); // Emerald 400
    grad.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{
            label: 'Volumen',
            data: [],
            backgroundColor: grad,
            borderColor: '#34d399',
            borderWidth: 2,
            borderRadius: 6,
            barThickness: 'flex',
            maxBarThickness: 40
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: {family: 'Inter', size: 10} } },
                y: { grid: { color: '#1e293b', borderDash: [4, 4] }, border: {display: false}, ticks: { display: false } }
            }
        }
    });
}

function updateChart(volumeData) {
    if(!chartInstance) return;
    
    // Sort dates
    const dates = Object.keys(volumeData).sort((a,b) => new Date(a) - new Date(b)).slice(-7);
    const vols = dates.map(d => volumeData[d]);

    chartInstance.data.labels = dates.map(d => d.slice(5)); // MM-DD
    chartInstance.data.datasets[0].data = vols;
    chartInstance.update();
}
