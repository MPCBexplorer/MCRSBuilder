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
    private dummy = new THREE.Object3D();
    private tempMatrix = new THREE.Matrix4();
    private textures: Map<number, THREE.Texture> = new Map(); // blockId -> texture

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

        // Load textures
        this.loadTextures();

        // Initialize InstancedMesh for all block types
        this.initMeshes();

        // Window resize
        window.addEventListener('resize', () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
    }

    // Load textures
    private loadTextures() {
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

        // Load redstone dust texture
        loader.load('/textures/redstone_dust_line0.png', (texture) => {
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            texture.premultiplyAlpha = true; // Ensure texture uses premultiplied alpha
            this.textures.set(2, texture);
            if (this.meshes.has(2)) {
                const mesh = this.meshes.get(2)!;
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.map = texture;
                mat.transparent = true;
                mat.alphaTest = 0.1;
                mat.premultipliedAlpha = true; // Ensure material uses premultiplied alpha
                mat.needsUpdate = true;
            }
        });
    }

    private initMeshes() {
        const maxCount = 10000;

        for (const blockType of BLOCK_TYPES) {
            if (blockType.id === 0) continue;

            let geometry: THREE.BoxGeometry;
            let material: THREE.MeshStandardMaterial;

            if (blockType.id === 2) {
                geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE / 16, BLOCK_SIZE);
                material = new THREE.MeshStandardMaterial({
                    roughness: 0.5,
                    metalness: 0.0,
                });
            } else {
                geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                material = new THREE.MeshStandardMaterial({
                    color: blockType.color,
                    roughness: 0.7,
                    metalness: 0.1,
                });
            }

            const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
            mesh.count = 0;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

         

            this.scene.add(mesh);
            this.meshes.set(blockType.id, mesh);
        }
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
    updateBlocks(blocks: Map<string, number>, redstonePowers: Map<string, number>) {
        this.blockData = blocks;

        // Reset all InstanceMesh counts
        for (const [, mesh] of this.meshes) {
            mesh.count = 0;
        }

        // Re-populate instances
        for (const [key, blockId] of blocks) {
            const mesh = this.meshes.get(blockId);
            if (!mesh) continue;

            const [x, y, z] = key.split(',').map(Number);
            const idx = mesh.count;

            // Set position
            if (blockId === 2) {
                this.dummy.position.set(x, y - 0.5 + 0.03125, z);
            } else {
                this.dummy.position.set(x, y, z);
            }

            this.dummy.updateMatrix();
            this.tempMatrix.copy(this.dummy.matrix);
            mesh.setMatrixAt(idx, this.tempMatrix);

            // Redstone dust: set color
            if (blockId=== 2) {
                const power = redstonePowers.get(key) ?? 0;
                const color = this.getRedstoneColor(power);
                mesh.setColorAt(idx, color);
            }

            mesh.count = idx + 1;
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
    } | null {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);

        const meshes: THREE.InstancedMesh[] = [];
        for (const [, mesh] of this.meshes) {
            if (mesh.count > 0) meshes.push(mesh);
        }

        const intersects = this.raycaster.intersectObjects(meshes, false);
        if (intersects.length === 0) return null;

        const hit = intersects[0];
        const point = hit.point;
        const normal = hit.face?.normal;
        if (!normal) return null;

        // Coordinates of the clicked block (round hit point)
        const epsilon = 0.001;
        const offsetX = normal.x > 0 ? 0.5 - epsilon : 0.5 + epsilon;
        const offsetY = normal.y > 0 ? 0.5 - epsilon : 0.5 + epsilon;
        const offsetZ = normal.z > 0 ? 0.5 - epsilon : 0.5 + epsilon;
        const hitX = Math.floor(point.x + offsetX);
        const hitY = Math.floor(point.y + offsetY);
        const hitZ = Math.floor(point.z + offsetZ);
        const hitKey = `${hitX},${hitY},${hitZ}`;
        const hitBlockId = this.blockData.get(hitKey) ?? 0;

        // Coordinates of adjacent placement position (offset along normal)
        let placeX = hitX;
        let placeY = hitY;
        let placeZ = hitZ;

        if (normal.x > 0.5) placeX += 1;        // Normal facing +X → place on the right
        else if (normal.x < -0.5) placeX -= 1;  // Normal facing -X → place on the left
        if (normal.y > 0.5) placeY += 1;        // Normal facing +Y → place on top
        else if (normal.y < -0.5) placeY -= 1;  // Normal facing -Y → place on bottom
        if (normal.z > 0.5) placeZ += 1;        // Normal facing +Z → place in front
        else if (normal.z < -0.5) placeZ -= 1;  // Normal facing -Z → place in back

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
