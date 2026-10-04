"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { filterPlaceOptions, mergePlaceOptions, type PlaceOption } from "@/lib/places";

export function PlaceCombobox({
  id,
  value,
  onChange,
  extraPlaces,
  placeholder = "Township or city",
  variant = "field",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  extraPlaces?: string[];
  placeholder?: string;
  variant?: "plain" | "field";
  "aria-label"?: string;
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [filtering, setFiltering] = useState(false);

  const options = useMemo(() => mergePlaceOptions(extraPlaces), [extraPlaces]);
  const matches = useMemo(
    () => (filtering ? filterPlaceOptions(options, value) : options),
    [filtering, options, value],
  );
  const grouped = useMemo(() => {
    const cities = matches.filter((item) => item.group === "city");
    const townships = matches.filter((item) => item.group === "township");
    return { cities, townships };
  }, [matches]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [value, open]);

  function selectOption(option: PlaceOption) {
    onChange(option.value);
    setFiltering(false);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Enter" && open && matches[highlight]) {
      event.preventDefault();
      selectOption(matches[highlight]);
    }
  }

  let optionIndex = -1;

  return (
    <div className={`place-combobox ${variant === "field" ? "place-combobox-field" : "place-combobox-plain"}`} ref={rootRef}>
      <input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches[highlight] ? `${listId}-opt-${highlight}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={variant === "field" ? "input-search place-combobox-input" : "place-combobox-input"}
        onChange={(event) => {
          onChange(event.target.value);
          setFiltering(true);
          setOpen(true);
        }}
        onFocus={() => {
          setFiltering(false);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {variant === "field" ? (
        <svg className="place-combobox-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
            clipRule="evenodd"
          />
        </svg>
      ) : null}
      {open ? (
        <div className="place-combobox-menu" id={listId} role="listbox" aria-label="Townships and cities">
          {value ? (
            <button type="button" className="place-combobox-option" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); setFiltering(false); setOpen(false); }}>
              All townships and cities
            </button>
          ) : null}
          {matches.length === 0 ? (
            <p className="place-combobox-empty">No matching township or city</p>
          ) : (
            <>
              {grouped.cities.length ? <div className="place-combobox-group">Cities</div> : null}
              {grouped.cities.map((item) => {
                optionIndex += 1;
                const index = optionIndex;
                return (
                  <OptionButton
                    key={item.value}
                    id={`${listId}-opt-${index}`}
                    option={item}
                    active={index === highlight}
                    onHighlight={() => setHighlight(index)}
                    onSelect={selectOption}
                  />
                );
              })}
              {grouped.townships.length ? <div className="place-combobox-group">Townships</div> : null}
              {grouped.townships.map((item) => {
                optionIndex += 1;
                const index = optionIndex;
                return (
                  <OptionButton
                    key={item.value}
                    id={`${listId}-opt-${index}`}
                    option={item}
                    active={index === highlight}
                    onHighlight={() => setHighlight(index)}
                    onSelect={selectOption}
                  />
                );
              })}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OptionButton({
  id,
  option,
  active,
  onHighlight,
  onSelect,
}: {
  id: string;
  option: PlaceOption;
  active: boolean;
  onHighlight: () => void;
  onSelect: (option: PlaceOption) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={active}
      className={`place-combobox-option ${active ? "place-combobox-option-active" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onHighlight}
      onClick={() => onSelect(option)}
    >
      {option.value}
    </button>
  );
}
