// scene.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const BLOCK_SIZE = 1;
export const BLOCK_TYPES = [
    { id: 0, name: 'Air', color: 0x000000 },
    { id: 1, name: 'Stone', color: 0x888888 },
    { id: 2, name: 'Redstone Dust', color: 0xff0000 },
    { id: 3, name: 'Redstone Torch', color: 0xff6600 },
    { id: 4, name: 'Repeater', color: 0xcccc00 },
    { id: 5, name: 'Comparator', color: 0x99ccff },
    { id: 6, name: 'Redstone Lamp', color: 0xff3333 },
];

export class SceneManager {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    raycaster: THREE.Raycaster;
    pointer: THREE.Vector2;
    private meshes: Map<number, THREE.InstancedMesh> = new Map();
    private blockData: Map<string, number> = new Map(); // "x,y,z" -> blockId
    private redstoneMeshes: THREE.Group = new THREE.Group(); // Redstone dust uses individual meshes
    private dummy = new THREE.Object3D();
    private tempMatrix = new THREE.Matrix4();
    private textures: Map<number, THREE.Texture> = new Map(); // blockId -> texture

    // Redstone texture components (base textures as masks)
    private redstoneLineTexture: HTMLImageElement | null = null;
    private redstoneDotTexture: HTMLImageElement | null = null;
    private redstoneTextureCache: Map<string, THREE.CanvasTexture> = new Map(); // "connections-power" -> texture
    private redstoneTexturesLoaded = false;

    // Incremental update: track redstone block states
    private redstoneStates: Map<string, {
        connections: number;
        power: number;
        mesh: THREE.Mesh;
    }> = new Map();

    // Shared geometry for all redstone meshes (avoids creating duplicates)
    private redstoneGeometry: THREE.PlaneGeometry | null = null;

