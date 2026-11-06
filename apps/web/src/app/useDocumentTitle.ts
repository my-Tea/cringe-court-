import { useEffect } from 'react';

const BASE = 'CringeCourt';

/** Sets document.title as "<page> · CringeCourt" (or just the brand on the home page). */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : `${BASE}: the AI performs, humans decide`;
  }, [title]);
}
