// The sticker scene: a picture the player decorates with stickers from the
// album. Nothing in this file touches the page.
//
// The scene is a list, drawn in order, so later items sit on top:
// [{ key: 1, id: "space-rocket", x: 50, y: 40, size: 2 }]
// `x` and `y` are the middle of the sticker, as a percent of the picture's
// width and height. `size` is 1 (small), 2, or 3 (big). `flip` (true when
// mirrored) and `turn` (degrees clockwise) are left out until they are used.

export const MAX_ON_SCENE = 30;
export const MIN_SIZE = 1;
export const MAX_SIZE = 3;

const EDGE = 5; // how close to the edge, in percent, a sticker's middle can go
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Puts a sticker on the scene. Each new one lands a little apart from the
// last, so they don't pile up exactly. Returns the scene unchanged when full.
export function addToScene(scene, stickerId) {
  if (scene.length >= MAX_ON_SCENE) return scene;
  const key = Math.max(0, ...scene.map((item) => item.key)) + 1;
  const step = scene.length % 9;
  const item = { key, id: stickerId, x: 26 + (step % 3) * 24, y: 30 + Math.floor(step / 3) * 20, size: 2 };
  return [...scene, item];
}

// Moves a sticker, keeping it inside the picture, and lifts it to the top.
export function moveInScene(scene, key, x, y) {
  const item = scene.find((entry) => entry.key === key);
  if (!item) return scene;
  const moved = { ...item, x: clamp(Math.round(x), EDGE, 100 - EDGE), y: clamp(Math.round(y), EDGE, 100 - EDGE) };
  return [...scene.filter((entry) => entry.key !== key), moved];
}

// Makes a sticker one step bigger (by = 1) or smaller (by = -1).
export function resizeInScene(scene, key, by) {
  return scene.map((item) =>
    item.key === key ? { ...item, size: clamp(item.size + by, MIN_SIZE, MAX_SIZE) } : item);
}

// Mirrors a sticker left to right, or back again.
export function flipInScene(scene, key) {
  return scene.map((item) => (item.key === key ? { ...item, flip: !item.flip } : item));
}

// Turns a sticker one step clockwise. Twelve steps bring it back upright.
export const TURN_STEP = 30;
export function turnInScene(scene, key) {
  return scene.map((item) =>
    item.key === key ? { ...item, turn: ((item.turn || 0) + TURN_STEP) % 360 } : item);
}

export function removeFromScene(scene, key) {
  return scene.filter((item) => item.key !== key);
}
