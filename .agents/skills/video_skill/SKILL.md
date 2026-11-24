---
name: video_skill
description: Automated video production skill that inspects software projects, extracts standout and crazy features, captures high-fidelity visual assets, and renders broadcast-grade 1080p MP4 demo videos using FFmpeg with motion graphics, feature lower-thirds, and synchronized audio.
metadata:
  icon: video
---

# Video Skill — Automated Project Demo Video Production

The **video_skill** provides an automated, programmatic pipeline for transforming software codebases into polished, high-definition (1080p 60fps/30fps) product showcase and demo videos.

## Capabilities

1. **Intelligent Project Inspection**:
   - Analyzes project documentation (`README.md`, `ARCHITECTURE.md`, `PROJECT.md`), package scripts, and test suites.
   - Identifies flagship differentiators, core workflows, and "crazy features" that make the project stand out.

2. **Asset Orchestration & Live Capturing**:
   - Utilizes headless browsers (Chrome/Edge DevTools Protocol) or pre-built UI artifacts to capture pixel-perfect viewports (Desktop 1920x1080, Laptop 1366x768, Mobile 390x844).
   - Prepares high-contrast feature callouts, title cards, and UI progression sequences.

3. **Motion Graphics & Compositing (FFmpeg)**:
   - Dynamic Ken Burns panning and zooming across UI details (e.g. zooming in on QR codes, clock increments, or engine evals).
   - Cyberpunk / modern dark-mode aesthetic framing, glassmorphism letterboxes, animated lower-third title bars, and glowing badges.
   - Cross-fading and wipe scene transitions.

4. **Synchronized Audio Synthesis**:
   - Generates ambient rhythmic synth tracks, bass pulses, and audio accents directly via FFmpeg audio filtergraphs (`sine`, `aevalsrc`, `flanger`, `chorus`).

5. **Production Rendering**:
   - Outputs universal, web-ready H.264 / AAC `.mp4` video files optimized for GitHub releases, documentation embeds, and presentations.

## Standard Invocation Workflow

```bash
# Generate project demo video
node scripts/generate-demo-video.mjs
```

### Video Storyboard Structure
- **Scene 1: Hook & Identity**: App name, version, tagline, and architectural highlight.
- **Scene 2-7: Crazy Features Spotlight**: Deep-dive into each standout technical capability with real UI evidence.
- **Final Scene: Outro & Get Started**: Quick installation command, GitHub links, and runtime requirements.
