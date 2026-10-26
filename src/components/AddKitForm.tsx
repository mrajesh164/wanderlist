"use client";

import { useRef, useState } from "react";
import { Button } from "./Button";
import { Field, Select, TextArea, TextInput, focusFirstError } from "./Field";
import { CATEGORY_ORDER, type ItemCategory } from "@/lib/types";
import type { KitAddition } from "@/app/providers";

/**
 * Add things to your inventory, several at a time.
 *
 * Nobody lists what they own one field at a time — they think in runs ("rain
 * shell, hiking boots, head torch"). So this takes a whole list: one per line,
 * or separated by commas, which is also what you get when you paste from notes.
 *
 * The category select ends in "A new category…" so the seven defaults aren't a
 * ceiling.
 */

const NEW_CATEGORY = "__new__";

/**
 * One per line, or comma separated, or both — with an optional count on the
 * end: "T-shirt x3", "Wool socks × 2".
 *
 * The suffix isn't advertised anywhere; the How many field is what people are
 * pointed at. It stays supported because pasting a list that already carries
 * counts is a real thing to do, and the alternative is silently creating an
 * item named "Wool socks x2". A line that names its own count overrides the
 * field, being the more specific of the two.
 */
function parseEntries(raw: string): KitAddition[] {
  return raw
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(.*?)\s*[x×]\s*(\d{1,2})$/i.exec(part);
      if (!match || !match[1]) return { label: part };
      return { label: match[1].trim(), qty: Number(match[2]) };
    })
    .filter((entry) => entry.label.length > 0);
}

