import { useEffect, useMemo, useState } from "react";

// Letras del rosco (A-Z). Si quieres Ñ, lo adaptamos luego.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Estados de cada letra
const STATUS = {
  PENDING: "pending",
  CORRECT: "correct",
  WRONG: "wrong",
};

// --- Helpers ---
function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function nextStatus(current) {
  // Ciclo: pendiente -> acierto -> fallo -> pendiente
  if (current === STATUS.PENDING) return STATUS.CORRECT;
  if (current === STATUS.CORRECT) return STATUS.WRONG;
  return STATUS.PENDING;
}

function makeInitialLettersState() {
  const state = {};
  for (const l of LETTERS) state[l] = STATUS.PENDING;
  return state;
}

function computeCounts(lettersState) {
  let correct = 0, wrong = 0, pending = 0;
  for (const l of LETTERS) {
    const st = lettersState[l];
    if (st === STATUS.CORRECT) correct++;
    else if (st === STATUS.WRONG) wrong++;
    else pending++;
  }
  return { correct, wrong, pending };
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// --- Components ---
function Rosco({
  title,
  timeTotal,
  state,
  setState,
  globalCommand, // "start" | "pause" | "reset" | null
}) {
  const { running, secondsLeft, letters, activeLetter } = state;



  const findNextPending = (fromLetter, lettersMap) => {
    const startIdx = LETTERS.indexOf(fromLetter);
    for (let step = 1; step <= LETTERS.length; step++) {
      const idx = (startIdx + step) % LETTERS.length;
      const l = LETTERS[idx];
      if (lettersMap[l] === STATUS.PENDING) return l;
    }
    return null; // no quedan pendientes
  };

  const markCorrect = () => {
    setState((prev) => {
      const updatedLetters = { ...prev.letters, [prev.activeLetter]: STATUS.CORRECT };
      const next = findNextPending(prev.activeLetter, updatedLetters);
      return {
        ...prev,
        letters: updatedLetters,
        activeLetter: next ?? prev.activeLetter,
      };
    });
  };

  const markWrongAndStop = () => {
    setState((prev) => {
      const updatedLetters = { ...prev.letters, [prev.activeLetter]: STATUS.WRONG };
      const next = findNextPending(prev.activeLetter, prev.letters);
      return {
        ...prev,
        letters: updatedLetters,
        running: false, // para el tiempo
        activeLetter: next ?? prev.activeLetter
      };
    });
  };

  const passLetter = () => {
    // Deja pendiente (no cambia estado) y avanza a la siguiente pendiente
    setState((prev) => {
      const next = findNextPending(prev.activeLetter, prev.letters);
      return { ...prev, activeLetter: next ?? prev.activeLetter };
    });
  };


  const setActiveToNextPending = () => {
    setState((prev) => {
      const next = findNextPending(prev.activeLetter, prev.letters);
      return { ...prev, activeLetter: next ?? prev.activeLetter };
    });
  };


  // Aplicar comandos globales (si cambian)
  useEffect(() => {
    if (!globalCommand) return;
    if (globalCommand === "start") {
      setState((prev) => ({ ...prev, running: true }));
    } else if (globalCommand === "pause") {
      setState((prev) => ({ ...prev, running: false }));
    } else if (globalCommand === "reset") {
      setState((prev) => ({
        ...prev,
        running: false,
        secondsLeft: timeTotal,
        letters: makeInitialLettersState(),
      }));
    }
  }, [globalCommand, setState, timeTotal]);

  // Tick del cronómetro
  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) return;

    const id = setInterval(() => {
      setState((prev) => {
        if (!prev.running) return prev;
        const next = Math.max(0, prev.secondsLeft - 1);
        return { ...prev, secondsLeft: next, running: next > 0 ? true : false };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [running, secondsLeft, setState]);

  const counts = useMemo(() => computeCounts(letters), [letters]);

  const onToggleLetter = (letter) => {
    setState((prev) => ({
      ...prev,
      letters: { ...prev.letters, [letter]: nextStatus(prev.letters[letter]) },
    }));
  };

  const setAllPending = () => {
    setState((prev) => ({ ...prev, letters: makeInitialLettersState() }));
  };

  const setRunning = (val) => setState((prev) => ({ ...prev, running: val }));

  const resetTimerOnly = () => {
    setState((prev) => ({ ...prev, running: false, secondsLeft: timeTotal }));
  };

  return (
    <section className="card">
      <div className="cardHeader">
        <h2>{title}</h2>
        <div className="badgeRow">
          {running ? <span className="badge badgeLive">EN MARCHA</span> : <span className="badge">PAUSA</span>}
          {secondsLeft === 0 ? <span className="badge badgeEnd">TIEMPO</span> : null}
        </div>
      </div>

      <div className="roscoWrap">
        <div className="rosco">
          {LETTERS.map((l, idx) => {
            const st = letters[l];
            const isActive = l === activeLetter;
            const cls =
              st === STATUS.CORRECT ? "chip chipCorrect" :
                st === STATUS.WRONG ? "chip chipWrong" :
                  "chip";
            const activeCls = isActive ? (running ? " chipActiveBlink" : " chipActive") : "";

            // Distribución circular simple (CSS rotate)
            const angle = (360 / LETTERS.length) * idx;
            return (
              <button
                key={l}
                className={cls + activeCls}
                style={{
                  transform: `rotate(${angle}deg) translate(0, calc(var(--radius) * -1)) rotate(${-angle}deg)`,
                }}
                onClick={() => onToggleLetter(l)}
                title={`${l}: ${st}`}
                aria-label={`Letra ${l}, estado ${st}`}
              >
                {l}
              </button>
            );
          })}

          <div className="center">
            <div className="time">{formatTime(secondsLeft)}</div>
          </div>
        </div>
        <div className="centerBtns">
          <button className="btn btnPrimary" onClick={() => setRunning(true)} disabled={secondsLeft === 0}>
            ▶ Iniciar
          </button>
          <button className="btn" onClick={() => setRunning(false)}>
            ⏸ Pausar
          </button>
          <button className="btn btnGood" onClick={markCorrect} disabled={secondsLeft === 0}>
            ✅ Correcto
          </button>
          <button className="btn btnDanger" onClick={markWrongAndStop} disabled={secondsLeft === 0}>
            ❌ Fallo
          </button>
          <button className="btn" onClick={passLetter} disabled={secondsLeft === 0}>
            ⏭ Pasar
          </button>
        </div>
        <div className="centerBtns">
          <button className="btn" onClick={resetTimerOnly}>
            ⟲ Reset tiempo
          </button>
          <button className="btn btnDanger" onClick={setAllPending}>
            ♻ Reset rosco
          </button>
        </div>
      </div>

      <div className="counts">
        <div className="countItem">
          <span className="dot dotCorrect" /> Aciertos <b>{counts.correct}</b>
        </div>
        <div className="countItem">
          <span className="dot dotWrong" /> Fallos <b>{counts.wrong}</b>
        </div>
        <div className="countItem">
          <span className="dot dotPending" /> Pendientes <b>{counts.pending}</b>
        </div>
      </div>


    </section>
  );
}

export default function App() {
  // Config general
  const [timeTotal, setTimeTotal] = useState(() => loadFromStorage("edr_timeTotal", 120)); // 2 min por defecto

  // Comandos globales (para avisar a cada Rosco)
  const [globalCommand, setGlobalCommand] = useState(null);

  // Estado de cada equipo (con persistencia)
  const [roscoA, setRoscoA] = useState(() =>
    loadFromStorage("edr_roscoA", {
      running: false,
      secondsLeft: timeTotal,
      letters: makeInitialLettersState(),
      activeLetter: "A",
    })
  );

  const [roscoB, setRoscoB] = useState(() =>
    loadFromStorage("edr_roscoB", {
      running: false,
      secondsLeft: timeTotal,
      letters: makeInitialLettersState(),
      activeLetter: "A",
    })
  );

  // Si cambia timeTotal, no fuerces reset automático; solo afecta a nuevos resets.
  useEffect(() => saveToStorage("edr_timeTotal", timeTotal), [timeTotal]);
  useEffect(() => saveToStorage("edr_roscoA", roscoA), [roscoA]);
  useEffect(() => saveToStorage("edr_roscoB", roscoB), [roscoB]);

  const fireGlobal = (cmd) => {
    setGlobalCommand(cmd);
    // limpiar el comando inmediatamente para que se pueda reenviar el mismo luego
    setTimeout(() => setGlobalCommand(null), 0);
  };

  const hardResetAll = () => {
    // En hardResetAll:
    setRoscoA({ running: false, secondsLeft: timeTotal, letters: makeInitialLettersState(), activeLetter: "A" });
    setRoscoB({ running: false, secondsLeft: timeTotal, letters: makeInitialLettersState(), activeLetter: "A" });

  };

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="logo">🏫</div>
          <div>
            <div className="brandName">EDU ROSCO</div>
          </div>
        </div>

        <div className="topControls">
          <label className="selectWrap">
            Tiempo por rosco:
            <select
              value={timeTotal}
              onChange={(e) => setTimeTotal(Number(e.target.value))}
              className="select"
            >
              <option value={60}>01:00</option>
              <option value={90}>01:30</option>
              <option value={120}>02:00</option>
              <option value={180}>03:00</option>
              <option value={240}>04:00</option>
              <option value={300}>05:00</option>
            </select>
          </label>

          <button className="btn btnPrimary" onClick={() => fireGlobal("start")}>▶ Iniciar ambos</button>
          <button className="btn" onClick={() => fireGlobal("pause")}>⏸ Pausar ambos</button>
          <button className="btn btnDanger" onClick={() => fireGlobal("reset")}>⟲ Reset ambos</button>
          <button className="btn" onClick={hardResetAll}>♻ Reset total</button>
        </div>
      </header>

      <main className="grid">
        <Rosco
          title="Equipo A"
          timeTotal={timeTotal}
          state={roscoA}
          setState={setRoscoA}
          globalCommand={globalCommand}
        />
        <Rosco
          title="Equipo B"
          timeTotal={timeTotal}
          state={roscoB}
          setState={setRoscoB}
          globalCommand={globalCommand}
        />
      </main>

      {/* <footer className="footer">
        <div className="footerBox">
          <b>Notas rápidas:</b> esto es una versión “panel” para el profe. No muestra preguntas ni admite respuestas.
          Si quieres, el siguiente paso es añadir: nombres de equipos editables, modo pantalla completa, exportar resultados (CSV), y teclado rápido (A=acierto / F=fallo / P=pendiente).
        </div>
      </footer> */}
    </div>
  );
}
