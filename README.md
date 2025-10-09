CYK Algorithm Visualizer & Personal Grammar Checker
==================================================

Interactive web app to learn, simulate, and visualize the Cocke–Younger–Kasami (CYK) parsing algorithm, with a Personal Grammar Checker for custom context-free grammars.

Features
--------
- CYK tab with hero cards and links to resources
- Simulator tab to input a CNF-style grammar and a word and generate the CYK table
- Personal Grammar Checker (PGC) for natural-language-like grammars with quoted terminals
- Visual parse tree rendered top-down using react-d3-tree, plus optional ASCII view
- Full-page background image, clean UI with Tailwind-like utility classes
- Floating download button to save `presentation.pdf`

Tech Stack
----------
- React (Vite)
- lucide-react icons
- react-d3-tree for parse tree visualization

Getting Started
---------------
1) Install dependencies

```bash
npm install
```

2) Run the dev server

```bash
npm run dev
```

3) Build for production

```bash
npm run build
```

4) Preview production build

```bash
npm run preview
```

Project Structure (key files)
-----------------------------
- `src/App.jsx` – main UI, tabs, CYK/PGC logic, Simulator, tree rendering
- `public/bg.jpg` – app background image
- `public/presentation.pdf` – downloadable PDF (via floating button)
- `public/*.jpg` – team images used in About Us

Usage
-----
CYK tab
- Overview and links; try the hero buttons to navigate.

Simulator tab
- Grammar format (CNF-style):
  - Binary rules: `A -> B C`
  - Terminal rules: `A -> a` or quoted terminals: `Det -> "the" | "a"`
- Enter a word (e.g., `ababa`) and click "Generate Table" to view the CYK matrix and acceptance.

Personal Grammar Checker (PGC)
- Default example (from attached screenshots):

```
S -> NP VP
NP -> Det N
VP -> V NP
Det -> "the" | "a"
N -> "cat" | "dog"
V -> "chased"
```

- Enter a sentence like `the cat chased a dog` and click "Generate Table & Parse Tree".
- The app tokenizes on spaces and supports quoted multi-word terminal.
- 

Download Button
---------------
- A floating round button at bottom-right downloads `presentation.pdf`.

Notes & Tips
------------
- Grammars should follow Chomsky Normal Form (CNF):
    either:

      A -> BC (two non-terminals), or

      A -> a (single terminal)

 - When using natural language, use quoted terminals for words.
 - If a valid sentence is rejected, check:
 - Grammar rules follow CNF
 - Tokens match your terminal symbols
  
Contributors
-------------

Shashikant Kumar 
Saloni Kumari 
Divyanshi Singh
Ketan


License
-------
For educational/demo use. Replace or extend as needed for your project.



