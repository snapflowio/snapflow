import { Button, cn, Input } from "@snapflow/ui";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

export function PasswordInput({
  className,
  enableToggle,
  onChange,
  ...props
}: ComponentProps<typeof Input> & { enableToggle?: boolean }) {
  const [disabled, setDisabled] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        className={cn(enableToggle && "pr-10", className)}
        {...props}
        type={isVisible && enableToggle ? "text" : "password"}
        onChange={(event) => {
          setDisabled(!event.target.value);
          onChange?.(event);
        }}
      />

      {enableToggle && (
        <>
          <Button
            className="absolute top-0 right-0 !bg-transparent"
            disabled={disabled}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => setIsVisible(!isVisible)}
          >
            {isVisible ? <EyeIcon /> : <EyeOffIcon />}
          </Button>
        </>
      )}
    </div>
  );
}
