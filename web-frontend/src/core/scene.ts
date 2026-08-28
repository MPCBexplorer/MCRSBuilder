// scene.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RedstoneDustRenderer } from './redstonedust';
import { RedstoneTorchRenderer } from './redstonetorch';

export const BLOCK_SIZE = 1;
export const BLOCK_TYPES: { id: number; name: string; color: number; texture?: string }[] = [
    { id: 0, name: 'Air', color: 0x000000 },
    { id: 1, name: 'Stone', color: 0x888888, texture: '/textures/smooth_stone.png' },
    { id: 2, name: 'Redstone Dust', color: 0xff0000, texture: '/textures/redstone.png' },
    { id: 3, name: 'Redstone Torch', color: 0x000000, texture: '/textures/redstone_torch.png' },
    { id: 4, name: 'Repeater', color: 0xcccc00 },
    { id: 5, name: 'Comparator', color: 0x99ccff },
    { id: 6, name: 'Redstone Lamp', color: 0xff3333 },
    { id: 7, name: 'Redstone Block', color: 0xff0000, texture: '/textures/redstone_block.png' }
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
    private torchMeshes: THREE.Group = new THREE.Group(); // Redstone torch uses individual meshes
    private dummy = new THREE.Object3D();
    private tempMatrix = new THREE.Matrix4();
    private textures: Map<number, THREE.Texture> = new Map(); // blockId -> texture

    // Renderers for specialized components
    private redstoneRenderer = new RedstoneDustRenderer();
    private torchRenderer = new RedstoneTorchRenderer();

    // Incremental update: track redstone block states
    private redstoneStates: Map<string, {
        connections: number;
        power: number;
        mesh: THREE.Mesh;
    }> = new Map();

    // Track torch states for incremental updates
    private torchStates: Map<string, {
        connections: number;
        signal: number;
        meshes: THREE.Object3D[];  // Multiple objects for upright/wall variants (Group or Mesh)
    }> = new Map();

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
        this.scene.add(this.torchMeshes);

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
            texture.magFilter = THREE.NearestFilter;
            this.textures.set(1, texture);
            if (this.meshes.has(1)) {
                const mesh = this.meshes.get(1)!;
                (mesh.material as THREE.MeshStandardMaterial).map = texture;
                (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
            }
        });
        // Load redstone block texture
        loader.load('/textures/redstone_block.png', (texture) => {
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            texture.magFilter = THREE.NearestFilter;
            this.textures.set(7, texture);
            if (this.meshes.has(7)) {
                const mesh = this.meshes.get(7)!;
                (mesh.material as THREE.MeshStandardMaterial).map = texture;
                (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
            }
        });

        // Load torch textures
        this.torchRenderer.loadTextures(this.renderer);

        // Load redstone base textures (as HTMLImageElement for Canvas operations)
        await this.redstoneRenderer.loadTextures();
    }

    /** Wait for redstone textures to be loaded */
    public async waitForRedstoneTextures(): Promise<void> {
        if (this.redstoneRenderer.isLoaded) {
            return;
        }
        await new Promise<void>((resolve) => {
            const checkLoaded = () => {
                if (this.redstoneRenderer.isLoaded) {
                    resolve();
                } else {
                    setTimeout(checkLoaded, 50);
                }
            };
            checkLoaded();
        });
    }

    /** Initialize meshes for non-redstone blocks */
    private initMeshes() {
        const maxCount = 10000;
        for (const blockType of BLOCK_TYPES) {
            if (blockType.id === 0 || blockType.id === 2 || blockType.id === 3) continue;

            const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            const material = new THREE.MeshStandardMaterial({
                color: blockType.color,
                roughness: 0.7,
                metalness: 0.1,
                map: this.textures.get(blockType.id),
            });
            const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
            mesh.count = 0;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

            this.scene.add(mesh);
            this.meshes.set(blockType.id, mesh);
        }
    }

    /** Update instance matrices for all blocks */
    updateBlocks(blocks: Map<string, number>, redstonePowers: Map<string, number>,
        redstoneConnections?: Map<string, number>) {
        this.blockData = blocks;

        // Reset all InstanceMesh counts
        for (const [, mesh] of this.meshes) {
            mesh.count = 0;
        }

        // Track current keys to detect deletions
        const currentRedstoneKeys = new Set<string>();
        const currentTorchKeys = new Set<string>();

        for (const [key, blockId] of blocks) {
            const [x, y, z] = key.split(',').map(Number);

            // Handle redstone dust (type 2)
            if (blockId === 2) {
                currentRedstoneKeys.add(key);
                const connections = redstoneConnections?.get(key) ?? 0;
                const power = redstonePowers.get(key) ?? 0;
                const prevState = this.redstoneStates.get(key);

                if (!prevState) {
                    const texture = this.redstoneRenderer.getTexture(connections, power, this.renderer);
                    const geometry = new THREE.PlaneGeometry(1, 1);
                    const material = new THREE.MeshStandardMaterial({
                        map: texture,
                        transparent: true,
                        alphaTest: 0.1,
                        roughness: 0.5,
                        metalness: 0.0,
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(x, y - 0.5 + 0.01, z);
                    mesh.rotation.x = -Math.PI / 2;
                    this.redstoneMeshes.add(mesh);
                    this.redstoneStates.set(key, { connections, power, mesh });
                } else {
                    const changed = prevState.connections !== connections || prevState.power !== power;
                    if (changed) {
                        const newTexture = this.redstoneRenderer.getTexture(connections, power, this.renderer);
                        const mat = prevState.mesh.material as THREE.MeshStandardMaterial;
                        if (mat.map !== newTexture) {
                            mat.map = newTexture;
                            mat.needsUpdate = true;
                        }
                        prevState.connections = connections;
                        prevState.power = power;
                    }
                }
                continue;
            }

            // Handle redstone torch (type 3)
            if (blockId === 3) {
                currentTorchKeys.add(key);
                const connections = redstoneConnections?.get(key) ?? 0;
                const signal = redstonePowers.get(key) ?? 15;
                const prevState = this.torchStates.get(key);

                if (!prevState) {
                    const isWall = connections !== 0;
                    const geometry = this.torchRenderer.buildGeometry(isWall);
                    const texture = this.torchRenderer.getTexture(signal);
                    const material = new THREE.MeshStandardMaterial({
                        map: texture,
                        alphaTest: 0.1,
                        roughness: 0.7,
                        metalness: 0.1,
                        side: THREE.DoubleSide,// DoubleSide for both front and back faces
                        polygonOffset: true,
                        polygonOffsetFactor: 1,
                        polygonOffsetUnits: 1,
                    });
                    const group = new THREE.Group();
                    
                    // Add collision box for raycasting (2x2x10 pixels = 0.125x0.625x0.125 MC units)
                    const collisionGeometry = new THREE.BoxGeometry(2/16, 10/16, 2/16);
                    const collisionMaterial = new THREE.MeshBasicMaterial({ 
                        transparent: true, 
                        opacity: 0,
                        depthWrite: false,
                        polygonOffset: true,
                        polygonOffsetFactor: -2,
                        polygonOffsetUnits: -2
                    });
                    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
                    collisionMesh.position.y = 5/16; // Center at Y=5px (covers Y=0 to Y=10px from ground)
                    group.add(collisionMesh);
                    
                    const mesh = new THREE.Mesh(geometry, material);
                    group.add(mesh);
                    if (isWall) {
                        switch (connections) {
                            case 0b0001: group.rotation.y = 0; break;
                            case 0b0010: group.rotation.y = Math.PI / 2; break;
                            case 0b0100: group.rotation.y = Math.PI; break;
                            case 0b1000: group.rotation.y = -Math.PI / 2; break;
                        }
                    }
                    group.position.set(x, y, z);
                    this.torchMeshes.add(group);
                    this.torchStates.set(key, { connections, signal, meshes: [group] });
                } else {
                    const changed = prevState.connections !== connections || prevState.signal !== signal;
                    if (changed) {
                        for (const mesh of prevState.meshes) {
                            this.torchMeshes.remove(mesh);
                            mesh.traverse((child: THREE.Object3D) => {
                                if (child instanceof THREE.Mesh) {
                                    (child.material as THREE.Material).dispose();
                                }
                            });
                        }
                        const isWall = connections !== 0;
                        const geometry = this.torchRenderer.buildGeometry(isWall);
                        const texture = this.torchRenderer.getTexture(signal);
                        const material = new THREE.MeshStandardMaterial({
                            map: texture,
                            alphaTest: 0.1,
                            roughness: 0.7,
                            metalness: 0.1,
                            side: THREE.DoubleSide,
                            polygonOffset: true,
                            polygonOffsetFactor: 1,
                            polygonOffsetUnits: 1,
                        });
                        const group = new THREE.Group();
                        
                        // Add collision box for raycasting (2x2x10 pixels = 0.125x0.625x0.125 MC units)
                        const collisionGeometry = new THREE.BoxGeometry(2/16, 10/16, 2/16);
                        const collisionMaterial = new THREE.MeshBasicMaterial({ 
                            transparent: true, 
                            opacity: 0,
                            depthWrite: false,
                            polygonOffset: true,
                            polygonOffsetFactor: -2,
                            polygonOffsetUnits: -2
                        });
                        const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
                        collisionMesh.position.y = 5/16; // Center at Y=5px (covers Y=0 to Y=10px from ground)
                        group.add(collisionMesh);
                        
                        const mesh = new THREE.Mesh(geometry, material);
                        group.add(mesh);
                        if (isWall) {
                            switch (connections) {
                                case 0b0001: group.rotation.y = 0; break;
                                case 0b0010: group.rotation.y = Math.PI / 2; break;
                                case 0b0100: group.rotation.y = Math.PI; break;
                                case 0b1000: group.rotation.y = -Math.PI / 2; break;
                            }
                        }
                        group.position.set(x, y, z);
                        this.torchMeshes.add(group);
                        this.torchStates.set(key, { connections, signal, meshes: [group] });
                    }
                }
                continue;
            }

            // Standard blocks
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
        for (const [key] of this.redstoneStates) {
            if (!currentRedstoneKeys.has(key)) {
                const state = this.redstoneStates.get(key);
                if (state) {
                    this.redstoneMeshes.remove(state.mesh);
                    (state.mesh.material as THREE.Material).dispose();
                    (state.mesh.geometry as THREE.BufferGeometry).dispose();
                    this.redstoneStates.delete(key);
                }
            }
        }

        // Remove deleted torch blocks
        for (const [key] of this.torchStates) {
            if (!currentTorchKeys.has(key)) {
                const state = this.torchStates.get(key);
                if (state) {
                    for (const mesh of state.meshes) {
                        this.torchMeshes.remove(mesh);
                        mesh.traverse((child: THREE.Object3D) => {
                            if (child instanceof THREE.Mesh) {
                                (child.material as THREE.Material).dispose();
                                (child.geometry as THREE.BufferGeometry).dispose();
                            }
                        });
                    }
                    this.torchStates.delete(key);
                }
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

    /** Get block coordinates at mouse position */
    getBlockAtPointer(clientX: number, clientY: number): {
        hitBlock: { x: number; y: number; z: number; blockId: number };  // The clicked block
        placeBlock: { x: number; y: number; z: number; blockId: number };  // Adjacent placement position
        normal?: THREE.Vector3;  // Hit face normal for determining torch orientation
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

        // Add torch meshes
        this.torchMeshes.traverse((child) => {
            if (child instanceof THREE.Mesh) allObjects.push(child);
        });

        // Detect all objects and sort by distance
        let intersects = this.raycaster.intersectObjects(allObjects, true);
        intersects.sort((a, b) => a.distance - b.distance);

        if (intersects.length === 0) return null;

        const hit = intersects[0];

        // Check if hit is a torch collision box
        if (hit.object instanceof THREE.Mesh && !(hit.object instanceof THREE.InstancedMesh)) {
            const mesh = hit.object as THREE.Mesh;
            
            // Check if this mesh is a torch collision box by looking up in torchStates
            for (const [key, state] of this.torchStates) {
                for (const group of state.meshes) {
                    // Check if the hit mesh is a child of this torch group
                    let found = false;
                    group.traverse((child: THREE.Object3D) => {
                        if (child === mesh) found = true;
                    });
                    
                    if (found) {
                        // Extract coordinates from the key
                        const [x, y, z] = key.split(',').map(Number);
                        return {
                            hitBlock: { x, y, z, blockId: 3 },
                            placeBlock: { x, y: y + 1, z, blockId: 0 },
                            normal: new THREE.Vector3(0, 1, 0),
                        };
                    }
                }
            }
            
            // If not a torch collision box, check if it's a redstone mesh
            const pos = mesh.position;
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
                normal: new THREE.Vector3(0, 1, 0),
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
            normal: normal.clone(),
        };
    }

    /** Animation loop */
    animate() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}
