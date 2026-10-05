export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  /** Actions, shown at the end of the row. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1.5">
        <h1 className="heading text-2xl md:text-[28px]">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-[70ch] text-sm">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
