# EMBERLINE — Fire Season

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/angelomlbb07-cyber/makefun-best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/angelomlbb07-cyber/makefun-best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D wildfire air-tanker game for the [best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057) bounty. Fire season in a mountain valley: three fronts are burning, one threatens the lakeside town, one the ranger station. You fly the tanker — scoop water from the lake, drop it on the fire, save the valley.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/index.html` plus its ES modules, all local. Desktop Chrome, keyboard + mouse.

| Key | Does |
| --- | --- |
| Arrows / WASD | Fly (pitch and bank) |
| Shift / Ctrl | Throttle up / down |
| Space | Drop water |
| Mouse (hold) | Bank toward the pointer |
| R | Restart the sortie |
| P | Pause |
| M | Mute |

## The sortie

- **Take off** from the airstrip, throttle up, pull back when you have speed.
- **Scoop**: fly low and slow over the lake (under 42 m/s, skimming the water) to fill the tank. The water gauge turns blue as it fills.
- **Drop**: Space releases water over a fire. A full tank puts out roughly one front — the ring on the ground marks each live front, and the HUD names the most urgent one.
- **Decisions**: fuel burns, the hull cooks if you fly through a fire plume below 42 m, and the fronts grow while you fly. Land on the strip to refuel and repair. Win by putting out all three fronts; lose if the town or the ranger station burns down, or the aircraft does.

## What it is made of

- `game/index.html` — the page; `game/src/main.js` — boot and game loop.
- `game/src/gl.js` — a minimal raw-WebGL renderer (matrices, shaders, meshes). No engine, no library: every vertex is authored here.
- `game/src/world.js` — the valley: heightfield terrain, lake, airstrip, town, ranger station, trees, fire fronts.
- `game/src/plane.js` — the tanker mesh and the flight model (speed, lift, stall, bank-to-turn).
- `game/src/missions.js` — fire fronts, spread, town/station damage, scoring.
- `game/src/render.js` — the 3D scene: chase camera, sky dome, fires, smoke, drop rings, water.
- `game/src/hud.js` — the 2D overlay: airspeed, altitude, heading, attitude, fuel, water, hull, objective.
- `game/src/audio.js` — procedural WebAudio: engine, wind, scoop, drop, alarms. No audio files.
- `game/src/shots.js` — deterministic screenshot staging (`?shot=start|play|drop|end`).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` (or `MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` via `vendor/makefun-game.ts`.
- `serve.ts` — a tiny static server for local play.

## Screenshots

Real renders of this game's own code, taken in headless Chrome against the local server (see `shots.json` for the staging queries):

| File | Shows |
| --- | --- |
| `screenshots/1-start.png` | Title screen over the valley at golden hour |
| `screenshots/2-play.png` | Chase view, closing on the Lakeside front, drop ring ahead |
| `screenshots/3-drop.png` | Water falling on the Ridge front by the ranger station |
| `screenshots/4-end.png` | The valley saved — all fronts out |

## License

MIT. See [LICENSE](LICENSE).
