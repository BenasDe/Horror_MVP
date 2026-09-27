# The Blood Marrow Pagoda: Demonic Grid
*Horror RPG for a nice spooky October*

## Scenario
You are a rogue cultivator whose soul has been sealed inside the **Blood Marrow Pagoda**—a 26-floor cursed artifact used by demonic elders to refine corpses. The pagoda is overflowing with concentrated Yin energy, twisting the spatial geometry into a rigid, maddening grid. Your only way out is to carve through rotting Jiangshi (hopping corpse fiends) and trapped resentful spirits, absorbing their corrupted Qi to forge demonic talismans.

Every five floors (Floors 5, 10, 15, 20, 25), you breach a **"Marrow Font"** (a safe room) where the oppressive Yin energy momentarily recedes. Here, you draft new, grotesque spells from the bones and blood of the enemies you’ve slain—sacrificing your humanity to gain the power needed to reach the 26th floor and shatter the pagoda’s seal.

---

## Core Mechanics

### 1. Three Core Character Stats
- **Health (Hits)**: Starts at **1 Hit**. Taking any damage shatters a soul talisman. Reaching 0 hits extinguishes your soul. Upgradable at Marrow Fonts.
- **Agility (Move Speed)**: Starts at **250 ms / step**. Dictates the real-time cooldown to transition between grid tiles. Upgrading Agility reduces step delay, letting you dodge Jiangshi hops.
- **Stamina (Spell Charges)**: Starts at **4 Casts / floor**. Determines how many demonic talismans you can invoke per combat floor. Automatically replenishes upon entering a new floor.

### 2. Grid Tile Status Manipulation
Spells and enemy abilities alter grid tile statuses in specific patterns:
- **`DAMAGING`** (Crimson Blood Spikes): Any entity stepping onto or caught within the tile takes 1 hit of lethal damage.
- **`INACCESSIBLE`** (Bone Spires / Flesh Walls): Blocks physical movement for both the player and ground enemies (wraiths phase through).
- **`SHIELDED`** (Cyan Taoist Wards): Immune to status changes; absorbs 1 hit / protects from damage.
- **`TELEGRAPHED`**: Runic countdown indicating impending tile transformation.

### 3. Spell Channeling & Movement Lock
- **Channeling Root**: While casting any spell, your movement is **completely locked** until the activation delay ends.
- **Scale vs. Delay**: Larger pattern spells have longer activation delays.
- **Queen's Ruin (Demonic Sacrifice)**: An apocalyptic board-wide blast (full cross + diagonals) requiring an extreme **3.00s movement root**. If any enemies remain alive on the board after the blast resolves, the caster loses **1 Health (hit)**!

### 4. Enemy Roster & Chess Spells
- **Hopping Jiangshi**: Rhythmic hopping with a 0.35s crouch telegraph. Deals 1 hit on landing. Periodically casts **Blood Pounce (Knight's Leap)** over obstacles.
- **Resentful Wraith**: Ethereal spirit that phases through Inaccessible walls. Channels **Bishop's Gaze (Diagonal Hex)**.
- **Corpse Scribe**: Backline bone sorcerer. Fires **Rook's Bone Lance** along full rows/columns and traps you with **Bone Cage**.
- **Floor 26 Boss (Corpse Emperor)**: Multi-phase 2x2 titan with rotating Imperial Cross lasers, Knight rain, and Corpse Extraction board purges.

---

## Controls
- **Movement**: `W`, `A`, `S`, `D` or `Arrow Keys` (Real-time tile-to-tile step)
- **Cast Spell 1**: `1` or `Q` (Default: *Pawn's Stride*)
- **Cast Spell 2**: `2` or `E` (Default: *Knight's Talon*)
- **Cast Spell 3**: `3` or `R` (Default: *Tortoise Sanctuary*)
- **Cast Spell 4**: `4` or `Space` (Default: *Queen's Ruin*)
- **Interact / Shop**: Mouse click on Altar upgrades and Talisman draft cards

---

## How to Run & Play
Since this is built with modern HTML5 Canvas, modular JavaScript, and procedural Web Audio API, it requires zero external dependencies or compilation.

### Option A: Local Server (Recommended for ES6 Modules)
Run a local Python HTTP server from this directory:
```bash
py -m http.server 8000
```
Then open your browser to:
[http://localhost:8000](http://localhost:8000)

### Option B: Direct Browser Launch
Open `index.html` directly in Edge, Chrome, or Firefox.
