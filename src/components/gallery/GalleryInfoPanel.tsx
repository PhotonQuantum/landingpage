import { Exif } from "exif-reader";
import { Component, createMemo, For, JSX, splitProps } from "solid-js";
import { createLocale } from "~/lib/gallery/createLocale";
import { dateWithOffset } from "~/lib/gallery/utils";

export interface GalleryInfoPanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  exifMetadata?: Exif;
}

interface InfoItem {
  label: string;
  value?: string;
}

interface Section {
  title: string;
  items: InfoItem[];
}

const formatExposureTime = (time: number): string => {
  if (time >= 1) return `${time}s`;
  const fraction = Math.round(1 / time);
  return `1/${fraction}s`;
};

const formatFocalLength = (length: number): string => `${length}mm`;

const formatAperture = (aperture: number): string => `f/${aperture}`;

const formatISO = (iso: number): string => `ISO ${iso}`;

const formatMegapixels = (width?: number, height?: number): string => {
  if (!width || !height) return '';
  const mp = (width * height) / 1000000;
  return `${mp.toFixed(1)} MP`;
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
};

const getMeteringMode = (mode: number): string => {
  const modes: { [key: number]: string } = {
    1: 'Average',
    2: 'Center-weighted',
    3: 'Spot',
    4: 'Multi-spot',
    5: 'Pattern',
    6: 'Partial'
  };
  return modes[mode] || 'Unknown';
};

const getFlashInfo = (flash: number): string => {
  if (flash === 0) return 'No Flash';
  if (flash === 16) return 'Flash did not fire';
  if (flash === 1) return 'Flash fired';
  return 'Flash';
};

const getExposureProgram = (program: number): string => {
  const programs: { [key: number]: string } = {
    0: 'Not defined',
    1: 'Manual',
    2: 'Normal program',
    3: 'Aperture priority',
    4: 'Shutter priority',
    5: 'Creative program',
    6: 'Action program',
    7: 'Portrait mode',
    8: 'Landscape mode'
  };
  return programs[program] || 'Unknown';
};

const formatExposureBias = (bias: number): string => {
  if (bias === 0) return '0 EV';
  const sign = bias > 0 ? '+' : '';
  return `${sign}${bias.toFixed(1)} EV`;
};

const locale = createLocale();

export const GalleryInfoPanel: Component<GalleryInfoPanelProps> = (props) => {
  const [local, rest] = splitProps(props, ["exifMetadata", "class"]);
  const sections = createMemo((): Section[] => {
    const data = local.exifMetadata;
    if (!data) return [];

    const image = data.Image || {};
    const photo = data.Photo || {};

    const dateTimeLabel = () => {
      if (!photo.DateTimeOriginal) return undefined;
      const dt = new Date(photo.DateTimeOriginal);
      const offset = photo.OffsetTimeOriginal;
      const dtOffset = dateWithOffset(dt, offset);
      return dtOffset.toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" });
    }

    return [
      {
        title: "Basic Information",
        items: [
          {
            label: "Dimensions",
            value: photo.PixelXDimension && photo.PixelYDimension
              ? `${photo.PixelXDimension} × ${photo.PixelYDimension}`
              : undefined
          },
          { label: "Resolution", value: formatMegapixels(photo.PixelXDimension, photo.PixelYDimension) },
          { label: "Time", value: dateTimeLabel() }
        ]
      },
      {
        title: "Camera Settings",
        items: [
          { label: "Aperture", value: photo.FNumber ? formatAperture(photo.FNumber) : undefined },
          { label: "Shutter Speed", value: photo.ExposureTime ? formatExposureTime(photo.ExposureTime) : undefined },
          { label: "ISO", value: photo.ISOSpeedRatings ? formatISO(photo.ISOSpeedRatings) : undefined },
          { label: "Focal Length", value: photo.FocalLength ? formatFocalLength(photo.FocalLength) : undefined },
          { label: "Program", value: photo.ExposureProgram !== undefined ? getExposureProgram(photo.ExposureProgram) : undefined },
          { label: "Exposure Bias", value: photo.ExposureBiasValue !== undefined ? formatExposureBias(photo.ExposureBiasValue) : undefined },
          { label: "Exposure Mode", value: photo.ExposureMode === 0 ? 'Auto' : photo.ExposureMode === 1 ? 'Manual' : 'Unknown' },
          { label: "Metering Mode", value: photo.MeteringMode ? getMeteringMode(photo.MeteringMode) : undefined },
          { label: "Flash", value: photo.Flash !== undefined ? getFlashInfo(photo.Flash) : undefined }
        ]
      },
      {
        title: "Equipment",
        items: [
          { label: "Camera", value: image.Make && image.Model ? `${image.Make} ${image.Model}` : undefined },
          { label: "Lens", value: photo.LensModel }
        ]
      }
    ];
  });

  return (
    <div class={`space-y-6 ${local.class}`} {...rest}>
      <For each={sections()}>{(section) =>
        <div class="space-y-2">
          <h3 class="text-gray-200 text-sm font-medium uppercase tracking-wider">{section.title}</h3>
          <div class="space-y-0 bg-white/5 rounded-lg overflow-hidden">
            <For each={section.items}>{(item) =>
              item.value ? (
                <div class="flex gap-4 justify-between items-center px-3 py-2 border-b border-white/10 last:border-b-0 hover:bg-white/5 motion-safe:transition-colors">
                  <span class="shrink-0 text-gray-300 text-sm font-normal">{item.label}</span>
                  <span class="text-white text-sm font-medium whitespace-nowrap overflow-ellipsis overflow-hidden">{item.value}</span>
                </div>
              ) : null
            }</For>
          </div>
        </div>
      }</For>
    </div>
  );
}; 