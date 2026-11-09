import { useEffect, useState } from "react";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function writeToFocused(next: string) {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const value = el.value.slice(0, start) + next + el.value.slice(end);
  setNativeValue(el, value);
  const caret = start + next.length;
  el.setSelectionRange(caret, caret);
}

function backspaceFocused() {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const from = start === end ? Math.max(0, start - 1) : start;
  const value = el.value.slice(0, from) + el.value.slice(end);
  setNativeValue(el, value);
  el.setSelectionRange(from, from);
}

function blockBottom(target: HTMLElement): number {
  let bottom = target.getBoundingClientRect().bottom;
  let node: Element | null = target.nextElementSibling;
  for (let step = 0; step < 2 && node instanceof HTMLElement; step += 1) {
    bottom = Math.max(bottom, node.getBoundingClientRect().bottom);
    if (node.tagName === "BUTTON") break;
    node = node.nextElementSibling;
  }
  return bottom;
}

function revealField(target: HTMLElement) {
  const scroller = target.closest(".lock-screen, .login-screen, .screen-page, .modal-body");
  const keyboard = document.querySelector(".osk")?.getBoundingClientRect().height ?? 280;
  const rect = target.getBoundingClientRect();
  const visibleBottom = window.innerHeight - keyboard - 12;
  const overflow = blockBottom(target) - visibleBottom;
  if (!(scroller instanceof HTMLElement)) {
    if (overflow > 0) target.scrollIntoView({ block: "center" });
    return;
  }
  if (overflow > 0) scroller.scrollTop += overflow + 12;
  if (rect.top < 48) scroller.scrollTop -= 48 - rect.top;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function OnScreenKeyboard() {
  const [visible, setVisible] = useState(false);
  const [shift, setShift] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("osk-open", visible);
    if (!visible) {
      document.documentElement.style.removeProperty("--osk-space");
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const height = document.querySelector(".osk")?.getBoundingClientRect().height ?? 280;
      document.documentElement.style.setProperty("--osk-space", `${Math.ceil(height + 16)}px`);
      const el = document.activeElement;
      if (el instanceof HTMLElement) revealField(el);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.osk === "true") {
        setVisible(true);
        window.requestAnimationFrame(() => revealField(target));
      }
    };
    const onPointer = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.osk === "true" || target.closest(".osk")) return;
      if (target.closest("[data-keep-osk]")) return;
      setVisible(false);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  if (!visible) return null;

  const typeKey = (key: string) => {
    writeToFocused(shift ? key.toUpperCase() : key);
    setShift(false);
  };

  return (
    <div className="osk" data-testid="osk" role="group" aria-label="On-screen keyboard">
      {ROWS.map((row) => (
        <div className="osk-row" key={row}>
          {row.split("").map((key) => (
            <button
              key={key}
              type="button"
              className="osk-key"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => typeKey(key)}
            >
              {shift ? key.toUpperCase() : key}
            </button>
          ))}
        </div>
      ))}
      <div className="osk-row">
        <button type="button" className="osk-key wide" onMouseDown={(event) => event.preventDefault()} onClick={() => setShift((value) => !value)}>
          Shift
        </button>
        <button type="button" className="osk-key wide" onMouseDown={(event) => event.preventDefault()} onClick={() => typeKey(" ")}>
          Space
        </button>
        <button type="button" className="osk-key" onMouseDown={(event) => event.preventDefault()} onClick={backspaceFocused}>
          ⌫
        </button>
        <button type="button" className="osk-key wide" onMouseDown={(event) => event.preventDefault()} onClick={() => setVisible(false)}>
          Done
        </button>
      </div>
    </div>
  );
}
