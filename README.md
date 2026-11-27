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
| C | Cockpit / chase view |
| Mouse (hold) | Bank toward the pointer |
| R | Restart the sortie |
| P | Pause |
| M | Mute |

## The sortie

- **Take off** from the airstrip: throttle up down the runway, rotate at 90 km/h, climb out. The HUD calls each step — TAKEOFF ROLL, ROTATE, CLIMB OUT.
- **Cockpit**: the default view is the pilot's seat — panel, yoke and nose ahead, gauges lit, the horizon banking with the wings. Press C for the chase view.
- **Scoop**: fly low and slow over the lake (under 42 m/s, skimming the water) to fill the tank. The water gauge turns blue as it fills.
- **Drop**: Space releases water over a fire. A full tank puts out roughly one front — the ring on the ground marks each live front, and the HUD names the most urgent one.
- **Land**: come back on final approach, flare over the numbers, touch down gently — a smooth landing pays +50, a hard one +10. Land on the strip to refuel and repair. Win by putting out all three fronts; lose if the town or the ranger station burns down, or the aircraft does.

## What it is made of

- `game/index.html` — the page; `game/src/main.js` — boot and game loop.
- `game/src/gl.js` — a minimal raw-WebGL renderer (matrices, shaders, meshes). No engine, no library: every vertex is authored here.
- `game/src/world.js` — the valley: heightfield terrain, lake, airstrip, town, ranger station, trees, fire fronts.
- `game/src/plane.js` — the tanker mesh and the flight model (speed, lift, stall, bank-to-turn).
- `game/src/missions.js` — fire fronts, spread, town/station damage, scoring.
- `game/src/cockpit.js` — the first-person cockpit: its camera (rides the plane's heading, pitch and roll), its interior mesh (panel, yoke, canopy, nose), and the takeoff/landing phase the HUD announces.
- `game/src/render.js` — the 3D scene: chase and cockpit cameras, sky dome, fires, smoke, drop rings, water.
- `game/src/hud.js` — the 2D overlay: airspeed, altitude, heading, attitude, fuel, water, hull, objective, flight-phase banner, cockpit panel.
- `game/src/audio.js` — procedural WebAudio: engine, wind, scoop, drop, alarms. No audio files.
- `game/src/shots.js` — deterministic screenshot staging (`?shot=start|takeoff|drop|land|end`).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` (or `MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` via `vendor/makefun-game.ts`.
- `serve.ts` — a tiny static server for local play.

## Screenshots

Real renders of this game's own code, taken in headless Chrome against the local server (see `shots.json` for the staging queries):

| File | Shows |
| --- | --- |
| `screenshots/1-start.png` | Title screen from the cockpit, parked on the strip, runway ahead |
| `screenshots/2-takeoff.png` | Cockpit view at lift-off — TAKEOFF ROLL to ROTATE |
| `screenshots/3-drop.png` | Water falling on the Ridge front by the ranger station |
| `screenshots/4-land.png` | Cockpit view on final approach — FINAL APPROACH, strip ahead |

## License

MIT. See [LICENSE](LICENSE).
