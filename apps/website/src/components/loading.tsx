import { DotLoader } from "./ui/dot-loader";

const loading = [
  [
    0, 2, 4, 6, 20, 34, 48, 46, 44, 42, 28, 14, 8, 22, 36, 38, 40, 26, 12, 10,
    16, 30, 24, 18, 32,
  ],
  [
    1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39,
    41, 43, 45, 47,
  ],
  [8, 22, 36, 38, 40, 26, 12, 10, 16, 30, 24, 18, 32],
  [9, 11, 15, 17, 19, 23, 25, 29, 31, 33, 37, 39],
  [16, 30, 24, 18, 32],
  [17, 23, 31, 25],
  [24],
  [17, 23, 31, 25],
  [16, 30, 24, 18, 32],
  [9, 11, 15, 17, 19, 23, 25, 29, 31, 33, 37, 39],
  [8, 22, 36, 38, 40, 26, 12, 10, 16, 30, 24, 18, 32],
  [
    1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39,
    41, 43, 45, 47,
  ],
  [
    0, 2, 4, 6, 20, 34, 48, 46, 44, 42, 28, 14, 8, 22, 36, 38, 40, 26, 12, 10,
    16, 30, 24, 18, 32,
  ],
];

export function Loading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <div className="flex items-center gap-5 rounded px-4 py-3 text-white">
        <DotLoader
          frames={loading}
          className="gap-0.5"
          dotClassName="bg-white/15 [&.active]:bg-white size-1"
        />
        <p className="font-medium">Loading...</p>
      </div>
    </div>
  );
}
