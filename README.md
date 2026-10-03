# Itzfizz — Scroll-Driven Rocket Launch

A cinematic **scroll-driven rocket launch experience** built for the frontend internship assignment.  
The entire launch sequence is controlled by scroll position using **GSAP ScrollTrigger** — scroll down to launch, scroll up to reverse.

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/GSAP-88CE02?style=for-the-badge&logo=greensock&logoColor=111111" alt="GSAP">
</p>

##  Highlights

-  Full-screen pinned hero animation
-  Scroll-controlled rocket launch sequence
-  Countdown, ignition and liftoff
-  Clouds, smoke and atmospheric effects
-  Stage separation and fairing jettison
-  Earth/orbit sequence and satellite deployment
-  Animated impact statistics
-  Telemetry HUD and scroll progress
-  Responsive layout
-  `prefers-reduced-motion` support
-  No build step — GSAP is bundled locally

##  Tech Stack

**HTML · CSS · Vanilla JavaScript · GSAP 3 · ScrollTrigger · Canvas · SVG**

## Run Locally

```bash
cd ascent
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

You can also open `index.html` directly in a browser.

## Project Structure

```text
ascent/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── smoke.js
│   └── sky.js
├── vendor/
│   ├── gsap.min.js
│   └── ScrollTrigger.min.js
└── .nojekyll
```
**A cinematic launch experience controlled by your scroll.**
