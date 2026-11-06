import type { SideId } from '@cringe-court/core';
import { t } from '@/i18n';

/** The letter a side shows as in copy ("Side A", "Agent A"). */
export const letter = (side: SideId): string => side.toUpperCase();

/** "Agent A" / "Agent B", translated at call time. */
export const agentName = (side: SideId): string => t('versus.agent.name', { side: letter(side) });
