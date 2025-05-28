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
