"use client";
import { forwardRef } from "react";
import {
  Button as MantineButton,
  UnstyledButton,
  Input,
  NativeSelect,
  Textarea as MantineTextarea,
  Checkbox,
} from "@mantine/core";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function Button({ className = "", type = "submit", ...props }, ref) {
  if (!className.split(" ").includes("button"))
    return (
      <UnstyledButton ref={ref} type={type} className={className} {...props} />
    );
  return (
    <MantineButton
      ref={ref}
      type={type}
      variant={className.includes("secondary") ? "default" : "filled"}
      className={className}
      {...props}
    />
  );
});
export const TextField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextField(
  { className, type = "text", hidden, size: _nativeSize, ...props },
  ref,
) {
  // Keep specialized browser gestures/file pickers native, inside Mantine's input primitive.
  if (type === "checkbox")
    return <Checkbox ref={ref} {...props} className="reader-checkbox" />;
  if (hidden || ["range", "color", "file"].includes(type))
    return (
      <Input
        component="input"
        ref={ref}
        type={type}
        {...props}
        hidden={hidden}
        wrapperProps={{ hidden, className: "specialized-field" }}
        classNames={{ input: className }}
      />
    );
  return (
    <Input
      component="input"
      ref={ref}
      type={type}
      {...props}
      classNames={{ input: className }}
      className="reader-field"
    />
  );
});
export const SelectField = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function SelectField({ className, size: _nativeSize, ...props }, ref) {
  return (
    <NativeSelect
      ref={ref}
      className="reader-select"
      classNames={{ input: className }}
      {...props}
    />
  );
});
export const TextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...props }, ref) {
  return (
    <MantineTextarea
      ref={ref}
      className="reader-textarea"
      classNames={{ input: className }}
      {...props}
    />
  );
});
