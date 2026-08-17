// --- DATABASE ---
const defaultDB = {
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
    workouts: JSON.parse(localStorage.getItem('fitTrackPro_workouts')) || [],
    routines: JSON.parse(localStorage.getItem('fitTrackPro_routines')) || [],
    customExercises: JSON.parse(localStorage.getItem('fitTrackPro_customEx')) || []
};

function getFullDB() {
    let db = JSON.parse(JSON.stringify(defaultDB));
    state.customExercises.forEach(ex => {
        if(!db[ex.category]) db[ex.category] = [];
        if(!db[ex.category].includes(ex.name)) db[ex.category].push(ex.name);
    });
    return db;
}

let activeWorkout = null; 
let workoutTimerInterval = null;
let workoutSeconds = 0;

let editingRoutine = null;
let exerciseModalTarget = 'workout'; // 'workout' or 'routine'

let restTimerSeconds = 0;
let restTimerInterval = null;
let currentRestTime = 90;

let chartInstance = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    renderDashboard();
    renderRoutines();
    initChart();
    
    document.getElementById('exercise-search').addEventListener('input', (e) => {
        renderExerciseList(e.target.value);
    });
});

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
    if (viewId === 'routines') renderRoutines();
}

// --- ROUTINES SYSTEM ---
function renderRoutines() {
    const list = document.getElementById('routines-list');
    list.innerHTML = '';
    
    if (state.routines.length === 0) {
        list.innerHTML = '<div class="text-center p-10 text-slate-500 bg-slate-800/50 rounded-3xl border border-slate-700/50 shadow-inner">No tienes rutinas creadas.<br><span class="text-sm mt-2 block">Haz clic en + Crear Rutina para programar tus pesos, series y descanso.</span></div>';
        return;
    }

    state.routines.forEach((r, i) => {
        const exSummary = r.exercises.map(ex => `${ex.name} (${ex.sets.length} series)`).join(' • ');
        list.innerHTML += `
            <div class="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 shadow-md flex justify-between items-center group">
                <div class="flex-1 pr-4">
                    <h4 class="font-bold text-white text-lg mb-1">${r.name}</h4>
                    <p class="text-xs text-emerald-400 font-medium mb-2"><i class="fa-solid fa-stopwatch mr-1"></i>Descanso: ${r.restTime || 90}s</p>
                    <p class="text-xs text-slate-400 line-clamp-2">${exSummary}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="startWorkoutFromRoutine(${i})" class="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-slate-900 transition active:scale-95 shadow" title="Empezar entrenamiento">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <button onclick="deleteRoutine(${i})" class="w-12 h-12 bg-slate-800 text-slate-500 rounded-xl flex items-center justify-center hover:text-rose-400 transition active:scale-95" title="Eliminar rutina">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

function openRoutineEditor() {
    editingRoutine = { name: '', restTime: 90, exercises: [] };
    document.getElementById('routine-name-input').value = '';
    document.getElementById('routine-rest-input').value = '90';
    renderRoutineCanvas();
    const ui = document.getElementById('routine-editor-view');
    ui.classList.remove('hidden');
    ui.classList.add('flex');
}

function closeRoutineEditor() {
    editingRoutine = null;
    const ui = document.getElementById('routine-editor-view');
    ui.classList.add('hidden');
    ui.classList.remove('flex');
}

function saveRoutine() {
    const name = document.getElementById('routine-name-input').value.trim();
    const restTime = parseInt(document.getElementById('routine-rest-input').value) || 90;
    
    if (!name) return showToast("Por favor, ponle nombre a la rutina.");
    if (editingRoutine.exercises.length === 0) return showToast("Añade al menos un ejercicio.");

    editingRoutine.name = name;
    editingRoutine.restTime = restTime;
    state.routines.push(editingRoutine);
    saveState();
    closeRoutineEditor();
    renderRoutines();
    showToast("¡Rutina guardada con éxito!");
}

function deleteRoutine(index) {
    if(confirm("¿Eliminar esta rutina?")) {
        state.routines.splice(index, 1);
        saveState();
        renderRoutines();
    }
}

function renderRoutineCanvas() {
    const canvas = document.getElementById('routine-canvas');
    canvas.innerHTML = '';
    
    if (editingRoutine.exercises.length === 0) {
        canvas.innerHTML = '<div class="text-center p-8 text-slate-500"><i class="fa-solid fa-clipboard-list text-3xl mb-2 opacity-30"></i><p>Rutina vacía. Añade ejercicios para configurar series y pesos.</p></div>';
        return;
    }

    editingRoutine.exercises.forEach((ex, exIndex) => {
        let setsHtml = '';
        ex.sets.forEach((set, setIndex) => {
            setsHtml += `
                <div class="grid grid-cols-[30px_1fr_1fr_40px] gap-2 items-center mb-2">
                    <span class="text-xs text-slate-500 font-bold text-center">${setIndex + 1}</span>
                    <input type="number" step="0.5" value="${set.kg}" onchange="updateRoutineSet(${exIndex}, ${setIndex}, 'kg', this.value)" class="bg-slate-950 border border-slate-700 rounded-lg p-2 text-center text-white text-sm font-bold outline-none focus:border-emerald-500" placeholder="kg">
                    <input type="number" value="${set.reps}" onchange="updateRoutineSet(${exIndex}, ${setIndex}, 'reps', this.value)" class="bg-slate-950 border border-slate-700 rounded-lg p-2 text-center text-white text-sm font-bold outline-none focus:border-emerald-500" placeholder="reps">
                    <button onclick="removeRoutineSet(${exIndex}, ${setIndex})" class="text-slate-500 hover:text-rose-400 p-1"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        });

        canvas.innerHTML += `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-3">
                <div class="flex justify-between items-center border-b border-slate-700/50 pb-2">
                    <div>
                        <span class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">${ex.category}</span>
                        <h4 class="text-white font-bold text-base">${ex.name}</h4>
                    </div>
                    <button onclick="removeRoutineExercise(${exIndex})" class="text-slate-500 hover:text-rose-400 p-2"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div>
                    <div class="grid grid-cols-[30px_1fr_1fr_40px] gap-2 text-[10px] text-slate-400 font-semibold uppercase mb-1">
                        <span class="text-center">Set</span>
                        <span class="text-center">Objetivo kg</span>
                        <span class="text-center">Objetivo Reps</span>
                        <span></span>
                    </div>
                    ${setsHtml}
                    <button onclick="addRoutineSet(${exIndex})" class="w-full mt-2 py-2 bg-slate-900 border border-slate-700 border-dashed rounded-lg text-slate-300 font-semibold text-xs hover:bg-slate-900/80 transition">
                        + Añadir Serie Objetivo
                    </button>
                </div>
            </div>
        `;
    });
}

