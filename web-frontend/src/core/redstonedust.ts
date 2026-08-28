// redstone-dust-renderer.ts
import * as THREE from 'three';

export class RedstoneDustRenderer {
    private redstoneLineTexture: HTMLImageElement | null = null;
    private redstoneDotTexture: HTMLImageElement | null = null;
    private redstoneTextureCache: Map<string, THREE.CanvasTexture> = new Map();
    private texturesLoaded = false;

    /** Load redstone dust base textures */
    async loadTextures(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let loaded = 0;
            const total = 2;

            this.redstoneLineTexture = new Image();
            this.redstoneLineTexture.crossOrigin = 'anonymous';
            this.redstoneLineTexture.onload = () => {
                loaded++;
                if (loaded === total) {
                    this.texturesLoaded = true;
                    resolve();
                }
            };
            this.redstoneLineTexture.onerror = (e) => {
                console.error('[Redstone] Failed to load line texture:', e);
                reject(new Error('Failed to load redstone line texture'));
            };
            this.redstoneLineTexture.src = '/textures/redstone_dust_line0.png';

            this.redstoneDotTexture = new Image();
            this.redstoneDotTexture.crossOrigin = 'anonymous';
            this.redstoneDotTexture.onload = () => {
                loaded++;
                if (loaded === total) {
                    this.texturesLoaded = true;
                    resolve();
                }
            };
            this.redstoneDotTexture.onerror = (e) => {
                console.error('[Redstone] Failed to load dot texture:', e);
                reject(new Error('Failed to load redstone dot texture'));
            };
            this.redstoneDotTexture.src = '/textures/redstone_dust_dot.png';
        });
    }

    /** Get redstone texture based on connections and power level */
    getTexture(connections: number, power: number, renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
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
            this.renderRedstoneTexture(ctx, connections, connectionCount, r, g, b);
        } else {
            // Fallback
            console.warn('[Redstone] Textures not loaded, using fallback');
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(0, 0, 16, 16);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;

        this.redstoneTextureCache.set(cacheKey, texture);
        return texture;
    }

    /** Check if textures are loaded */
    get isLoaded(): boolean {
        return this.texturesLoaded;
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
        if (direction === 'east' || direction === 'west') { rotation = -Math.PI / 2; }

        // Rotate around center of canvas
        tCtx.translate(8, 8);
        tCtx.rotate(rotation);
        tCtx.translate(-8, -8);
        // Draw the full texture first
        tCtx.drawImage(this.redstoneLineTexture!, 0, 0);

        // Now clip to keep only half (from center to edge)
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

        this.tintImage(tCtx, r, g, b);
        ctx.drawImage(temp, 0, 0);
        return true;
    }

    /** Render redstone texture to canvas */
    private renderRedstoneTexture(ctx: CanvasRenderingContext2D, connections: number,
        connectionCount: number, r: number, g: number, b: number): void {
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

        const isStraightEW = (connections === 5);
        const isStraightNS = (connections === 10);
        const isStraightLine = isStraightEW || isStraightNS;

        const shouldDrawDot = isStandalone ||
            (connectionCount === 2 && !isStraightLine) ||
            connectionCount >= 3;

        if (shouldDrawDot) {
            this.drawCenterDot(ctx, r, g, b);
        }
    }

    /** Calculate color based on power level */
    private getRedstoneColor(power: number): THREE.Color {
        const colors = [
            0x4C0000, 0x700000, 0x7A0000, 0x840000, 0x8E0000, 0x990000,
            0xA30000, 0xAD0000, 0xB70000, 0xC10000, 0xCC0000, 0xD60000,
            0xE00000, 0xEA0600, 0xF41B00, 0xFF3200
        ];
        return new THREE.Color(colors[power]);
    }
}
