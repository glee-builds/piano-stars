import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ON_SCENE, addToScene, moveInScene, resizeInScene, removeFromScene, flipInScene, turnInScene } from "../src/scene.js";

test("adding a sticker gives it its own key and a place inside the picture", () => {
  let scene = addToScene([], "space-rocket");
  scene = addToScene(scene, "space-rocket");
  assert.deepEqual(scene.map((item) => item.key), [1, 2]);
  assert.notDeepEqual([scene[0].x, scene[0].y], [scene[1].x, scene[1].y]);
  for (const item of scene) assert.ok(item.x > 0 && item.x < 100 && item.y > 0 && item.y < 100);
});

test("keys are never reused after a sticker is taken off", () => {
  let scene = addToScene(addToScene([], "a"), "b");
  scene = removeFromScene(scene, 1);
  scene = addToScene(scene, "c");
  assert.deepEqual(scene.map((item) => item.key), [2, 3]);
});

test("the scene stops taking stickers when it is full", () => {
  let scene = [];
  for (let i = 0; i < MAX_ON_SCENE + 5; i++) scene = addToScene(scene, "a");
  assert.equal(scene.length, MAX_ON_SCENE);
});

test("moving keeps a sticker inside the picture and lifts it to the top", () => {
  let scene = addToScene(addToScene([], "a"), "b");
  scene = moveInScene(scene, 1, 140, -20);
  assert.equal(scene[scene.length - 1].key, 1);
  assert.deepEqual([scene[1].x, scene[1].y], [95, 5]);
  assert.equal(moveInScene(scene, 99, 10, 10), scene);
});

test("size stays between small and big", () => {
  let scene = addToScene([], "a");
  scene = resizeInScene(resizeInScene(resizeInScene(scene, 1, 1), 1, 1), 1, 1);
  assert.equal(scene[0].size, 3);
  scene = resizeInScene(resizeInScene(resizeInScene(resizeInScene(scene, 1, -1), 1, -1), 1, -1), 1, -1);
  assert.equal(scene[0].size, 1);
});

test("flipping twice puts a sticker back, and only the chosen one changes", () => {
  let scene = addToScene(addToScene([], "a"), "b");
  scene = flipInScene(scene, 1);
  assert.deepEqual(scene.map((item) => Boolean(item.flip)), [true, false]);
  assert.equal(Boolean(flipInScene(scene, 1)[0].flip), false);
});

test("turning goes round in steps and comes back upright", () => {
  let scene = addToScene([], "a");
  scene = turnInScene(scene, 1);
  assert.equal(scene[0].turn, 30);
  for (let i = 0; i < 11; i++) scene = turnInScene(scene, 1);
  assert.equal(scene[0].turn, 0);
});
