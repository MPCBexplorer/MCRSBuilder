// main.ts
import './style.css';
import { loadWasm, getWasm } from './bridge/wasm-bridge';
import { SceneManager, BLOCK_TYPES } from './core/scene';
import { toTypeId } from './core/util';

async function main() {
    // Load Wasm
    await loadWasm();
    const wasm = getWasm();
    console.log('Wasm loaded successfully!');
    console.log('Wasm exports:', wasm);

    // Initialize redstone world
    wasm.initWorld(32, 32, 32);

    // Get container
    const app = document.getElementById('app')!;
    app.innerHTML = '';

    // Create scene
    const sceneManager = new SceneManager(app);
    sceneManager.animate();

    // Currently selected block type (default: redstone dust)
    let currentBlockId = 2;

    // Create UI toolbar (simple example, can be extended later)
    const toolbar = document.createElement('div');
    toolbar.className = 'ui-toolbar';  // Add class
    toolbar.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        background: rgba(0,0,0,0.7);
        padding: 8px 16px;
        border-radius: 8px;
        z-index: 100;
    `;

    for (const blockType of BLOCK_TYPES) {
        if (blockType.id === 0) continue;
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid ${blockType.id === currentBlockId ? '#fff' : 'transparent'};
            border-radius: 4px;
            cursor: pointer;
            background-color: #${blockType.color.toString(16).padStart(6, '0')};
        `;
        btn.title = blockType.name;
        btn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();  // Prevent pointerdown bubbling
        });
        btn.addEventListener('click', () => {
            currentBlockId = blockType.id;
            // Update button border
            toolbar.querySelectorAll('button').forEach((b) => {
                b.style.borderColor = 'transparent';
            });
            btn.style.borderColor = '#fff';
        });
        toolbar.appendChild(btn);
    }
    app.appendChild(toolbar);

    // Edit mode enum
    const EditMode = {
        Move: 'move',
        Info: 'info',
        Block: 'block',
        Line: 'line',
    } as const;

    type EditMode = (typeof EditMode)[keyof typeof EditMode];

    let currentMode: EditMode = EditMode.Block;

    // Create left toolbar
    const leftToolbar = document.createElement('div');
    leftToolbar.className = 'left-toolbar';  // Add class
    leftToolbar.style.cssText = `
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: rgba(0,0,0,0.7);
        padding: 8px;
        border-radius: 8px;
        z-index: 100;
    `;

    const tools = [
        { id: EditMode.Move, label: 'Moving', icon: '✋' },
        { id: EditMode.Info, label: 'Info', icon: 'ℹ️' },
        { id: EditMode.Block, label: 'Block', icon: '🧱' },
        { id: EditMode.Line, label: 'Line', icon: '📏' },
    ];

    const modeButtons: Map<string, HTMLButtonElement> = new Map();

    for (const tool of tools) {
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 48px;
            height: 48px;
            border: 2px solid ${tool.id === currentMode ? '#fff' : 'transparent'};
            border-radius: 8px;
            cursor: pointer;
            background: ${tool.id === currentMode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};
            color: #fff;
            font-size: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        btn.innerHTML = `${tool.icon}<span style="font-size:10px;margin-top:2px;">${tool.label}</span>`;
        btn.title = tool.label;
        btn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();  // Prevent pointerdown bubbling
        });
        btn.addEventListener('click', () => {
            // Update button styles
            for (const [, b] of modeButtons) {
                b.style.borderColor = 'transparent';
                b.style.background = 'rgba(255,255,255,0.1)';
            }
            btn.style.borderColor = '#fff';
            btn.style.background = 'rgba(255,255,255,0.2)';
            currentMode = tool.id;
            console.log('Switched mode to:', tool.label);

            // Switch interaction behavior based on mode
            switchMode(tool.id);
        });
        modeButtons.set(tool.id, btn);
        leftToolbar.appendChild(btn);
    }

    app.appendChild(leftToolbar);

    // Mode switching logic
    function switchMode(mode: EditMode) {
        toolbar.style.display = mode === EditMode.Block ? 'flex' : 'none';

        // Show info box in info mode, hide in other modes
        infoBox.style.display = mode === EditMode.Info ? 'block' : 'none';

        switch (mode) {
            case EditMode.Move:
                app.style.cursor = 'grab';
                break;
            case EditMode.Info:
                app.style.cursor = 'crosshair';
                break;
            case EditMode.Block:
                app.style.cursor = 'default';
                break;
            case EditMode.Line:
                app.style.cursor = 'crosshair';
                break;
        }
    }

    // Local block data cache
    const localBlockData = new Map<string, number>();

    // Redstone dust power state cache
    const redstonePowers = new Map<string, number>();

    let isPointerDown = false;
    let pointerButton = -1;
    let pointerDownX = 0;
    let pointerDownY = 0;
    const DRAG_THRESHOLD = 8; // Pixel threshold, exceeding is considered a drag

    app.addEventListener('pointerdown', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.ui-toolbar') || target.closest('.left-toolbar')) {
            return; // Clicking toolbar does not trigger block operations
        }
        isPointerDown = true;
        pointerButton = e.button;
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
    });

    app.addEventListener('pointermove', (e) => {
        // If mouse is pressed and moving, mark as drag
        if (isPointerDown) {
            const dx = e.clientX - pointerDownX;
            const dy = e.clientY - pointerDownY;
            if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
                isPointerDown = false;
            }
        }

        // Info mode: follow mouse to show info box
        if (currentMode === EditMode.Info) {
            const result = sceneManager.getBlockAtPointer(e.clientX, e.clientY);
            if (result) {
                const { x, y, z } = result.hitBlock;
                const state = wasm.getBlockState(x, y, z);
                const typeId = (state >> 24) & 0xFF;
                const signal = (state >> 16) & 0xFF;
                const blockType = BLOCK_TYPES.find(t => t.id === typeId);

                infoBox.innerHTML = `
                    <div>Coords: (${x}, ${y}, ${z})</div>
                    <div>Type: ${blockType?.name ?? 'Unknown'} (ID: ${typeId})</div>
                    <div>Signal: ${signal}</div>
                `;

                infoBox.style.left = (e.clientX + 15) + 'px';
                infoBox.style.top = (e.clientY - 10) + 'px';
                infoBox.style.display = 'block';
            } else {
                infoBox.style.display = 'none';
            }
        }
    });

    app.addEventListener('pointerup', (e) => {
        if (!isPointerDown) return;
        isPointerDown = false;

        const result = sceneManager.getBlockAtPointer(e.clientX, e.clientY);
        if (!result) return;

        switch (currentMode) {
            case EditMode.Move:
                break;

            case EditMode.Info:
                break;

            case EditMode.Block:
                if (pointerButton === 2) {
                    // Right-click place
                    const { x, y, z } = result.placeBlock;
                    if (toTypeId(wasm.getBlockState(x,y-1,z)) !== 1 && currentBlockId !== 1) break;
                    wasm.placeBlock(x, y, z, currentBlockId);
                    localBlockData.set(`${x},${y},${z}`, currentBlockId);
                    redstonePowers.set(`${x},${y},${z}`, 0);
                    syncWorldToScene();
                } else if (pointerButton === 0) {
                    // Left-click delete
                    const { x, y, z } = result.hitBlock;
                    if (toTypeId(wasm.getBlockState(x, y + 1, z)) > 1) {
                        wasm.removeBlock(x, y + 1, z);
                        localBlockData.delete(`${x},${y + 1},${z}`);
                        redstonePowers.delete(`${x},${y + 1},${z}`);
                    }
                    wasm.removeBlock(x, y, z);
                    localBlockData.delete(`${x},${y},${z}`);
                    redstonePowers.delete(`${x},${y},${z}`);
                    syncWorldToScene();
                }
                break;

            case EditMode.Line:
                // Line mode: reserved for future continuous placement
                console.log('Line mode - click position:', result.placeBlock);
                break;
        }
    });

    function syncWorldToScene() {
        // Wasm does not provide a method to iterate all blocks, frontend maintains a local Map
        // Sync update on each place/delete
        // Update from local blockData
        sceneManager.updateBlocks(localBlockData, redstonePowers);
    }

    // Create info box
    const infoBox = document.createElement('div');
    infoBox.style.cssText = `
        position: fixed;
        display: none;
        background: rgba(0,0,0,0.8);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.6;
        pointer-events: none;
        z-index: 200;
        white-space: nowrap;
        border: 1px solid rgba(255,255,255,0.2);
        font-family: monospace;
    `;
    document.body.appendChild(infoBox);

    // Ground initialization
    for (let x = -16; x < 17; x++) {
        for (let z = -16; z < 17; z++) {
            wasm.placeBlock(x, -1, z, 1);
            localBlockData.set(x.toString() + ',-1,' + z.toString(), 1);
        }
    }
    // Place some test blocks
    wasm.placeBlock(0, 0, 0, 2);
    localBlockData.set('0,0,0', 2);
    redstonePowers.set('0,0,0', 10); // Example: power level 10
    wasm.setBlockSignal(0, 0, 0, 10); // Example: set signal strength to 10

    wasm.placeBlock(1, 0, 0, 2);
    localBlockData.set('1,0,0', 2);
    redstonePowers.set('1,0,0', 15); // Example: power level 15
    wasm.setBlockSignal(1, 0, 0, 15); // Example: set signal strength to 15



    wasm.placeBlock(0, 0, 1, 3);
    localBlockData.set('0,0,1', 3);
    syncWorldToScene();

    console.log('Frontend initialization complete!');

    // At the end: expose to global for debugging
    (window as any).sceneManager = sceneManager;
    (window as any).wasm = wasm;
    (window as any).localBlockData = localBlockData;
    (window as any).syncWorldToScene = syncWorldToScene;
    (window as any).redstonePowers = redstonePowers;
}

main().catch(console.error);
