import { BorderBeam } from '@/components/magicui/border-beam';

/**
 * The amber current running round a live card's edge — the single ambient
 * animation in the app, only ever mounted while energy is flowing. Put it as
 * the last child of a `relative` element with that `radius`.
 */
export function LiveBeam({ radius = 26 }: { radius?: number }) {
  return <BorderBeam tone="live" radius={radius} duration={5} />;
}
