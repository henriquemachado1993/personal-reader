"use client";
import {
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { Menu, UnstyledButton, Tooltip } from "@mantine/core";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function menuItems(children: ReactNode): ReactNode {
  return Children.toArray(children).flatMap((child, index) => {
    if (!isValidElement(child)) return [];
    const element = child as ReactElement<{
      children?: ReactNode;
      className?: string;
    }>;
    if (element.type === "div")
      return element.props.children
        ? menuItems(element.props.children)
        : [<Menu.Divider key={index} />];
    if (element.type === "h2")
      return [
        <Menu.Label key={index}>
          <h2>{element.props.children}</h2>
        </Menu.Label>,
      ];
    return [
      <Menu.Item
        key={element.key ?? index}
        component={element.type as "button"}
        {...element.props}
        className={`reader-menu-item ${element.props.className ?? ""}`}
      />,
    ];
  });
}
export function Dropdown({
  label,
  icon,
  children,
  className = "",
  triggerClassName = "floating-circle",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  const [opened, setOpened] = useState(false);
  const pathname = usePathname();
  const headerMenu = className.split(" ").includes("header-dropdown");
  useEffect(() => setOpened(false), [pathname]);
  return (
    <div className={className}>
      <Menu
        opened={opened}
        onChange={setOpened}
        position="bottom-end"
        width={headerMenu ? 330 : 260}
        offset={headerMenu ? 14 : 8}
      >
        <Menu.Target>
          <Tooltip
            label={label}
            events={{ hover: true, focus: true, touch: false }}
          >
            <UnstyledButton
              type="button"
              className={triggerClassName}
              aria-label={label}
            >
              {icon}
            </UnstyledButton>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown
          className={`reader-menu${headerMenu ? " reader-header-menu" : ""}`}
        >
          {menuItems(children)}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
