# Roasters (plug and play)

Everything roaster-specific lives in one roaster record. Switching the active roaster switches
the driver, limits, batch sizes, profiles and suggestions together. Profiles belong to a roaster
and never move between roasters on their own (see [roast-control.md](roast-control.md)).

| Roaster setting                  | Skywalker starting value                                                         |
| -------------------------------- | -------------------------------------------------------------------------------- |
| Driver + connection              | `Tc4SkywalkerDriver` over USB serial                                             |
| Capabilities                     | Heater, fan, drum, cooling, filter                                               |
| Batch size min / ideal / max (g) | 250 / 375 / 400                                                                  |
| Safety limits                    | 240 °C, 20 min                                                                   |
| PID gains, correction limit      | Tuned on real roasts; ±20%                                                       |
| Temperature offset               | 0 °C                                                                             |
| Preheat hold / cooling time      | 2:30 hold at charge temp / 4 min                                                 |
| Built-in profiles                | Skywalker set: Light · Steps, Light · Curve; Medium and Dark once Light is tuned |

- Profiles, roasts and favourites belong to a roaster. A roaster model ships its own Light, Medium and Dark; an unknown model gets generic templates marked "needs calibration".
- The UI reads capabilities: a control the roaster doesn't have is hidden.
- Adding a roaster = pick an existing driver and fill in the record. A new kind of hardware = one new driver class (`add-extension` skill).

## First version (milestone 5)

- **Two records to start:** Skywalker and Simulator, made by the migration. Add another by picking a model and filling in the record; a Simulator is the only other model until a new driver ships.
- **In the record:** name, model, connection, batch min / ideal / max, safety limits, temperature offset, preheat hold and PID gains. Batch min starts at 250 g; change it once you've tested smaller batches. Cooling stays in Settings, as it doesn't depend on the roaster so far.
- **Moving over:** the connection in Settings moves to the Skywalker or Simulator record on first start. Your own profiles and every saved roast move to the Skywalker record, simulator practice roasts included, as nothing recorded which roaster they used.
- **Active roaster:** one at a time. Connect uses it, and Connect on a roaster's page (Roasters screen) makes that roaster active first, and picking its port saves it on that record. Changing it, or its limits and gains, waits while it is connected. Its profiles, batch sizes and limits follow.
- **Limits:** the record's temperature and time limits replace the fixed ones, and can only be set at or below the model's own (Skywalker: 240 °C, 20 min).
- **Offset:** added to the temperature reading before anything else sees it, safety rules included.
- **Deleting:** a roaster with saved roasts or your own profiles can't be deleted, and neither can the active one.
- **Capabilities:** an output or switch the connected roaster doesn't have is hidden on the Roast screen.
- **Copy to another roaster:** on the Profiles screen, makes a copy there marked "needs calibration".