function addRoutineSet(exIndex) {
    const ex = editingRoutine.exercises[exIndex];
    let prevKg = '', prevReps = '';
    if (ex.sets.length > 0) {
        prevKg = ex.sets[ex.sets.length - 1].kg;
        prevReps = ex.sets[ex.sets.length - 1].reps;
    }
    ex.sets.push({ kg: prevKg, reps: prevReps });
    renderRoutineCanvas();
}

function updateRoutineSet(exIndex, setIndex, field, value) {
    editingRoutine.exercises[exIndex].sets[setIndex][field] = value;
}

function removeRoutineSet(exIndex, setIndex) {
    editingRoutine.exercises[exIndex].sets.splice(setIndex, 1);
    renderRoutineCanvas();
}

function removeRoutineExercise(exIndex) {
    editingRoutine.exercises.splice(exIndex, 1);
    renderRoutineCanvas();
}

// --- ACTIVE WORKOUT LOGIC ---

function startFreeWorkout() {
    initWorkoutObj("Entrenamiento Libre", 90);
}

function startWorkoutFromRoutine(index) {
    const routine = state.routines[index];
    initWorkoutObj(routine.name, routine.restTime || 90);
    
    // Copy exercises and predefined target sets directly ready to go
    activeWorkout.exercises = routine.exercises.map(ex => ({
        name: ex.name,
        category: ex.category,
        sets: ex.sets.map(s => ({ kg: s.kg, reps: s.reps, done: false }))
    }));
    
    renderWorkoutCanvas();
}

