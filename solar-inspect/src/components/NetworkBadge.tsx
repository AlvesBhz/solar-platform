import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Status sempre com cor + ícone + texto. */
export default function NetworkBadge({ onDark = false }: { onDark?: boolean }) {
  const online = useOnline();
  const base = onDark ? 'bg-white/10 text-white' : 'bg-white text-fg-2 border border-line-1';
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${base}`}>
      <Icon
        icon={online ? 'solar:check-circle-linear' : 'solar:close-circle-linear'}
        width={16}
        className={online ? (onDark ? 'text-white' : 'text-available') : onDark ? 'text-white' : 'text-error'}
        aria-hidden="true"
      />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}
