// src/components/ModalFormulario.tsx
// Formulario en un modal: «Aceptar» (o Intro) aplica y «Cancelar» (o Escape) descarta.
// No se cierra al pulsar fuera, para no perder lo escrito por un clic sin querer.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { btn } from './ui.ts';

interface Props {
  titulo: string;
  /** con false, «Aceptar» queda desactivado */
  valido?: boolean;
  /** texto del botón de aceptar */
  aceptar?: string;
  onAceptar(): void;
  onCancelar(): void;
  children: ComponentChildren;
}

export function ModalFormulario({ titulo, valido = true, aceptar = 'Aceptar', onAceptar, onCancelar, children }: Props) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.querySelector<HTMLElement>('input:not([type=checkbox]), select')?.focus(); }, []);

  return (
    <div class="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-5 movil:p-0" role="dialog" aria-modal="true" aria-label={titulo}
      onKeyDown={e => { if (e.key === 'Escape') onCancelar(); }}>
      {/* en móvil ocupa toda la pantalla */}
      <form ref={form} class="flex max-h-[calc(100dvh-40px)] w-[min(560px,100%)] flex-col overflow-hidden rounded-[14px] bg-paper movil:h-dvh movil:max-h-none movil:rounded-none movil:pb-[env(safe-area-inset-bottom)]"
        onSubmit={e => { e.preventDefault(); if (valido) onAceptar(); }}>
        <div class="flex items-center justify-between gap-3 bg-primary py-2.5 pr-3.5 pl-5 text-ink movil:px-3 movil:pt-[calc(10px+env(safe-area-inset-top))]">
          <span class="min-w-0 truncate font-bold">{titulo}</span>
          <div class="flex gap-2">
            <button type="button" class={btn('bar')} onClick={onCancelar}>Cancelar</button>
            <button type="submit" class={btn('white')} disabled={!valido}>{aceptar}</button>
          </div>
        </div>
        <div class="overflow-auto p-5.5 movil:p-4">{children}</div>
      </form>
    </div>
  );
}
