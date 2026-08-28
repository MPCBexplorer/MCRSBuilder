# ADR-001: Redstone Torch Implementation

**Date**: 2026-08-24  
**Status**: Accepted  
**Type**: Architectural Decision

## Context

The MCRSBuilder simulator needs to implement redstone torch functionality. The torch is a fundamental redstone component that provides signal and inverts power through its "reverse logic" behavior (turning off when powered).

## Decision

### 1. Block Type Assignment

**Decision**: Redstone torch assigned type ID `3` in the `BlockState` type field.

**Rationale**:
- Type 2 is already used by redstone dust
- Type 7 is reserved for redstone block
- Type 3 provides a logical gap between existing types

### 2. Orientation Encoding via `connections` Field

**Decision**: Reuse the `connections` field (u4, bits 12-15) to store torch orientation instead of adding a new field.

**Encoding**:
```
0b0000 (0) = Top placement (standing on block)
0b0001 (1) = North face attachment
0b0010 (2) = West face attachment
0b0100 (4) = South face attachment
0b1000 (8) = East face attachment
```

**Rationale**:
- **Memory efficiency**: No additional fields needed in the packed `BlockState` struct
- **Semantic clarity**: Torches don't need connection directions like redstone dust. The field is semantically repurposed for torch orientation.
- **Bit-level operations**: Fast bitmask-based lookup for orientation detection

**Alternatives considered**:
- Using `_reserved` field: Would waste space other components might need
- Adding new field: Would require restructuring `BlockState` and potentially break WASM ABI

### 3. Signal Behavior

**Decision**: Torch outputs signal strength 15 when lit, 0 when extinguished.

**Rationale**:
- Matches Minecraft's standard torch behavior
- Simplifies signal calculations (no intermediate values needed)
- Consistent with redstone block's constant output

### 4. Power Detection Method

**Decision**: Implement power detection directly within the torch's `update()` function, using `canProvideSignal()` to check the attached block.

**Rationale**:
- Decouples torch logic from generic signal detection
- Allows custom logic for torch-specific power rules
- More maintainable than modifying `canProvideSignal()` for torch-specific cases

**Modified `canProvideSignal()`**:
```zig
3 => return nb.signal > 0,  // Only lit torches provide signal
```

### 5. Update Trigger Strategy

**Decision**: Primary update occurs at placement time via immediate `update()` call. Tick-based updates are placeholder for future expansion.

**Rationale**:
- **Immediate feedback**: User sees correct torch state right after placement
- **Reduced overhead**: Avoids unnecessary periodic checks for static configurations
- **Event-driven architecture**: Updates triggered by actual state changes

**Implementation**:
```zig
// In placeBlock():
if (blockId == 3) {
    redstone_torch.update(x, y, z);
}
```

### 6. Frontend Model Strategy

**Decision**: Use 4 model variants (lit/unlit × upright/tilted) with Y-axis rotation for side-facing torches.

**Model Variants**:
1. Lit upright - top placement when lit
2. Unlit upright - top placement when extinguished
3. Lit tilted - side placement when lit (rotated based on direction)
4. Unlit tilted - side placement when extinguished (rotated based on direction)

**Rotation Logic**:
- North (0b0001): 0° rotation (default)
- West (0b0010): 90° rotation
- South (0b0100): 180° rotation
- East (0b1000): 270° rotation

**Rationale**:
- **Visual accuracy**: Matches Minecraft's distinct upright vs. tilted torch geometries
- **Simplified rotation**: Only side-facing torches need rotation transforms
- **Collision optimization**: Different collision boxes for different orientations

## Consequences

### Positive
- Memory-efficient orientation storage
- Fast bitmask-based orientation lookup
- Clear separation between torch and redstone logic
- Extensible architecture for future components

### Negative
- No support for torch burnout mechanism (TODO)
- Neighbor notification not yet implemented
- Weak vs. strong power distinction not modeled (both treated equally)

### Future Work
1. Implement torch burnout when signal exceeds threshold
2. Complete neighbor notification in update function
3. Implement periodic re-check in tick() if needed
4. Import Minecraft textures and collision meshes
5. Model weak vs. strong power distinction

## Related Issues

- Redstone torch is a prerequisite for:
  - Redstone repeaters and comparators
  - Complex circuit simulation
  - Clock and oscillator circuits