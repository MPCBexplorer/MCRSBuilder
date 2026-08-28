/**
 * Redstone Torch Geometry Definitions
 * 
 * Reference: Minecraft block models (template_torch.json, template_torch_wall.json)
 * Source: Minecraft Java Edition assets (for development reference only)
 * 
 * Note: UV coordinates and element dimensions are based on Minecraft's 16x16 pixel grid.
 * For production use, consider replacing with original textures.
 */

// Coordinate system: [x, y, z] in 1/16th block units
export interface ElementFace {
  uv: [number, number, number, number]; // [u1, v1, u2, v2]
}

export interface Element {
  from: [number, number, number];
  to: [number, number, number];
  rotation?: {
    origin: [number, number, number];
    axis: 'x' | 'y' | 'z';
    angle: number;
  };
  faces: {
    north?: ElementFace;
    south?: ElementFace;
    east?: ElementFace;
    west?: ElementFace;
    up?: ElementFace;
    down?: ElementFace;
  };
}

export interface TorchModelDefinition {
  elements: Element[];
  particleTexture?: string; // Reserved for future particle effects
  ambientOcclusion?: boolean; // Reserved for future rendering optimization
}

/**
 * Upright torch geometry (standing on top of a block)
 * Collision box: 2×2×10 (width × depth × height)
 * Uses 3 intersecting thin plates to match Minecraft's rendering approach
 */
export const UPRIGHT_TORCH_MODEL: TorchModelDefinition = {
  particleTexture: 'redstone_torch', // Reserved for future use
  ambientOcclusion: false, // Reserved for future use
  elements: [
    // Element 1: Bottom base (7,0,7)-(9,10,9) - only top and bottom faces
    {
      from: [7, 0, 7],
      to: [9, 10, 9],
      faces: {
        down: { uv: [7, 13, 9, 15] },
        up: { uv: [7, 6, 9, 8] }
      }
    },
    // Element 2: North-South plate (7,0,0)-(9,16,16) - only west and east faces
    {
      from: [7, 0, 0],
      to: [9, 16, 16],
      faces: {
        west: { uv: [0, 0, 16, 16] },
        east: { uv: [0, 0, 16, 16] }
      }
    },
    // Element 3: East-West plate (0,0,7)-(16,16,9) - only north and south faces
    {
      from: [0, 0, 7],
      to: [16, 16, 9],
      faces: {
        north: { uv: [0, 0, 16, 16] },
        south: { uv: [0, 0, 16, 16] }
      }
    }
  ]
};

/**
 * Wall torch geometry (attached to side of a block)
 * Collision box: 2×9×10 (width × depth × height), with 2×10 face against the wall
 * Rotation: -22.5 degrees around Z axis
 * Uses 3 intersecting thin plates to match Minecraft's rendering approach
 */
export const WALL_TORCH_MODEL: TorchModelDefinition = {
  particleTexture: 'redstone_torch', // Reserved for future use
  ambientOcclusion: false, // Reserved for future use
  elements: [
    // Element 1: Bottom base (-1,3.5,7)-(1,13.5,9) with rotation - only top and bottom faces
    {
      from: [-1, 3.5, 7],
      to: [1, 13.5, 9],
      rotation: {
        origin: [0, 3.5, 8],
        axis: 'z',
        angle: -22.5
      },
      faces: {
        down: { uv: [7, 13, 9, 15] },
        up: { uv: [7, 6, 9, 8] }
      }
    },
    // Element 2: North-South plate (-1,3.5,0)-(1,19.5,16) with rotation - only west and east faces
    {
      from: [-1, 3.5, 0],
      to: [1, 19.5, 16],
      rotation: {
        origin: [0, 3.5, 8],
        axis: 'z',
        angle: -22.5
      },
      faces: {
        west: { uv: [0, 0, 16, 16] },
        east: { uv: [0, 0, 16, 16] }
      }
    },
    // Element 3: East-West plate (-8,3.5,7)-(8,19.5,9) with rotation - only north and south faces
    {
      from: [-8, 3.5, 7],
      to: [8, 19.5, 9],
      rotation: {
        origin: [0, 3.5, 8],
        axis: 'z',
        angle: -22.5
      },
      faces: {
        north: { uv: [0, 0, 16, 16] },
        south: { uv: [0, 0, 16, 16] }
      }
    }
  ]
};
