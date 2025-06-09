import { Accessor, createEffect, createMemo, createSignal, JSX, on, onCleanup, onMount, splitProps } from "solid-js";
import { GestureManagerState } from "~/lib/gallery/gesture";
import { ViewerImageItem } from "~/data/galleryData";
import { isServer } from "solid-js/web";
import { createElementBounds } from "@solid-primitives/bounds";
import { TextureManager } from "~/lib/gallery/textureManager";

export interface WebGLViewerProps extends JSX.HTMLAttributes<HTMLCanvasElement> {
  containerRef: Accessor<EventTarget & HTMLElement | undefined>;
  geometry: GestureManagerState;
  imageItems: ViewerImageItem[];
  onBoundingRectChange?: (rect: DOMRect | null) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  initialThumbnail?: string;
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

const mergeClass = (a: string, b: string) => a.split(" ").concat(b.split(" ")).join(" ");

export default function WebGLViewer(props: WebGLViewerProps) {
  const [local, rest] = splitProps(props, ["geometry", "imageItems", "containerRef", "onBoundingRectChange", "onLoadingChange", "initialThumbnail", "class"]);

  const initialThumbnail = createMemo(() => local.initialThumbnail);
  const imageItems = createMemo(() => local.imageItems, [], { equals: (a, b) => a.length === b.length && a.every((item, index) => item.src === b[index].src) });

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

  const textureManager: TextureManager = new TextureManager({
    onTextureLoaded: (src) => {
      console.log("loaded texture, triggering render", src);
      needsRender = true;
    },
    onTextureLoadError: (src, error) => {
      console.error('Failed to load image:', error);
      needsRender = true;
    },
    onTextureLoadCancelled: (src) => {
      console.log("cancelled texture load", src);
    }
  });


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
    const items = imageItems();
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
    const items = imageItems();
    if (!items.length) return { prev: null, next: null };

    const currentIndex = items.findIndex(item => item.src === currentImage.src);
    if (currentIndex === -1) return { prev: null, next: null };

    return {
      prev: currentIndex > 0 ? items[currentIndex - 1] : null,
      next: currentIndex < items.length - 1 ? items[currentIndex + 1] : null
    };
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

    textureManager.setGL(gl);

    // Create shaders and program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    program = createProgram(gl, vertexShader, fragmentShader);

    // Create buffers
    positionBuffer = gl.createBuffer()!;
    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
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
    const texture = textureManager.getTexture(currentImage.src) ||
      textureManager.findNearestAvailableTexture(currentImage, imageItems());

    if (texture) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    needsRender = false;
    animationFrameId = requestAnimationFrame(render);
  };

  const hasRendered = createMemo(() => textureManager.hasTexture(imageItems().map(item => item.src))());
  createEffect(() => {
    console.log("hasRendered", hasRendered());
  });

  // Cancel previous texture loads
  createEffect(
    on(
      imageItems,
      (_, prevItems) => {
        console.log("cancelling previous texture loads", prevItems);
        if (!prevItems) return;
        for (const item of prevItems) {
          textureManager.cancelTextureLoad(item.src);
        }
      }
    )
  );

  // Handle LOD changes and preloading
  createEffect(() => {
    console.log("triggered LOD change", "selectedImage", selectedImage());

    const newSelectedImage = selectedImage();
    if (!newSelectedImage) return;

    // Load current image
    textureManager.loadTexture(newSelectedImage.src);

    // Preload adjacent LOD levels
    const { prev, next } = getAdjacentLODs(newSelectedImage);
    if (prev) textureManager.loadTexture(prev.src);
    if (next) textureManager.loadTexture(next.src);

    // Update last used time for current and adjacent textures
    textureManager.updateTextureLastUsed(newSelectedImage.src);
    if (prev) textureManager.updateTextureLastUsed(prev.src);
    if (next) textureManager.updateTextureLastUsed(next.src);
  });

  // Track loading status
  createEffect(() => {
    const currentImage = selectedImage();
    if (!currentImage) return;

    const isOptimalTextureLoaded = textureManager.hasTexture(currentImage.src);
    const isOptimalTextureLoading = textureManager.isLoadingTexture(currentImage.src);

    local.onLoadingChange?.(!isOptimalTextureLoaded() && isOptimalTextureLoading());
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
    console.log("getBoundingClientRect changed");
    needsRender = true;
  });

  onCleanup(() => {
    if (isServer) return;
    // Cancel animation frame
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    // Clean up WebGL resources
    textureManager.dispose();
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteProgram(program);
  });

  const mergedClass = () => mergeClass(local.class ?? "", "bg-no-repeat bg-center bg-contain");

  return (
    <canvas
      ref={setCanvas}
      class={mergedClass()}
      style={{ "background-image": hasRendered() ? undefined : `url(${initialThumbnail()})` }}
      {...rest}
    />
  );
} 