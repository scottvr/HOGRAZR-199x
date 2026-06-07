import {
  CLASSROOM_PROMPT_START_SECONDS,
  CLASSROOM_SECOND_PROMPT_START_SECONDS,
  TRACK_DURATION_SECONDS,
  getActiveCue,
  getSceneForTime,
} from "./state-machine.js";
import { createAudioFx } from "./audio.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const audio = new Audio(`${import.meta.env.BASE_URL}hograzor_fatback-1993.mp3`);
audio.preload = "auto";

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  action: false,
  actionPressed: false,
};

const state = {
  started: false,
  startError: false,
  sceneKey: "BOOT_HOLDING_PEN",
  prevSceneKey: "",
  t: 0,
  flash: 0,
  mass: 10,
  compliance: 60,
  yieldScore: 0,
  pig: { x: 40, y: 130, w: 18, h: 12, speed: 82 },
  feed: [],
  obstacles: [],
  classroomChoice: 0,
  classroomLocked: false,
  classroomStamp: "",
  classroomQuestionKey: "purpose",
  classroomCorrectChoicePurpose: 2,
  classroomCorrectChoiceIndustry: 0,
  lastCue: "",
  lastCueTime: -99,
  nextFeedSfxAt: 0,
  truck: {
    active: false,
    x: 350,
    y: 28,
    w: 92,
    h: 20,
    horned: false,
    nextDropAt: 0,
  },
  truckDroppedPiglets: [],
  transition: {
    active: false,
    mode: "cut",
    age: 0,
    duration: 0.18,
  },
  terminalBlinkTimer: 0,
  terminalCursorOn: true,
  registrationOpen: false,
  shouldResumeAudioAfterRegistration: false,
  trackVolume: 0.2,
  trackMuted: false,
};

const audioFx = createAudioFx();
const SCENE_TRANSITION_MODES = ["wipe", "jitter", "flash"];
const TRUCK_PASS_START_SECONDS = 90;
const TRUCK_PASS_END_SECONDS = 93.8;
const TRUCK_PASS_START_X = 350;
const TRUCK_PASS_END_X = -110;
const INTAKE_GUEST_APPEAR_START_SECONDS = 38;
const INTAKE_GUEST_MOVE_START_SECONDS = 42;
const INTAKE_GUEST_EXIT_SECONDS = 44;
const WEIGH_PIGLET_LINE_COUNT = 6;
const WEIGH_PIGLET_MARCH_RESUME_SECONDS = 117;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function applyTrackVolume() {
  audio.volume = state.trackMuted ? 0 : state.trackVolume;
}

function adjustTrackVolume(delta) {
  state.trackVolume = clamp(state.trackVolume + delta, 0, 1);
  if (state.trackVolume > 0) {
    state.trackMuted = false;
  }
  applyTrackVolume();
}

function spawnTruckDroppedPiglet() {
  const yBase = state.truck.y + state.truck.h + 9;
  state.truckDroppedPiglets.push({
    x: state.truck.x + state.truck.w - 8 + rand(0, 16),
    y: yBase + rand(0, 11),
    w: 9,
    h: 6,
    seed: Math.random() * Math.PI * 2,
  });
  if (state.truckDroppedPiglets.length > 24) {
    state.truckDroppedPiglets.shift();
  }
}

function seedFeed(count = 8) {
  state.feed = [];
  for (let i = 0; i < count; i += 1) {
    state.feed.push({
      x: rand(18, 300),
      y: rand(44, 184),
      r: 3 + Math.floor(Math.random() * 3),
    });
  }
}

function seedObstacles(count = 6) {
  state.obstacles = [];
  for (let i = 0; i < count; i += 1) {
    state.obstacles.push({
      x: 340 + i * 56,
      y: rand(40, 170),
      w: 10 + Math.floor(Math.random() * 8),
      h: 10 + Math.floor(Math.random() * 16),
    });
  }
}

function updateTruckPass() {
  if (state.t < TRUCK_PASS_START_SECONDS || state.t > TRUCK_PASS_END_SECONDS) {
    state.truck.active = false;
    return;
  }

  if (!state.truck.active) {
    state.truck.active = true;
    state.truck.horned = false;
    state.truck.nextDropAt = state.t + rand(0.08, 0.22);
  }

  const progress = clamp(
    (state.t - TRUCK_PASS_START_SECONDS) / (TRUCK_PASS_END_SECONDS - TRUCK_PASS_START_SECONDS),
    0,
    1,
  );
  state.truck.x = TRUCK_PASS_START_X + (TRUCK_PASS_END_X - TRUCK_PASS_START_X) * progress;

  if (state.t >= state.truck.nextDropAt) {
    if (Math.random() < 0.72) {
      spawnTruckDroppedPiglet();
    }
    state.truck.nextDropAt = state.t + rand(0.16, 0.36);
  }
}

