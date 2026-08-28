// redstonetorch.ts
import * as THREE from 'three';
import type { Element } from './geometry/torch_geometry';
import { UPRIGHT_TORCH_MODEL, WALL_TORCH_MODEL } from './geometry/torch_geometry';

export class RedstoneTorchRenderer {
    private torchLitTexture: THREE.Texture | null = null;
    private torchUnlitTexture: THREE.Texture | null = null;
    private torchGeometries: Map<string, THREE.BufferGeometry> = new Map();

    /** Load torch textures */
    loadTextures(renderer: THREE.WebGLRenderer): void {
        const loader = new THREE.TextureLoader();
        
        this.torchLitTexture = loader.load('/textures/redstone_torch.png', (texture) => {
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            texture.magFilter = THREE.NearestFilter;
        });
        
        this.torchUnlitTexture = loader.load('/textures/redstone_torch_off.png', (texture) => {
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            texture.magFilter = THREE.NearestFilter;
        });
    }

    /** Get torch texture based on signal (lit/unlit) */
    getTexture(signal: number): THREE.Texture | null {
        return signal > 0 ? this.torchLitTexture : this.torchUnlitTexture;
    }

    /** Build Three.js BufferGeometry from torch element definitions */
    buildGeometry(isWall: boolean): THREE.BufferGeometry {
        const cacheKey = isWall ? 'wall' : 'upright';
        if (this.torchGeometries.has(cacheKey)) {
            return this.torchGeometries.get(cacheKey)!;
        }

        // Select the appropriate torch model based on orientation
        const model = isWall ? WALL_TORCH_MODEL : UPRIGHT_TORCH_MODEL;
        const geometries: THREE.BufferGeometry[] = [];

        // Create geometry for each element and collect them
        for (const element of model.elements) {
            const geometry = this.createElementGeometry(element);
            geometries.push(geometry);
        }

        // Merge all element geometries into a single BufferGeometry
        const merged = geometries.length === 1 ? geometries[0] : this.mergeGeometries(geometries);
        this.torchGeometries.set(cacheKey, merged);
        return merged;
    }

