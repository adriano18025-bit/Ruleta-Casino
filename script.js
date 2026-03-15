// --- CONFIGURATION ---
const NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const NUM_SECTORS = 37;
const ARC_ANGLE = (2 * Math.PI) / NUM_SECTORS;
const RADIUS = 250;
const BEZEL_RADIUS = 300;
const NUM_BEZEL_LIGHTS = 48; // Lights inside the outer casing

// --- COLORS ---
const COLOR_RED_FILL = '#d10000';
const COLOR_BLACK = '#1a1a1a';
const COLOR_GREEN_FILL = '#008000';
const COLOR_BEZEL = '#111';
const COLOR_GOLD = '#ffd700';

function getNumberColor(num) {
    if (num === 0) return 'green';
    const numIdx = NUMBERS.indexOf(num);
    return numIdx % 2 !== 0 ? 'red' : 'black';
}

function getFillColor(num) {
    const col = getNumberColor(num);
    if (col === 'green') return COLOR_GREEN_FILL;
    if (col === 'red') return COLOR_RED_FILL;
    return COLOR_BLACK;
}

// --- SETUP ---
const canvas = document.getElementById('rouletteCanvas');
const ctx = canvas.getContext('2d');
const timerDisplay = document.getElementById('timerDisplay');
const timerSecondsSpan = document.getElementById('timerSeconds');
const historyTape = document.getElementById('historyTape');

const CENTER_X = canvas.width / 2;
const CENTER_Y = canvas.height / 2;

// --- STATE ---
let currentRotation = 0; // standard rotation in radians (clockwise)
let isSpinning = false;
let currentWinningNumber = null;

let activeLightIndex = 0;
let lastRotationForLights = 0;
let lightChaseAccumulator = 0;
let blinkState = false;
let blinkInterval = null;

const statsHistory = []; // max 120 draws
const numCounts = new Array(37).fill(0);

// Render initial stats
initStatsUI();
updateStatsObj(null); // to mount initial cold/hot states

