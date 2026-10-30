import { useEffect, useMemo, useRef, useState } from "react";

export type Command = {
  id: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
};

/**
 * ⌘K: every action in one searchable list. Typing something that matches no
 * command offers to send it to the assistant instead.
 */
export function CommandPalette({
  commands,
  onAsk,
  onClose,
}: {
  commands: Command[];
  onAsk: (text: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matched = words.length
      ? commands.filter((c) =>
          words.every((w) => `${c.label} ${c.group}`.toLowerCase().includes(w)),
        )
      : commands;
    const ask: Command[] = query.trim()
      ? [
          {
            id: "ask",
            label: `Ask the assistant: “${query.trim()}”`,
            group: "Assistant",
            run: () => onAsk(query.trim()),
          },
        ]
      : [];
    return matched.length ? [...matched, ...ask] : ask;
  }, [commands, query, onAsk]);

  useEffect(() => setIndex(0), [query]);

  const choose = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  let lastGroup = "";
  return (
    <div className="ed-palette-backdrop" onMouseDown={onClose}>
      <div
        className="ed-palette"
        role="dialog"
        aria-label="Commands"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command, a page, or a change to ask for…"
          aria-label="Search commands"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[index]);
            } else if (e.key === "Escape") onClose();
          }}
        />
        <ul role="listbox">
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <li key={c.id} role="presentation">
                {header && <div className="ed-palette-group">{header}</div>}
                <button
                  role="option"
                  aria-selected={i === index}
                  className={i === index ? "ed-active" : ""}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(c)}
                >
                  <span>{c.label}</span>
                  {c.hint && <kbd>{c.hint}</kbd>}
                </button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="ed-palette-empty">Type to search</li>
          )}
        </ul>
      </div>
    </div>
  );
}
