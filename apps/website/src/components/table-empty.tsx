import { TableCell, TableRow } from "./ui/table";

interface TableEmptyStateProps {
  colSpan: number;
  message: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

export function TableEmptyState({
  colSpan,
  message,
  icon,
  description,
  className = "",
}: TableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={`h-32 text-center`}>
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          {icon && (
            <span className="mb-1 text-3xl text-muted-foreground" aria-hidden="true">
              {icon}
            </span>
          )}
          <p className="font-semibold text-lg text-muted-foreground">{message}</p>
          {description && (
            <div className="max-w-md whitespace-normal break-words text-center text-muted-foreground/80 text-sm">
              {description}
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
