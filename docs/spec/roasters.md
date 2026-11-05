# Roasters (plug and play)

Everything roaster-specific lives in one roaster record. Switching the active roaster switches
the driver, limits, batch sizes, profiles and suggestions together. Profiles belong to a roaster
and never move between roasters on their own (see [roast-control.md](roast-control.md)).

| Roaster setting                  | Skywalker starting value                            |
| -------------------------------- | --------------------------------------------------- |
| Driver + connection              | `Tc4SkywalkerDriver` over USB serial                |
| Capabilities                     | Heater, fan, drum, cooling, filter                  |
| Batch size min / ideal / max (g) | [min] / 375 / 400                                   |
| Safety limits                    | 240 °C, 20 min                                      |
| PID gains, correction limit      | Tuned on real roasts; ±20%                          |
| Temperature offset               | 0 °C                                                |
| Preheat hold / cooling time      | 2:30 hold at charge temp / 4 min                    |
| Built-in profiles                | Skywalker set: Light (soak technique), Medium, Dark |

- Profiles, roasts and favourites belong to a roaster. A roaster model ships its own Light, Medium and Dark; an unknown model gets generic templates marked "needs calibration".
- The UI reads capabilities: a control the roaster doesn't have is hidden.
- Adding a roaster = pick an existing driver and fill in the record. A new kind of hardware = one new driver class (`add-extension` skill).