function setRegistrationOverlay(open) {
  state.registrationOpen = open;
  input.left = false;
  input.right = false;
  input.up = false;
  input.down = false;
  input.action = false;
  input.actionPressed = false;

  if (open) {
    if (state.started && !audio.paused) {
      audio.pause();
      state.shouldResumeAudioAfterRegistration = true;
    }
    audioFx.noise({ duration: 0.06, gain: 0.38 });
    return;
  }

  if (state.shouldResumeAudioAfterRegistration) {
    state.shouldResumeAudioAfterRegistration = false;
    audio.play().catch(() => {});
  }
}

function toggleRegistrationOverlay() {
  setRegistrationOverlay(!state.registrationOpen);
}

function onSceneEnter(sceneKey) {
  state.transition.active = true;
  state.transition.mode = SCENE_TRANSITION_MODES[Math.floor(Math.random() * SCENE_TRANSITION_MODES.length)];
  state.transition.age = 0;
  state.transition.duration = 0.12 + Math.random() * 0.14;

  audioFx.noise({ duration: 0.04, gain: 0.34 });

  if (sceneKey === "INTAKE_TAGGING") {
    state.pig.x = 22;
    state.pig.y = 126;
    audioFx.blip({ freq: 120, duration: 0.12, type: "triangle", gain: 0.38 });
  } else if (sceneKey === "FEEDTIME") {
    seedFeed();
    state.truck.active = false;
    state.truck.horned = false;
    state.truck.x = TRUCK_PASS_START_X;
    state.truck.nextDropAt = 0;
    state.truckDroppedPiglets = [];
    audioFx.blip({ freq: 330, duration: 0.12, type: "square", gain: 0.38 });
  } else if (sceneKey === "WEIGH_CLASSROOM") {
    state.pig.x = 146;
    state.pig.y = 132;
    state.classroomQuestionKey = "purpose";
    state.classroomLocked = false;
    state.classroomStamp = "";
    state.classroomChoice = 0;
    state.classroomCorrectChoicePurpose = Math.floor(Math.random() * 4);
    state.classroomCorrectChoiceIndustry = Math.floor(Math.random() * 4);
    audioFx.blip({ freq: 210, duration: 0.1, type: "sawtooth", gain: 0.38 });
  } else if (sceneKey === "RUNWAY_SPRINT") {
    state.pig.x = 30;
    state.pig.y = 100;
    seedObstacles();
    audioFx.blip({ freq: 420, duration: 0.08, type: "square", gain: 0.39 });
  } else if (sceneKey === "INSPECTION_STOP") {
    state.pig.x = 150;
    state.pig.y = 120;
    audioFx.blip({ freq: 98, duration: 0.2, type: "triangle", gain: 0.12 });
  } else if (sceneKey === "FATBACK_CORRIDOR") {
    state.pig.x = 152;
    state.pig.y = 140;
    state.yieldScore = Math.floor(state.mass * 1.2 + state.compliance * 0.8);
    audioFx.blip({ freq: 180, duration: 0.16, type: "sawtooth", gain: 0.1 });
  } else if (sceneKey === "WHITEOUT_PROMPT") {
    state.flash = 0;
    audioFx.impact(state.t);
  } else if (sceneKey === "END_IDLE") {
    state.terminalBlinkTimer = 0;
    state.terminalCursorOn = true;
  }
}

function updatePigMovement(dt, speedScale = 1) {
  const speed = state.pig.speed * speedScale;
  if (input.left) state.pig.x -= speed * dt;
  if (input.right) state.pig.x += speed * dt;
  if (input.up) state.pig.y -= speed * dt;
  if (input.down) state.pig.y += speed * dt;
  state.pig.x = clamp(state.pig.x, 4, 320 - state.pig.w - 4);
  state.pig.y = clamp(state.pig.y, 26, 200 - state.pig.h - 4);
}

