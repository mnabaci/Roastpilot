# Build order and open questions

Eight milestones. Each one is usable on its own before the next starts.

1. **Serial console:** a TypeScript script that lists ports, opens one at 115200 baud, sends `UNITS;C` and `READ` every second, and lets you type commands. First safe hardware test.
2. **Electron shell + manual roast:** live chart, big numbers, heater/fan sliders, safety rules active. Build it against the simulated driver first, then roast manually with the real one.
3. **Logging:** SQLite tables, save every roast, history screen with overlay.
4. **Auto mode:** phase-based profiles (Skywalker Light first), between-batch preheat, PID trim and curve follow, dry-end marker, FC button, auto drop and cooling. Tune the trim and follow on real roasts.
5. **Roasters:** roaster records, capability-driven UI, PID tuning per roaster.
6. **Beans and favourites:** bean library, stock and yield, batch calculator, stars, step and curve profiles from a roast, profile suggestion, ghost layer.
7. **Manual coach:** background controller, suggestion card, Apply.
8. **Polish + packaging:** profile editor (phases, curve points, milestone builder), Artisan import, CSV export, macOS DMG and Windows installer.

## Open questions

- [ ] Smallest batch that still roasts evenly on the Skywalker (batch min)?