export function AddKitForm({
  existing,
  existingCategories,
  onAdd,
  onSetQty,
}: {
  /** Every row already in the inventory, with the count it currently shows. */
  existing: { label: string; qty: number; category: ItemCategory }[];
  existingCategories: ItemCategory[];
  onAdd: (entries: KitAddition[], category: string) => void;
  onSetQty: (label: string, category: ItemCategory, qty: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const [category, setCategory] = useState<string>("Clothing");
  const [customCategory, setCustomCategory] = useState("");
  /** Held as a string so the field can be empty mid-typing. */
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string>();
  const [categoryError, setCategoryError] = useState<string>();
  const [qtyError, setQtyError] = useState<string>();
  const [added, setAdded] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);

  const extras = existingCategories.filter((c) => !CATEGORY_ORDER.includes(c));
  const choosingNew = category === NEW_CATEGORY;
  const parsed = parseEntries(raw);

  function submit(event: React.FormEvent) {
    event.preventDefault();

    if (parsed.length === 0) {
      setError("List at least one thing to add.");
      queueMicrotask(() => focusFirstError(formRef.current));
      return;
    }

    const resolved = choosingNew ? customCategory.trim() : category;
    if (choosingNew && !resolved) {
      setCategoryError("Name the new category.");
      queueMicrotask(() => focusFirstError(formRef.current));
      return;
    }

    /* The count applies to everything in this submission, the same way the
       category does — add "Rain shell, Hiking boots" and both land in one
       place, at one count. A line carrying its own "x3" keeps it. */
    const batchQty = Number(qty);
    if (!Number.isInteger(batchQty) || batchQty < 1 || batchQty > 99) {
      setQtyError("A whole number, 1 to 99.");
      queueMicrotask(() => focusFirstError(formRef.current));
      return;
    }

    /**
     * Listing something twice used to be an error, which was the wrong answer
     * to the right question: someone typing "T-shirt" when a t-shirt is already
     * there is telling us they own another one. So a repeat adds up — to the
     * count they gave, or one more than the row shows.
     */
    const known = new Map(existing.map((e) => [e.label.toLowerCase(), e]));
    const fresh: KitAddition[] = [];
    const counted: string[] = [];

    for (const entry of parsed) {
      const current = known.get(entry.label.toLowerCase());
      if (!current) {
        fresh.push({ ...entry, qty: entry.qty ?? batchQty });
        continue;
      }
      /* A repeat means another one of these: the count given, or one more than
         the row already shows. The field's default of 1 must not read as "set
         this to 1", which would quietly undo a bigger count. */
      const next =
        entry.qty ?? (batchQty > 1 ? batchQty : current.qty + 1);
      if (next === current.qty) continue;
      /* Its own category, not whatever the select happens to be showing — this
         row already has a home and the add form isn't choosing it. */
      onSetQty(current.label, current.category, next);
      counted.push(`${current.label} → ${next}`);
    }

    if (fresh.length > 0) onAdd(fresh, resolved);

    setRaw("");
    /* The category persists — people file several things in a row into the same
       place. The count doesn't: "2" was about the socks, and carrying it into
       the next add would quietly claim two of whatever comes next. */
    setQty("1");
    setError(undefined);
    setCategoryError(undefined);
    setQtyError(undefined);

    /* Say the count back. The field is the whole point of this form now, so a
       confirmation that doesn't mention the number leaves you checking the
       rows to see whether it took. */
    const addedSaid =
      fresh.length === 0
        ? null
        : fresh.length === 1
          ? `Added ${fresh[0]!.label}${
              fresh[0]!.qty && fresh[0]!.qty > 1 ? ` × ${fresh[0]!.qty}` : ""
            } to ${resolved}`
          : `Added ${fresh.length} to ${resolved}${
              batchQty > 1 ? `, ${batchQty} each` : ""
            }`;

    const said = [
      addedSaid,
      counted.length > 0 ? counted.join(", ") : null,
    ].filter(Boolean);
    setAdded(
      said.length > 0
        ? said.join(" · ")
        : "Already in your inventory at that count.",
    );
    if (choosingNew) {
      setCategory(resolved);
      setCustomCategory("");
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="mt-6 border border-rule bg-surface p-5"
    >
      <p className="measure mb-4 text-small text-muted">
        One per line, or separated by commas. Things you pack show up here too.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Field
            label="What do you have?"
            error={error}
          >
            {(props) => (
              <TextArea
                {...props}
                value={raw}
                rows={3}
                placeholder={"Rain shell\nHiking boots\nHead torch"}
                onChange={(e) => {
                  setRaw(e.target.value);
                  if (error) setError(undefined);
                  if (added) setAdded(undefined);
                }}
              />
            )}
          </Field>
        </div>

        {/* Side by side rather than stacked. Stacked, these two came to more
            than the textarea's height, so both columns ended on different
            lines and the panel read as two misaligned halves. In a row they
            share the textarea's top edge, their labels sit on one line with
            "What do you have?", and the space beneath them reads as deliberate
            rather than as a gap. */}
        <div className="flex gap-3 sm:w-64">
          <Field label="Where it goes" error={categoryError} className="flex-1">
            {(props) => (
              <>
                <Select
                  {...props}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (categoryError) setCategoryError(undefined);
                  }}
                >
                  {[...CATEGORY_ORDER, ...extras].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY}>A new category…</option>
                </Select>

                {choosingNew && (
                  <TextInput
                    value={customCategory}
                    autoFocus
                    aria-label="Name the new category"
                    placeholder="Climbing gear"
                    className="mt-2"
                    onChange={(e) => {
                      setCustomCategory(e.target.value);
                      if (categoryError) setCategoryError(undefined);
                    }}
                  />
                )}
              </>
            )}
          </Field>

          {/* Applies to everything in this submission, like the category
              beside it. Most things are one, so it starts at 1 and is there
              for the times they aren't. */}
          <Field label="How many" error={qtyError} className="w-20">
            {(props) => (
              <TextInput
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                step={1}
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  if (qtyError) setQtyError(undefined);
                  if (added) setAdded(undefined);
                }}
              />
            )}
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary">
          {parsed.length > 1 ? `Add ${parsed.length} things` : "Add to inventory"}
        </Button>
        <p aria-live="polite" className="text-small text-success">
          {added ?? ""}
        </p>
      </div>
    </form>
  );
}
