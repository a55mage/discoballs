import { type ReactNode, useState } from "react";
import {
  IconCheck,
  IconFolder,
  IconHeart,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeatOne,
  IconSave,
  IconSearch,
  IconShuffle,
  IconTrash,
} from "../components/icons";
import { useSettingsStore } from "../store/settingsStore";
import { Badge, Button, Chip, Cover, Field, IconButton, Pane, Segmented, Select, Slider, Switch, TextInput, ToggleGroup } from "./index";
import { useApplyTheme } from "./useApplyTheme";

const SWATCHES = [
  ["--db-bg", "bg"],
  ["--db-solid", "solid"],
  ["--db-surface", "surface"],
  ["--db-surface-2", "surface-2"],
  ["--db-line", "line"],
  ["--db-ink", "ink"],
  ["--db-ink-2", "ink-2"],
  ["--db-accent", "accent"],
  ["--db-accent-fill", "accent-fill"],
  ["--db-accent-soft", "accent-soft"],
  ["--db-warn", "warn"],
  ["--db-ok", "ok"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ padding: "20px 0", borderTop: "1px solid var(--db-line)" }}>
      <h2 style={{ margin: "0 0 14px", font: "800 13px var(--db-font-sans)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--db-ink-2)" }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>{children}</div>
    </section>
  );
}

/** Living reference of every design-system component. Open the app with `#styleguide` (dev only). */
export function StyleGuide() {
  useApplyTheme();
  const { colorMode, setColorMode, accentThemes, accentIndex, setAccentIndex } = useSettingsStore();
  const [view, setView] = useState("tracks");
  const [show, setShow] = useState<string[]>(["cover", "lyrics"]);
  const [on, setOn] = useState(true);
  const [volume, setVolume] = useState(60);
  const [chip, setChip] = useState(false);
  const [text, setText] = useState("Harbor Lights");

  return (
    <div style={{ minHeight: "100vh", background: "var(--db-bg)", color: "var(--db-ink)", fontFamily: "var(--db-font-sans)", position: "relative" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--db-veil)" }} />
      <div style={{ position: "relative", maxWidth: 980, margin: "0 auto", padding: "28px 24px 80px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <h1 className="db-text-display" style={{ margin: 0, fontSize: 32, fontWeight: 800, flex: 1 }}>
            DiscoBalls UI kit
          </h1>
          <Segmented
            label="Theme"
            value={colorMode}
            onChange={setColorMode}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <div style={{ display: "flex", gap: 8 }} role="group" aria-label="Accent color">
            {accentThemes.map((theme, index) => (
              <button
                key={theme.accent + index}
                type="button"
                aria-label={`Accent ${index + 1}`}
                aria-pressed={index === accentIndex}
                onClick={() => setAccentIndex(index)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: 0,
                  background: theme.accent,
                  cursor: "pointer",
                  boxShadow: index === accentIndex ? "0 0 0 2px var(--db-solid), 0 0 0 4px " + theme.accent : "none",
                }}
              />
            ))}
          </div>
        </header>

        <Section title="Typography">
          <div>
            <div className="db-text-display" style={{ fontSize: 32, fontWeight: 800 }}>Display 32 · Syne</div>
            <div className="db-text-display" style={{ fontSize: 24, fontWeight: 700 }}>Title 24 · Syne</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Body strong 16 · Manrope</div>
            <div style={{ fontSize: 14 }}>Body 14 · Manrope regular for lists and forms</div>
            <div style={{ fontSize: 12, color: "var(--db-ink-2)" }}>Caption 12 · secondary text</div>
          </div>
        </Section>

        <Section title="Color tokens">
          {SWATCHES.map(([token, name]) => (
            <div key={token} style={{ width: 96 }}>
              <div style={{ height: 44, borderRadius: 10, background: `var(${token})`, border: "1px solid var(--db-line)" }} />
              <div style={{ fontSize: 11, marginTop: 4, color: "var(--db-ink-2)" }}>{name}</div>
            </div>
          ))}
        </Section>

        <Section title="Buttons">
          <Button variant="primary" icon={<IconSave />}>Save tags</Button>
          <Button variant="secondary" icon={<IconFolder />}>Open folder</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger" icon={<IconTrash />}>Delete</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Section>

        <Section title="Icon buttons">
          <IconButton label="Previous"><IconPrev /></IconButton>
          <IconButton label="Play" solid><IconPlay /></IconButton>
          <IconButton label="Pause" solid><IconPause /></IconButton>
          <IconButton label="Next"><IconNext /></IconButton>
          <IconButton label="Shuffle" active><IconShuffle /></IconButton>
          <IconButton label="Repeat track"><IconRepeatOne /></IconButton>
          <IconButton label="Favorite" size="sm"><IconHeart /></IconButton>
          <IconButton label="Search" size="lg"><IconSearch /></IconButton>
          <IconButton label="Disabled" disabled><IconCheck /></IconButton>
        </Section>

        <Section title="Chips, segmented and toggle groups">
          <Chip on={chip} onClick={() => setChip((value) => !value)} count={4}>Missing cover</Chip>
          <Chip>All</Chip>
          <Segmented
            label="Library view"
            value={view}
            onChange={setView}
            options={[
              { value: "tracks", label: "Tracks" },
              { value: "albums", label: "Albums" },
              { value: "artists", label: "Artists" },
            ]}
          />
          <ToggleGroup
            label="Show in Now Playing"
            value={show}
            onChange={setShow}
            options={[
              { value: "cover", label: "Cover" },
              { value: "lyrics", label: "Lyrics" },
              { value: "viz", label: "Visualizer" },
            ]}
          />
        </Section>

        <Section title="Form controls">
          <div style={{ width: 240 }}><Field label="Title"><TextInput value={text} onChange={(event) => setText(event.target.value)} /></Field></div>
          <div style={{ width: 240 }}><Field label="Artist (changed)"><TextInput defaultValue="Marlow Vane" changed /></Field></div>
          <div style={{ width: 240 }}><Field label="Year" hint="Four digits"><TextInput defaultValue="20x9" invalid /></Field></div>
          <div style={{ width: 200 }}>
            <Field label="Genre">
              <Select defaultValue="rock"><option value="rock">Rock</option><option value="folk">Folk</option></Select>
            </Field>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Switch label="Dynamic background" checked={on} onChange={setOn} /> Dynamic background
          </label>
          <div style={{ width: 220 }}>
            <Field label={`Volume ${volume}%`}><Slider label="Volume" min={0} max={100} value={volume} onValueChange={setVolume} /></Field>
          </div>
        </Section>

        <Section title="Badges and covers">
          <Badge>FLAC · 1411 kbps</Badge>
          <Badge tone="neutral">MP3</Badge>
          <Badge tone="warn">No genre</Badge>
          <Badge tone="ok">All fields match</Badge>
          <Cover size={64} src="" />
          <Cover size={64} radius={32} />
        </Section>

        <Section title="Glass panes">
          <div style={{ display: "flex", width: "100%", height: 140, borderRadius: 16, overflow: "hidden", border: "1px solid var(--db-line)", background: "linear-gradient(135deg, var(--db-accent), #1f3a5f)" }}>
            <Pane glass divider="right" style={{ width: 180, padding: 16 }}>Sidebar</Pane>
            <Pane style={{ flex: 1, padding: 16, background: "var(--db-content)" }}>Content window</Pane>
            <Pane glass divider="left" style={{ width: 200, padding: 16 }}>Inspector</Pane>
          </div>
        </Section>
      </div>
    </div>
  );
}
