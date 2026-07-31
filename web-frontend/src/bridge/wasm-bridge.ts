// wasm-bridge.ts
// Responsible for loading .wasm files and wrapping Zig exported functions

export interface WasmExports {
  initWorld: (width: number, height: number, depth: number) => void;
  placeBlock: (x: number, y: number, z: number, blockId: number) => void;
  removeBlock: (x: number, y: number, z: number) => void;
  tick: () => void;
  getBlockState: (x: number, y: number, z: number) => number;
  setBlockSignal: (x: number, y: number, z: number, signal: number) => void;
}

let wasmInstance: WebAssembly.Instance | null = null;
let wasmExports: WasmExports | null = null;

export async function loadWasm(): Promise<WasmExports> {
  if (wasmExports) return wasmExports;

  const response = await fetch('/redstone_core.wasm');
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: {
      // Import JS functions needed by Zig here (print, error callbacks, etc.)
      // Currently Zig side has no imports, leave empty
    },
  });

  wasmInstance = instance;
  wasmExports = instance.exports as unknown as WasmExports;
  return wasmExports;
}

export function getWasm(): WasmExports {
  if (!wasmExports) throw new Error('Wasm not loaded yet');
  return wasmExports;
}
