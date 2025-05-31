export interface Position {
  left: number;
  top: number;
}

export interface LayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
} 

export interface Layout {
  containerHeight: number;
  widowCount: number;
  boxes: LayoutBox[];
}

export const layoutBoxToPosition = (box: LayoutBox): Position => {
  return {
    left: box.left,
    top: box.top,
  };
};

export const positionToLayoutBox = (position: Position, width: number, height: number): LayoutBox => {
  return {
    left: position.left,
    top: position.top,
    width,
    height,
  };
};

export const positionLike = (box: LayoutBox): LayoutBox => positionToLayoutBox(layoutBoxToPosition(box), 0, 0);