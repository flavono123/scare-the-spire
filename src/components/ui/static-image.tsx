import { forwardRef, type CSSProperties, type ImgHTMLAttributes } from "react";

type StaticImageImport = {
  src: string;
  width?: number;
  height?: number;
};

type StaticImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "height" | "loading" | "src" | "width"> & {
  alt: string;
  blurDataURL?: string;
  fill?: boolean;
  height?: number;
  placeholder?: "blur" | "empty";
  priority?: boolean;
  quality?: number;
  src: string | StaticImageImport;
  unoptimized?: boolean;
  width?: number;
};

function resolveImageSource(src: StaticImageProps["src"]) {
  return typeof src === "string" ? src : src.src;
}

function resolveImageDimension(
  explicit: number | undefined,
  src: StaticImageProps["src"],
  dimension: "width" | "height",
) {
  if (explicit !== undefined) {
    return explicit;
  }

  if (typeof src === "string") {
    return undefined;
  }

  return src[dimension];
}

const StaticImage = forwardRef<HTMLImageElement, StaticImageProps>(function StaticImage(
  {
    alt,
    blurDataURL: _blurDataURL,
    className,
    fill = false,
    height,
    loading,
    placeholder: _placeholder,
    priority = false,
    quality: _quality,
    src,
    style,
    unoptimized: _unoptimized,
    width,
    ...props
  },
  ref,
) {
  const resolvedWidth = resolveImageDimension(width, src, "width");
  const resolvedHeight = resolveImageDimension(height, src, "height");
  const resolvedSrc = resolveImageSource(src);
  const resolvedStyle: CSSProperties | undefined = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        ...style,
      }
    : style;

  return (
    <img
      {...props}
      ref={ref}
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority={priority ? "high" : props.fetchPriority}
      height={fill ? undefined : resolvedHeight}
      loading={priority ? "eager" : loading}
      src={resolvedSrc}
      style={resolvedStyle}
      width={fill ? undefined : resolvedWidth}
    />
  );
});

export default StaticImage;
