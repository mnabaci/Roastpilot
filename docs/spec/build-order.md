# Build order and open questions

Eight milestones. Each one is usable on its own before the next starts.

1. **Serial console:** a Node script that opens the port, sends `READ` every second and prints replies. Answers the protocol questions below.
2. **Electron shell + manual roast:** live chart, big numbers, heater/fan sliders, safety rules active. Build it against the simulated driver first, then roast manually with the real one.
3. **Logging:** SQLite tables, save every roast, history screen with overlay.
4. **Auto mode:** phase-based profiles (Skywalker Light first), between-batch preheat, PID trim, dry-end marker, FC button, auto drop and cooling. Tune the trim on real roasts.
5. **Roasters:** roaster records, capability-driven UI, PID tuning per roaster.
6. **Manual coach:** background controller, suggestion card, Apply.
7. **Beans and favourites:** bean library, stock and yield, batch calculator, stars, custom profiles, profile suggestion, ghost layer.
8. **Polish + packaging:** profile editor, CSV export, macOS DMG and Windows installer.

## Open questions

- [ ] Which of `OT1` / `OT2` is the heater and which is the fan in the sketch?
- [ ] Exact format of the `READ` reply, and which field is the roaster temperature?
- [ ] Is there a serial command for the bean cooling fan, or does auto-cool need a small sketch change?
- [ ] Is the drum always on during a roast, or should profiles control it?
- [ ] Smallest batch that still roasts evenly on the Skywalker (batch min)?
- [ ] Are the BT values in the Light profile sheet (180/150/165/182 °C) from this modded Skywalker's sensor?
- [ ] Ideal batch: 375 g (stated) or 385 g (Light profile sheet)?
- [ ] License of the upstream SkywalkerRoaster sketch, before copying it into `firmware/`.
