export const TRACK_DURATION_SECONDS = 227;
export const DEFAULT_CUE_DURATION_SECONDS = 2.5;
export const CLASSROOM_PROMPT_START_SECONDS = 135;
export const CLASSROOM_SECOND_PROMPT_START_SECONDS = 145;

export const SCENE_TIMELINE = [
  { key: "BOOT_HOLDING_PEN", start: 0, end: 13, label: "BOOT / HOLDING PEN" },
  { key: "INTAKE_TAGGING", start: 13, end: 45, label: "INTAKE / TAGGING" },
  { key: "FEEDTIME", start: 45, end: 110, label: "FEEDTIME" },
  { key: "WEIGH_CLASSROOM", start: 110, end: 165, label: "WEIGH LINE / MARKET CLASSROOM" },
  { key: "RUNWAY_SPRINT", start: 165, end: 175, label: "RUNWAY SPRINT" },
  { key: "INSPECTION_STOP", start: 175, end: 193, label: "INSPECTION STOP" },
  { key: "FATBACK_CORRIDOR", start: 193, end: 220, label: "FATBACK CORRIDOR" },
  { key: "WHITEOUT_PROMPT", start: 220, end: 227, label: "WHITEOUT / PROMPT" },
  { key: "END_IDLE", start: 227, end: Number.POSITIVE_INFINITY, label: "END IDLE" },
];

export const TRACK_CUES = [
  { time: 25, duration: 2.0, text: "END OF THE LINE" },
  { time: 29, duration: 3.0, text: "END OF THE LINE // HOGRAZOR" },
  { time: 38, duration: 5.6, text: "MEET TY PAWGZ!" },
  { time: 41, duration: .3, text: "MEET TY PAWGZ" },
  { time: 41.3, duration: .2, text: "MEET TY" },
  { time: 41.5, duration: .5, text: "MEET TY P" },
  { time: 42, duration: 5.6, text: "MEET" },
  { time: 43, duration: 2.6, text: "MEAT TYPE HOGS" },
  { time: 45, duration: 2.7, text: "BUT NOT ALL WILL BE AS HAPPY" },
  { time: 83, duration: 2.7, text: "FRANK FARMER // MAKE THE FARMER HAPPY" },
  { time: 102, duration: 2.4, text: "HIGH PERCENTAGE LEAN CUTS" },
  { time: 115, duration: 2.8, text: "LOOK THEM OVER" },
  { time: 148, duration: 2.5, text: "EVERYONE IS TRYING TO PLEASE" },
  { time: 155, duration: 2.4, text: "LET'S FOLLOW THIS YOUNG LADY" },
  { time: 175, duration: 2.5, text: "SHE HAS TOO MUCH FAT" },
  { time: 189, duration: 2.5, text: "THE HOG IS TOO FAT" },
  { time: 194, duration: 2.8, text: "NOT ENOUGH LEAN MEAT" },
  { time: 220, duration: 2.2, text: "FRANK FARMER. MAKE THE FARMER HAPPY." },
  { time: 220, duration: 2.2, text: "MANY JOBS ARE DONE BY MACHINES" },
  { time: 226, duration: 1.4, text: "MAKE THE FARMER HAPPY" },
];

export function getSceneForTime(seconds) {
  for (const scene of SCENE_TIMELINE) {
    if (seconds >= scene.start && seconds < scene.end) {
      return scene;
    }
  }
  return SCENE_TIMELINE[SCENE_TIMELINE.length - 1];
}

export function getActiveCue(seconds) {
  for (let i = TRACK_CUES.length - 1; i >= 0; i -= 1) {
    const cue = TRACK_CUES[i];
    const duration = cue.duration ?? DEFAULT_CUE_DURATION_SECONDS;
    if (seconds >= cue.time && seconds <= cue.time + duration) {
      return cue.text;
    }
  }
  return "";
}