function updateScene(dt) {
  if (state.sceneKey === "BOOT_HOLDING_PEN") {
    updatePigMovement(dt, 0.35);
    return;
  }

  if (state.sceneKey === "INTAKE_TAGGING") {
    updatePigMovement(dt, 0.6);
    if (state.pig.x > 120 && state.pig.x < 135) state.compliance += 8 * dt;
    return;
  }

  if (state.sceneKey === "FEEDTIME") {
    updatePigMovement(dt, 1);
    updateTruckPass();
    for (const pellet of state.feed) {
      const dx = state.pig.x + state.pig.w * 0.5 - pellet.x;
      const dy = state.pig.y + state.pig.h * 0.5 - pellet.y;
      const dist = Math.hypot(dx, dy);
      if (dist < state.pig.w * 0.6 + pellet.r) {
        pellet.x = rand(12, 308);
        pellet.y = rand(38, 190);
        state.mass += 1;
        state.compliance += 0.4;
        if (state.t > state.nextFeedSfxAt) {
          if (pellet.r <= 3) {
            audioFx.biteMedium();
          } else if (pellet.r >= 5) {
            audioFx.biteLarge();
          } else {
            audioFx.biteSmall();
          }
          state.nextFeedSfxAt = state.t + 0.09;
        }
      }
    }
    if (state.truck.active && input.actionPressed && !state.truck.horned) {
      audioFx.truckHorn();
      state.truck.horned = true;
    }
    return;
  }

  if (state.sceneKey === "WEIGH_CLASSROOM") {
    const inClassroomSegment = state.t >= CLASSROOM_PROMPT_START_SECONDS;
    if (!inClassroomSegment) {
      updatePigMovement(dt, 0.5);
      state.pig.x = clamp(state.pig.x, 126, 190);
      state.pig.y = clamp(state.pig.y, 118, 154);
      state.compliance += 2.8 * dt;
      state.mass += 0.4 * dt;
    } else {
      const nextQuestionKey =
        state.t >= CLASSROOM_SECOND_PROMPT_START_SECONDS ? "industry" : "purpose";
      if (nextQuestionKey !== state.classroomQuestionKey) {
        state.classroomQuestionKey = nextQuestionKey;
        state.classroomChoice = 0;
        state.classroomLocked = false;
        state.classroomStamp = "";
      }

      if (!state.classroomLocked) {
        if (input.left) state.classroomChoice = 0;
        if (input.up) state.classroomChoice = 1;
        if (input.right) state.classroomChoice = 2;
        if (input.down) state.classroomChoice = 3;
        if (input.actionPressed) {
          state.classroomLocked = true;
          const correctChoice =
            state.classroomQuestionKey === "industry"
              ? state.classroomCorrectChoiceIndustry
              : state.classroomCorrectChoicePurpose;
          if (state.classroomChoice === correctChoice) {
            state.classroomStamp = "APPROVED";
            state.compliance += 7;
            audioFx.blip({ freq: 410, duration: 0.06, gain: 0.38 });
          } else {
            state.classroomStamp = "INCORRECT";
            state.compliance -= 10;
            audioFx.noise({ duration: 0.08, gain: 0.38 });
          }
        }
      }
    }
    return;
  }

  if (state.sceneKey === "RUNWAY_SPRINT") {
    updatePigMovement(dt, 1.3);
    for (const o of state.obstacles) {
      o.x -= 115 * dt;
      if (o.x + o.w < 0) {
        o.x = 330 + rand(10, 64);
        o.y = rand(36, 174);
      }
      const hit =
        state.pig.x < o.x + o.w &&
        state.pig.x + state.pig.w > o.x &&
        state.pig.y < o.y + o.h &&
        state.pig.y + state.pig.h > o.y;
      if (hit) {
        state.compliance -= 14 * dt;
        if (Math.random() < 0.1) audioFx.noise({ duration: 0.03, gain: 0.35 });
      }
    }
    return;
  }

  if (state.sceneKey === "INSPECTION_STOP") {
    updatePigMovement(dt, 0.24);
    state.pig.x += (150 - state.pig.x) * 0.045;
    state.pig.y += (122 - state.pig.y) * 0.045;
    state.mass -= 0.2 * dt;
    state.compliance -= 1.8 * dt;
    return;
  }

  if (state.sceneKey === "FATBACK_CORRIDOR") {
    updatePigMovement(dt, 0.55);
    state.pig.y -= 10 * dt;
    state.pig.y = clamp(state.pig.y, 65, 180);
    return;
  }

  if (state.sceneKey === "WHITEOUT_PROMPT") {
    state.flash = clamp(state.flash + dt * 0.85, 0, 1);
    if (state.t > 226.2) {
      state.terminalBlinkTimer += dt;
      if (state.terminalBlinkTimer > 0.35) {
        state.terminalBlinkTimer = 0;
        state.terminalCursorOn = !state.terminalCursorOn;
      }
    }
    return;
  }

  if (state.sceneKey === "END_IDLE") {
    state.terminalBlinkTimer += dt;
    if (state.terminalBlinkTimer > 0.35) {
      state.terminalBlinkTimer = 0;
      state.terminalCursorOn = !state.terminalCursorOn;
    }
  }
}

