import type { ButtonHTMLAttributes } from "react";

import { button, cn, type ButtonSize, type ButtonVariant } from "@/lib/ui";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cn(button(variant, size), className)} {...rest} />;
}
