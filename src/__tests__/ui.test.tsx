// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge, Button, Chip, Cover, Field, IconButton, Segmented, Switch, TextInput, ToggleGroup, cx } from "../ui";

afterEach(cleanup);

describe("cx", () => {
  it("joins truthy parts only", () => {
    expect(cx("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("Button", () => {
  it("renders variant and size classes and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" size="sm" onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("db-btn--primary");
    expect(button.className).toContain("db-btn--sm");
    expect(button).toHaveProperty("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Nope</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Nope" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("is named by its label and exposes the pressed state", () => {
    render(
      <IconButton label="Shuffle" active>
        <svg />
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Shuffle" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.className).toContain("db-icon-btn--active");
  });

  it("has no pressed state unless it is a toggle", () => {
    render(
      <IconButton label="Next">
        <svg />
      </IconButton>
    );
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("aria-pressed")).toBe(false);
  });
});

describe("Chip", () => {
  it("reports pressed state and the optional count", () => {
    render(<Chip on count={3}>Missing cover</Chip>);
    const chip = screen.getByRole("button", { name: /Missing cover/ });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.textContent).toContain("3");
  });
});

describe("Switch", () => {
  it("toggles through onChange with switch semantics", async () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return <Switch label="Dynamic background" checked={checked} onChange={setChecked} />;
    }
    render(<Harness />);
    const toggle = screen.getByRole("switch", { name: "Dynamic background" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});

describe("Segmented", () => {
  function Harness({ onChange }: { onChange?: (value: string) => void }) {
    const [value, setValue] = useState("tracks");
    return (
      <Segmented
        label="Library view"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        options={[
          { value: "tracks", label: "Tracks" },
          { value: "albums", label: "Albums" },
          { value: "artists", label: "Artists" },
        ]}
      />
    );
  }

  it("is a radio group with one checked option and a single tab stop", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Library view" })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
  });

  it("selects on click and moves with arrow keys, wrapping around", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Albums" }));
    expect(onChange).toHaveBeenLastCalledWith("albums");
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("artists");
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("tracks");
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("artists");
  });
});

describe("ToggleGroup", () => {
  function Harness({ initial }: { initial: string[] }) {
    const [value, setValue] = useState(initial);
    return (
      <ToggleGroup
        label="Show"
        value={value}
        onChange={setValue}
        options={[
          { value: "cover", label: "Cover" },
          { value: "lyrics", label: "Lyrics" },
          { value: "viz", label: "Visualizer" },
        ]}
      />
    );
  }
  const pressed = () => screen.getAllByRole("button").map((button) => button.getAttribute("aria-pressed"));

  it("allows combinations", async () => {
    render(<Harness initial={["cover"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Lyrics" }));
    expect(pressed()).toEqual(["true", "true", "false"]);
  });

  it("never lets the last active option be switched off", async () => {
    render(<Harness initial={["cover"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Cover" }));
    expect(pressed()).toEqual(["true", "false", "false"]);
  });
});

describe("Field", () => {
  it("associates the label with the nested control", async () => {
    const onChange = vi.fn();
    render(
      <Field label="Title" hint="As shown in the player">
        <TextInput value="Solid Gold" onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
    const input = screen.getByLabelText(/Title/);
    expect((input as HTMLInputElement).value).toBe("Solid Gold");
    await userEvent.type(input, "!");
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByText("As shown in the player")).toBeTruthy();
  });

  it("marks changed and invalid values", () => {
    render(
      <>
        <TextInput aria-label="a" changed />
        <TextInput aria-label="b" invalid />
      </>
    );
    expect(screen.getByLabelText("a").className).toContain("db-input--changed");
    expect(screen.getByLabelText("b").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("Cover", () => {
  it("shows a placeholder without an image", () => {
    const { container } = render(<Cover size={40} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild?.className).toContain("db-cover--empty");
  });

  it("shows the image when there is one", () => {
    const { container } = render(<Cover size={40} src="cover.jpg" alt="Polygon" />);
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("cover.jpg");
    expect(image?.getAttribute("alt")).toBe("Polygon");
  });
});

describe("Badge", () => {
  it("maps tones to classes", () => {
    render(<Badge tone="warn">No genre</Badge>);
    expect(screen.getByText("No genre").className).toContain("db-badge--warn");
  });
});
