export function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full md:rounded-s-[inherit] min-[1024px]:rounded-e-3xl">
      <div className="container p-8">{children}</div>
    </div>
  );
}
