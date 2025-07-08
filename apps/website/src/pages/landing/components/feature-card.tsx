import { twMerge } from "tailwind-merge";

export default function FeatureCard(props: {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { title, description, children, className } = props;
  return (
    <div className={twMerge("rounded-3xl border bg-background p-6", className)}>
      <div className="aspect-video">{children}</div>
      <div>
        <h3 className="mt-6 font-bold text-3xl">{title}</h3>
        <p className="mt-2 text-white/50">{description}</p>
      </div>
    </div>
  );
}
