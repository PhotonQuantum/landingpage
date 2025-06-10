import { ViewerImageItem } from "~/data/galleryData";
import { Accessor, createMemo, createSignal, Setter, untrack } from "solid-js";

export interface TextureEntry {
  texture: WebGLTexture;
  size: number;  // Size in bytes
  lastUsed: number;  // Timestamp of last use
}

export interface TextureManagerOptions {
  onTextureLoaded?: (src: string) => void;
  onTextureLoadError?: (src: string, error: Error) => void;
  onTextureLoadCancelled?: (src: string) => void;
}

interface LoadingTexture {
  promise: Promise<WebGLTexture | undefined>;
  abortController: AbortController;
  image: HTMLImageElement;
}

export class TextureManager {
  private textureCache: Accessor<Map<string, TextureEntry>>;
  private setTextureCache: Setter<Map<string, TextureEntry>>;
  private loadingTextures: Accessor<Map<string, LoadingTexture | undefined>>;
  private setLoadingTextures: Setter<Map<string, LoadingTexture | undefined>>;
  private currentCacheSize: number;
  private readonly MAX_CACHE_SIZE: number;
  private gl!: WebGLRenderingContext;
  private options: TextureManagerOptions;

  constructor(options: TextureManagerOptions = {}, maxCacheSize: number = 256 * 1024 * 1024) {
    [this.textureCache, this.setTextureCache] = createSignal(new Map(), {equals: false});
    [this.loadingTextures, this.setLoadingTextures] = createSignal(new Map(), {equals: false});
    this.currentCacheSize = 0;
    this.MAX_CACHE_SIZE = maxCacheSize;
    this.options = options;
  }

