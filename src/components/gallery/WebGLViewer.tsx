import { Accessor, createEffect, createMemo, createSignal, JSX, onCleanup, onMount, splitProps } from "solid-js";
import { GestureManagerState } from "~/lib/gallery/gesture";
import { ViewerImageItem } from "~/data/galleryData";
import { isServer } from "solid-js/web";
import { createElementBounds } from "@solid-primitives/bounds";

export interface WebGLViewerProps extends Omit<JSX.HTMLAttributes<HTMLCanvasElement>, "style"> {
  containerRef: Accessor<EventTarget & HTMLElement | undefined>;
  geometry: GestureManagerState;
  imageItems: ViewerImageItem[];
  onBoundingRectChange?: (rect: DOMRect | null) => void;
}

// WebGL shader programs
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  uniform mat4 u_matrix;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = u_matrix * vec4(a_position, 0, 1);
    v_texCoord = a_texCoord;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  void main() {
    gl_FragColor = texture2D(u_texture, v_texCoord);
  }
`;

// Helper function to create and compile shader
function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error('Failed to compile shader');
  }

  return shader;
}

// Helper function to create program
function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    throw new Error('Failed to link program');
  }

  return program;
}

export default function WebGLViewer(props: WebGLViewerProps) {
  const [local, rest] = splitProps(props, ["geometry", "imageItems", "containerRef", "onBoundingRectChange"]);
  
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>();
  let gl: WebGLRenderingContext;
  let program: WebGLProgram;
  let positionBuffer: WebGLBuffer;
  let texCoordBuffer: WebGLBuffer;
  let positionLocation: number;
  let texCoordLocation: number;
  let matrixLocation: WebGLUniformLocation;
  let animationFrameId: number;
  let needsRender = true;
  
  // Texture management
  const textures = new Map<string, WebGLTexture>();
  const loadingTextures = new Map<string, Promise<WebGLTexture>>();

  // Calculate required image size based on container and scale
  const containerBounds = createElementBounds(local.containerRef);

  const requiredImageSize = createMemo(() => {
    if (!containerBounds.width || !containerBounds.height) return { width: 0, height: 0 };

    const scale = local.geometry.scale;
    const requiredWidth = containerBounds.width * scale;
    const requiredHeight = containerBounds.height * scale;

    return { width: requiredWidth, height: requiredHeight };
  });

  // Select the best image based on required size
  const selectedImage = createMemo(() => {
    const items = local.imageItems;
    if (!items.length) return null;

    const requiredSize = Math.max(requiredImageSize().width, requiredImageSize().height);

    // Find the smallest image that's larger than required size, or use the largest one
    const bestImage = items.find(item =>
      Math.max(item.width, item.height) >= requiredSize
    ) || items[items.length - 1];

    return bestImage;
  });

  // Get adjacent LOD levels for preloading
  const getAdjacentLODs = (currentImage: ViewerImageItem) => {
    const items = local.imageItems;
    if (!items.length) return { prev: null, next: null };

    const currentIndex = items.findIndex(item => item.src === currentImage.src);
    if (currentIndex === -1) return { prev: null, next: null };

    return {
      prev: currentIndex > 0 ? items[currentIndex - 1] : null,
      next: currentIndex < items.length - 1 ? items[currentIndex + 1] : null
    };
  };

  // Load texture asynchronously
  const loadTexture = async (src: string): Promise<WebGLTexture> => {
    if (textures.has(src)) return textures.get(src)!;
    if (loadingTextures.has(src)) return loadingTextures.get(src)!;
    
    const loadPromise = new Promise<WebGLTexture>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Enable CORS
      img.onload = () => {
        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // First upload the image
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        
        // Then set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Enable anisotropic filtering if available
        const ext = gl.getExtension('EXT_texture_filter_anisotropic');
        if (ext) {
          const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
          gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
        }
        
        textures.set(src, texture);
        needsRender = true;
        resolve(texture);
      };
      img.onerror = (error) => {
        console.error('Failed to load image:', error);
        // Create a 1x1 transparent texture as fallback
        const fallbackTexture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, fallbackTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        textures.set(src, fallbackTexture);
        needsRender = true;
        resolve(fallbackTexture);
      };
      img.src = src;
    });
    
    loadingTextures.set(src, loadPromise);
    return loadPromise;
  };

  // Initialize WebGL
  onMount(() => {
    const canvasElement = canvas();
    if (!canvasElement) return;

    // Create WebGL context
    gl = canvasElement.getContext('webgl', { 
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    })!;
    
    // Create shaders and program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    program = createProgram(gl, vertexShader, fragmentShader);
    
    // Create buffers
    positionBuffer = gl.createBuffer()!;
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    // Create texture coordinates (flipped Y to match WebGL coordinate system)
    const texCoords = new Float32Array([
      0, 0,  // bottom-left
      1, 0,  // bottom-right
      0, 1,  // top-left
      1, 1   // top-right
    ]);
    texCoordBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    
    // Get attribute and uniform locations
    positionLocation = gl.getAttribLocation(program, 'a_position');
    texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    matrixLocation = gl.getUniformLocation(program, 'u_matrix')!;
    
    // Set up attributes (only need to do this once)
    gl.useProgram(program);
    
    // Set up position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Set up texture coordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Start render loop
    animationFrameId = requestAnimationFrame(render);
  });

  // Render loop
  const render = () => {
    if (!gl || !program) return;
    
    const canvasElement = canvas();
    if (!canvasElement) return;
    
    const container = local.containerRef();
    if (!container) return;

    // Only render if needed
    if (!needsRender) {
      animationFrameId = requestAnimationFrame(render);
      return;
    }
    
    // Update canvas size
    const dpr = window.devicePixelRatio || 1;
    canvasElement.width = container.clientWidth * dpr;
    canvasElement.height = container.clientHeight * dpr;
    gl.viewport(0, 0, canvasElement.width, canvasElement.height);
    
    // Get current image dimensions
    const currentImage = selectedImage();
    if (!currentImage) return;
    
    // Calculate aspect ratios
    const containerAspect = container.clientWidth / container.clientHeight;
    const imageAspect = currentImage.width / currentImage.height;

    // Calculate dpr corrected geometry
    const x = local.geometry.x * dpr;
    const y = local.geometry.y * dpr;
    const scale = local.geometry.scale;
    
    // Calculate scale factors to maintain aspect ratio
    let scaleX = scale;
    let scaleY = scale;
    
    if (imageAspect > containerAspect) {
      // Image is wider than container
      scaleY = scale * (containerAspect / imageAspect);
    } else {
      // Image is taller than container
      scaleX = scale * (imageAspect / containerAspect);
    }
    
    // Calculate transformation matrix with aspect ratio preservation
    const matrix = new Float32Array([
      scaleX, 0, 0, 0,
      0, -scaleY, 0, 0,
      0, 0, 1, 0,
      x / (canvasElement.width / 2), -y / (canvasElement.height / 2), 0, 1,
    ]);
    
    // Clear and setup
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Set matrix uniform
    gl.uniformMatrix4fv(matrixLocation, false, matrix);
    
    // Draw current texture
    const texture = textures.get(currentImage.src);
    if (texture) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      // Adjust texture filtering based on relative scale
      const displayWidth = container.clientWidth * scaleX;
      const displayHeight = container.clientHeight * scaleY;
      const relativeScaleX = displayWidth / currentImage.width;
      const relativeScaleY = displayHeight / currentImage.height;
      const relativeScale = Math.max(relativeScaleX, relativeScaleY);
      
      if (relativeScale > 1.0) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else if (relativeScale < 0.5) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    needsRender = false;
    animationFrameId = requestAnimationFrame(render);
  };

  // Handle LOD changes and preloading
  createEffect(() => {
    const newSelectedImage = selectedImage();
    if (!newSelectedImage) return;

    // Load current image
    loadTexture(newSelectedImage.src);

    // Preload adjacent LOD levels
    const { prev, next } = getAdjacentLODs(newSelectedImage);
    if (prev) loadTexture(prev.src);
    if (next) loadTexture(next.src);
  });

  // Function to get the rendered image's bounding rect
  const getBoundingClientRect = (): DOMRect | null => {
    const currentImage = selectedImage();
    if (!currentImage) return null;

    if (containerBounds.width === null || containerBounds.height === null || containerBounds.left === null || containerBounds.top === null) return null;

    const containerAspect = containerBounds.width / containerBounds.height;
    const imageAspect = currentImage.width / currentImage.height;

    // Calculate scale factors to maintain aspect ratio
    let scaleX = local.geometry.scale;
    let scaleY = local.geometry.scale;
    
    if (imageAspect > containerAspect) {
      // Image is wider than container
      scaleY = local.geometry.scale * (containerAspect / imageAspect);
    } else {
      // Image is taller than container
      scaleX = local.geometry.scale * (imageAspect / containerAspect);
    }

    // Calculate the actual dimensions of the rendered image
    const width = containerBounds.width * scaleX;
    const height = containerBounds.height * scaleY;

    // Calculate the position, taking into account the container's position
    const x = containerBounds.left + (containerBounds.width - width) / 2 + local.geometry.x;
    const y = containerBounds.top + (containerBounds.height - height) / 2 + local.geometry.y;

    return new DOMRect(x, y, width, height);
  };

  // When geometry or container changes,
  createEffect(() => {
    // Update bounding rect
    const rect = getBoundingClientRect();
    local.onBoundingRectChange?.(rect);
    // Force a render
    needsRender = true;
  });

  onCleanup(() => {
    if (isServer) return;
    // Cancel animation frame
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    // Clean up WebGL resources
    textures.forEach(texture => gl.deleteTexture(texture));
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteProgram(program);
  });

  return (
    <canvas
      ref={setCanvas}
      {...rest}
    />
  );
} 