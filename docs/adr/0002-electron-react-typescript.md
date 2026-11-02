# 0002: Electron + React + TypeScript desktop app

Status: accepted
Date: 2026-11-02

## Context

The user knows React and TypeScript well; Electron gives serial port access and a native window; electron-vite gives fast reload for all three processes.

## Decision

An Electron app for macOS and Windows built with electron-vite, React, Tailwind CSS v4 and shadcn/ui.

## Consequences

Larger app size than a native app. Native modules (`serialport`, `better-sqlite3`) must be rebuilt for Electron (`install-app-deps`).
