'use client';

import { useId } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  appearanceColors,
  appearanceEnums,
  appearanceKeys,
  appearanceNumbers,
  profileFonts,
} from '@/lib/appearance-options';
import type { Profile, ProfileAppearance } from '@/lib/types';

type Change = (values: ProfileAppearance) => void;
type ColorKey = (typeof appearanceColors)[number];
type NumberKey = keyof typeof appearanceNumbers;
type EnumKey = keyof typeof appearanceEnums;
type ToggleKey = 'showAvatar' | 'showBranding' | 'showQrCode' | 'showLinkIcons' | 'showLinkArrows';
const hexColor = /^#[0-9a-f]{6}$/i;

function ColorControl({
  label,
  field,
  value,
  fallback,
  onChange,
}: {
  label: string;
  field: ColorKey;
  value?: string;
  fallback: string;
  onChange: Change;
}) {
  const id = useId();
  const invalid = value !== undefined && !hexColor.test(value);
  return (
    <div className="design-control">
      <label htmlFor={id}>{label}</label>
      <div className="design-color-row">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value && hexColor.test(value) ? value : fallback}
          onChange={(event) => onChange({ [field]: event.target.value })}
        />
        <input
          id={id}
          type="text"
          value={value ?? ''}
          placeholder="Automatic"
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => onChange({ [field]: event.target.value || undefined })}
        />
        <button
          type="button"
          className="design-reset"
          aria-label={`Reset ${label.toLowerCase()}`}
          disabled={value === undefined}
          onClick={() => onChange({ [field]: undefined })}
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      </div>
      {invalid && (
        <small id={`${id}-error`} className="design-error">
          Use a six-digit color, such as #284839.
        </small>
      )}
    </div>
  );
}

function RangeControl({
  label,
  field,
  value,
  fallback,
  onChange,
  unit = 'px',
}: {
  label: string;
  field: NumberKey;
  value?: number;
  fallback: number;
  onChange: Change;
  unit?: string;
}) {
  const id = useId();
  const [min, max] = appearanceNumbers[field];
  return (
    <div className="design-control">
      <div className="design-range-label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value ?? fallback}
          {unit}
        </output>
      </div>
      <div className="design-range-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={1}
          value={value ?? fallback}
          onChange={(event) => onChange({ [field]: Number(event.target.value) })}
        />
        <button
          type="button"
          className="design-reset"
          aria-label={`Reset ${label.toLowerCase()}`}
          disabled={value === undefined}
          onClick={() => onChange({ [field]: undefined })}
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function SelectControl({
  label,
  field,
  value,
  options,
  onChange,
}: {
  label: string;
  field: EnumKey;
  value?: string | number;
  options: readonly { value: string | number; label: string }[];
  onChange: Change;
}) {
  const id = useId();
  return (
    <div className="design-control">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) =>
          onChange({
            [field]:
              event.target.value === ''
                ? undefined
                : field === 'headingWeight'
                  ? Number(event.target.value)
                  : event.target.value,
          })
        }
      >
        <option value="">Theme default</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleControl({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: ToggleKey;
  value?: boolean;
  onChange: Change;
}) {
  return (
    <label className="design-toggle">
      <input
        type="checkbox"
        checked={value !== false}
        onChange={(event) => onChange({ [field]: event.target.checked })}
      />
      <span>{label}</span>
    </label>
  );
}

const alignmentOptions = ['left', 'center', 'right'].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));
const preservedImageSettings = new Set([
  'backgroundImageUrl',
  'backgroundPosition',
  'backgroundOverlay',
  'avatarPosition',
  'dashboardBackground',
]);