function getBehaviorTag() {
  if (state.compliance < 30) return "STATUS: SUBSTANDARD";
  if (state.mass > 70) return "STATUS: OVERFAT";
  if (state.compliance > 82 && state.mass > 36) return "STATUS: PRIME";
  return "STATUS: IN PROCESS";
}

function renderPig() {
  const blinkRate = state.t > 160 ? 8 : 12;
  const blink = Math.floor(state.t * 4) % blinkRate === 0;
  ctx.fillStyle = "#efb7c0";
  ctx.fillRect(state.pig.x, state.pig.y, state.pig.w, state.pig.h);
  ctx.fillStyle = "#d1889c";
  ctx.fillRect(state.pig.x + state.pig.w - 3, state.pig.y + 3, 3, 5);
  ctx.fillStyle = blink ? "#2f2831" : "#f6f5f5";
  ctx.fillRect(state.pig.x + 3, state.pig.y + 3, 2, 2);
}

function renderTinyPiglet({ x, y, w = 9, h = 6, seed = 0, body = "#d8a2ab", nose = "#bf7f8d" }) {
  const legWiggle = Math.sin(state.t * 7 + seed) > 0.7 ? 1 : 0;
  const blink = Math.floor((state.t + seed) * 3.7) % 23 === 0;
  ctx.fillStyle = body;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = nose;
  ctx.fillRect(x + w - 2, y + 2, 2, 2);
  ctx.fillStyle = blink ? "#2c2529" : "#f3f1ef";
  ctx.fillRect(x + 1, y + 2, 1, 1);
  ctx.fillStyle = "#2c2529";
  ctx.fillRect(x + 2, y + h, 1, 1 + legWiggle);
  ctx.fillRect(x + 5, y + h, 1, 1 + (1 - legWiggle));
}

function renderIntakeGuestHog() {
  if (state.t < INTAKE_GUEST_APPEAR_START_SECONDS || state.t > INTAKE_GUEST_EXIT_SECONDS) return;

  const w = 22;
  const h = 14;
  let x = 278;
  if (state.t >= INTAKE_GUEST_MOVE_START_SECONDS) {
    const p = clamp(
      (state.t - INTAKE_GUEST_MOVE_START_SECONDS) /
        (INTAKE_GUEST_EXIT_SECONDS - INTAKE_GUEST_MOVE_START_SECONDS),
      0,
      1,
    );
    x = 278 + p * 56;
  }
  const y = 118;
  const blink = Math.floor(state.t * 4.3) % 13 === 0;
  ctx.fillStyle = "#3b2a20";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#5d4030";
  ctx.fillRect(x + w - 4, y + 4, 4, 6);
  ctx.fillStyle = blink ? "#2a1f1a" : "#f6f5f3";
  ctx.fillRect(x + 4, y + 4, 2, 2);
}

function renderWeighPigletParade() {
  if (state.sceneKey !== "WEIGH_CLASSROOM") return;

  const paradeStart = 110;
  const paradePause = 114;
  const paradeResume = WEIGH_PIGLET_MARCH_RESUME_SECONDS;
  const paradeEnd = 121;
  if (state.t < paradeStart || state.t > paradeEnd) return;

  let leaderX = 160;
  if (state.t < paradePause) {
    const p = clamp((state.t - paradeStart) / (paradePause - paradeStart), 0, 1);
    leaderX = -18 + p * 178;
  } else if (state.t < paradeResume) {
    leaderX = 160;
  } else {
    const p = clamp((state.t - paradeResume) / (paradeEnd - paradeResume), 0, 1);
    leaderX = 160 + p * 210;
  }

  const baseY = 148;
  for (let i = 0; i < WEIGH_PIGLET_LINE_COUNT; i += 1) {
    const x = leaderX - i * 11;
    if (x < -16 || x > 336) continue;
    const bounce = Math.sin((state.t * 10.5) + i * 0.85) * 1.2;
    renderTinyPiglet({
      x,
      y: baseY + bounce,
      seed: i * 0.7,
      body: "#d9a9b1",
      nose: "#c48592",
    });
  }
}

