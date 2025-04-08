// src/components/ui/card.tsx
import { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-gray-800 shadow-md p-4 w-full",
        "md:p-6 lg:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("mb-4", className)}>{children}</div>;
}

export function CardTitle({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={clsx("text-lg font-semibold text-white", className)}>
      {children}
    </h3>
  );
}

export function CardContent({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("text-sm text-gray-300", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("mt-4", className)}>{children}</div>;
}