    /** Create geometry for a single element - Minecraft style rendering */
    private createElementGeometry(element: Element): THREE.BufferGeometry {
        const geometries: THREE.BufferGeometry[] = [];

        // Define face configurations with normal vectors and UV orientation directions
        // Each face specifies: name, dimensions, normal direction, right/up vectors for UV mapping
        const faceConfigs: {
            name: string;
            width: number;  // UV width in pixels
            height: number; // UV height in pixels
            normal: [number, number, number];
            right: [number, number, number];  // Right direction in local space
            up: [number, number, number];     // Up direction in local space
        }[] = [
            {
                name: 'east',
                width: 16, height: 16,
                normal: [1, 0, 0],
                right: [0, 0, -1],  // Z decreases to the right on east face
                up: [0, 1, 0],
            },
            {
                name: 'west',
                width: 16, height: 16,
                normal: [-1, 0, 0],
                right: [0, 0, 1],   // Z increases to the right on west face
                up: [0, 1, 0],
            },
            {
                name: 'up',
                width: 16, height: 16,
                normal: [0, 1, 0],
                right: [1, 0, 0],   // X increases to the right on up face
                up: [0, 0, -1],     // Z decreases upward on up face
            },
            {
                name: 'down',
                width: 16, height: 16,
                normal: [0, -1, 0],
                right: [1, 0, 0],
                up: [0, 0, 1],      // Z increases upward on down face
            },
            {
                name: 'south',
                width: 16, height: 16,
                normal: [0, 0, 1],
                right: [1, 0, 0],   // X increases to the right on south face
                up: [0, 1, 0],
            },
            {
                name: 'north',
                width: 16, height: 16,
                normal: [0, 0, -1],
                right: [-1, 0, 0],  // X decreases to the right on north face
                up: [0, 1, 0],
            },
        ];

        for (const config of faceConfigs) {
            // Skip faces that are not defined in this element
            const faceData = element.faces[config.name as keyof typeof element.faces];
            if (!faceData) continue;

            const [u1, v1, u2, v2] = faceData.uv;
            
            // Create plane with dimensions matching the UV region to prevent texture stretching
            const planeWidth = (u2 - u1) / 16;
            const planeHeight = (v2 - v1) / 16;
            const plane = new THREE.PlaneGeometry(planeWidth, planeHeight);

            // Set UV coordinates directly mapping to the texture region
            const uvAttr = plane.getAttribute('uv');
            uvAttr.setXY(0, u1 / 16, v1 / 16);  // bottom-left
            uvAttr.setXY(1, u2 / 16, v1 / 16);  // bottom-right
            uvAttr.setXY(2, u1 / 16, v2 / 16);  // top-left
            uvAttr.setXY(3, u2 / 16, v2 / 16);  // top-right
            uvAttr.needsUpdate = true;

            // Calculate center position of the element in world space
            const centerX = (element.from[0] + element.to[0]) / 32 - 0.5;
            const centerY = (element.from[1] + element.to[1]) / 32 - 0.5;
            const centerZ = (element.from[2] + element.to[2]) / 32 - 0.5;
            
            // Position the plane on the correct surface of the element (not at center)
            let posX: number, posY: number, posZ: number;
            
            switch (config.name) {
                case 'east':
                    posX = element.to[0] / 16 - 0.5;
                    posY = centerY;
                    posZ = centerZ;
                    break;
                case 'west':
                    posX = element.from[0] / 16 - 0.5;
                    posY = centerY;
                    posZ = centerZ;
                    break;
                case 'up':
                    posX = centerX;
                    posY = element.to[1] / 16 - 0.5;
                    posZ = centerZ;
                    break;
                case 'down':
                    posX = centerX;
                    posY = element.from[1] / 16 - 0.5;
                    posZ = centerZ;
                    break;
                case 'south':
                    posX = centerX;
                    posY = centerY;
                    posZ = element.to[2] / 16 - 0.5;
                    break;
                case 'north':
                    posX = centerX;
                    posY = centerY;
                    posZ = element.from[2] / 16 - 0.5;
                    break;
                default:
                    posX = centerX;
                    posY = centerY;
                    posZ = centerZ;
            }

            // Rotate plane to align its normal with the target face direction
            const mesh = new THREE.Mesh(plane);
            mesh.position.set(posX, posY, posZ);

            // Calculate rotation to align plane's normal with face normal
            const planeNormal = new THREE.Vector3(0, 0, 1); // PlaneGeometry default normal
            const targetNormal = new THREE.Vector3(...config.normal);
            const quaternion = new THREE.Quaternion().setFromUnitVectors(planeNormal, targetNormal);
            mesh.quaternion.copy(quaternion);

            // Flip UV V-axis for side faces to correct orientation (Three.js vs Minecraft Y-axis difference)
            if (['east', 'west', 'south', 'north'].includes(config.name)) {
                uvAttr.setXY(0, u1 / 16, v2 / 16);  // bottom-left -> top-left
                uvAttr.setXY(1, u2 / 16, v2 / 16);  // bottom-right -> top-right
                uvAttr.setXY(2, u1 / 16, v1 / 16);  // top-left -> bottom-left
                uvAttr.setXY(3, u2 / 16, v1 / 16);  // top-right -> bottom-right
                uvAttr.needsUpdate = true;
            }

            // Apply element rotation if present
            if (element.rotation) {
                const { origin, axis, angle } = element.rotation;
                const rad = angle * (Math.PI / 180);
                const originVec = new THREE.Vector3(
                    origin[0] / 16 - 0.5,
                    origin[1] / 16 - 0.5,
                    origin[2] / 16 - 0.5
                );

                // Translate to origin, rotate, translate back
                mesh.position.sub(originVec);
                if (axis === 'z') {
                    mesh.rotateZ(rad);
                } else if (axis === 'y') {
                    mesh.rotateY(rad);
                } else {
                    mesh.rotateX(rad);
                }
                mesh.position.add(originVec);
            }

            mesh.updateMatrix();
            const transformedGeometry = plane.clone();
            transformedGeometry.applyMatrix4(mesh.matrix);
            plane.dispose();
            geometries.push(transformedGeometry);
        }

        // If no faces defined, create empty geometry
        if (geometries.length === 0) {
            return new THREE.BufferGeometry();
        }

        // Merge all face geometries
        return geometries.length === 1 ? geometries[0] : this.mergeGeometries(geometries);
    }

    /** Merge multiple BufferGeometry into one */
    private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        let indexOffset = 0;

        for (const geometry of geometries) {
            const pos = geometry.getAttribute('position');
            const norm = geometry.getAttribute('normal');
            const uv = geometry.getAttribute('uv');
            const index = geometry.getIndex();

            for (let i = 0; i < pos.count; i++) {
                positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
                uvs.push(uv.getX(i), uv.getY(i));
            }

            if (index) {
                for (let i = 0; i < index.count; i++) {
                    indices.push(index.getX(i) + indexOffset);
                }
            }
            indexOffset += pos.count;
            geometry.dispose();
        }

        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        merged.setIndex(indices);
        return merged;
    }
}
