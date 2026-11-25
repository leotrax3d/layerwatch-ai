<!--
  The smoothed score above the print's own baseline, as a bar the colour of
  the verdict. Full width is an excess of 1, past the threshold that fails a
  print.
-->
<script lang="ts">
  import type { Watch } from './guard';
  import { heldHost } from './host';
  import { verdictBar } from './verdict';

  let { watch }: { watch: Watch } = $props();

  const t = heldHost().t;
  const shown = $derived(Math.min(1, Math.max(0, watch.excess)));
</script>

<div
  class="h-2 w-full overflow-hidden rounded-full bg-muted"
  role="meter"
  aria-label={t('guard.camera.excess')}
  aria-valuemin="0"
  aria-valuemax="1"
  aria-valuenow={shown}
>
  <div
    class="h-full rounded-full {verdictBar[watch.verdict]}"
    style="width: {shown * 100}%"
  ></div>
</div>
