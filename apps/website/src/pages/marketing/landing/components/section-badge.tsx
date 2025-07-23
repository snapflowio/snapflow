interface Props {
  title: string;
}

export function SectionBadge({ title }: Props) {
  return (
    <div className="cursor-pointer select-none rounded-full border px-4 py-1">
      <div className=" font-medium text-green-400 text-sm">{title}</div>
    </div>
  );
}
