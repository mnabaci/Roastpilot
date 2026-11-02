# Roasters (plug and play)

Everything roaster-specific lives in one roaster record. Switching the active roaster switches
the driver, limits, batch sizes, profiles and suggestions together.

| Roaster setting                  | Skywalker starting value             |
| -------------------------------- | ------------------------------------ |
| Driver + connection              | `Tc4SkywalkerDriver` over USB serial |
| Capabilities                     | Heater, fan, drum, cooling, filter   |
| Batch size min / ideal / max (g) | [min] / 375 / 400                    |
| Safety limits                    | 240 °C, 20 min                       |
| PID defaults + coach gains       | Tuned on real roasts                 |
| Temperature offset               | 0 °C                                 |
| Preheat temp / cooling time      | 150 °C / 4 min                       |

- Profiles, roasts and favourites belong to a roaster. Light, Medium and Dark are created for each new roaster.
- The UI reads capabilities: a control the roaster doesn't have is hidden.
- Adding a roaster = pick an existing driver and fill in the record. A new kind of hardware = one new driver class (`add-extension` skill).
