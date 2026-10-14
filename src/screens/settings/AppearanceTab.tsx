import { IconPlus, IconTrash } from "../../components/icons";
import { useSettingsStore } from "../../store/settingsStore";
import { Badge, Button, IconButton, SettingRow, Segmented, Slider, Switch } from "../../ui";

export function AppearanceTab() {
  const s = useSettingsStore();
  const activeTheme = s.accentThemes[s.accentIndex] ?? s.accentThemes[0];

  return (
    <>
      <h2 className="set__heading db-text-display">Appearance</h2>
      <div className="set__group">
        <SettingRow title="Theme" description="Light, or dark for low-light listening.">
          <Segmented
            label="Theme"
            value={s.colorMode}
            onChange={s.setColorMode}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </SettingRow>
        <SettingRow title="Track list style" description="Table rows or a grid of covers in the library.">
          <Segmented
            label="Track list style"
            value={s.listDensity}
            onChange={s.setListDensity}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
              { value: "grid", label: "Grid" },
            ]}
          />
        </SettingRow>
        <SettingRow title="Dynamic background" description="Tints the whole window with the cover of the current track." badge={<Badge>New</Badge>}>
          <Switch label="Dynamic background" checked={s.dynamicBackground} onChange={s.setDynamicBackground} />
        </SettingRow>
        <SettingRow title="Background intensity" description={`${s.backgroundIntensity}%`}>
          <Slider className="set__slider" label="Background intensity" min={0} max={100} step={1} value={s.backgroundIntensity} disabled={!s.dynamicBackground} onValueChange={s.setBackgroundIntensity} />
        </SettingRow>
      </div>

      <h3 className="set__subheading">Accent color</h3>
      <div className="set__accents" role="group" aria-label="Accent colors">
        {s.accentThemes.map((theme, index) => (
          <button
            key={`${theme.accent}-${index}`}
            type="button"
            className="set__swatch"
            style={{ background: theme.accent }}
            aria-label={`Accent ${index + 1}, ${theme.accent}`}
            aria-pressed={index === s.accentIndex}
            onClick={() => s.setAccentIndex(index)}
          />
        ))}
        <IconButton label="Add an accent color" onClick={s.addAccentTheme}><IconPlus /></IconButton>
      </div>
      {activeTheme ? (
        <div className="set__accent-edit">
          <label className="set__color">
            <span>Selected color</span>
            <input type="color" value={activeTheme.accent} onChange={(event) => s.changeAccentColor(s.accentIndex, event.target.value)} aria-label="Edit the selected accent color" />
            <code>{activeTheme.accent}</code>
          </label>
          <Button size="sm" icon={<IconTrash />} disabled={s.accentThemes.length <= 1} onClick={() => s.removeAccentTheme(s.accentIndex)}>Remove</Button>
          <Button size="sm" onClick={s.resetAccentThemes}>Reset palette</Button>
        </div>
      ) : null}
      <div className="set__group">
        <SettingRow title="Rotate accent on launch" description="Pick the next color of your palette every time the app starts.">
          <Switch label="Rotate accent on launch" checked={s.accentRotateOnLaunch} onChange={s.setAccentRotateOnLaunch} />
        </SettingRow>
      </div>
    </>
  );
}
