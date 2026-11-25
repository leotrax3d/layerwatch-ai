<!--
  LayerWatch AI at the foot of a printer's Status tab: the verdict, the trend
  above the print's own baseline and the latest incident, with the way to the
  page. A printer the guard follows no camera of shows nothing.
-->
<script lang="ts">
  import { Badge, Card, CardContent } from '@prusa/connect-ui/primitives';

  import { heldHost } from '../host';
  import { liveFor } from '../live.svelte';
  import Meter from '../meter.svelte';
  import { verdictBadge, when } from '../verdict';

  let { deviceId }: { deviceId: string } = $props();

  const host = heldHost();
  const t = host.t;
  const live = liveFor(host);

  const watch = $derived(live.watchOf(deviceId));
  const incident = $derived(live.incidentOf(deviceId));
</script>

{#if watch}
  <Card>
    <CardContent class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          {#if watch.printing}
            <Badge variant={verdictBadge[watch.verdict]}
              >{t(`guard.verdict.${watch.verdict}`)}</Badge
            >
          {:else}
            <Badge variant="outline">{t('guard.camera.idle')}</Badge>
          {/if}
          {#if live.state.kind === 'ready'}
            <span class="text-xs text-muted-foreground"
              >{t('guard.page.summary', {
                detector: t(`guard.detector.${live.state.status.detector}`),
                action: t(`guard.action.${live.state.status.action}`),
              })}</span
            >
          {/if}
        </div>
        <a class="text-sm hover:underline" href={host.pageHref('layerwatch-ai')}
          >{t('guard.card.open')}</a
        >
      </div>

      {#if watch.printing}
        <Meter {watch} />
        <dl class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4">
          <dt class="text-muted-foreground">{t('guard.camera.score')}</dt>
          <dd class="tabular-nums">{watch.score.toFixed(2)}</dd>
          <dt class="text-muted-foreground">{t('guard.camera.excess')}</dt>
          <dd class="tabular-nums">{watch.excess.toFixed(2)}</dd>
          <dt class="text-muted-foreground">{t('guard.camera.frames')}</dt>
          <dd class="tabular-nums">{watch.frames}</dd>
          <dt class="text-muted-foreground">{t('guard.camera.last')}</dt>
          <dd>{when(watch.last)}</dd>
        </dl>
      {/if}

      {#if watch.error}
        <p class="text-sm text-destructive">{watch.error}</p>
      {/if}
      {#if incident}
        <p class="text-sm text-muted-foreground">
          {t('guard.card.incident', {
            time: when(incident.time),
            outcome: incident.outcome,
          })}
        </p>
      {/if}
    </CardContent>
  </Card>
{/if}
