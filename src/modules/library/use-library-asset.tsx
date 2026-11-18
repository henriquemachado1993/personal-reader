"use client";
import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { assetIdPattern } from "@/infrastructure/r2/file-key";
import { readLibraryAsset } from "./library-assets";
import { useLibrary } from "./store";

export function useLibraryAsset(reference?: string, visible = true) {
  const ownerId = useLibrary((state) => state.ownerId);
  const [resolved, setResolved] = useState<{
    reference: string;
    ownerId: string;
    url: string;
  }>();
  const isAsset = !!reference && assetIdPattern.test(reference);
  useEffect(() => {
    if (!reference || !isAsset || !visible || !ownerId) return;
    let active = true;
    let url: string | undefined;
    const load = () => {
      void readLibraryAsset(reference, ownerId)
        .then((blob) => {
          if (!active || !blob) return;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(blob);
          setResolved({ reference, ownerId, url });
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("online", load);
    return () => {
      active = false;
      window.removeEventListener("online", load);
      if (url) URL.revokeObjectURL(url);
    };
  }, [reference, isAsset, visible, ownerId]);
  if (!isAsset) return reference;
  return resolved?.reference === reference && resolved?.ownerId === ownerId
    ? resolved.url
    : undefined;
}

export function LibraryAssetImage({
  reference,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { reference: string }) {
  const node = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible || !node.current || !assetIdPattern.test(reference)) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: "240px" },
    );
    observer.observe(node.current);
    return () => observer.disconnect();
  }, [reference, visible]);
  const src = useLibraryAsset(reference, visible);
  return <img {...props} ref={node} src={src} />;
}
