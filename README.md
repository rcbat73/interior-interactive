# Interactive Home Walkthrough

Interactive Home Walkthrough is an interactive 3D web application built with Three.js that allows users to freely explore an architectural interior directly in the browser using first-person controls.

The project was originally developed as a product prototype for an architecture studio. The objective was to explore how future homeowners could visit and experience their property before construction through an interactive web application instead of static renders or images.

The long-term vision also included interior customization features, allowing users to place furniture, reposition objects and personalize rooms before construction.

---

## Live Demo

https://rcbat73.github.io/interactive-home-walkthrough/

---

## Features

- Interactive first-person walkthrough
- Desktop keyboard and mouse controls
- Mobile touch controls
- Collision detection
- Responsive experience for desktop and mobile
- Browser-based 3D rendering
- GLB model loading
- Smooth camera movement

---

## Technology Stack

- Three.js
- JavaScript (ES6)
- Vite
- HTML5
- CSS3
- Blender (3D modelling)
- glTF / GLB

---

## Getting Started

Clone the repository:

```bash
git clone https://github.com/rcbat73/interactive-home-walkthrough.git
cd interactive-home-walkthrough
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```
http://localhost:5173
```

---

## Production Build

Generate a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## Deployment

The project is deployed using GitHub Pages.

After generating the production build:

```bash
npm run build
```

Replace the `docs` folder with the contents of `dist`, then commit and push the changes.

GitHub Pages configuration:

```
Source: Deploy from a branch
Branch: main
Folder: /docs
```

---

## Project Status

Current version includes:

- Interactive architectural walkthrough
- Desktop and mobile navigation
- Collision detection
- Browser-based 3D visualization

Future improvements considered during the project:

- Furniture placement
- Object manipulation
- Electrical outlet positioning
- Interior customization
- Multiple property layouts

---

## License

This project is provided for portfolio and demonstration purposes.
