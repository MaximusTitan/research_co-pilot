import Image from "next/image";

const WIDTH = 1536;
const HEIGHT = 351;

/**
 * The Research Mate wordmark. The navy lettering disappears on dark
 * backgrounds, so a light-lettered copy is swapped in by CSS (see .logo-on-*
 * in globals.css), which follows both the OS scheme and the saved theme.
 */
export function Logo({ height = 32, preload = false }: { height?: number; preload?: boolean }) {
  const width = Math.round((WIDTH / HEIGHT) * height);
  return (
    <span className="inline-flex" style={{ height }}>
      <Image src="/logo.png" alt="Research Mate" width={width} height={height} preload={preload} className="logo-on-light" />
      <Image src="/logo-dark.png" alt="Research Mate" width={width} height={height} className="logo-on-dark" />
    </span>
  );
}
