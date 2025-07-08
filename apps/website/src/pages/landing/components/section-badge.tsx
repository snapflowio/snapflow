interface Props {
  title: string;
}

export function SectionBadge({ title }: Props) {
  return (
    <div className="cursor-pointer select-none rounded-full bg-primary/20 px-4 py-1">
      <div className="animate-background-shine bg-[length:250%_100%] bg-[linear-gradient(110deg,#6d28d9,45%,#c4b5fd,55%,#6d28d9)] bg-clip-text font-medium text-sm text-transparent">
        {title}
      </div>
    </div>
  );
}