function renderHeader(sceneLabel) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, 0, 320, 22);

  ctx.fillStyle = "#d6d2bf";
  ctx.font = "8px monospace";
  ctx.fillText(sceneLabel, 6, 9);
  ctx.fillText(`T+${state.t.toFixed(1)}s`, 256, 9);

  const normalizedCompliance = clamp(state.compliance, 0, 99);
  ctx.fillText(`MASS ${Math.floor(state.mass)}`, 6, 18);
  ctx.fillText(`COMP ${Math.floor(normalizedCompliance)}`, 74, 18);
  ctx.fillText(`YIELD ${Math.floor(state.yieldScore)}`, 142, 18);
  const trackLabel = state.trackMuted ? "TRK MUTE" : `TRK ${Math.round(state.trackVolume * 100)}%`;
  ctx.fillText(trackLabel, 196, 9);
  ctx.fillText(getBehaviorTag(), 196, 18);
}

function renderCue() {
  const cueText = getActiveCue(state.t);
  if (!cueText) return;

  if (cueText !== state.lastCue && state.t > state.lastCueTime + 0.45) {
    state.lastCue = cueText;
    state.lastCueTime = state.t;
    audioFx.noise({ duration: 0.06, gain: 0.35 });
  }

  ctx.fillStyle = "rgba(150, 30, 12, 0.65)";
  ctx.fillRect(0, 176, 320, 24);
  ctx.fillStyle = "#f0d8cc";
  ctx.font = "9px monospace";
  ctx.fillText(cueText, 6, 190);
}

