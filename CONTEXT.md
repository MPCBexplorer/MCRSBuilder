# MCRSBuilder Context

## Project Overview

MCRSBuilder is a 3D Minecraft redstone simulator using Zig (WASM backend) and Three.js (frontend).

## Domain Model

### Core Concepts

- **Block**: A 3D grid position that can contain a component
- **Component**: A redstone element with specific behavior (wire, torch, block, etc.)
- **Signal Strength**: Integer 0-15 representing redstone power level
- **Coord**: 3D position (x, y, z) in the world grid

### Block Types

| Type ID | Component | Description |
|---------|-----------|-------------|
| 2 | Redstone Dust | Transmits and decreases signal strength |
| 3 | Redstone Torch | Provides signal and inverts power |
| 4 | Repeater | Forwards signal with configurable delay |
| 5 | Comparator | Compares signal strengths |
| 7 | Redstone Block | Constant signal source (strength 15) |

## Redstone Torch Design

### Overview

The redstone torch is a fundamental redstone component that:
- Outputs signal strength 15 when lit
- Turns off (signal = 0) when its attached block becomes powered
- Supports 5 placement orientations (1 top + 4 sides)

### Placement Orientations

The torch orientation is stored in the `connections` field (u4, bits 12-15):

| Connections (binary) | Orientation | Description |
|---------------------|-------------|-------------|
| 0b0000 | Top | Standing on top of a block |
| 0b0001 | North | Attached to north face of block |
| 0b0010 | West | Attached to west face of block |
| 0b0100 | South | Attached to south face of block |
| 0b1000 | East | Attached to east face of block |

### Attached Block Detection

The torch checks the power state of the block it's attached to:

| Connections | Check Block At |
|-------------|----------------|
| 0b0000 | (x, y-1, z) |
| 0b0001 | (x, y, z+1) |
| 0b0010 | (x+1, y, z) |
| 0b0100 | (x, y, z-1) |
| 0b1000 | (x-1, y, z) |

### Power Detection Logic

A block is considered "powered" if:
- `canProvideSignal()` returns true for that block
- For redstone dust/repeater/comparator: signal > 0
- For redstone torch: signal > 0 (only lit torches provide power)
- For redstone block: always true

### Signal Output

- **Lit state**: `signal = 15` (maximum strength)
- **Extinguished state**: `signal = 0` (no power)

### Update Trigger

The torch update is triggered:
1. At placement time (via immediate `update()` call in `placeBlock()`)
2. During tick processing (placeholder for future periodic checks)

### Frontend Integration

#### Model Variants (pending texture import)

1. Lit upright - for top placement when lit
2. Unlit upright - for top placement when extinguished
3. Lit tilted - for side placement when lit
4. Unlit tilted - for side placement when extinguished

#### Rotation Logic

Side-facing torches use Y-axis rotation:
- North (0b0001): 0° (default)
- West (0b0010): 90°
- South (0b0100): 180°
- East (0b1000): 270°

#### Collision Boxes

- Upright: Small cube centered at bottom
- Tilted: Small cube near attachment point
- Rotation pivot: Center of 16×16 pixel space

## Known Limitations

1. **Torch burnout**: Not yet implemented (TODO)
2. **Neighbor notification**: Empty stub in update function
3. **Periodic re-check**: tick() integration is minimal
4. **Frontend assets**: Textures and collision meshes pending
5. **Weak vs strong power**: Treated equally (Minecraft distinction not modeled)