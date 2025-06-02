import justifiedLayout from "justified-layout";
import { LayoutBox, Layout } from "./types";

export interface LayoutOptions {
  containerWidth: number;
  targetRowHeight: number;
  boxSpacing: number;
  maxNumRows: number;
  doubleRowImagesIdx: number[];
}

export interface LayoutResultItem {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ImageItem {
  id: number;
  aspectRatio: number;
}

const rowsInBoxes = (boxes: LayoutBox[]) => {
  // It's basically the number of unique top values
  const topValues = new Set(boxes.map((box) => box.top));
  return topValues.size;
}

export const myLayout = (aspectRatios: number[], options: LayoutOptions) => {
  // For simplicity of this algorithm we enforce the container padding to be 0
  const { containerWidth, targetRowHeight, boxSpacing, maxNumRows, doubleRowImagesIdx } = options;

  let workingList: ImageItem[] = aspectRatios.map((aspectRatio, idx) => ({ id: idx, aspectRatio }));
  let result: (LayoutResultItem & { id: number })[] = [];

  let doubleRowLeft = true; // Whether the double row image is on the left or right

  let currentRowIdx = 0;
  let currentRowTop = 0;

  const commitLayout = (layout: Layout, leftOffset?: number) => {
    result.push(...layout.boxes.map((box, i) => ({
      top: box.top + currentRowTop,
      left: box.left + (leftOffset ?? 0),
      width: box.width,
      height: box.height,
      id: workingList[i].id,
    })));

    // Update the current row top
    currentRowTop += layout.containerHeight + boxSpacing;

    // Update the current row index
    currentRowIdx += rowsInBoxes(layout.boxes);

    // Remove the committed boxes from the working list
    workingList = workingList.slice(layout.boxes.length);
  }

  const layoutRemaining = () => {
    if (currentRowIdx >= maxNumRows) {
      return;
    }

    // Layout the remaining images with standard justified layout
    const layout = justifiedLayout(workingList.map((item) => item.aspectRatio), {
      containerWidth,
      containerPadding: 0,
      targetRowHeight,
      boxSpacing,
      maxNumRows: maxNumRows - currentRowIdx,
    });
    commitLayout(layout);
  }

  while (workingList.length > 0) {
    if (currentRowIdx >= maxNumRows) {
      break;
    }

    // Find the next double row image
    const nextDoubleRowImage = workingList.find((item) => doubleRowImagesIdx.includes(item.id));
    if (!nextDoubleRowImage) {
      layoutRemaining();
      break;
    } else {
      // Okay we got a double row image. We first try to layout all images before it, stripping widows.
      const previousImages = workingList.slice(0, workingList.indexOf(nextDoubleRowImage));
      const previousLayout = justifiedLayout(previousImages.map((item) => item.aspectRatio), {
        containerWidth,
        containerPadding: 0,
        targetRowHeight,
        boxSpacing,
        showWidows: false,
      });

      // If previous image rows exceeds the max number of rows, we bail out and layout the remaining images
      if (rowsInBoxes(previousLayout.boxes) >= maxNumRows - currentRowIdx) {
        layoutRemaining();
        break;
      }

      commitLayout(previousLayout);

      // We now finished layoutting the previous images. We need to layout the two rows of the double row image.
      // Take this double row image out of the working list.
      workingList = workingList.filter((item) => item.id !== nextDoubleRowImage.id);
      // We first fix the width of the double row image.
      const doubleRowImageWidth = nextDoubleRowImage.aspectRatio * targetRowHeight * 2;
      // Then we layout the two rows with the remaining images. TODO what if there are another double row image? Let's ignore it for now.
      const doubleRowOtherImagesLayout = justifiedLayout(workingList.map((item) => item.aspectRatio), {
        containerWidth: containerWidth - doubleRowImageWidth - boxSpacing,
        containerPadding: 0,
        targetRowHeight,
        boxSpacing,
        maxNumRows: 2,
      });
      // We now have a concrete layout result for other images in the double row. Compute the height of the double row image.
      const doubleRowImageHeight = doubleRowOtherImagesLayout.containerHeight;
      // Layout the double row image
      result.push({
        top: currentRowTop,
        left: doubleRowLeft ? 0 : containerWidth - doubleRowImageWidth,
        width: doubleRowImageWidth,
        height: doubleRowImageHeight,
        id: nextDoubleRowImage.id,
      })
      // Layout the other images in the double row
      commitLayout(doubleRowOtherImagesLayout, doubleRowLeft ? doubleRowImageWidth + boxSpacing : 0);
    }
  }

  return { boxes: result.sort((a, b) => a.id - b.id), containerHeight: currentRowTop, widowCount: 0 };
}