function renderCurrentScene(scene) {
  if (scene.key === "BOOT_HOLDING_PEN") {
    ctx.fillStyle = "#050607";
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = "#253124";
    ctx.fillRect(15, 35, 290, 145);
    ctx.fillStyle = "#4f5e3c";
    ctx.fillRect(15, 62, 290, 7);
    ctx.fillRect(15, 110, 290, 7);
    renderPig();
  } else if (scene.key === "INTAKE_TAGGING") {
    ctx.fillStyle = "#1a1c12";
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = "#3f4330";
    for (let i = 0; i < 7; i += 1) {
      ctx.fillRect(58 + i * 34, 26, 2, 174);
    }
    ctx.fillStyle = "#8b2b18";
    ctx.fillRect(122, 30, 12, 164);
    renderIntakeGuestHog();
    renderPig();
  } else if (scene.key === "FEEDTIME") {
    ctx.fillStyle = "#2b3324";
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = "#56614f";
    ctx.fillRect(12, 30, 296, 160);
    for (const pellet of state.feed) {
      ctx.fillStyle = "#b7a56c";
      ctx.fillRect(pellet.x, pellet.y, pellet.r, pellet.r);
    }
    for (const droppedPiglet of state.truckDroppedPiglets) {
      renderTinyPiglet({
        x: droppedPiglet.x,
        y: droppedPiglet.y,
        w: droppedPiglet.w,
        h: droppedPiglet.h,
        seed: droppedPiglet.seed,
      });
    }
    if (state.truck.active) {
      const tx = state.truck.x;
      const ty = state.truck.y;
      ctx.fillStyle = "#2a2a2d";
      ctx.fillRect(tx, ty + 7, state.truck.w, 10);
      ctx.fillStyle = "#6f7075";
      ctx.fillRect(tx + 48, ty + 2, 26, 13);
      ctx.fillStyle = "#8f3225";
      ctx.fillRect(tx + 2, ty + 4, 44, 12);
      ctx.fillStyle = "#141414";
      ctx.fillRect(tx + 8, ty + 15, 10, 4);
      ctx.fillRect(tx + 56, ty + 15, 10, 4);
      ctx.fillRect(tx + 78, ty + 15, 10, 4);
    }
    renderPig();
  } else if (scene.key === "WEIGH_CLASSROOM") {
    const inClassroomSegment = state.t >= CLASSROOM_PROMPT_START_SECONDS;
    ctx.fillStyle = inClassroomSegment ? "#333028" : "#26272d";
    ctx.fillRect(0, 0, 320, 200);
    renderWeighPigletParade();

    if (!inClassroomSegment) {
      ctx.fillStyle = "#5f6770";
      ctx.fillRect(124, 118, 72, 42);
      ctx.fillStyle = "#111315";
      ctx.fillRect(132, 126, 56, 8);
      renderPig();
    } else {
      const isIndustryQuestion =
        state.t >= CLASSROOM_SECOND_PROMPT_START_SECONDS ||
        state.classroomQuestionKey === "industry";
      const questionText = isIndustryQuestion
        ? "EVERYONE IN THE MEAT INDUSTRY IS:"
        : "WHAT IS YOUR PURPOSE?";
      const options = isIndustryQuestion
        ? [
            "A) COMPETING FOR HER ATTENTION.",
            "B) TRYING TO PLEASE.",
            "C) FED AND CARED FOR.",
            "D) A MEAT TYPE HOG.",
          ]
        : ["A) PLAY", "B) WORK", "C) YIELD", "D) NONE OF THE ABOVE"];

      ctx.fillStyle = "#7f744d";
      ctx.fillRect(18, 36, 286, 72);
      ctx.fillStyle = "#15140f";
      ctx.font = "8px monospace";
      ctx.fillText(questionText, 24, 50);
      ctx.fillText(options[0], 24, 62);
      ctx.fillText(options[1], 24, 72);
      ctx.fillText(options[2], 24, 82);
      ctx.fillText(options[3], 24, 92);
      ctx.fillStyle = "#d8cfa8";
      ctx.fillText(
        `SELECTION: ${["A", "B", "C", "D"][state.classroomChoice]}  (ARROWS + SPACE)`,
        24,
        112,
      );
      if (state.classroomLocked) {
        ctx.fillStyle = state.classroomStamp === "APPROVED" ? "#87be71" : "#bf5241";
        ctx.fillText(state.classroomStamp, 240, 112);
      }
      renderPig();
    }
  } else if (scene.key === "RUNWAY_SPRINT") {
    ctx.fillStyle = "#1f1a17";
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = "#47433e";
    ctx.fillRect(0, 34, 320, 132);
    for (const o of state.obstacles) {
      ctx.fillStyle = "#7c2b24";
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
    renderPig();
  } else if (scene.key === "INSPECTION_STOP") {
    ctx.fillStyle = "#111013";
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = "#5c5e66";
    ctx.fillRect(38, 42, 244, 122);
    ctx.fillStyle = "#ac3426";
    ctx.font = "13px monospace";
    ctx.fillText("THE HOG IS TOO FAT", 67, 72);
    renderPig();
  } else if (scene.key === "FATBACK_CORRIDOR") {
    ctx.fillStyle = "#0f0f12";
    ctx.fillRect(0, 0, 320, 200);
    const pulse = Math.sin(state.t * 4) * 6;
    const w = clamp(118 + pulse, 98, 140);
    const x = (320 - w) * 0.5;
    ctx.fillStyle = "#dcd9cf";
    ctx.fillRect(x, 36, w, 150);
    ctx.fillStyle = "#22232a";
    ctx.fillRect(x + 9, 45, w - 18, 132);
    renderPig();
  } else if (scene.key === "WHITEOUT_PROMPT") {
    const whiteness = Math.floor(255 * state.flash);
    ctx.fillStyle = `rgb(${whiteness},${whiteness},${whiteness})`;
    ctx.fillRect(0, 0, 320, 200);
    if (state.t >= 226) {
      ctx.fillStyle = "#060606";
      ctx.fillRect(0, 0, 320, 200);
      ctx.fillStyle = "#c4c9c4";
      ctx.font = "11px monospace";
      ctx.fillText("C:\\HOGRAZR>", 12, 28);
      if (state.terminalCursorOn) {
        ctx.fillRect(88, 22, 6, 9);
      }
    }
  } else {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = "#c5cab8";
    ctx.font = "11px monospace";
    ctx.fillText("C:\\HOGRAZR>", 12, 28);
    if (state.terminalCursorOn) {
      ctx.fillRect(88, 22, 6, 9);
    }
  }
}

function renderBootScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
  ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = "#6e644a";
  ctx.fillRect(18, 24, 284, 152);
  ctx.fillStyle = "#0b0b0a";
  ctx.fillRect(20, 26, 280, 148);
  ctx.fillStyle = "#cabf9e";
  ctx.font = "10px monospace";
  ctx.fillText("HOGRAZR SHAREWARE LOAD MODULE", 35, 48);
  ctx.font = "8px monospace";
  ctx.fillText("VERSION 0.9x PROVISIONAL", 35, 62);
  ctx.fillText("PRESS SPACE OR ENTER TO BEGIN", 35, 86);
  ctx.fillText("PRESS F1 FOR REGISTRATION INFO", 35, 98);
  ctx.fillStyle = "#978f7c";
  ctx.fillText("ARROWS MOVE  /  SPACE CONTEXT ACTION", 35, 118);
  if (state.startError) {
    ctx.fillStyle = "#b55f4b";
    ctx.fillText("AUDIO START FAILED. PRESS SPACE TO RETRY.", 35, 154);
  } else if (Math.floor(performance.now() / 330) % 2 === 0) {
    ctx.fillStyle = "#d8ceaf";
    ctx.fillText("READY", 35, 154);
  }
}

