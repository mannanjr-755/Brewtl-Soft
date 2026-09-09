import Image from "next/image";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg" | "hero";
  showWordmark?: boolean;
  className?: string;
};

  const sizes = {
  sm: { box: "h-9 w-9", img: 36 },
  md: { box: "h-10 w-10", img: 40 },
  lg: { box: "h-14 w-14", img: 56 },
  hero: { box: "h-28 w-36 bg-[var(--gold)] sm:h-32 sm:w-40", img: 160 },
};

export function BrandLogo({
  size = "md",
  showWordmark = false,
  className = "",
}: BrandLogoProps) {
  const s = sizes[size];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className={`relative overflow-hidden rounded-xl border border-[var(--gold)]/35 shadow-[var(--shadow)] ${s.box}`}
      >
        <Image
          src="/logo.png"
          alt="BON PANIER"
          width={s.img}
          height={s.img}
          className={
            size === "hero"
              ? "h-full w-full object-contain"
              : "h-full w-full object-cover"
          }
          priority
        />
      </div>
      {showWordmark && (
        <>
          <span className="font-display mt-3 text-3xl text-[var(--gold-bright)]">
            BON PANIER
          </span>
          <span className="mt-1 text-xs uppercase tracking-[0.25em] text-[var(--text-dim)]">
            The French Bakery Cafe & Store
          </span>
        </>
      )}
    </div>
  );
}
