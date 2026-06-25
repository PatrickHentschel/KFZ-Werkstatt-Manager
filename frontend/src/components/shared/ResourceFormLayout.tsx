import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUnsavedChangesPrompt } from '@/hooks/use-unsaved-changes-prompt';
import { cn } from '@/lib/utils';

interface ResourceFormLayoutProps {
  title: string;
  subtitle?: React.ReactNode;
  onCancel: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  isDirty?: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  /** Zusätzliche Buttons im Header rechts (z.B. Vorschau, Löschen). */
  headerActions?: React.ReactNode;
  /** Zusätzliche Buttons im Footer links neben Save/Cancel. */
  footerActions?: React.ReactNode;
  /** Breitenbegrenzung des Form-Bodys. Default: max-w-4xl. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Vollseiten-Form-Layout zum Ersetzen der Tabellensicht beim Anlegen/Bearbeiten.
 *
 * - Header: Back-Button + Titel + optionaler Subtitle + Header-Actions
 * - Body: scrollbare Children
 * - Footer: sticky Save/Cancel mit busy-State
 * - Dirty-Guard: integriert via useUnsavedChangesPrompt + AlertDialog
 *
 * Verbraucher liefert `isDirty` aus react-hook-form (`formState.isDirty`).
 * Der Layout selbst ist das `<form>`-Element — Submit-Button im Footer ist `type=submit`.
 */
export function ResourceFormLayout({
  title,
  subtitle,
  onCancel,
  onSubmit,
  isDirty = false,
  isSubmitting = false,
  submitLabel = 'Speichern',
  cancelLabel = 'Abbrechen',
  headerActions,
  footerActions,
  className,
  children,
}: ResourceFormLayoutProps) {
  const blocker = useUnsavedChangesPrompt(isDirty && !isSubmitting);

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col min-h-[calc(100vh-7rem)]"
      noValidate
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Zurück">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{title}</h1>
            {subtitle && (
              <div className="text-sm text-muted-foreground truncate">{subtitle}</div>
            )}
          </div>
        </div>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </div>

      {/* Body */}
      <div className={cn('flex-1 mx-auto w-full max-w-4xl space-y-6 pb-24', className)}>
        {children}
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 -mx-6 mt-6 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <div className="flex items-center gap-2">{footerActions}</div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert...' : submitLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Dirty-Guard Bestätigung */}
      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Änderungen</AlertDialogTitle>
            <AlertDialogDescription>
              Du hast noch nicht gespeicherte Eingaben. Wenn du jetzt verlässt, gehen sie verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => blocker.state === 'blocked' && blocker.reset()}
            >
              Bleiben
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => blocker.state === 'blocked' && blocker.proceed()}
            >
              Verwerfen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

interface FormSectionProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Hilfs-Container für gruppierte Felder innerhalb eines ResourceFormLayout.
 */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn('rounded-lg border bg-card p-6 space-y-4', className)}>
      <header>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