function initWorkoutObj(name, restTime) {
    currentRestTime = restTime;
    activeWorkout = {
        id: Date.now(),
        startTime: Date.now(),
        name: name,
        exercises: []
    };
    workoutSeconds = 0;
    document.getElementById('workout-name-input').value = activeWorkout.name;
    document.getElementById('workout-timer-display').innerText = "00:00";
    
    clearInterval(workoutTimerInterval);
    workoutTimerInterval = setInterval(() => {
        workoutSeconds++;
        const m = String(Math.floor(workoutSeconds / 60)).padStart(2, '0');
        const s = String(workoutSeconds % 60).padStart(2, '0');
        document.getElementById('workout-timer-display').innerText = `${m}:${s}`;
    }, 1000);

    renderWorkoutCanvas();
    const ui = document.getElementById('workout-active-view');
    ui.classList.remove('hidden');
    ui.classList.add('flex');
}

function finishWorkout() {
    if (activeWorkout.exercises.length === 0) {
        if(confirm("El entrenamiento está vacío. ¿Cancelar?")) closeWorkoutUI();
        return;
    }

    activeWorkout.name = document.getElementById('workout-name-input').value;
    activeWorkout.duration = Math.floor(workoutSeconds / 60);
    activeWorkout.date = new Date().toISOString();

    // Clean up uncompleted sets
    activeWorkout.exercises = activeWorkout.exercises.map(ex => {
        ex.sets = ex.sets.filter(s => s.done);
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

// --- EXERCISE MODALS & CUSTOM EXERCISES ---

function openExerciseModal(target) {
    exerciseModalTarget = target; // 'workout' or 'routine'
    document.getElementById('exercise-search').value = '';
    renderExerciseList();
    const modal = document.getElementById('exercise-modal');
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
    const fullDB = getFullDB();

    Object.keys(fullDB).forEach(category => {
        const exercises = fullDB[category].filter(ex => ex.toLowerCase().includes(term));
        if (exercises.length === 0) return;

        container.innerHTML += `<p class="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-2 mt-4 px-1">${category}</p>`;
        
        exercises.forEach(ex => {
            container.innerHTML += `
                <div onclick="addExerciseToTarget('${ex}', '${category}')" class="bg-slate-800 p-4 rounded-xl mb-2 flex justify-between items-center active:bg-slate-700 transition cursor-pointer border border-slate-700 shadow-sm">
                    <span class="font-semibold text-white">${ex}</span>
                    <i class="fa-solid fa-plus text-emerald-400"></i>
                </div>
            `;
        });
    });
}

function addExerciseToTarget(name, category) {
    if (exerciseModalTarget === 'workout') {
        activeWorkout.exercises.push({
            name: name, category: category,
            sets: [ { kg: '', reps: '', done: false } ]
        });
        renderWorkoutCanvas();
        setTimeout(() => {
            const canvas = document.getElementById('workout-canvas');
            canvas.scrollTop = canvas.scrollHeight;
        }, 100);
    } else if (exerciseModalTarget === 'routine') {
        editingRoutine.exercises.push({ name, category, sets: [{ kg: '', reps: '' }] });
        renderRoutineCanvas();
    }
    closeExerciseModal();
}

// Custom Exercise Functions
function openCustomExModal() {
    document.getElementById('custom-ex-name').value = '';
    const modal = document.getElementById('custom-ex-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'modal-enter');
}

function closeCustomExModal() {
    const modal = document.getElementById('custom-ex-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function saveCustomExercise() {
    const name = document.getElementById('custom-ex-name').value.trim();
    const cat = document.getElementById('custom-ex-cat').value;
    
    if(!name) return showToast("Por favor, ingresa un nombre.");
    
    state.customExercises.push({name, category: cat});
    saveState();
    closeCustomExModal();
    renderExerciseList(document.getElementById('exercise-search').value);
    showToast(`"${name}" añadido a tus ejercicios.`);
}

// --- WORKOUT CANVAS RENDERING (MODIFIABLE ON THE FLY) ---

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
                        <input type="number" step="0.5" value="${set.kg}" onchange="updateWorkoutSet(${exIndex}, ${setIndex}, 'kg', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-center text-white font-bold outline-none focus:border-emerald-500 placeholder-slate-600" placeholder="kg">
                    </div>
                    <div>
                        <input type="number" value="${set.reps}" onchange="updateWorkoutSet(${exIndex}, ${setIndex}, 'reps', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-center text-white font-bold outline-none focus:border-emerald-500 placeholder-slate-600" placeholder="reps">
                    </div>
                    <div class="flex justify-center">
                        <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleWorkoutSet(${exIndex}, ${setIndex})" class="set-checkbox">
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
                    <button onclick="removeExerciseFromWorkout(${exIndex})" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-400 transition">
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
                    
                    <button onclick="addWorkoutSet(${exIndex})" class="w-full mt-3 py-3 rounded-xl bg-slate-700/50 text-slate-300 font-bold text-sm hover:bg-slate-700 transition border border-slate-700 border-dashed">
                        + Añadir Serie sobre la marcha
                    </button>
                </div>
            </div>
        `;
    });
}

function addWorkoutSet(exIndex) {
    const ex = activeWorkout.exercises[exIndex];
    let prevKg = '', prevReps = '';
    if (ex.sets.length > 0) {
        const last = ex.sets[ex.sets.length - 1];
        prevKg = last.kg; prevReps = last.reps;
    }
    ex.sets.push({ kg: prevKg, reps: prevReps, done: false });
    renderWorkoutCanvas();
}

function updateWorkoutSet(exIndex, setIndex, field, value) {
    activeWorkout.exercises[exIndex].sets[setIndex][field] = value;
}

function toggleWorkoutSet(exIndex, setIndex) {
    const set = activeWorkout.exercises[exIndex].sets[setIndex];
    set.done = !set.done;
    if(set.done) {
        if(!set.kg) set.kg = '0';
        if(!set.reps) set.reps = '0';
    }
    renderWorkoutCanvas();
    if (set.done) startRestTimer(currentRestTime);
}

function removeExerciseFromWorkout(exIndex) {
    if(confirm("¿Eliminar ejercicio del entrenamiento?")) {
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
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            showToast("¡Tiempo de descanso terminado!");
            return;
        }
        const m = String(Math.floor(restTimerSeconds / 60)).padStart(2, '0');
        const s = String(restTimerSeconds % 60).padStart(2, '0');
        timeDisplay.innerText = `${m}:${s}`;
        restTimerSeconds--;
    };
    
    tick();
    restTimerInterval = setInterval(tick, 1000);
}

function stopRestTimer() {
    clearInterval(restTimerInterval);
    document.getElementById('rest-timer-bubble').classList.add('hidden');
    document.getElementById('rest-timer-bubble').classList.remove('flex');
}

// --- DASHBOARD & ANALYTICS RENDERING (RELEVANT METRICS) ---

function renderDashboard() {
    let totalWorkouts = state.workouts.length;
    let totalSetsCompleted = 0;
    let totalDurationSum = 0;
    let setsPerDate = {};

    state.workouts.forEach(w => {
        const dStr = w.date.split('T')[0];
        if(!setsPerDate[dStr]) setsPerDate[dStr] = 0;
        
        totalDurationSum += (w.duration || 0);

        w.exercises.forEach(ex => {
            ex.sets.forEach(set => {
                if(set.done) {
                    totalSetsCompleted++;
                    setsPerDate[dStr]++;
                }
            });
        });
    });

    const avgTime = totalWorkouts > 0 ? Math.round(totalDurationSum / totalWorkouts) : 0;

    document.getElementById('stat-workouts').innerText = totalWorkouts;
    document.getElementById('stat-sets').innerText = totalSetsCompleted;
    document.getElementById('stat-avg-time').innerText = avgTime;

    updateChart(setsPerDate);
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (state.workouts.length === 0) {
        list.innerHTML = '<div class="text-center p-10 text-slate-500 bg-slate-800/50 rounded-3xl shadow-inner border border-slate-700/50">Aún no hay historial.</div>';
        return;
    }

    state.workouts.forEach(w => {
        const dateObj = new Date(w.date);
        const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
        
        let setCounts = 0;
        w.exercises.forEach(ex => {
            ex.sets.forEach(s => { if(s.done) setCounts++; });
        });

        const exSummary = w.exercises.map(ex => `<span class="text-slate-300 text-[10px] uppercase font-bold mr-2 border border-slate-700 bg-slate-900 rounded px-2 py-1 mb-1 inline-block">${ex.sets.length}x ${ex.name}</span>`).join('');

        list.innerHTML += `
            <div class="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 shadow-md">
                <div class="flex justify-between items-start mb-3 border-b border-slate-700/50 pb-3">
                    <div>
                        <h4 class="font-bold text-white text-lg">${w.name}</h4>
                        <p class="text-xs text-emerald-400 font-medium mt-1"><i class="fa-regular fa-calendar mr-1"></i>${dateStr} &bull; <i class="fa-regular fa-clock mx-1"></i>${w.duration} min</p>
                    </div>
                    <div class="text-right">
                        <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold text-xs">${setCounts} series efectivas</span>
                    </div>
                </div>
                <div class="pt-1">
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
    localStorage.setItem('fitTrackPro_routines', JSON.stringify(state.routines));
    localStorage.setItem('fitTrackPro_customEx', JSON.stringify(state.customExercises));
}

function factoryReset() {
    if(confirm("⚠ CUIDADO: Esto borrará permanentemente todo. ¿Continuar?")) {
        localStorage.clear();
        state = { profile: {weight:80, height:175}, workouts: [], routines: [], customExercises: [] };
        saveState();
        renderDashboard();
        renderRoutines();
        renderHistory();
        showToast("Datos borrados de fábrica");
    }
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-emerald-500/30 z-[100] text-sm font-bold flex items-center gap-2 transition-all duration-300 -translate-y-10 opacity-0';
    t.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> ${msg}`;
    document.body.appendChild(t);
    
    requestAnimationFrame(() => t.classList.remove('-translate-y-10', 'opacity-0'));
    
    setTimeout(() => {
        t.classList.add('-translate-y-10', 'opacity-0');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// --- CHARTJS (RELEVANT METRICS: SETS PER SESSION) ---
function initChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    let grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
    grad.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{
            label: 'Series Efectivas', data: [], backgroundColor: grad, borderColor: '#34d399', borderWidth: 2, borderRadius: 6, barThickness: 'flex', maxBarThickness: 40
        }]},
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: {family: 'Inter', size: 10} } },
                y: { grid: { color: '#1e293b', borderDash: [4, 4] }, border: {display: false}, ticks: { precision:0, color: '#94a3b8' } }
            }
        }
    });
}

function updateChart(setsData) {
    if(!chartInstance) return;
    const dates = Object.keys(setsData).sort((a,b) => new Date(a) - new Date(b)).slice(-7);
    const setCounts = dates.map(d => setsData[d]);

    chartInstance.data.labels = dates.map(d => d.slice(5));
    chartInstance.data.datasets[0].data = setCounts;
    chartInstance.update();
}
