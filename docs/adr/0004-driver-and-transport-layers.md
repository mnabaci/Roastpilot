# 0004: Driver and transport layers for hardware

Status: accepted
Date: 2026-11-02

## Context

Roasters and boards will change. Keeping hardware behind two small interfaces makes a new roaster one new class and lets everything run against a simulator.

## Decision

The controller depends only on `RoasterDriver`; drivers use a `Transport` for bytes. `Tc4SkywalkerDriver` and `SimulatedDriver` ship first; `DriverFactory` picks one per roaster record.

## Consequences

Drivers must declare channels and capabilities so the UI can adapt.
