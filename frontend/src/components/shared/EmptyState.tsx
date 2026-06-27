import { Link } from 'react-router-dom';
import { Plus, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Teaching empty state: icon + title + optional body + optional CTA link. */
export function EmptyState({ icon: Icon, title, body, ctaLabel, ctaTo, className }: {
  icon: LucideIcon;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaTo?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 py-10 text-center', className)}>
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="max-w-[36ch] text-xs text-muted-foreground">{body}</p>}
      {ctaLabel && ctaTo && (
        <Button asChild size="sm" className="mt-2">
          <Link to={ctaTo}><Plus className="mr-1.5 h-4 w-4" />{ctaLabel}</Link>
        </Button>
      )}
    </div>
  );
}
