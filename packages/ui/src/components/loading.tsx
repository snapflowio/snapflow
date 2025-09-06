export function Loading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <div className="flex items-center gap-5 rounded-sm px-4 py-3 text-white">
        <div className="border-popover border-t-primary h-10 w-10 animate-spin rounded-full border-4" />
      </div>
    </div>
  );
}
