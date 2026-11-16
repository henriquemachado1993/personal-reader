"use client";
import { Children, isValidElement, forwardRef } from "react";
import { DatePickerInput } from "@mantine/dates";
import "dayjs/locale/pt-br";
import {
  Button as MantineButton,
  UnstyledButton,
  Input,
  Select,
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
  if (type === "date") {
    return (
      <DatePickerInput
        locale="pt-br"
        valueFormat="DD/MM/YYYY"
        placeholder="Selecionar data"
        clearable
        value={props.value ? String(props.value) : null}
        onChange={(value) =>
          props.onChange?.({
            target: { value: value ?? "" },
          } as React.ChangeEvent<HTMLInputElement>)
        }
        minDate={props.min ? String(props.min) : undefined}
        aria-label={props["aria-label"]}
        className="reader-field"
        classNames={{ input: className }}
      />
    );
  }
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
>(function SelectField(
  {
    className,
    size: _nativeSize,
    children,
    onChange,
    value,
    defaultValue,
    ...props
  },
  _ref,
) {
  const options = Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value: string;
        children: React.ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    return [
      {
        value: String(child.props.value),
        label: Children.toArray(child.props.children).join(""),
        disabled: child.props.disabled,
      },
    ];
  });
  return (
    <Select
      className="reader-select"
      classNames={{ input: className }}
      id={props.id}
      aria-label={props["aria-label"]}
      name={props.name}
      disabled={props.disabled}
      required={props.required}
      value={value === undefined ? undefined : String(value)}
      defaultValue={
        defaultValue === undefined ? undefined : String(defaultValue)
      }
      data={options}
      allowDeselect={false}
      searchable={options.length > 8}
      onChange={(next) => {
        if (next !== null)
          onChange?.({
            target: { value: next },
          } as React.ChangeEvent<HTMLSelectElement>);
      }}
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