    constructor(container: HTMLElement) {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(10, 10, 10);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;

        // Raycaster
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        // Lights
        const ambient = new THREE.AmbientLight(0x808080);  // Enhanced ambient light
        this.scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);  // Enhanced directional light
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);
        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.8);  // Enhanced auxiliary directional light
        dirLight2.position.set(-5, 5, -5);
        this.scene.add(dirLight2);

        // Grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
        this.scene.add(gridHelper);

        // Add X axis arrow
        const xDir = new THREE.Vector3(10, 0, 0);
        const origin = new THREE.Vector3(0, 0, 0);
        const arrowColorX = 0xff0000; // Red
        const arrowHelperX = new THREE.ArrowHelper(xDir, origin, xDir.length(), arrowColorX, 0.5, 0.25);
        this.scene.add(arrowHelperX);

        // Add Y axis arrow
        const yDir = new THREE.Vector3(0, 10, 0);
        const arrowColorY = 0x00ff00; // Green
        const arrowHelperY = new THREE.ArrowHelper(yDir, origin, yDir.length(), arrowColorY, 0.5, 0.25);
        this.scene.add(arrowHelperY);

        // Add Z axis arrow
        const zDir = new THREE.Vector3(0, 0, 10);
        const arrowColorZ = 0x0000ff; // Blue
        const arrowHelperZ = new THREE.ArrowHelper(zDir, origin, zDir.length(), arrowColorZ, 0.5, 0.25);
        this.scene.add(arrowHelperZ);

        // Add redstone group to scene
        this.scene.add(this.redstoneMeshes);

        // Initialize meshes first (before textures are loaded)
        this.initMeshes();

        // Load textures asynchronously
        this.loadTextures().then(() => {
            // All textures loaded
        });

        // Window resize
        window.addEventListener('resize', () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
    }

    // Load textures and return a Promise that resolves when all are ready
    private async loadTextures() {
        const loader = new THREE.TextureLoader();

        // Load stone texture
        loader.load('/textures/smooth_stone.png', (texture) => {
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            this.textures.set(1, texture);
            if (this.meshes.has(1)) {
                const mesh = this.meshes.get(1)!;
                (mesh.material as THREE.MeshStandardMaterial).map = texture;
                (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
            }
        });

        // Load redstone base textures (as HTMLImageElement for Canvas operations)
        await this.loadImage();
        this.redstoneTexturesLoaded = true;
    }

    /** Wait for redstone textures to be loaded */
    public async waitForRedstoneTextures(): Promise<void> {
        if (this.redstoneTexturesLoaded) {
            return;
        }
        await new Promise<void>((resolve) => {
            const checkLoaded = () => {
                if (this.redstoneTexturesLoaded) {
                    resolve();
                } else {
                    setTimeout(checkLoaded, 50);
                }
            };
            checkLoaded();
        });
    }

    private loadImage() {
        return new Promise<void>((resolve, reject) => {
            let loaded = 0;
            const total = 2;

            this.redstoneLineTexture = new Image();
            this.redstoneLineTexture.crossOrigin = 'anonymous';
            this.redstoneLineTexture.onload = () => {
                //console.log('[Redstone] Line texture loaded, size:', this.redstoneLineTexture!.naturalWidth, 'x', this.redstoneLineTexture!.naturalHeight);
                loaded++;
                if (loaded === total) resolve();
            };
            this.redstoneLineTexture.onerror = (e) => {
                console.error('[Redstone] Failed to load line texture:', e);
                reject(new Error('Failed to load redstone line texture'));
            };
            this.redstoneLineTexture.src = '/textures/redstone_dust_line0.png';

            this.redstoneDotTexture = new Image();
            this.redstoneDotTexture.crossOrigin = 'anonymous';
            this.redstoneDotTexture.onload = () => {
                console.log('[Redstone] Dot texture loaded, size:', this.redstoneDotTexture!.naturalWidth, 'x', this.redstoneDotTexture!.naturalHeight);
                loaded++;
                if (loaded === total) resolve();
            };
            this.redstoneDotTexture.onerror = (e) => {
                console.error('[Redstone] Failed to load dot texture:', e);
                reject(new Error('Failed to load redstone dot texture'));
            };
            this.redstoneDotTexture.src = '/textures/redstone_dust_dot.png';
        });
    }

    private initMeshes() {
        const maxCount = 10000;

        for (const blockType of BLOCK_TYPES) {
            if (blockType.id === 0 || blockType.id === 2) continue; // Skip air and redstone dust

            const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            const material = new THREE.MeshStandardMaterial({
                color: blockType.color,
                roughness: 0.7,
                metalness: 0.1,
            });

            const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
            mesh.count = 0;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

            this.scene.add(mesh);
            this.meshes.set(blockType.id, mesh);
        }
    }

    /** Tint an image: color all non-transparent pixels */
    private tintImage(ctx: CanvasRenderingContext2D, r: number, g: number, b: number): number {
        const imgData = ctx.getImageData(0, 0, 16, 16);
        const d = imgData.data;
        let count = 0;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 0) {
                d[i] = r;
                d[i + 1] = g;
                d[i + 2] = b;
                count++;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return count;
    }

    /** Draw a line segment for a specific direction */
    private drawLineSegment(ctx: CanvasRenderingContext2D, direction: 'east' | 'south' | 'west' | 'north',
        r: number, g: number, b: number): void {
        const temp = document.createElement('canvas');
        temp.width = 16;
        temp.height = 16;
        const tCtx = temp.getContext('2d')!;

        let rotation = 0;
        if (direction === 'east' || direction === 'west') { rotation = -Math.PI / 2; }  // Counter-clockwise 90°

        // Rotate around center of canvas
        tCtx.translate(8, 8);
        tCtx.rotate(rotation);
        tCtx.translate(-8, -8);
        // Draw the full texture first
        tCtx.drawImage(this.redstoneLineTexture!, 0, 0);


        // Now clip to keep only half (from center to edge)
        // Notice: according to the rotated axis
        if ((direction === 'east') || (direction === 'south')) {
            tCtx.clearRect(0, 0, 16, 8);
        } else if ((direction === 'west') || (direction === 'north')) {
            tCtx.clearRect(0, 8, 16, 8);
        }
        // Tint: color all non-transparent pixels
        this.tintImage(tCtx, r, g, b);
        ctx.drawImage(temp, 0, 0);
    }

    /** Draw center dot */
    private drawCenterDot(ctx: CanvasRenderingContext2D, r: number, g: number, b: number): boolean {
        if (!this.redstoneDotTexture ||
            !this.redstoneDotTexture.complete ||
            this.redstoneDotTexture.naturalWidth === 0) {
            return false;
        }

        const temp = document.createElement('canvas');
        temp.width = 16;
        temp.height = 16;
        const tCtx = temp.getContext('2d')!;
        tCtx.drawImage(this.redstoneDotTexture!, 0, 0);

        const count = this.tintImage(tCtx, r, g, b);
        ctx.drawImage(temp, 0, 0);
        //console.log(`[Redstone]   Center dot: ${count} pixels`);
        return true;
    }

    /** Render redstone texture to canvas */
    private renderRedstoneTexture(ctx: CanvasRenderingContext2D, connections: number,
        connectionCount: number, r: number, g: number, b: number): void {
        // For standalone redstone (0 connections), draw all 4 directions to form a cross
        const isStandalone = (connectionCount === 0);
        if (connectionCount === 1) {
            if ((connections === 1) || (connections === 4)) {
                this.drawLineSegment(ctx, 'east', r, g, b);
                this.drawLineSegment(ctx, 'west', r, g, b);
            }
            if ((connections === 2) || (connections === 8)) {
                this.drawLineSegment(ctx, 'south', r, g, b);
                this.drawLineSegment(ctx, 'north', r, g, b);
            }
        } else {
            // Draw line segments for each connection direction
            if ((connections & 1) === 1 || isStandalone) this.drawLineSegment(ctx, 'east', r, g, b);
            if ((connections & 2) === 2 || isStandalone) this.drawLineSegment(ctx, 'south', r, g, b);
            if ((connections & 4) === 4 || isStandalone) this.drawLineSegment(ctx, 'west', r, g, b);
            if ((connections & 8) === 8 || isStandalone) this.drawLineSegment(ctx, 'north', r, g, b);
        }
        // Determine if center dot should be drawn:
        // - 0 connections (standalone): YES (cross shape with center dot)
        // - 1 connection: NO (single line only)
        // - 2 connections: YES if NOT a straight line (i.e., corner connection)
        // - 3+ connections: YES
        // Straight lines: East+West (5) or North+South (10) should NOT have center dot
        const isStraightEW = (connections === 5); // East (1) + West (4) = 5
        const isStraightNS = (connections === 10); // North (8) + South (2) = 10
        const isStraightLine = isStraightEW || isStraightNS;

        const shouldDrawDot = isStandalone ||
            (connectionCount === 2 && !isStraightLine) ||
            connectionCount >= 3;

        if (shouldDrawDot) {
            this.drawCenterDot(ctx, r, g, b);
        }
    }

    /** Get redstone texture based on connections and power level */
    private getRedstoneTexture(connections: number, power: number): THREE.CanvasTexture {
        const cacheKey = `${connections}-${power}`;
        if (this.redstoneTextureCache.has(cacheKey)) {
            return this.redstoneTextureCache.get(cacheKey)!;
        }

        const powerColor = this.getRedstoneColor(power);
        const r = Math.floor(powerColor.r * 255);
        const g = Math.floor(powerColor.g * 255);
        const b = Math.floor(powerColor.b * 255);

        const connectionCount =
            ((connections & 1) >> 0) +
            ((connections & 2) >> 1) +
            ((connections & 4) >> 2) +
            ((connections & 8) >> 3);

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d')!;

        const texturesReady = this.redstoneLineTexture &&
            this.redstoneLineTexture.complete &&
            this.redstoneLineTexture.naturalWidth > 0;

        if (texturesReady) {
            //console.log(`[Redstone] Drawing connections=${connections} (${connections.toString(2).padStart(4, '0')}), power=${power}`);
            this.renderRedstoneTexture(ctx, connections, connectionCount, r, g, b);
        } else {
            // Fallback
            console.warn('[Redstone] Textures not loaded, using fallback');
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(0, 0, 16, 16);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;

        this.redstoneTextureCache.set(cacheKey, texture);
        return texture;
    }

    /** Calculate color based on power level */
    private getRedstoneColor(power: number): THREE.Color {
        // power: 0-15
        const colors = [
            0x4C0000, 0x700000, 0x7A0000, 0x840000, 0x8E0000, 0x990000,
            0xA30000, 0xAD0000, 0xB70000, 0xC10000, 0xCC0000, 0xD60000,
            0xE00000, 0xEA0600, 0xF41B00, 0xFF3200
        ];
        return new THREE.Color(colors[power]);
    }

    /** Update instance matrices for all blocks */
    updateBlocks(blocks: Map<string, number>, redstonePowers: Map<string, number>,
        redstoneConnections?: Map<string, number>) {
        this.blockData = blocks;

        // Reset all InstanceMesh counts
        for (const [, mesh] of this.meshes) {
            mesh.count = 0;
        }

        // Initialize shared geometry for redstone
        if (!this.redstoneGeometry) {
            this.redstoneGeometry = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE);
        }

        // Track current redstone keys to detect deletions
        const currentRedstoneKeys = new Set<string>();

        // Re-populate instances
        for (const [key, blockId] of blocks) {
            const [x, y, z] = key.split(',').map(Number);

            // Handle redstone dust with incremental updates
            if (blockId === 2) {
                currentRedstoneKeys.add(key);
                const connections = redstoneConnections?.get(key) ?? 0;
                const power = redstonePowers.get(key) ?? 0;

                const prevState = this.redstoneStates.get(key);

                if (!prevState) {
                    // New redstone block: create mesh
                    this.createRedstoneMesh(key, connections, power, x, y, z);
                } else {
                    // Existing block: check if state changed
                    const changed = prevState.connections !== connections || prevState.power !== power;
                    const positionChanged = prevState.mesh.position.x !== x ||
                                           prevState.mesh.position.y !== (y - BLOCK_SIZE / 2 + 0.01) ||
                                           prevState.mesh.position.z !== z;

                    if (changed) {
                        // Update texture
                        const newTexture = this.getRedstoneTexture(connections, power);
                        const mat = prevState.mesh.material as THREE.MeshStandardMaterial;
                        if (mat.map !== newTexture) {
                            mat.map = newTexture;
                            mat.needsUpdate = true;
                        }
                        // Update tracked state
                        prevState.connections = connections;
                        prevState.power = power;
                    }

                    if (positionChanged) {
                        // Update position
                        prevState.mesh.position.set(x, y - BLOCK_SIZE / 2 + 0.01, z);
                    }
                }
                continue;
            }

            const mesh = this.meshes.get(blockId);
            if (!mesh) continue;

            const idx = mesh.count;

            this.dummy.position.set(x, y, z);
            this.dummy.updateMatrix();
            this.tempMatrix.copy(this.dummy.matrix);
            mesh.setMatrixAt(idx, this.tempMatrix);

            mesh.count = idx + 1;
        }

        // Remove deleted redstone blocks
        for (const [key, state] of this.redstoneStates) {
            if (!currentRedstoneKeys.has(key)) {
                this.redstoneMeshes.remove(state.mesh);
                // Note: do NOT dispose geometry since it's shared
                (state.mesh.material as THREE.Material).dispose();
                this.redstoneStates.delete(key);
            }
        }

        // Update instanceMatrix for all InstanceMeshes
        for (const [, mesh] of this.meshes) {
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) {
                mesh.instanceColor.needsUpdate = true;
            }
            mesh.computeBoundingSphere();
            mesh.computeBoundingBox();
        }
    }


    /** Create a redstone mesh and add to tracked state */
    private createRedstoneMesh(key: string, connections: number, power: number,
        x: number, y: number, z: number): void {
        const texture = this.getRedstoneTexture(connections, power);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide,
            roughness: 0.5,
            metalness: 0.0,
        });

        const mesh = new THREE.Mesh(this.redstoneGeometry!, material);
        mesh.position.set(x, y - BLOCK_SIZE / 2 + 0.01, z);
        mesh.rotation.x = -Math.PI / 2;

        this.redstoneMeshes.add(mesh);
        this.redstoneStates.set(key, { connections, power, mesh });
    }

    /** Get block coordinates at mouse position */
    getBlockAtPointer(clientX: number, clientY: number): {
        hitBlock: { x: number; y: number; z: number; blockId: number };  // The clicked block
        placeBlock: { x: number; y: number; z: number; blockId: number };  // Adjacent placement position
    } | null {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);

        // Collect all detectable objects: InstancedMeshes + Redstone meshes
        const allObjects: (THREE.InstancedMesh | THREE.Mesh)[] = [];

        // Add InstancedMeshes with count > 0
        for (const [, mesh] of this.meshes) {
            if (mesh.count > 0) allObjects.push(mesh);
        }

        // Add redstone meshes
        this.redstoneMeshes.traverse((child) => {
            if (child instanceof THREE.Mesh) allObjects.push(child);
        });

        // Detect all objects and sort by distance
        let intersects = this.raycaster.intersectObjects(allObjects, true);
        intersects.sort((a, b) => a.distance - b.distance);

        if (intersects.length === 0) return null;

        const hit = intersects[0];

        // Handle redstone mesh hit
        if (hit.object instanceof THREE.Mesh && !(hit.object instanceof THREE.InstancedMesh)) {
            const mesh = hit.object as THREE.Mesh;
            const pos = mesh.position;
            // pos.y = y - 0.49, so pos.y + 0.5 ≈ y + 0.01, floor gives y
            const hitY = Math.floor(pos.y + BLOCK_SIZE / 2);
            const hitX = Math.floor(pos.x);
            const hitZ = Math.floor(pos.z);
            const hitKey = `${hitX},${hitY},${hitZ}`;
            const hitBlockId = this.blockData.get(hitKey) ?? 2;

            // Redstone is flat, place block on top
            const placeKey = `${hitX},${hitY + 1},${hitZ}`;
            const placeBlockId = this.blockData.get(placeKey) ?? 0;

            return {
                hitBlock: { x: hitX, y: hitY, z: hitZ, blockId: hitBlockId },
                placeBlock: { x: hitX, y: hitY + 1, z: hitZ, blockId: placeBlockId },
            };
        }

        // Handle InstancedMesh hit
        const point = hit.point;
        const normal = hit.face?.normal;
        if (!normal) return null;

        const epsilon = 0.001;
        const offsetX = normal.x > 0 ? 0.5 - epsilon : 0.5 + epsilon;
        const offsetY = normal.y > 0 ? 0.5 - epsilon : 0.5 + epsilon;
        const offsetZ = normal.z > 0 ? 0.5 - epsilon : 0.5 + epsilon;
        const hitX = Math.floor(point.x + offsetX);
        const hitY = Math.floor(point.y + offsetY);
        const hitZ = Math.floor(point.z + offsetZ);
        const hitKey = `${hitX},${hitY},${hitZ}`;
        const hitBlockId = this.blockData.get(hitKey) ?? 0;

        // Special case: check if the hit position itself has redstone dust
        if (hitBlockId === 2) {
            return {
                hitBlock: { x: hitX, y: hitY, z: hitZ, blockId: 2 },
                placeBlock: { x: hitX, y: hitY + 1, z: hitZ, blockId: 0 },
            };
        }

        // Special case: if hitting top surface, check for redstone dust above
        if (normal.y > 0.5) {
            const redstoneKey = `${hitX},${hitY + 1},${hitZ}`;
            const redstoneBlockId = this.blockData.get(redstoneKey);
            if (redstoneBlockId === 2) {
                return {
                    hitBlock: { x: hitX, y: hitY + 1, z: hitZ, blockId: 2 },
                    placeBlock: { x: hitX, y: hitY + 2, z: hitZ, blockId: 0 },
                };
            }
        }

        let placeX = hitX;
        let placeY = hitY;
        let placeZ = hitZ;

        if (normal.x > 0.5) placeX += 1;
        else if (normal.x < -0.5) placeX -= 1;
        if (normal.y > 0.5) placeY += 1;
        else if (normal.y < -0.5) placeY -= 1;
        if (normal.z > 0.5) placeZ += 1;
        else if (normal.z < -0.5) placeZ -= 1;

        const placeKey = `${placeX},${placeY},${placeZ}`;
        const placeBlockId = this.blockData.get(placeKey) ?? 0;

        return {
            hitBlock: { x: hitX, y: hitY, z: hitZ, blockId: hitBlockId },
            placeBlock: { x: placeX, y: placeY, z: placeZ, blockId: placeBlockId },
        };
    }

    /** Animation loop */
    animate() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}
