/**
 * Flyvis Mascot: Otto the Groovy Travel Otter
 * Option 1: "Already Chilling" Host on Step 1 with micro-interactions
 * Option 4: 5-Step Journey Companion throughout the booking funnel
 * Step 2: Perched Scout with Interactive Hand-Scope Laser Targeting System!
 */
(() => {
  'use strict';

  // Step 1 Chilling Host Quotes
  const hostQuotes = [
    "Ready to fly? Let's lock your lowest fare! ✈️",
    "I've got my sunglasses & suitcase ready! 🧳",
    "Flyvis 100% price lock guarantee active! 🛡️",
    "Sunny beach vibes ahead! Where to next? 🌴",
    "Zero price increase risk. 100% price lock! 💎"
  ];
  let quoteIdx = 0;

  // Step 2 Departure Window Insights (Scout Radar)
  const departureInsights = {
    any: "Scanning carrier skies with my telescope! Choosing <strong>Any Time</strong> lets me grab sudden flash drops. Pick your preferred departure slot below and watch me adjust my radar! 🔭",
    midnight: "🌙 <strong>Night Owl Radar Activated!</strong> Midnight flights (12AM - 4AM) often drop <strong>15–20%</strong> because leisure passenger demand takes a nap. Sleep in the air, save on your wallet!",
    early_morning: "🌅 <strong>Early Bird Radar!</strong> 4AM - 8AM slots boast the <strong>#1 on-time record</strong> across carriers and zero incoming runway traffic jams!",
    morning: "☀️ <strong>Prime Morning Radar!</strong> Smooth daylight travel with great arrival timing for business or hotel check-in.",
    afternoon: "✈️ <strong>Afternoon Leisure Radar!</strong> Sleep in late, eat breakfast at home, and breeze through midday security lines.",
    evening: "🌇 <strong>Sunset Runway Radar!</strong> Finish your full workday, head straight to the terminal, and wake up at your destination!",
    night: "🌌 <strong>Moonlight Cruising Radar!</strong> Optimal night departure window (8PM - 11:59PM) for cross-time-zone hops and restful arrivals."
  };

  // Web Audio Synthesizer: Mechanical Lens Focus Dial Click
  function playLensFocusSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      // Dual optical dial micro-clicks (tactile lens barrel snapping into focus)
      [0, 0.045].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 0 ? 1900 : 2400, now + delay);
        osc.frequency.exponentialRampToValueAtTime(750, now + delay + 0.022);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, now + delay);
        filter.Q.setValueAtTime(3.5, now + delay);

        gain.gain.setValueAtTime(0.045, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.022);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.028);
      });
    } catch (e) {}
  }

  // Web Audio Synthesizer: Camera Snapshot Shutter Click & Harmonic Lock Chime
  function playShutterSnapshot() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      // 1. Shutter Front Blade Snap (quick crisp metallic transient)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1400, now);
      osc1.frequency.exponentialRampToValueAtTime(220, now + 0.038);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.042);

      // 2. Shutter Rear Blade Clack (35ms later)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(750, now + 0.035);
      osc2.frequency.exponentialRampToValueAtTime(160, now + 0.035 + 0.038);
      gain2.gain.setValueAtTime(0.06, now + 0.035);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.035 + 0.038);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.035);
      osc2.stop(now + 0.035 + 0.042);

      // 3. Subtle Positive Harmonic Ping (reward chime for locking fare)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(980, now + 0.045);
      osc3.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
      gain3.gain.setValueAtTime(0.04, now + 0.045);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.045);
      osc3.stop(now + 0.23);
    } catch (e) {}
  }

  // Heavy mechanical vault lock bolt snap + resonant chime
  function playVaultLockSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Heavy metallic mechanical clunk (shackle closing)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(340, now);
      osc1.frequency.exponentialRampToValueAtTime(75, now + 0.08);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.095);

      // Sharp metallic tumbler snap (35ms later)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1150, now + 0.035);
      osc2.frequency.exponentialRampToValueAtTime(260, now + 0.035 + 0.06);
      gain2.gain.setValueAtTime(0.14, now + 0.035);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.035 + 0.06);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.035);
      osc2.stop(now + 0.035 + 0.065);

      // Resonant brass bell lock chime (positive confirmation)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(880, now + 0.06);
      osc3.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
      gain3.gain.setValueAtTime(0.11, now + 0.06);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.06);
      osc3.stop(now + 0.45);
    } catch (e) {}
  }

  // Cheerful cash-register / savings coin cascade chime
  function playCoinDropChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      [1046.5, 1318.5, 1567.98, 2093].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.045);
        gain.gain.setValueAtTime(0.05, now + idx * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.19);
      });
    } catch (e) {}
  }

  // Rapid micro-tick for rolling price odometer
  function playPriceTickSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.018);
    } catch (e) {}
  }

  // Energy shield deflection against price surge
  function playShieldDeflectSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Laser energy barrier zap + metallic ricochet
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1900, now);
      osc1.frequency.exponentialRampToValueAtTime(450, now + 0.09);
      gain1.gain.setValueAtTime(0.09, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2400, now + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.22);
      gain2.gain.setValueAtTime(0.08, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.26);
    } catch (e) {}
  }

  // Soft metallic key ring jingle when hovering padlock / lock button
  function playKeyJingleSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      [2200, 2900, 3400].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.02);
        gain.gain.setValueAtTime(0.015, now + i * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.02 + 0.045);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.02);
        osc.stop(now + i * 0.02 + 0.05);
      });
    } catch (e) {}
  }

  // Expose audio synthesizers globally
  window.playVaultLockSound = playVaultLockSound;
  window.playCoinDropChime = playCoinDropChime;
  window.playPriceTickSound = playPriceTickSound;
  window.playShieldDeflectSound = playShieldDeflectSound;
  window.playKeyJingleSound = playKeyJingleSound;

  // Alias for backward compatibility
  function playLaserChirp() {
    playLensFocusSound();
  }

  // Create or retrieve fixed full-screen SVG overlay for spotlight beam and viewfinder HUD
  function getOrCreateSpotlightOverlay() {
    let overlay = document.getElementById('otto-spotlight-overlay') || document.getElementById('otto-laser-overlay');
    if (!overlay) {
      overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      overlay.setAttribute('id', 'otto-spotlight-overlay');
      overlay.setAttribute('class', 'otto-spotlight-overlay-svg');
      overlay.innerHTML = `
        <defs>
          <filter id="otto-spot-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur1" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="otto-beam-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.75" />
            <stop offset="55%" stop-color="#38BDF8" stop-opacity="0.28" />
            <stop offset="100%" stop-color="#2DD4BF" stop-opacity="0.06" />
          </linearGradient>
          <radialGradient id="otto-pool-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.65" />
            <stop offset="35%" stop-color="#67E8F9" stop-opacity="0.35" />
            <stop offset="85%" stop-color="#2DD4BF" stop-opacity="0.1" />
            <stop offset="100%" stop-color="#2DD4BF" stop-opacity="0" />
          </radialGradient>
        </defs>
        <g id="otto-spotlight-beams"></g>
        <g id="otto-viewfinder-hud"></g>
        <g id="otto-snapshot-flash"></g>
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  // Calculate transformed telescope lens coordinate in screen/viewport space
  function getOttoLensScreenCoords() {
    const wrap = document.getElementById('otto-scout-figure-wrap') || document.querySelector('.otto-perched-figure-wrap');
    if (!wrap) return null;

    let anchor = document.getElementById('otto-scope-lens-anchor');
    if (!anchor) {
      const headPivot = document.getElementById('otto-scout-head-pivot');
      anchor = document.createElement('div');
      anchor.id = 'otto-scope-lens-anchor';
      anchor.style.position = 'absolute';
      anchor.style.left = '7.7%';
      anchor.style.top = '13.7%';
      anchor.style.width = '2px';
      anchor.style.height = '2px';
      anchor.style.pointerEvents = 'none';
      anchor.style.opacity = '0';
      (headPivot || wrap).appendChild(anchor);
    }

    const rect = anchor.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  // Aim Otto at target element and return computed tilt angle & flip state
  function aimOttoAtElement(targetEl) {
    const wrap = document.getElementById('otto-scout-figure-wrap') || document.querySelector('.otto-perched-figure-wrap');
    if (!wrap || !targetEl) return { tilt: 0, targetDeg: 0, isFlipped: false };

    const headPivot = document.getElementById('otto-scout-head-pivot');
    const wrapRect = wrap.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    // Pivot is at neck / shoulder socket
    const pivotX = wrapRect.left + wrapRect.width * 0.477;
    const pivotY = wrapRect.top + wrapRect.height * 0.359;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const dx = targetCenterX - pivotX;
    const dy = targetCenterY - pivotY;

    // Only flip if target is distinctly to Otto's right (e.g. mobile right columns)
    const isFlipped = dx > 35;

    // Ergonomic head tilt mapping: smoothly clamped between 10 deg and 28 deg
    // This preserves character anatomy, keeping the neck seated inside the collar with zero neck gap
    let targetDeg;
    if (targetEl.classList && targetEl.classList.contains('nomadiq-dep-card')) {
      const slotAngles = {
        'any': 10,
        'midnight': 13,
        'early_morning': 16,
        'morning': 19,
        'afternoon': 22,
        'evening': 25,
        'night': 28
      };
      const slotKey = targetEl.id.replace('nomadiq-dep-', '');
      targetDeg = slotAngles[slotKey] !== undefined ? slotAngles[slotKey] : 18;
    } else if (targetEl.closest && targetEl.closest('#nomadiq-airlines-container')) {
      // Preferred airlines rows
      targetDeg = 24;
    } else if ((targetEl.closest && targetEl.closest('.nomadiq-stop-row')) || (targetEl.classList && targetEl.classList.contains('nomadiq-stop-row'))) {
      // Flight stops rows
      targetDeg = 20;
    } else if ((targetEl.closest && targetEl.closest('label[id^="lbl-pref-bag-"]')) || (targetEl.id && targetEl.id.startsWith('lbl-pref-bag-'))) {
      // Baggage options
      targetDeg = 26;
    } else if ((targetEl.closest && targetEl.closest('#nomadiq-chk-protected-conn-wrap')) || targetEl.id === 'nomadiq-chk-protected-conn-wrap') {
      // Transfer protection
      targetDeg = 26;
    } else {
      const rawDeg = Math.atan2(Math.max(15, dy), Math.abs(dx)) * (180 / Math.PI);
      targetDeg = Math.min(28, Math.max(10, rawDeg * 0.45));
    }

    window.__ottoCurrentTilt = targetDeg;
    window.__ottoIsFlipped = isFlipped;

    const targetMoveEl = headPivot || wrap;
    targetMoveEl.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)';

    const flipPrefix = isFlipped ? 'scaleX(-1) translateX(6px) ' : '';
    // Negative rotation in CSS tilts the leftward-pointing head DOWN towards the cards
    targetMoveEl.style.transform = `${flipPrefix}rotate(-${targetDeg.toFixed(1)}deg) scale(1.02)`;

    return { tilt: targetDeg, targetDeg, isFlipped };
  }

  // Option A+B Merger: Explorer Spotlight Sweep & Viewfinder Snapshot Lock
  function spotlightAndSnapshotPreference(targetEl, onSnapshot) {
    if (!targetEl) {
      if (typeof onSnapshot === 'function') onSnapshot();
      return;
    }

    // 1. Target lock indicator
    targetEl.classList.add('otto-target-locked');

    // 2. Aim Otto at target
    const aimResult = aimOttoAtElement(targetEl);

    // 3. Play optical lens focus dial tick
    playLensFocusSound();

    // Prepare overlay groups
    const overlay = getOrCreateSpotlightOverlay();
    overlay.style.opacity = '1';
    const beamGroup = overlay.querySelector('#otto-spotlight-beams');
    const vfGroup = overlay.querySelector('#otto-viewfinder-hud');
    const flashGroup = overlay.querySelector('#otto-snapshot-flash');

    if (beamGroup) beamGroup.innerHTML = '';
    if (vfGroup) vfGroup.innerHTML = '';
    if (flashGroup) flashGroup.innerHTML = '';

    // Small delay (~40ms) for transform to apply before positioning beam
    setTimeout(() => {
      const lens = getOttoLensScreenCoords();
      if (!lens) {
        targetEl.classList.remove('otto-target-locked');
        if (typeof onSnapshot === 'function') onSnapshot();
        return;
      }

      const targetRect = targetEl.getBoundingClientRect();
      const targetCX = targetRect.left + targetRect.width / 2;
      const targetCY = targetRect.top + targetRect.height / 2;

      // 1. Conical Spotlight Beam (Option A)
      const pLeft = targetRect.left;
      const pRight = targetRect.right;
      const pTop = targetRect.top;
      const pBottom = targetRect.bottom;

      beamGroup.innerHTML = `
        <polygon points="${lens.x},${lens.y} ${pLeft},${pTop} ${pRight},${pTop}" fill="url(#otto-beam-grad)" filter="url(#otto-spot-glow)" opacity="0.85" />
        <polygon points="${lens.x},${lens.y} ${pLeft},${pTop} ${pLeft},${pBottom} ${pRight},${pBottom} ${pRight},${pTop}" fill="url(#otto-beam-grad)" opacity="0.45" />
        <circle cx="${lens.x}" cy="${lens.y}" r="10" fill="#2DD4BF" opacity="0.9" filter="url(#otto-spot-glow)" />
        <circle cx="${lens.x}" cy="${lens.y}" r="3.5" fill="#FFFFFF" />
        <ellipse cx="${targetCX}" cy="${targetCY}" rx="${targetRect.width * 0.55}" ry="${targetRect.height * 0.5}" fill="url(#otto-pool-grad)" />
      `;

      // 2. Viewfinder HUD Reticle [ ⌖ ] (Option B)
      vfGroup.innerHTML = `
        <g transform="translate(${targetCX}, ${targetCY})">
          <g class="otto-viewfinder-reticle">
            <!-- Circular target ring -->
            <circle cx="0" cy="0" r="28" stroke="#0D9488" stroke-width="2" fill="rgba(45,212,191,0.08)" stroke-dasharray="6 8" />
            <circle cx="0" cy="0" r="11" stroke="#14B8A6" stroke-width="1.6" fill="rgba(20,184,166,0.18)" />
            <circle cx="0" cy="0" r="3" fill="#0F766E" />
            <!-- Crosshairs -->
            <line x1="0" y1="-34" x2="0" y2="-18" stroke="#0F766E" stroke-width="2" stroke-linecap="round" />
            <line x1="0" y1="18" x2="0" y2="34" stroke="#0F766E" stroke-width="2" stroke-linecap="round" />
            <line x1="-34" y1="0" x2="-18" y2="0" stroke="#0F766E" stroke-width="2" stroke-linecap="round" />
            <line x1="18" y1="0" x2="34" y2="0" stroke="#0F766E" stroke-width="2" stroke-linecap="round" />
            <!-- Corner brackets [ ] -->
            <path d="M-22,-22 L-26,-22 L-26,-18" stroke="#0D9488" stroke-width="2" fill="none" stroke-linecap="round" />
            <path d="M22,-22 L26,-22 L26,-18" stroke="#0D9488" stroke-width="2" fill="none" stroke-linecap="round" />
            <path d="M-22,22 L-26,22 L-26,18" stroke="#0D9488" stroke-width="2" fill="none" stroke-linecap="round" />
            <path d="M22,22 L26,22 L26,18" stroke="#0D9488" stroke-width="2" fill="none" stroke-linecap="round" />
          </g>
        </g>
      `;

      // 3. Shutter Snapshot Lock at t = 200ms
      setTimeout(() => {
        // Shutter snap sound
        playShutterSnapshot();

        // Shutter flash bloom
        flashGroup.innerHTML = `
          <g transform="translate(${targetCX}, ${targetCY})">
            <circle cx="0" cy="0" r="20" fill="#FFFFFF" class="otto-shutter-flash" />
            <circle cx="0" cy="0" r="34" fill="#2DD4BF" opacity="0.6" class="otto-shutter-flash-ring" />
          </g>
        `;

        // Turn ON the card!
        targetEl.classList.remove('otto-target-locked');
        targetEl.classList.add('otto-card-activated');
        setTimeout(() => targetEl.classList.remove('otto-card-activated'), 500);

        if (typeof onSnapshot === 'function') {
          onSnapshot();
        }

        // Otto slight nod/recoil
        const headPivot = document.getElementById('otto-scout-head-pivot');
        const wrap = document.getElementById('otto-scout-figure-wrap') || document.querySelector('.otto-perched-figure-wrap');
        const targetMoveEl = headPivot || wrap;
        if (targetMoveEl) {
          const effTilt = aimResult.targetDeg;
          const flipPrefix = aimResult.isFlipped ? 'scaleX(-1) translateX(6px) ' : '';
          targetMoveEl.style.transition = 'transform 0.12s ease-out';
          targetMoveEl.style.transform = `${flipPrefix}rotate(-${effTilt - 2.5}deg) translateY(-2px) scale(1.02)`;
          setTimeout(() => {
            targetMoveEl.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
            targetMoveEl.style.transform = `${flipPrefix}rotate(-${effTilt}deg) scale(1)`;
          }, 120);
        }

        // Dissolve spotlight & viewfinder smoothly
        const isFrozen = new URLSearchParams(window.location.search).get('freezeSpotlight') || new URLSearchParams(window.location.search).get('freezeLaser');
        if (!isFrozen) {
          overlay.style.transition = 'opacity 0.2s ease-out';
          overlay.style.opacity = '0';
          setTimeout(() => {
            beamGroup.innerHTML = '';
            vfGroup.innerHTML = '';
            flashGroup.innerHTML = '';
            overlay.style.opacity = '1';
          }, 210);
        }

      }, 200);

    }, 40);
  }

  // Alias for backward compatibility
  const shootOttoLaserToPreference = spotlightAndSnapshotPreference;
  function initStep1Host() {
    const mascot = document.getElementById('flyvis-groovy-otter');
    if (!mascot) return;

    const mover = mascot.querySelector('.otter-mover');
    const bubble = document.getElementById('otter-speech-bubble');
    const bubbleText = bubble ? bubble.querySelector('.otter-bubble-text') : null;

    if (mover) {
      mover.classList.add('is-arrived');
    }

    // Click on Otto for playful interaction & quote rotation
    mascot.addEventListener('click', (e) => {
      if (e.target.closest('.otter-bubble-close')) return;
      mascot.classList.add('is-reacting');
      setTimeout(() => mascot.classList.remove('is-reacting'), 600);

      if (bubble && bubbleText) {
        bubble.classList.remove('is-hidden');
        quoteIdx = (quoteIdx + 1) % hostQuotes.length;
        bubbleText.textContent = hostQuotes[quoteIdx];
      }
    });

    // When SMART BOOKING button is clicked, Otto cheers
    const smartBtn = document.querySelector('.nomadiq-btn-smart-booking');
    if (smartBtn) {
      smartBtn.addEventListener('click', () => {
        mascot.classList.add('is-reacting');
        if (bubble && bubbleText) {
          bubble.classList.remove('is-hidden');
          bubbleText.textContent = "Scanning live airline inventory... 🛫";
        }
      });
    }
  }

  function initStep2Interactions() {
    const depContainer = document.getElementById('departure-slots-container');
    const bubble2 = document.getElementById('otto-bubble-step-2');
    if (!depContainer) return;

    // Capture-phase listener: Otto shoots spotlight and reticle at departure card, then toggles it!
    depContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.nomadiq-dep-card');
      if (!card || !card.id) return;

      e.preventDefault();
      e.stopPropagation();

      const slotKey = card.id.replace('nomadiq-dep-', '');

      shootOttoLaserToPreference(card, () => {
        // Toggle departure window slot
        if (typeof window.setNomadiqDepartureTime === 'function') {
          window.setNomadiqDepartureTime(slotKey);
        }

        // Update radar dialogue based on multi-select state
        if (bubble2) {
          const selected = (window.FlyvisOtaState && window.FlyvisOtaState.nomadiqPreferences && Array.isArray(window.FlyvisOtaState.nomadiqPreferences.departureSlots))
            ? window.FlyvisOtaState.nomadiqPreferences.departureSlots
            : [slotKey];

          if (selected.includes('any') || selected.length === 0) {
            bubble2.innerHTML = departureInsights.any;
          } else if (selected.length === 1 && departureInsights[selected[0]]) {
            bubble2.innerHTML = departureInsights[selected[0]];
          } else if (selected.length > 1) {
            const slotLabels = {
              midnight: "Midnight (12AM-4AM)",
              early_morning: "Early Bird (4AM-8AM)",
              morning: "Morning (8AM-12PM)",
              afternoon: "Afternoon (12PM-4PM)",
              evening: "Sunset (4PM-8PM)",
              night: "Night (8PM-12AM)"
            };
            const labelStr = selected.map(s => slotLabels[s] || s).join(' + ');
            bubble2.innerHTML = `🔭 <strong>Multi-Window Radar Activated!</strong> Tracking flight deals across <strong>${labelStr}</strong>. Locking in maximum savings across your chosen hours!`;
          }
          bubble2.style.transform = 'scale(1.03)';
          setTimeout(() => { bubble2.style.transform = ''; }, 220);
        }
      });
    }, true);

    // Also wire Flight Stops rows
    const stopsContainer = document.querySelector('.nomadiq-stop-row')?.parentElement;
    if (stopsContainer) {
      stopsContainer.addEventListener('click', (e) => {
        const row = e.target.closest('.nomadiq-stop-row');
        if (!row || !row.id) return;
        e.preventDefault();
        e.stopPropagation();

        const stopKey = row.id.replace('nomadiq-stop-', '');
        shootOttoLaserToPreference(row, () => {
          if (typeof window.setNomadiqStops === 'function') {
            window.setNomadiqStops(stopKey);
          }
          if (bubble2) {
            const stopMsgs = {
              no_preference: "🔭 <strong>Scanning All Route Combinations!</strong> No stop preference gives us max flight density.",
              nonstop: "🎯 <strong>Non-Stop Direct Lock!</strong> Locked to direct routes with zero connection layover risk.",
              '1stop': "⚡ <strong>Smart 1-Stop Radar!</strong> Single stop flights often drop fares by up to 15% with safe hub connections.",
              '2plus': "💎 <strong>Max Value Layover Radar!</strong> Multiple stops prioritized for absolute bottom prices."
            };
            if (stopMsgs[stopKey]) {
              bubble2.innerHTML = stopMsgs[stopKey];
              bubble2.style.transform = 'scale(1.03)';
              setTimeout(() => { bubble2.style.transform = ''; }, 220);
            }
          }
        });
      }, true);
    }

    // Wire Preferred Airline selection
    const airlinesContainer = document.getElementById('nomadiq-airlines-container');
    if (airlinesContainer) {
      airlinesContainer.addEventListener('click', (e) => {
        const row = e.target.closest('.nomadiq-airline-row');
        if (!row) return;

        e.preventDefault();
        e.stopPropagation();

        shootOttoLaserToPreference(row, () => {
          // Extract airline name
          const nameEl = row.querySelector('div > div > div[style*="font-weight: 700"]');
          const airlineText = nameEl ? nameEl.textContent.trim() : '';
          const isAll = airlineText.toLowerCase().includes('all airlines');
          const airlineName = isAll ? 'all' : airlineText;

          if (typeof window.toggleNomadiqAirline === 'function') {
            window.toggleNomadiqAirline(airlineName);
          }

          if (bubble2) {
            if (isAll) {
              bubble2.innerHTML = "🛫 <strong>All Airlines Fleet Radar!</strong> Scanning live seat availability across all full-service and low-cost carriers!";
            } else {
              bubble2.innerHTML = `✈️ <strong>${airlineText} Locked!</strong> Filtering private & published fares for <strong>${airlineText}</strong> with instant seat guarantee!`;
            }
            bubble2.style.transform = 'scale(1.03)';
            setTimeout(() => { bubble2.style.transform = ''; }, 220);
          }
        });
      }, true);
    }

    // Wire Baggage Allowance Options (0kg, 15kg, 25kg)
    [0, 15, 25].forEach(kg => {
      const lbl = document.getElementById(`lbl-pref-bag-${kg}`);
      if (!lbl) return;

      lbl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        shootOttoLaserToPreference(lbl, () => {
          const radio = lbl.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;

          if (typeof window.setNomadiqBaggage === 'function') {
            window.setNomadiqBaggage(kg);
          }

          if (bubble2) {
            const bagMsgs = {
              0: "🎒 <strong>Cabin Light Radar!</strong> 0kg check-in selected. Traveling light saves time at baggage carousels and unlocks lowest tier promo fares!",
              15: "🧳 <strong>15kg Standard Allowance Locked!</strong> Guaranteed 15kg check-in bag included with 100% zero surprise airport counter fees.",
              25: "📦 <strong>25kg Extended Heavyweight Radar!</strong> Locking in maximum baggage allowance for long stays, shopping, or family trips."
            };
            bubble2.innerHTML = bagMsgs[kg];
            bubble2.style.transform = 'scale(1.03)';
            setTimeout(() => { bubble2.style.transform = ''; }, 220);
          }
        });
      }, true);
    });

    // Wire Protected Transfer checkbox
    const protWrap = document.getElementById('nomadiq-chk-protected-conn-wrap');
    if (protWrap) {
      protWrap.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const chk = document.getElementById('nomadiq-chk-protected-conn');
        shootOttoLaserToPreference(protWrap, () => {
          if (chk) chk.checked = !chk.checked;
          if (bubble2) {
            if (chk && chk.checked) {
              bubble2.innerHTML = "🛡️ <strong>Protected Connection Lock!</strong> Excluding risky self-transfer split tickets so your bags are checked straight to destination.";
            } else {
              bubble2.innerHTML = "⚠️ <strong>Self-Transfer Allowed!</strong> Showing all layover options including separate airline bookings.";
            }
            bubble2.style.transform = 'scale(1.03)';
            setTimeout(() => { bubble2.style.transform = ''; }, 220);
          }
        });
      }, true);
    }

    // Direct click on Otto
    const perchedWrap = document.getElementById('otto-scout-figure-wrap') || document.querySelector('.otto-perched-figure-wrap');
    if (perchedWrap) {
      perchedWrap.addEventListener('click', () => {
        perchedWrap.classList.add('is-reacting');
        setTimeout(() => perchedWrap.classList.remove('is-reacting'), 500);
        playLensFocusSound();
        if (bubble2) {
          bubble2.innerHTML = "🔭 <strong>Spotlight Radar Armed & Ready!</strong> Click any departure slot or stop preference below and watch me focus & lock in!";
        }
      });
    }
  }

  // Interactive bounce on all step mascot figures + lock trigger for step 3
  function initMascotFigClicks() {
    document.addEventListener('click', (e) => {
      const fig = e.target.closest('.otto-mascot-fig-img, .otto-confirmed-mascot');
      if (!fig) return;
      fig.style.transform = 'scale(1.18) translateY(-12px)';
      setTimeout(() => { fig.style.transform = ''; }, 350);

      // If Step 3 Lockmaster Otto is clicked directly
      const step3Wrap = fig.closest('#otto-companion-step-3');
      if (step3Wrap && typeof window.triggerOttoLockPadlockFun === 'function') {
        window.triggerOttoLockPadlockFun();
      }
    });

    // Hover listener on Step 3 Lock button to jiggle Otto's padlock with key chime
    document.addEventListener('mouseover', (e) => {
      const lockBtn = e.target.closest('#smart-pane-3 .btn-smart-primary, #smart-step3-fare-card .btn-smart-primary');
      if (lockBtn) {
        const step3Fig = document.querySelector('#otto-companion-step-3 .otto-mascot-fig-img');
        if (step3Fig && !step3Fig.classList.contains('otto-padlock-jiggling')) {
          step3Fig.classList.add('otto-padlock-jiggling');
          playKeyJingleSound();
          setTimeout(() => step3Fig.classList.remove('otto-padlock-jiggling'), 400);
        }
      }
    });
  }

  window.triggerOttoReaction = function(step) {
    if (step === 'step2') {
      const wrap = document.getElementById('otto-scout-figure-wrap') || document.querySelector('.otto-perched-figure-wrap');
      const bubble = document.getElementById('otto-bubble-step-2');
      if (wrap) {
        wrap.classList.add('is-reacting');
        setTimeout(() => wrap.classList.remove('is-reacting'), 500);
      }
      playLensFocusSound();
      if (bubble) {
        bubble.innerHTML = "🔭 <strong>Spotlight Radar Armed & Ready!</strong> Scanning skies across airlines. Select your ideal departure slot below!";
      }
    }
  };

  // Expose function globally for programmatic triggers
  window.spotlightAndSnapshotPreference = spotlightAndSnapshotPreference;
  window.shootOttoLaserToPreference = spotlightAndSnapshotPreference;

  // Hook into step changes for subtle companion entrance
  function setupStepCompanionHook() {
    const origGoToFunnelStep = window.goToFunnelStep;
    if (typeof origGoToFunnelStep === 'function') {
      window.goToFunnelStep = function(stepNum) {
        origGoToFunnelStep(stepNum);
        const comp = document.getElementById(`otto-companion-step-${stepNum}`);
        if (comp) {
          comp.style.opacity = '0';
          comp.style.transform = 'translateY(10px) scale(0.98)';
          setTimeout(() => {
            comp.style.transition = 'all 0.4s cubic-bezier(0.34, 1.35, 0.64, 1)';
            comp.style.opacity = '1';
            comp.style.transform = 'translateY(0) scale(1)';
          }, 60);
        }

        if (String(stepNum) === '3') {
          setTimeout(() => {
            if (typeof window.initStep3LowestFareFun === 'function') {
              window.initStep3LowestFareFun();
            }
          }, 90);
        }
      };
    }
  }

  window.dismissOtterBubble = function(event) {
    if (event) event.stopPropagation();
    const bubble = document.getElementById('otter-speech-bubble');
    if (bubble) bubble.classList.add('is-hidden');
  };

  function initAll() {
    initStep1Host();
    initStep2Interactions();
    initMascotFigClicks();
    setupStepCompanionHook();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