function renderRegistrationOverlay() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
  ctx.fillRect(10, 10, 300, 180);
  ctx.fillStyle = "#7b6f54";
  ctx.fillRect(12, 12, 296, 176);
  ctx.fillStyle = "#090909";
  ctx.fillRect(14, 14, 292, 172);
  ctx.fillStyle = "#d9cfaf";
  ctx.font = "8px monospace";
  ctx.fillText("HOGRAZR (FATBACK) - SHAREWARE REGISTRATION", 20, 30);
  ctx.fillText("VERSION: 0.9x PROVISIONAL // SINGLE-TRACK", 20, 44);
  ctx.fillText("REGISTER: $8 CASH OR MONEY ORDER", 20, 60);
  ctx.fillText("FARMWARE TOOLS", 20, 76);
  ctx.fillText("P.O. BOX 1947, STOCKTON, IA 52769", 20, 88);
  ctx.fillText("REQUEST CODE: FRANK FARMER MODULE", 20, 104);
  ctx.fillText("RELATED TITLES:", 20, 122);
  ctx.fillText("CORNQUEST 2000 / SILO MASTER / VEAL RUNNER", 20, 134);
  ctx.fillStyle = "#b78f6b";
  ctx.fillText("PRESS F1 OR ESC TO RETURN", 20, 162);
}

