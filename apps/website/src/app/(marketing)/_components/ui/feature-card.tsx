import { twMerge } from "tailwind-merge";

export default function FeatureCard(props: {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { title, description, children, className } = props;
  return (
    <div className={twMerge("flex flex-col rounded-3xl border p-6", className)}>
      <div className="flex min-h-[200px] flex-1 items-center justify-center">{children}</div>
      <div className="mt-6 text-center">
        <h3 className="font-bold text-3xl">{title}</h3>
        <p className="mt-2 text-white/50">{description}</p>
      </div>
    </div>
  );
}