export default function AppearanceEditor({
  profile,
  onChange,
  disabled,
}: {
  profile: Profile;
  onChange: Change;
  disabled?: boolean;
}) {
  const appearance = profile.appearance || {};
  const dark = profile.theme === 'ink';
  const textFallback = dark ? '#f9f8f2' : '#353a30';
  const color = (field: ColorKey, label: string, fallback = textFallback) => (
    <ColorControl
      key={field}
      field={field}
      label={label}
      value={appearance[field]}
      fallback={fallback}
      onChange={onChange}
    />
  );
  const range = (field: NumberKey, label: string, fallback: number, unit?: string) => (
    <RangeControl
      key={field}
      field={field}
      label={label}
      value={appearance[field]}
      fallback={fallback}
      unit={unit}
      onChange={onChange}
    />
  );
  const select = (
    field: EnumKey,
    label: string,
    options: readonly { value: string | number; label: string }[],
  ) => (
    <SelectControl
      key={field}
      field={field}
      label={label}
      value={appearance[field]}
      options={options}
      onChange={onChange}
    />
  );
  const toggle = (field: ToggleKey, label: string) => (
    <ToggleControl
      key={field}
      field={field}
      label={label}
      value={appearance[field]}
      onChange={onChange}
    />
  );
  function resetStyling() {
    onChange(
      Object.fromEntries(
        appearanceKeys
          .filter((key) => !preservedImageSettings.has(key))
          .map((key) => [key, undefined]),
      ),
    );
  }

  return (
    <fieldset className="design-editor" disabled={disabled}>
      <legend>Your page, your style</legend>
      <p className="design-intro">
        Customize your public page. See changes in the preview, then save when you’re ready. Reset
        any setting to follow your theme.
      </p>
      <details className="design-group" open>
        <summary>
          Text & fonts<span>Typefaces, sizes, and alignment</span>
        </summary>
        <div className="design-grid">
          {select('fontFamily', 'Body and link font', profileFonts)}
          {select('headingFontFamily', 'Profile name font', profileFonts)}
          {select(
            'headingWeight',
            'Profile name weight',
            [400, 500, 600, 700, 800].map((value) => ({
              value,
              label: `${value} — ${value === 400 ? 'Regular' : value === 500 ? 'Medium' : value === 600 ? 'Semibold' : value === 700 ? 'Bold' : 'Extra bold'}`,
            })),
          )}
          {select('textAlign', 'Profile text alignment', alignmentOptions)}
          {range('headingSize', 'Profile name size', 29)}
          {range('bioSize', 'Bio text size', 12)}
          {range('linkFontSize', 'Link text size', 13)}
        </div>
      </details>
      <details className="design-group">
        <summary>
          Colors<span>Text, buttons, and borders</span>
        </summary>
        <p className="design-hint">
          Leave a color on Automatic to follow your theme. Choose contrasting colors so your links
          stay easy to read.
        </p>
        <div className="design-grid">
          {color('headingColor', 'Profile name color')}
          {color('textColor', 'Bio and page text color')}
          {color('linkTextColor', 'Link text and icon color')}
          {color('linkBackgroundColor', 'Link background color', dark ? '#424a46' : '#fffdf6')}
          {color('linkBorderColor', 'Link border color', '#ffffff')}
          {color('avatarBorderColor', 'Profile picture border color', '#ffffff')}
        </div>
      </details>
      <details className="design-group">
        <summary>
          Profile picture<span>Size, shape, and border</span>
        </summary>
        <p className="design-hint">
          Upload or replace your picture in Settings. These controls also style your initials when
          no picture is set.
        </p>
        <div className="design-grid">
          {range('avatarSize', 'Profile picture size', 92)}
          {select('avatarShape', 'Profile picture shape', [
            { value: 'circle', label: 'Circle' },
            { value: 'rounded', label: 'Rounded square' },
            { value: 'square', label: 'Square' },
          ])}
          {range('avatarBorderWidth', 'Profile picture border width', 3)}
        </div>
        {toggle('showAvatar', 'Show profile picture')}
      </details>
      <details className="design-group">
        <summary>
          Link buttons<span>Shape, fill, spacing, and icons</span>
        </summary>
        <div className="design-grid">
          {select('linkStyle', 'Button style', [
            { value: 'filled', label: 'Filled' },
            { value: 'outline', label: 'Outline' },
            { value: 'glass', label: 'Glass' },
          ])}
          {select('linkShadow', 'Button shadow', [
            { value: 'none', label: 'None' },
            { value: 'soft', label: 'Soft' },
            { value: 'bold', label: 'Bold' },
          ])}
          {select('linkAlign', 'Link text alignment', alignmentOptions)}
          {range('linkRadius', 'Button corner radius', 8)}
          {range('linkBorderWidth', 'Button border width', 1)}
          {range('linkPadding', 'Button padding', 14)}
          {range('linkGap', 'Space between links', 11)}
        </div>
        {toggle('showLinkIcons', 'Show platform logos')}
        {toggle('showLinkArrows', 'Show link arrows')}
      </details>
      <details className="design-group">
        <summary>
          Layout & background<span>Page width, spacing, and gradients</span>
        </summary>
        <div className="design-grid">
          {range('contentWidth', 'Page content width', 480)}
          {range('contentPadding', 'Space above profile', 24)}
          {color('backgroundGradientColor', 'Gradient second color', '#dce5d8')}
          {range('backgroundGradientAngle', 'Gradient direction', 135, '°')}
          {select('backgroundFit', 'Background image fit', [
            { value: 'cover', label: 'Fill the page (crop to fit)' },
            { value: 'contain', label: 'Fit the whole image' },
          ])}
        </div>
        <p className="design-hint">
          The gradient starts with your background color above. Reset the second color to return to
          a solid background. Images appear over the color or gradient.
        </p>
      </details>
      <details className="design-group">
        <summary>
          Page elements<span>Branding and sharing</span>
        </summary>
        {toggle('showBranding', 'Show Linkboard branding and footer')}
        {toggle('showQrCode', 'Show QR code and sharing section')}
        <p className="design-hint">
          Your QR download remains available in the dashboard when hidden from the public page.
        </p>
      </details>
      <div className="design-reset-all">
        <button type="button" className="button small-button" onClick={resetStyling}>
          <RotateCcw size={14} aria-hidden="true" />
          Reset styling
        </button>
        <span>Keeps your images, content, and chosen theme.</span>
      </div>
    </fieldset>
  );
}
