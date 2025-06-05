import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { useContext, createMemo } from "solid-js";
import { GalleryGroupsContext } from "~/context/gallery";
import { GalleryPopup } from "~/components/gallery/GalleryPopup";
import { identity } from "~/lib/gallery/helpers";
import { ImagePointer, locatePointer, nextPointer, prevPointer, reverseLookupPointer } from "~/lib/gallery/pointer";

interface NavigateState {
  fromGallery?: boolean;
}

export default function PopupView() {
  const galleryGroups = useContext(GalleryGroupsContext)!;
  const location = useLocation<NavigateState | undefined>();
  const naviState = () => location.state;
  identity(naviState);    // NOTE DO NOT REMOVE THIS.

  const params = useParams();
  const galleryItemId = () => params.path?.split('/').slice(0, -1).join('/');
  const imageId = () => params.path?.split('/').pop()!;
  const pointer = createMemo(() => {
    return locatePointer(galleryGroups, galleryItemId(), imageId());
  });

  const navigate = useNavigate();

  // Navigation handlers
  const selectImage = (pointer: ImagePointer) => {
    const { galleryItemId, imageId } = reverseLookupPointer(galleryGroups, pointer);
    navigate(`${galleryItemId}/${imageId}`, { scroll: false });
  };
  const onPrev = () => {
    if (!pointer()) return;
    const p = prevPointer(galleryGroups, pointer()!);
    if (p) selectImage(p);
  };
  const onNext = () => {
    if (!pointer()) return;
    const p = nextPointer(galleryGroups, pointer()!);
    if (p) selectImage(p);
  };
  const onClose = () => {
    navigate("/gallery", { scroll: false });
  };

  return (
    <GalleryPopup
      pointer={pointer()}
      onPrev={onPrev}
      onNext={onNext}
      onClose={onClose}
      onSelect={selectImage}
    />
  );
}