// --- DRAWING ---
function drawRoulette() {
    // Clear whole canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(CENTER_X, CENTER_Y);

    // Draw non-rotating Bezel & lights
    drawBezel();

    // Rotate context to draw the spinning wheel
    ctx.rotate(currentRotation);

    // Wheel background casing
    ctx.beginPath();
    ctx.arc(0, 0, RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLOR_GOLD;
    ctx.stroke();

    // Draw individual sectors
    for (let i = 0; i < NUM_SECTORS; i++) {
        const angle = i * ARC_ANGLE;
        const num = NUMBERS[i];

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, RADIUS - 4, angle, angle + ARC_ANGLE);
        ctx.closePath();

        ctx.fillStyle = getFillColor(num);

        // Winning number gets a neon glow if not spinning
        if (num === currentWinningNumber && !isSpinning) {
            ctx.shadowColor = getFillColor(num);
            ctx.shadowBlur = 25;
            // Brighten fill slightly
            ctx.fillStyle = num === 0 ? '#00ff66' : (getNumberColor(num) === 'red' ? '#ff4d4d' : '#333');
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Sector separators (white lines)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * (RADIUS - 4), Math.sin(angle) * (RADIUS - 4));
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Number Text
        ctx.save();
        // Position text in the middle of the sector arc
        ctx.rotate(angle + ARC_ANGLE / 2);
        ctx.translate(RADIUS - 35, 0); // push outwards
        ctx.rotate(Math.PI / 2); // rotate text so top points outwards

        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (num === currentWinningNumber && !isSpinning) {
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
        }

        ctx.fillText(num.toString(), 0, 0);
        ctx.restore();
    }

    // --- Center Metallic Circle ---
    // Outer highlight ring
    ctx.beginPath();
    ctx.arc(0, 0, 65, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, 65);
    grad.addColorStop(0, '#ffe600');
    grad.addColorStop(0.5, '#b38f00');
    grad.addColorStop(1, '#ffe600');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#665200';
    ctx.stroke();

    // Inner dark circle
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, 2 * Math.PI);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Draw the winning number prominently in the center if won
    if (currentWinningNumber !== null && !isSpinning) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 42px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const winColor = getFillColor(currentWinningNumber);
        ctx.shadowColor = winColor;
        ctx.shadowBlur = 20;
        ctx.fillText(currentWinningNumber.toString(), 0, 0);
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function drawBezel() {
    // Outer black casing
    ctx.beginPath();
    ctx.arc(0, 0, BEZEL_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = COLOR_BEZEL;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#222';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, RADIUS + 10, 0, 2 * Math.PI);
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLOR_GOLD;
    ctx.stroke();

    // Lights ring
    const lightAngle = (2 * Math.PI) / NUM_BEZEL_LIGHTS;
    for (let i = 0; i < NUM_BEZEL_LIGHTS; i++) {
        // Adjust angle so light 0 is at top (-PI/2)
        const lx = Math.cos(i * lightAngle - Math.PI / 2) * (BEZEL_RADIUS - 18);
        const ly = Math.sin(i * lightAngle - Math.PI / 2) * (BEZEL_RADIUS - 18);

        ctx.beginPath();
        ctx.arc(lx, ly, 6, 0, 2 * Math.PI);

        let lightCol = '#000';
        ctx.shadowBlur = 0;

        if (isSpinning) {
            // Chasing Lights effect
            const distance = Math.abs(i - activeLightIndex);
            // Creates a tail of 3 lights
            if (distance < 3 || distance > NUM_BEZEL_LIGHTS - 3) {
                lightCol = COLOR_GOLD;
                ctx.shadowColor = COLOR_GOLD;
                ctx.shadowBlur = 15;
            } else {
                lightCol = '#333';
            }
        } else if (currentWinningNumber !== null) {
            // Blink the top Light (index 0) if won
            if (i === 0 && blinkState) {
                lightCol = '#00ff66';
                ctx.shadowColor = '#00ff66';
                ctx.shadowBlur = 20;
            } else {
                lightCol = '#222';
            }
        } else {
            // Default idle state
            lightCol = '#333';
        }

        ctx.fillStyle = lightCol;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Bulb gloss reflection
        ctx.beginPath();
        ctx.arc(lx - 2, ly - 2, 2, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fill();
    }
}

function updateLightChase() {
    if (isSpinning) {
        const delta = currentRotation - lastRotationForLights;
        lastRotationForLights = currentRotation;

        lightChaseAccumulator += delta;
        // Move light position every 0.1 radians of wheel spin
        const threshold = 0.1;
        if (Math.abs(lightChaseAccumulator) > threshold) {
            const steps = Math.floor(Math.abs(lightChaseAccumulator) / threshold);
            activeLightIndex = (activeLightIndex + steps) % NUM_BEZEL_LIGHTS;
            lightChaseAccumulator = lightChaseAccumulator % threshold;
        }
    }
}

// --- LOGIC ---
function calculateWinningNumber(rotationRad) {
    // Canvas standard: Angle 0 is East (Right). Top is -PI/2.
    // Normalized Rotation
    const normalizedRotation = rotationRad % (2 * Math.PI);

    // The top pointer is physically at -PI/2.
    // Which sector angle intersects this?
    let pointerAngleOnWheel = -Math.PI / 2 - normalizedRotation;

    // Normalize to 0 -> 2PI
    pointerAngleOnWheel = pointerAngleOnWheel % (2 * Math.PI);
    if (pointerAngleOnWheel < 0) pointerAngleOnWheel += 2 * Math.PI;

    const sectorIndex = Math.floor(pointerAngleOnWheel / ARC_ANGLE);
    return NUMBERS[sectorIndex];
}

// --- AUTOMATION TIMER & GAME LOOP ---
let bettingClosed = false;
let timeRemaining = 30; // 30 seconds betting phase

function updateTimerUI() {
    if (bettingClosed) {
        timerDisplay.innerHTML = `APUESTAS CERRADAS`;
        timerDisplay.classList.remove('urgent');
    } else {
        timerDisplay.innerHTML = `CIERRE EN <span id="timerSeconds">0:${timeRemaining.toString().padStart(2, '0')}</span>`;
        if (timeRemaining <= 5) {
            timerDisplay.classList.add('urgent');
        } else {
            timerDisplay.classList.remove('urgent');
        }
    }
}

function startGameLoop() {
    timeRemaining = 30;
    bettingClosed = false;
    updateTimerUI();

    const countdownInterval = setInterval(() => {
        timeRemaining--;
        updateTimerUI();

        if (timeRemaining <= 0) {
            clearInterval(countdownInterval);
            bettingClosed = true;
            updateTimerUI();

            // Wait 1 second after "BETS CLOSED" before spinning
            setTimeout(() => {
                triggerAutoSpin();
            }, 1000);
        }
    }, 1000);
}

// --- SPIN LOGIC ---
function triggerAutoSpin() {
    isSpinning = true;
    currentWinningNumber = null;

    if (blinkInterval) {
        clearInterval(blinkInterval);
        blinkInterval = null;
    }
    blinkState = false;

    // Determine random spins (e.g. 5 to 10 full turns) + random extra angle
    const numSpins = 5 + Math.floor(Math.random() * 5);
    const randomAngle = Math.random() * Math.PI * 2;
    const targetRotation = currentRotation + (numSpins * 2 * Math.PI) + randomAngle;

    const proxy = { rot: currentRotation };

    // GSAP Tween ensures 60fps power4.out deceleration
    gsap.to(proxy, {
        rot: targetRotation,
        duration: 8,
        ease: "power4.out",
        onUpdate: () => {
            currentRotation = proxy.rot;
            updateLightChase();
            drawRoulette();
        },
        onComplete: () => {
            isSpinning = false;

            // Result
            currentWinningNumber = calculateWinningNumber(currentRotation);

            // Sync Statistics precisely on stop
            updateStatsObj(currentWinningNumber);

            // Final render and blink trigger
            drawRoulette();
            startVictoryBlink();

            // Trigger Cinematic Reveal (will chain back to game loop on complete)
            triggerCinematicReveal(currentWinningNumber);
        }
    });
}

function startVictoryBlink() {
    let blinkCount = 0;
    blinkInterval = setInterval(() => {
        blinkState = !blinkState;
        drawRoulette();
        blinkCount++;
        if (blinkCount > 8) { // 4 full blink cycles
            clearInterval(blinkInterval);
            blinkInterval = null;
            blinkState = true;
            drawRoulette(); // Ensure it stays visible at the end
        }
    }, 150);
}

// --- STATISTICS & UI PANELS ---
function initStatsUI() {
    // 1. Pay Table (Static)
    const ptContainer = document.getElementById('payTableContainer');
    ptContainer.innerHTML = `
        <div class="deluxe-divider"><span>TABLA DE PAGOS</span></div>
        <div class="pay-table-grid">
            <div class="pt-col-left">
                <div class="pt-colours-label">COLORES</div>
                <div class="pt-colours-values">
                    <div class="pt-cv-row" style="background:#cc0000;">x2</div>
                    <div class="pt-cv-row" style="background:#000000;">x2</div>
                    <div class="pt-cv-row" style="background:#3b8700;">x36</div>
                </div>
            </div>
            <div class="pt-col-right">
                <div class="pt-right-row">
                    <div class="pt-label">DOCENAS</div>
                    <div class="pt-value">x3</div>
                </div>
                <div class="pt-right-row">
                    <div class="pt-label">PAR / IMPAR</div>
                    <div class="pt-value">x2</div>
                </div>
                <div class="pt-right-row">
                    <div class="pt-label">NUMEROS</div>
                    <div class="pt-value">x36</div>
                </div>
            </div>
        </div>
    `;

    // 2. Last Results Container (Dynamic content injected via updateStatsObj)
    const lrContainer = document.getElementById('lastResultsContainer');
    lrContainer.innerHTML = `
        <div class="deluxe-divider"><span>ULTIMOS RESULTADOS</span></div>
        <div class="last-results-grid" id="lastResultsGrid">
            <!-- Rendered in JS -->
        </div>
    `;

    // 3. Statistics Grid
    const container = document.getElementById('statsContainer');

    // Build the grid HTML
    let numbersGrid = `<div class="deluxe-divider"><span>ESTADISTICAS</span><div class="subtitle">ULTIMOS 120 RESULTADOS</div></div>`;
    numbersGrid += `<div class="deluxe-section-title">NUMEROS</div>`;
    numbersGrid += `<div class="numbers-grid">`;

    // 1 to 36 in exactly 3 columns block as seen in reference
    for (let row = 1; row <= 12; row++) {
        for (let col = 0; col < 3; col++) {
            const num = row + (col * 12);
            const colorClass = getNumberColor(num);
            numbersGrid += `<div class="cell-num ${colorClass}">${num}</div>`;
            numbersGrid += `<div class="cell-count" id="count-${num}"></div>`;
        }
    }
    // Bottom row for 0
    numbersGrid += `<div class="cell-num green" style="grid-column: span 2;">0</div>`;
    numbersGrid += `<div class="cell-count" id="count-0" style="grid-column: span 4; display: flex; align-items: center; justify-content: center;"></div>`;
    numbersGrid += `</div>`;

    // Dozens
    let dozensHtml = `<div class="deluxe-section-title">DOCENAS</div>`;
    dozensHtml += `<div class="dozens-row">
        <div class="label-light">1-12</div><div class="count-dark" id="count-doz-1"></div>
        <div class="label-light">13-24</div><div class="count-dark" id="count-doz-2"></div>
        <div class="label-light">25-36</div><div class="count-dark" id="count-doz-3"></div>
    </div>`;

    // Colors
    let colorsHtml = `<div class="deluxe-section-title">COLORES</div>`;
    colorsHtml += `<div class="colors-row" id="colorsRow">
        <div class="color-bar red" id="bar-red"></div>
        <div class="color-bar black" id="bar-black"></div>
        <div class="color-bar green" id="bar-green"></div>
    </div>`;

    // Hot/Cold
    let hotColdHtml = `<div class="deluxe-section-title">HOT / COLD NUMBERS</div>`;
    hotColdHtml += `<div class="hot-cold-table">
        <div class="hc-row">
            <div class="hc-label hot">HOT</div>
            <div class="hc-cells" id="hot-cells">
                <!-- 5 cells injected -->
            </div>
        </div>
        <div class="hc-row">
            <div class="hc-label cold">COLD</div>
            <div class="hc-cells" id="cold-cells">
                <!-- 5 cells injected -->
            </div>
        </div>
    </div>`;

    container.innerHTML = numbersGrid + dozensHtml + colorsHtml + hotColdHtml;
}

function updateStatsObj(winner) {
    if (winner !== null) {
        statsHistory.push(winner);
        if (statsHistory.length > 120) {
            const removed = statsHistory.shift();
            numCounts[removed]--;
        }
        numCounts[winner]++;
    }

    // Update individual number cells
    for (let i = 0; i < 37; i++) {
        const cElement = document.getElementById('count-' + i);
        if (cElement) cElement.innerText = numCounts[i] > 0 ? numCounts[i] : '';
    }

    // Last Results (Top 8 of statsHistory, reversed so newest is first)
    const lrGrid = document.getElementById('lastResultsGrid');
    if (lrGrid) {
        let lrHtml = '';
        const recent = statsHistory.slice(-8).reverse();
        // Render up to 8 items in 2 columns (left col 0-3, right col 4-7 is typically grouped, or just flow left-right-left-right)
        // Image shows left column then right column order, but standard grid flows by rows. We can use flex or grid cols.
        // Grid flow defaults to left/right alternating. 
        // We'll wrap them in two column containers if we strictly mimic image vertical flow.

        let col1 = '<div class="lr-col">';
        let col2 = '<div class="lr-col">';
        for (let i = 0; i < 8; i++) {
            if (i < recent.length) {
                const num = recent[i];
                const bgClass = getNumberColor(num);
                const colorCode = bgClass === 'red' ? '#cc0000' : (bgClass === 'green' ? '#3b8700' : '#000000');
                const rowHtml = `
                    <div class="lr-row">
                        <div class="lr-id">#${1000000 + statsHistory.length - i}</div>
                        <div class="lr-num" style="background:${colorCode};">${num}</div>
                    </div>
                `;
                if (i < 4) col1 += rowHtml;
                else col2 += rowHtml;
            } else {
                // Empty placeholders
                const rowHtml = `<div class="lr-row"><div class="lr-id">--</div><div class="lr-num"></div></div>`;
                if (i < 4) col1 += rowHtml;
                else col2 += rowHtml;
            }
        }
        col1 += '</div>';
        col2 += '</div>';
        lrGrid.innerHTML = col1 + col2;
    }

    // Dozens
    const doz1 = numCounts.slice(1, 13).reduce((a, b) => a + b, 0);
    const doz2 = numCounts.slice(13, 25).reduce((a, b) => a + b, 0);
    const doz3 = numCounts.slice(25, 37).reduce((a, b) => a + b, 0);
    document.getElementById('count-doz-1').innerText = doz1 || '';
    document.getElementById('count-doz-2').innerText = doz2 || '';
    document.getElementById('count-doz-3').innerText = doz3 || '';

    // Colors
    let reds = 0, blacks = 0, greens = numCounts[0];
    for (let i = 1; i <= 36; i++) {
        if (getNumberColor(i) === 'red') reds += numCounts[i];
        else blacks += numCounts[i];
    }

    // Update color bars flex layout (only show text if > 0)
    document.getElementById('bar-red').style.flex = reds || 0.01;
    document.getElementById('bar-red').innerText = reds || '';
    document.getElementById('bar-black').style.flex = blacks || 0.01;
    document.getElementById('bar-black').innerText = blacks || '';
    document.getElementById('bar-green').style.flex = greens || 0.01;
    document.getElementById('bar-green').innerText = greens || '';

    // Hot/Cold numbers logic
    const freqs = [];
    for (let i = 0; i <= 36; i++) {
        freqs.push({ num: i, count: numCounts[i] });
    }

    // HOT: highest frequency (descending)
    const hotSorted = [...freqs].sort((a, b) => b.count - a.count || a.num - b.num);
    const hot5 = hotSorted.slice(0, 5);

    // COLD: lowest frequency (ascending)
    const coldSorted = [...freqs].sort((a, b) => a.count - b.count || a.num - b.num);
    const cold5 = coldSorted.slice(0, 5);

    const renderHC = (arr, containerId) => {
        const html = arr.map(x => {
            const c = getNumberColor(x.num);
            return `<div class="hc-num ${c}">${x.num}</div>`;
        }).join('');
        const cId = document.getElementById(containerId);
        if (cId) cId.innerHTML = html;
    };

    renderHC(hot5, 'hot-cells');
    renderHC(cold5, 'cold-cells');
}

// --- CINEMATIC REVEAL ---
function triggerCinematicReveal(winningNumber) {
    const overlay = document.getElementById('cinematicOverlay');
    const centerObj = document.getElementById('cinematicCenter');
    const numberSpan = document.getElementById('cinematicNumber');
    // We need to animate the inner circle and the ring elements
    const innerCircle = document.querySelector('.cinematic-inner');
    const ring = document.querySelector('.cinematic-ring');

    numberSpan.innerText = winningNumber;

    const winColor = getFillColor(winningNumber);
    // Use brighter colors for the aura/glow
    const glowColor = winningNumber === 0 ? '#00ff66' : (getNumberColor(winningNumber) === 'red' ? '#ff4d4d' : '#888888');

    // Dynamic text contrast rule based on the winning color
    const finalTextColor = winningNumber === 0 ? '#111' : '#fff';

    gsap.set(overlay, { display: 'block', opacity: 0 });
    gsap.set(centerObj, { display: 'flex', scale: 1, opacity: 1 });

    // Reset colors for the start of the cinematic
    gsap.set(innerCircle, { backgroundColor: '#111' });
    gsap.set(ring, { boxShadow: 'none' });
    gsap.set(numberSpan, { color: '#111', textShadow: 'none', scale: 0.5 });

    const tl = gsap.timeline({
        onComplete: () => {
            gsap.set(centerObj, { display: 'none' });
            gsap.set(overlay, { display: 'none' });

            // Reset state and Restart Game Loop after 5s wait within the cinematic timeline
            startGameLoop();
        }
    });

    tl.to(overlay, { opacity: 1, duration: 0.5 }, 0)
        .to(centerObj, {
            scale: 1.4,
            duration: 0.8,
            ease: "back.out(1.7)"
        }, 0)
        // Transition center color using GSAP string interpolation handling 
        .to(innerCircle, {
            backgroundColor: winColor,
            duration: 0.5,
            ease: "power2.out"
        }, 0.3)
        // Apply the aura/glow on the ring
        .to(ring, {
            boxShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
            duration: 0.5,
            ease: "power2.out"
        }, 0.3)
        .to(numberSpan, {
            color: finalTextColor,
            textShadow: `0 0 15px ${finalTextColor}, 0 0 30px ${finalTextColor}`,
            scale: 1,
            duration: 0.5,
            ease: "power2.out"
        }, 0.3)
        .call(() => {
            createParticles();
        }, null, 0.4)
        .to({}, { duration: 5 }) // Display cinematic for exactly 5 seconds before reset
        .to([overlay, centerObj], { opacity: 0, duration: 0.5 });
}

function createParticles() {
    const container = document.getElementById('cinematicCenter');
    for (let i = 0; i < 40; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        container.insertBefore(particle, container.firstChild);

        const angle = Math.random() * Math.PI * 2;
        const distance = 70 + Math.random() * 100;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        gsap.set(particle, { x: 0, y: 0, scale: Math.random() + 0.5, opacity: 1 });

        gsap.to(particle, {
            x: tx,
            y: ty,
            opacity: 0,
            duration: 0.8 + Math.random() * 0.6,
            ease: "power3.out",
            onComplete: () => {
                particle.remove();
            }
        });
    }
}

// --- INITIAL PAINT & START ---
drawRoulette();
startGameLoop();