  public setGL(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  private getTextureCache(): Map<string, TextureEntry> {
    return untrack(this.textureCache);
  }

  private getLoadingTextures(): Map<string, LoadingTexture | undefined> {
    return untrack(this.loadingTextures);
  }

  // Helper to calculate texture size in bytes
  private calculateTextureSize(width: number, height: number): number {
    // RGBA format: 4 bytes per pixel
    return width * height * 4;
  }

  // Helper to evict textures based on LRU and size
  private evictTextures(requiredSize: number) {
    if (this.currentCacheSize + requiredSize <= this.MAX_CACHE_SIZE) return;

    console.log("evicting textures", this.currentCacheSize, "->", this.MAX_CACHE_SIZE - requiredSize);

    // Sort textures by last used time
    const sortedTextures = Array.from(this.getTextureCache().entries())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

    // Evict textures until we have enough space
    for (const [src, entry] of sortedTextures) {
      if (this.currentCacheSize + requiredSize <= this.MAX_CACHE_SIZE) break;
      
      this.gl.deleteTexture(entry.texture);
      this.setTextureCache((prev) => {
        prev.delete(src);
        return prev;
      });
      this.currentCacheSize -= entry.size;
    }
  }

  // Helper to update texture last used time
  public updateTextureLastUsed(src: string) {
    const entry = this.getTextureCache().get(src);
    if (entry) {
      entry.lastUsed = Date.now();
    }
  }

  // Cancel loading a texture
  public cancelTextureLoad(src: string): boolean {
    const loadingTexture = this.getLoadingTextures().get(src);
    if (!loadingTexture) return false;

    // Abort the fetch request if it's still in progress
    loadingTexture.abortController.abort();
    
    // Clean up the image element
    loadingTexture.image.src = '';
    loadingTexture.image.onload = null;
    loadingTexture.image.onerror = null;

    // Remove from loading textures
    this.setLoadingTextures(prev => {
      console.log("removing promise from loading textures", src);
      prev.delete(src);
      return prev;
    });

    this.options.onTextureLoadCancelled?.(src);
    return true;
  }

  // Cancel all loading textures
  public cancelAllTextureLoads(): void {
    this.getLoadingTextures().forEach((loadingTexture, src) => {
      this.cancelTextureLoad(src);
    });
  }

  // Load texture asynchronously
  public async loadTexture(src: string): Promise<WebGLTexture | undefined> {
    if (this.getTextureCache().has(src)) {
      this.updateTextureLastUsed(src);
      return this.getTextureCache().get(src)!.texture;
    }

    const loadingTexture = this.getLoadingTextures().get(src);
    if (loadingTexture) return loadingTexture.promise;

    const abortController = new AbortController();
    const img = new Image();
    img.crossOrigin = "anonymous"; // Enable CORS

    const loadPromise = new Promise<WebGLTexture | undefined>((resolve, reject) => {
      img.onload = () => {
        // Check if the load was cancelled
        if (abortController.signal.aborted) {
          resolve(undefined);
          return;
        }

        const texture = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // First upload the image
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);

        // Then set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

        // Enable anisotropic filtering if available
        const ext = this.gl.getExtension('EXT_texture_filter_anisotropic');
        if (ext) {
          const max = this.gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
          this.gl.texParameterf(this.gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
        }

        const textureSize = this.calculateTextureSize(img.width, img.height);
        this.evictTextures(textureSize);
        
        this.setTextureCache(prev => {
          prev.set(src, {
            texture,
            size: textureSize,
            lastUsed: Date.now()
          });
          return prev;
        });
        this.currentCacheSize += textureSize;

        this.setLoadingTextures((prev) => {
          prev.delete(src);
          return prev;
        }); 

        this.options.onTextureLoaded?.(src);
        resolve(texture);
      };

      img.onerror = (error) => {
        // Check if the load was cancelled
        if (abortController.signal.aborted) {
          resolve(undefined);
          return;
        }

        console.error('Failed to load image:', error);
        // Create a 1x1 transparent texture as fallback
        const fallbackTexture = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, fallbackTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        
        const fallbackSize = this.calculateTextureSize(1, 1);
        this.setTextureCache(prev => {
          prev.set(src, {
            texture: fallbackTexture,
            size: fallbackSize,
            lastUsed: Date.now()
          });
          return prev;
        });
        this.currentCacheSize += fallbackSize;

        this.options.onTextureLoadError?.(src, new Error('Failed to load image'));
        resolve(fallbackTexture);
      };

      // Set up abort handling
      abortController.signal.addEventListener('abort', () => {
        img.src = '';
        img.onload = null;
        img.onerror = null;
        resolve(undefined);
      });

      img.src = src;
    });

    this.setLoadingTextures(prev => {
      prev.set(src, { promise: loadPromise, abortController, image: img });
      return prev;
    });

    return loadPromise;
  }

  // Find nearest available texture
  public findNearestAvailableTexture(currentImage: ViewerImageItem, imageItems: ViewerImageItem[]): WebGLTexture | undefined {
    const currentIndex = imageItems.findIndex(item => item.src === currentImage.src);
    if (currentIndex === -1) return undefined;

    let searchDistance = 1;

    while (searchDistance < imageItems.length) {
      // Check lower resolution
      const lowerIndex = currentIndex - searchDistance;
      if (lowerIndex >= 0) {
        const lowerTexture = this.getTextureCache().get(imageItems[lowerIndex].src)?.texture;
        if (lowerTexture) {
          this.updateTextureLastUsed(imageItems[lowerIndex].src);
          return lowerTexture;
        }
      }

      // Check higher resolution
      const higherIndex = currentIndex + searchDistance;
      if (higherIndex < imageItems.length) {
        const higherTexture = this.getTextureCache().get(imageItems[higherIndex].src)?.texture;
        if (higherTexture) {
          this.updateTextureLastUsed(imageItems[higherIndex].src);
          return higherTexture;
        }
      }

      searchDistance++;
    }

    console.warn("no texture found");
    return undefined;
  }

  // Check if a texture is loaded
  public hasTexture(src: string|string[]): Accessor<boolean> {
    return createMemo(() => {
      if (Array.isArray(src)) {
        return src.some(s => this.textureCache().has(s));
      }
      return this.textureCache().has(src);
    });
  }

  // Check if a texture is loading
  public isLoadingTexture(src: string|string[]): Accessor<boolean> {
    return createMemo(() => {
      if (Array.isArray(src)) {
        return src.some(s => this.loadingTextures().has(s));
      }
      return this.loadingTextures().has(src);
    });
  }

  // Get a texture if it exists
  public getTexture(src: string): WebGLTexture | undefined {
    const entry = this.getTextureCache().get(src);
    if (entry) {
      this.updateTextureLastUsed(src);
      return entry.texture;
    }
    return undefined;
  }

  // Clean up all textures
  public dispose() {
    // Cancel all pending loads
    this.cancelAllTextureLoads();
    
    // Clean up loaded textures
    this.getTextureCache().forEach(entry => this.gl.deleteTexture(entry.texture));
    this.setTextureCache(new Map());
    this.setLoadingTextures(new Map());
    this.currentCacheSize = 0;
  }
} 