function renderTonePass() {
  if (!state.started) return;

  const p = clamp(state.t / TRACK_DURATION_SECONDS, 0, 1);

  const grime = Math.floor(95 * p);
  ctx.fillStyle = `rgba(${grime},${Math.floor(grime * 0.84)},${Math.floor(grime * 0.55)},${0.08 + p * 0.26})`;
  ctx.fillRect(0, 0, 320, 200);

  const cold = Math.floor(90 * p);
  ctx.fillStyle = `rgba(${Math.floor(cold * 0.25)},${Math.floor(cold * 0.42)},${cold},${0.03 + p * 0.18})`;
  ctx.fillRect(0, 0, 320, 200);

  const lines = 30;
  const lineAlpha = 0.02 + p * 0.09;
  ctx.fillStyle = `rgba(0, 0, 0, ${lineAlpha})`;
  for (let i = 0; i < lines; i += 1) {
    const y = (i * 7 + Math.floor(state.t * 12)) % 200;
    ctx.fillRect(0, y, 320, 1);
  }

  const gritCount = Math.floor(18 + p * 110);
  for (let i = 0; i < gritCount; i += 1) {
    const x = Math.floor(Math.random() * 320);
    const y = Math.floor(Math.random() * 200);
    const alpha = 0.01 + Math.random() * (0.03 + p * 0.05);
    ctx.fillStyle = `rgba(240, 230, 205, ${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function renderTransitionOverlay() {
  if (!state.transition.active) return;

  const progress = clamp(state.transition.age / state.transition.duration, 0, 1);

  if (state.transition.mode === "wipe") {
    const h = Math.floor((1 - progress) * 200);
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, 0, 320, h);
  } else if (state.transition.mode === "jitter") {
    for (let i = 0; i < 6; i += 1) {
      const y = Math.floor(Math.random() * 200);
      const alpha = (1 - progress) * (0.28 + Math.random() * 0.18);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(0, y, 320, 1 + Math.floor(Math.random() * 2));
    }
  } else {
    ctx.fillStyle = `rgba(255,255,255,${(1 - progress) * 0.45})`;
    ctx.fillRect(0, 0, 320, 200);
  }

  if (progress >= 1) {
    state.transition.active = false;
  }
}

function renderFrame(scene) {
  const jitterX = state.started && Math.random() < 0.07 ? Math.floor(Math.random() * 3) - 1 : 0;
  const jitterY = state.started && Math.random() < 0.05 ? Math.floor(Math.random() * 3) - 1 : 0;

  ctx.save();
  ctx.translate(jitterX, jitterY);
  renderCurrentScene(scene);
  if (scene.key !== "WHITEOUT_PROMPT" && scene.key !== "END_IDLE") {
    renderHeader(scene.label);
    renderCue();
  }
  renderTonePass();
  if (!state.started) {
    renderBootScreen();
  }
  if (state.registrationOpen) {
    renderRegistrationOverlay();
  }
  renderTransitionOverlay();
  ctx.restore();
}

let lastTime = performance.now();
function gameLoop(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;

  if (state.started) {
    state.t = clamp(audio.currentTime || 0, 0, TRACK_DURATION_SECONDS + 6);
    const scene = getSceneForTime(state.t);
    state.sceneKey = scene.key;
    if (state.sceneKey !== state.prevSceneKey) {
      onSceneEnter(state.sceneKey);
      state.prevSceneKey = state.sceneKey;
    }

    state.mass = clamp(state.mass, 1, 120);
    state.compliance = clamp(state.compliance, 0, 99);

    if (state.transition.active) {
      state.transition.age += dt;
    }

    if (!state.registrationOpen) {
      updateScene(dt);
    }
    renderFrame(scene);
  } else {
    renderFrame(getSceneForTime(state.t));
  }

  input.actionPressed = false;
  requestAnimationFrame(gameLoop);
}

function handleKey(value, code) {
  if (code === "ArrowLeft") input.left = value;
  if (code === "ArrowRight") input.right = value;
  if (code === "ArrowUp") input.up = value;
  if (code === "ArrowDown") input.down = value;
  if (code === "Space") {
    if (value && !input.action) input.actionPressed = true;
    input.action = value;
  }
}

async function attemptStart() {
  if (state.started) return;
  state.startError = false;
  setRegistrationOverlay(false);
  state.truck.active = false;
  state.truck.horned = false;
  state.truck.x = TRUCK_PASS_START_X;
  state.truck.nextDropAt = 0;
  state.truckDroppedPiglets = [];

  audioFx.ensureContext();
  await audioFx.resume();

  state.started = true;
  try {
    await audio.play();
    audioFx.blip({ freq: 220, duration: 0.09, type: "square", gain: 0.38 });
  } catch (error) {
    state.started = false;
    state.startError = true;
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyM") {
    event.preventDefault();
    state.trackMuted = !state.trackMuted;
    applyTrackVolume();
    return;
  }

  if (event.code === "BracketLeft") {
    event.preventDefault();
    adjustTrackVolume(-0.1);
    return;
  }

  if (event.code === "BracketRight") {
    event.preventDefault();
    adjustTrackVolume(0.2);
    return;
  }

  if (event.code === "Digit0") {
    event.preventDefault();
    state.trackVolume = 0.1;
    state.trackMuted = false;
    applyTrackVolume();
    return;
  }

  if (event.code === "F1") {
    event.preventDefault();
    toggleRegistrationOverlay();
    return;
  }

  if (event.code === "Escape" && state.registrationOpen) {
    event.preventDefault();
    setRegistrationOverlay(false);
    return;
  }

  if (state.registrationOpen) {
    event.preventDefault();
    return;
  }

  if (!state.started && (event.code === "Space" || event.code === "Enter")) {
    event.preventDefault();
    attemptStart();
    return;
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  handleKey(true, event.code);
});

window.addEventListener("keyup", (event) => {
  if (state.registrationOpen) return;
  handleKey(false, event.code);
});

canvas.addEventListener("pointerdown", () => {
  if (state.registrationOpen) {
    setRegistrationOverlay(false);
    return;
  }
  attemptStart();
});

audio.addEventListener("ended", () => {
  state.t = TRACK_DURATION_SECONDS;
});

applyTrackVolume();
ctx.imageSmoothingEnabled = false;
renderFrame(getSceneForTime(0));
requestAnimationFrame(gameLoop);
