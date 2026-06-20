import type { AppConfig } from '@/lib/types';
import { EmbedErrorDetails } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  appConfig: AppConfig;
  error: EmbedErrorDetails | null;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return (
    <div
      inert={error === null}
      className={cn(
        'absolute inset-0 z-50 flex h-full w-full flex-col items-center justify-center gap-5 transition-opacity',
        error === null ? 'opacity-0' : 'opacity-100'
      )}
    >
      <div className="flex w-full flex-col justify-center gap-4 overflow-auto px-8 text-center">
        <span className="leading-tight font-medium text-pretty">{error?.title}</span>
        <span className="text-sm text-balance">{error?.description}</span>
      </div>
    </div>
  );
}
