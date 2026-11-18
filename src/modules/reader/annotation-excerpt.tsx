import { LibraryAssetImage } from "@/modules/library/use-library-asset";
import type { Annotation } from "@/shared/types";
import { annotationLabels } from "./annotation-context";

export function AnnotationExcerpt({ annotation }: { annotation: Annotation }) {
  const hasContent = !!(
    annotation.text ||
    annotation.quote ||
    annotation.image
  );
  const quote = annotation.quote;
  return (
    <div className="annotation-excerpt">
      {annotation.image && (
        <LibraryAssetImage
          className={
            !["image", "clipping"].includes(annotation.kind)
              ? "annotation-region-preview"
              : undefined
          }
          reference={annotation.image}
          alt={
            annotation.text ||
            `${annotationLabels[annotation.kind]} da página ${annotation.page + 1}`
          }
          loading="lazy"
          decoding="async"
        />
      )}
      {quote && quote !== annotation.text && <blockquote>{quote}</blockquote>}
      {annotation.text && <p>{annotation.text}</p>}
      {!hasContent && (
        <p className="annotation-context-status">
          Marcação sem trecho salvo. Abra a página para consultar.
        </p>
      )}
    </div>
  );
}
