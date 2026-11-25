<!--
  One line on a printer's card in the listing, while it prints and the guard
  follows its camera: the verdict and the trend above the print's own
  baseline. An idle printer's card stays as it was.
-->
<script lang="ts">
  import { heldHost } from '../host';
  import { liveFor } from '../live.svelte';

  let { deviceId }: { deviceId: string } = $props();

  const host = heldHost();
  const t = host.t;
  const live = liveFor(host);

  const watch = $derived(live.watchOf(deviceId));
  const tone = {
    warming_up: 'text-muted-foreground',
    ok: 'text-muted-foreground',
    warning: 'text-warning',
    failing: 'text-destructive',
  } as const;
</script>

{#if watch?.printing}
  <span class="text-sm {tone[watch.verdict]}">
    {t('guard.card.line', {
      verdict: t(`guard.verdict.${watch.verdict}`),
      excess: watch.excess.toFixed(2),
    })}
  </span>
{/if}
